// netlify/functions/booking-reminders.js
// Netlify Scheduled Function running every 5 minutes to process pending WhatsApp reminders
// Strictly follows the Zero-Cost Indexed Queue Architecture (~576 reads/day = 1.15% of Firebase Free Tier)

import { schedule } from '@netlify/functions';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';

function getDb() {
  const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCreds) return null;
  if (getApps().length === 0) {
    const serviceAccount = typeof rawCreds === 'string' ? JSON.parse(rawCreds) : rawCreds;
    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAdminFirestore();
}

async function logOutgoingReminder(db, phone, reminder, templateName, unitNumber) {
  try {
    const cleanPhone = phone.replace('+', '').trim();
    const chatRef = db.collection('chats').doc(cleanPhone);
    const textLabel = reminder.type === 'entry'
      ? `[تذكير دخول تلقائي: وحدة ${unitNumber}]`
      : `[تذكير خروج تلقائي: وحدة ${unitNumber}]`;

    await chatRef.set(
      {
        lastMessage: textLabel,
        lastMessageAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await chatRef.collection('messages').add({
      sender: 'system_reminder',
      text: textLabel,
      timestamp: FieldValue.serverTimestamp(),
      isRead: true,
      status: 'sent',
      template: templateName,
      unitNumber,
    });
  } catch (err) {
    console.error(`[Reminders] Failed to log reminder to chat for ${phone}:`, err.message);
  }
}

async function processRemindersCore(event) {
  console.log('[Reminders Cron] ⏰ Running reminder queue check at', new Date().toISOString());

  const db = getDb();
  if (!db) {
    console.error('[Reminders Cron] ❌ FIREBASE_SERVICE_ACCOUNT not configured');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Firebase Admin credentials not configured on server' }),
    };
  }

  const PHONE_NUMBER_ID =
    process.env.META_PHONE_NUMBER_ID ||
    process.env.VITE_META_PHONE_NUMBER_ID ||
    '1244951792043253';
  const ACCESS_TOKEN =
    process.env.META_ACCESS_TOKEN ||
    process.env.VITE_META_ACCESS_TOKEN;

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error('[Reminders Cron] ❌ Meta Cloud API credentials not configured');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Meta credentials not configured on server' }),
    };
  }

  try {
    const nowIso = new Date().toISOString();

    // 1. Single Indexed Query on pending_reminders (Zero-Cost strategy: only reads due documents)
    const remindersRef = db.collection('pending_reminders');
    const dueSnapshot = await remindersRef
      .where('triggerTime', '<=', nowIso)
      .limit(50)
      .get();

    if (dueSnapshot.empty) {
      console.log('[Reminders Cron] 💤 No reminders due at this time.');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'No pending reminders due',
          checkedAt: nowIso,
          processed: 0,
        }),
      };
    }

    console.log(`[Reminders Cron] 📬 Found ${dueSnapshot.docs.length} due reminder(s) to process.`);

    // 2. Fetch admin phone numbers from settings/global_settings
    const settingsDoc = await db.collection('settings').doc('global_settings').get();
    let adminPhones = [];
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      if (Array.isArray(data.adminPhones)) {
        adminPhones = data.adminPhones.filter(Boolean);
      }
    }

    if (adminPhones.length === 0) {
      console.warn('[Reminders Cron] ⚠️ No admin phone numbers configured in settings/global_settings.');
    }

    const endpoint = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    let sentCount = 0;
    let failedCount = 0;

    const batch = db.batch();

    // 3. Process each due reminder
    for (const docSnap of dueSnapshot.docs) {
      const reminder = docSnap.data();
      const unitNumber = String(reminder.unitNumber || '1');
      const templateName = reminder.template || (reminder.type === 'entry' ? 'entry_reminder' : 'reminder');

      console.log(`[Reminders Cron] 🚀 Sending ${templateName} for Unit ${unitNumber} (Booking: ${reminder.bookingId})`);

      for (const phone of adminPhones) {
        const cleanPhone = phone.replace('+', '').trim();
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'ar' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: unitNumber },
                ],
              },
            ],
          },
        };

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const resData = await res.json();
          if (res.ok) {
            sentCount++;
            console.log(`[Reminders Cron] ✅ Sent ${templateName} to ${cleanPhone}`);
            await logOutgoingReminder(db, cleanPhone, reminder, templateName, unitNumber);
          } else {
            failedCount++;
            console.error(`[Reminders Cron] ❌ Failed to send to ${cleanPhone}:`, JSON.stringify(resData));
          }
        } catch (netErr) {
          failedCount++;
          console.error(`[Reminders Cron] ❌ Network error sending to ${cleanPhone}:`, netErr.message);
        }
      }

      // 4. Delete processed reminder so it never fires again
      batch.delete(docSnap.ref);
    }

    // Commit deletion batch
    await batch.commit();
    console.log(`[Reminders Cron] 🧹 Successfully deleted ${dueSnapshot.docs.length} processed reminder document(s).`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Reminders processed successfully',
        checkedAt: nowIso,
        remindersProcessed: dueSnapshot.docs.length,
        messagesSent: sentCount,
        messagesFailed: failedCount,
        adminRecipients: adminPhones.length,
      }),
    };
  } catch (err) {
    console.error('[Reminders Cron] 💥 Unhandled error processing reminders:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
}

// Standard handler compatible with both Netlify Cron (configured via netlify.toml schedule) and direct HTTP POST triggers
export async function handler(event, context) {
  return await processRemindersCore(event, context);
}
