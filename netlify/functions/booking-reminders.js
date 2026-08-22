// netlify/functions/booking-reminders.js
// Netlify Scheduled Function - runs every 5 minutes via cron: */5 * * * *
// Also accessible via HTTP GET/POST at /api/reminders/trigger for diagnostics and manual testing.
//
// Logic condition:
//   1. Query: pending_reminders WHERE triggerTime <= NOW_ISO
//   2. Send template 'entry_reminder' or 'reminder' to all adminPhoneNumbers in settings/global_settings
//   3. Delete the processed reminder doc so it never sends duplicate messages
//   4. Auto-backfills pending_reminders if any active booking in units collection was created previously

import { schedule } from '@netlify/functions';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin initializer (lazy singleton)
function getDb() {
  const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCreds) {
    throw new Error('[booking-reminders] FIREBASE_SERVICE_ACCOUNT env var is not set.');
  }
  if (getApps().length === 0) {
    const serviceAccount =
      typeof rawCreds === 'string' ? JSON.parse(rawCreds) : rawCreds;
    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// Send one WhatsApp template message via Meta Cloud API
async function sendTemplate(to, templateName, unitNumber) {
  const PHONE_NUMBER_ID =
    process.env.META_PHONE_NUMBER_ID || process.env.VITE_META_PHONE_NUMBER_ID;
  const ACCESS_TOKEN =
    process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN;

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('[booking-reminders] Meta API credentials are not configured.');
  }

  const endpoint = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
  const cleanTo  = String(to).replace(/[^0-9]/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'ar' },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: String(unitNumber) }],
        },
      ],
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Meta API error sending "${templateName}" to ${cleanTo}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

// Fan-out template to all admin numbers via Promise.allSettled
async function fanOut(adminPhones, templateName, unitNumber) {
  if (!adminPhones || adminPhones.length === 0) {
    console.warn(`[booking-reminders] No admin phones - skipping "${templateName}" unit ${unitNumber}`);
    return [];
  }

  const results = await Promise.allSettled(
    adminPhones.map((phone) => sendTemplate(phone, templateName, unitNumber))
  );

  results.forEach((result, i) => {
    const phone = adminPhones[i];
    if (result.status === 'fulfilled') {
      console.log(`[booking-reminders] Sent "${templateName}" -> ${phone} (unit ${unitNumber})`);
    } else {
      console.error(
        `[booking-reminders] Failed "${templateName}" -> ${phone} (unit ${unitNumber}):`,
        result.reason?.message || result.reason
      );
    }
  });

  return results;
}

// Helper to backfill any existing bookings that were missing from pending_reminders
async function syncExistingBookingsIfNeeded(db) {
  try {
    const unitsSnap = await db.collection('units').get();
    const batch = db.batch();
    let backfilledCount = 0;

    for (const unitDoc of unitsSnap.docs) {
      const unit = unitDoc.data();
      const unitNumber = unit.number ?? unitDoc.id;
      const bookings = Array.isArray(unit.bookings) ? unit.bookings : [];

      for (const booking of bookings) {
        if (!booking.id || !booking.checkIn || !booking.checkOut) continue;

        const entryId = `${booking.id}_entry`;
        const exitId  = `${booking.id}_exit`;

        const entryRef = db.collection('pending_reminders').doc(entryId);
        const exitRef  = db.collection('pending_reminders').doc(exitId);

        const entrySnap = await entryRef.get();
        const exitSnap  = await exitRef.get();

        const entryOffsetMs = (Number(booking.entryReminderMinutes) || 180) * 60 * 1000;
        const exitOffsetMs  = (Number(booking.exitReminderMinutes)  || 15)  * 60 * 1000;

        const checkInMs  = Date.parse(booking.checkIn);
        const checkOutMs = Date.parse(booking.checkOut);

        if (!isNaN(checkInMs) && !entrySnap.exists) {
          const entryTrigger = new Date(checkInMs - entryOffsetMs).toISOString();
          batch.set(entryRef, {
            bookingId: booking.id,
            unitId: unitDoc.id,
            unitNumber: String(unitNumber),
            type: 'entry',
            template: 'entry_reminder',
            triggerTime: entryTrigger,
            entryReminderMinutes: Number(booking.entryReminderMinutes) || 180,
            createdAt: new Date().toISOString(),
          });
          backfilledCount++;
        }

        if (!isNaN(checkOutMs) && !exitSnap.exists) {
          const exitTrigger = new Date(checkOutMs - exitOffsetMs).toISOString();
          batch.set(exitRef, {
            bookingId: booking.id,
            unitId: unitDoc.id,
            unitNumber: String(unitNumber),
            type: 'exit',
            template: 'reminder',
            triggerTime: exitTrigger,
            exitReminderMinutes: Number(booking.exitReminderMinutes) || 15,
            createdAt: new Date().toISOString(),
          });
          backfilledCount++;
        }
      }
    }

    if (backfilledCount > 0) {
      await batch.commit();
      console.log(`[booking-reminders] Backfilled ${backfilledCount} missing reminders.`);
    }
  } catch (e) {
    console.warn('[booking-reminders] Auto-backfill non-fatal error:', e.message);
  }
}

