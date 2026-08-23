// netlify/functions/send-whatsapp.js
// Netlify Serverless Function for securely sending WhatsApp Messages via Meta Cloud API
// Supports: (1) Template-based booking confirmations, (2) Free-text replies within 24h window, (3) Hello World, (4) Terms
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

async function saveMessage(phone, { sender, text, messageId, mediaId, mediaType, mimeType, caption, mediaUrl }) {
  try {
    const db = getDb();
    if (!db) return;
    const cleanPhone = phone.replace('+', '').trim();
    const chatRef = db.collection('chats').doc(cleanPhone);

    const updateDoc = {
      lastMessage: text?.substring(0, 100) || '',
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Whenever an admin/agent manually sends a message from the dashboard, pause bot auto-replies for 24h
    if (sender === 'admin' || !sender) {
      updateDoc.botPausedUntil = Date.now() + 24 * 60 * 60 * 1000;
    }

    await chatRef.set(updateDoc, { merge: true });

    const msgData = {
      sender: sender || 'admin',
      text: text || '',
      messageId: messageId || '',
      timestamp: FieldValue.serverTimestamp(),
      isRead: true,
      status: 'sent',
    };
    if (mediaId) msgData.mediaId = mediaId;
    if (mediaType) msgData.mediaType = mediaType;
    if (mediaUrl) msgData.mediaUrl = mediaUrl;
    if (mimeType) msgData.mimeType = mimeType;
    if (caption) msgData.caption = caption;

    await chatRef.collection('messages').add(msgData);
    console.log(`[Firestore] ✅ Saved outgoing ${sender} ${mediaType || 'text'} message for ${cleanPhone}`);
  } catch (err) {
    console.error(`[Firestore] ❌ Failed to save outgoing message:`, err.message);
  }
}

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || process.env.VITE_META_PHONE_NUMBER_ID || '1244951792043253';
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN;

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Meta credentials not configured on server' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const endpoint = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

    let payload = null;

    // ── Mode 1: Free-text reply (within 24h window) ─────────────────────────
    if (body.mode === 'freetext') {
      const { to, text } = body;

      if (!to || !text) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing "to" phone number or "text" message body' }),
        };
      }

      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      };
    }
    // ── Mode 2: Template-based booking confirmation ──────────────────────────
    else if (!body.mode || body.mode === 'booking_confirmation') {
      const { booking, unitNumber } = body;

      if (!booking || !booking.phone) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing booking or phone number' }),
        };
      }

      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: booking.phone,
        type: 'template',
        template: {
          name: 'booking_confirmation',
          language: { code: 'ar' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: booking.tenantName },
                { type: 'text', text: `Unit ${unitNumber}` },
                { type: 'text', text: booking.checkIn },
                { type: 'text', text: booking.checkOut },
                { type: 'text', text: `SAR ${booking.amount.toLocaleString()}` },
              ],
            },
          ],
        },
      };
    }
    // ── Mode 3: Hello World Template ──────────────────────────
    else if (body.mode === 'hello_world') {
      const { to } = body;

      if (!to) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing "to" phone number' }),
        };
      }

      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' }
        },
      };
    }
    // ── Mode 4: Send "terms" template ──────────────────────────────────────────
    else if (body.mode === 'send_terms') {
      const { to, variableValue } = body;

      if (!to || !variableValue) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing "to" or "variableValue"' }),
        };
      }

      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: 'terms',
          language: { code: 'ar' },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: variableValue.toString(),
                },
              ],
            },
          ],
        },
      };
    }
    // ── Mode 5: Send "entry_reminder" (Check-in Reminder) ──────────────────────
    else if (body.mode === 'entry_reminder') {
      const { to, unitNumber } = body;

      if (!to) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing "to" phone number' }),
        };
      }

      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: 'entry_reminder',
          language: { code: 'ar' },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: String(unitNumber || '1'),
                },
              ],
            },
          ],
        },
      };
    }
    // ── Mode 6: Send "reminder" (Check-out Reminder) ──────────────────────────
    else if (body.mode === 'reminder' || body.mode === 'reminder_test') {
      const { to, unitNumber } = body;

      if (!to) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing "to" phone number' }),
        };
      }

      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: 'reminder',
          language: { code: 'ar' },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: String(unitNumber || '1'),
                },
              ],
            },
          ],
        },
      };
    }
    // ── Mode 5: Send media (image / audio) ────────────────────────────────────
    else if (body.mode === 'media') {
      const { to, base64Media, mimeType, mediaType, caption } = body;

      if (!to || !base64Media || !mimeType || !mediaType) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing required fields: to, base64Media, mimeType, mediaType' }),
        };
      }

      // Step 1: Decode base64 to binary buffer
      const binaryData = Buffer.from(base64Media, 'base64');

      // Sanitize mimeType & extension for Meta WhatsApp API
      let effectiveMime = mimeType;
      let ext = 'bin';
      if (mediaType === 'audio') {
        if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
          effectiveMime = 'audio/mpeg';
          ext = 'mp3';
        } else if (mimeType.includes('ogg')) {
          effectiveMime = 'audio/ogg; codecs=opus';
          ext = 'ogg';
        } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
          effectiveMime = 'audio/mp4';
          ext = 'mp4';
        } else if (mimeType.includes('aac')) {
          effectiveMime = 'audio/aac';
          ext = 'aac';
        } else {
          // Default fallback for browser-recorded audio
          effectiveMime = 'audio/mpeg';
          ext = 'mp3';
        }
      } else if (mediaType === 'image') {
        if (mimeType.includes('png')) {
          effectiveMime = 'image/png';
          ext = 'png';
        } else {
          effectiveMime = 'image/jpeg';
          ext = 'jpg';
        }
      }

      const filename = `${mediaType}_${Date.now()}.${ext}`;

      // Step 2: Use FormData for upload to Meta Media API
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', effectiveMime);
      const fileBlob = new Blob([binaryData], { type: effectiveMime });
      formData.append('file', fileBlob, filename);

      const uploadUrl = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/media`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.id) {
        console.error('[Media Upload] ❌ Meta Media Upload Failed:', JSON.stringify(uploadData, null, 2));
        return {
          statusCode: uploadRes.status || 500,
          body: JSON.stringify({ error: 'Media upload to Meta failed', details: uploadData }),
        };
      }

      const uploadedMediaId = uploadData.id;
      console.log(`[Media Upload] ✅ Uploaded ${mediaType} to Meta successfully, media_id=${uploadedMediaId}`);

      // Step 3: Build the WhatsApp message referencing the real uploadedMediaId
      const mediaPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: mediaType,
      };

      if (mediaType === 'audio') {
        mediaPayload.audio = { id: uploadedMediaId };
      } else if (mediaType === 'image') {
        mediaPayload.image = { id: uploadedMediaId };
        if (caption) mediaPayload.image.caption = caption;
      } else if (mediaType === 'video') {
        mediaPayload.video = { id: uploadedMediaId };
        if (caption) mediaPayload.video.caption = caption;
      } else if (mediaType === 'document') {
        mediaPayload.document = { id: uploadedMediaId };
        if (caption) mediaPayload.document.filename = caption;
      }

      // Step 4: Send the message via Meta Cloud API
      const sendRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mediaPayload),
      });

      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        console.error('[Send Media Message] ❌ Meta Send Error:', JSON.stringify(sendData, null, 2));
        return {
          statusCode: sendRes.status,
          body: JSON.stringify({ error: 'Meta API error sending media message', details: sendData }),
        };
      }

      console.log('[Send Media Message] ✅ Media message sent successfully via Meta:', sendData);

      // Step 5: Persist to Firestore with valid mediaId and playable mediaUrl
      const sentMsgId = sendData?.messages?.[0]?.id || '';
      const displayText = mediaType === 'image'
        ? (caption || '📸 صورة')
        : mediaType === 'audio'
          ? '🎵 رسالة صوتية'
          : `📎 ${mediaType}`;

      await saveMessage(to, {
        sender: 'admin',
        text: displayText,
        messageId: sentMsgId,
        mediaId: uploadedMediaId,
        mediaType,
        mimeType: effectiveMime,
        caption: caption || null,
        mediaUrl: `/api/media?id=${uploadedMediaId}`,
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sendData, mediaId: uploadedMediaId, mediaUrl: `/api/media?id=${uploadedMediaId}` }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid mode specified' }),
      };
    }

    // Common fetch for all modes
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Meta API error', details: data }),
      };
    }

    // Persist outgoing message in Firestore
    const messageId = data?.messages?.[0]?.id || '';
    if (body.mode === 'freetext') {
      await saveMessage(body.to, { sender: 'admin', text: body.text, messageId });
    } else if (body.mode === 'send_terms') {
      await saveMessage(body.to, { sender: 'admin', text: `[قالب الشروط: ${body.variableValue}]`, messageId });
    } else if (body.mode === 'entry_reminder') {
      await saveMessage(body.to, { sender: 'admin', text: `[تنبيه دخول للوحدة ${body.unitNumber || '1'}]`, messageId });
    } else if (body.mode === 'reminder' || body.mode === 'reminder_test') {
      await saveMessage(body.to, { sender: 'admin', text: `[تنبيه خروج للوحدة ${body.unitNumber || '1'}]`, messageId });
    } else if (body.mode === 'booking_confirmation' || !body.mode) {
      await saveMessage(body.booking?.phone, { sender: 'admin', text: `[تأكيد حجز الوحدة ${body.unitNumber}]`, messageId });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

  } catch (err) {
    console.error('[send-whatsapp function error]:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