// Core reminder runner
async function remindersHandler(event) {
  const startTime = new Date().toISOString();
  console.log('[booking-reminders] Cron / Trigger fired at', startTime);

  try {
    const db = getDb();

    // 1. Fetch admin phone numbers (1 read)
    const settingsSnap = await db
      .collection('settings')
      .doc('global_settings')
      .get();

    const adminPhones = settingsSnap.exists
      ? settingsSnap.data().adminPhoneNumbers || []
      : [];

    console.log(`[booking-reminders] Admin phones: [${adminPhones.join(', ')}]`);

    // 2. Ensure existing bookings have reminder docs (safe self-healing)
    await syncExistingBookingsIfNeeded(db);

    // 3. Query ONLY due reminders from the indexed collection
    const nowISO = new Date().toISOString();

    const dueSnap = await db
      .collection('pending_reminders')
      .where('triggerTime', '<=', nowISO)
      .get();

    // Also get all pending reminders count for diagnostic overview
    const allPendingSnap = await db.collection('pending_reminders').get();
    const allPendingList = allPendingSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      isDue: d.data().triggerTime <= nowISO,
    }));

    if (dueSnap.empty) {
      console.log(`[booking-reminders] No reminders due at ${nowISO}. Total pending: ${allPendingSnap.size}`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          nowISO,
          adminPhoneNumbers: adminPhones,
          dueCount: 0,
          totalPendingCount: allPendingSnap.size,
          pendingReminders: allPendingList,
          message: 'No reminders are due right now.',
        }),
      };
    }

    console.log(`[booking-reminders] ${dueSnap.size} reminder(s) due.`);

    // 4. Process each due reminder
    let sent = 0;
    const executionDetails = [];

    await Promise.allSettled(
      dueSnap.docs.map(async (reminderDoc) => {
        const reminder = reminderDoc.data();

        try {
          // Send the WhatsApp template to all admins
          const results = await fanOut(adminPhones, reminder.template, reminder.unitNumber);

          // Delete the reminder doc so it NEVER fires again
          await reminderDoc.ref.delete();

          console.log(
            `[booking-reminders] Reminder ${reminderDoc.id} processed and deleted.`
          );
          sent++;
          executionDetails.push({
            id: reminderDoc.id,
            status: 'sent',
            template: reminder.template,
            unitNumber: reminder.unitNumber,
            results,
          });
        } catch (err) {
          console.error(
            `[booking-reminders] Error processing reminder ${reminderDoc.id}:`,
            err.message
          );
          executionDetails.push({
            id: reminderDoc.id,
            status: 'error',
            error: err.message,
          });
        }
      })
    );

    console.log(`[booking-reminders] Done. Sent: ${sent}/${dueSnap.size}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        nowISO,
        adminPhoneNumbers: adminPhones,
        sentCount: sent,
        dueCount: dueSnap.size,
        totalPendingCount: allPendingSnap.size,
        executionDetails,
      }),
    };
  } catch (err) {
    console.error('[booking-reminders] Fatal error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}

// Export using @netlify/functions schedule wrapper
export const handler = schedule('*/5 * * * *', remindersHandler);
