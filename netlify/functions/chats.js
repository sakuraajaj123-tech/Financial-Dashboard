// netlify/functions/chats.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';

let db;
function getFirestore() {
  if (db) return db;

  const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCreds) {
    console.warn('[Firestore] ⚠️ FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
    return null;
  }

  if (getApps().length === 0) {
    try {
      const serviceAccount = typeof rawCreds === 'string' ? JSON.parse(rawCreds) : rawCreds;
      if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('[Firestore] ✅ Firebase Admin SDK initialized successfully.');
    } catch (err) {
      console.error('[Firestore] ❌ Error initializing Firebase Admin:', err.message);
      return null;
    }
  }

  db = getAdminFirestore();
  return db;
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  };

  // Handle CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const firestore = getFirestore();
    if (!firestore) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Firestore not configured. Missing FIREBASE_SERVICE_ACCOUNT.' }),
      };
    }

    // ── POST: Mark chat messages as read ────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { phone, action } = body;

      if (!phone || action !== 'mark_read') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing phone or invalid action' }),
        };
      }

      const cleanPhone = phone.replace('+', '').trim();
      const chatRef = firestore.collection('chats').doc(cleanPhone);
      const messagesRef = chatRef.collection('messages');

      const messagesSnapshot = await messagesRef.where('sender', '==', 'user').get();
      if (!messagesSnapshot.empty) {
        const batch = firestore.batch();
        let updatedCount = 0;
        messagesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.isRead !== true || data.status !== 'read') {
            batch.update(doc.ref, { isRead: true, status: 'read' });
            updatedCount++;
          }
        });
        if (updatedCount > 0) {
          await batch.commit();
        }
      }

      console.log(`[Firestore] ✅ Marked messages as read for chat +${cleanPhone}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, action: 'mark_read', phone: cleanPhone }),
      };
    }

    // ── DELETE: Delete chat, clear messages, or delete a single message ──────
    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      const { phone, action, messageId } = body;

      if (!phone || !action) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing phone or action' }),
        };
      }

      const cleanPhone = phone.replace('+', '').trim();
      const chatRef = firestore.collection('chats').doc(cleanPhone);
      const messagesRef = chatRef.collection('messages');

      // 1. Delete single message
      if (action === 'delete_message') {
        if (!messageId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing messageId' }),
          };
        }

        // Try direct doc deletion
        await messagesRef.doc(messageId).delete();

        // Also query if any document has field `messageId` == messageId (e.g. WhatsApp wamid)
        const snap = await messagesRef.where('messageId', '==', messageId).get();
        if (!snap.empty) {
          const batch = firestore.batch();
          snap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        console.log(`[Firestore] 🗑️ Deleted message ${messageId} for chat +${cleanPhone}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, action: 'delete_message', messageId }),
        };
      }

      // 2. Clear all messages for a contact (keeps the contact doc)
      if (action === 'clear_messages') {
        const messagesSnapshot = await messagesRef.get();
        if (!messagesSnapshot.empty) {
          const batch = firestore.batch();
          messagesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }

        // Reset lastMessage on parent chat doc
        await chatRef.set(
          {
            lastMessage: '',
            lastMessageAt: null,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log(`[Firestore] 🧹 Cleared all messages for chat +${cleanPhone}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, action: 'clear_messages', phone: cleanPhone }),
        };
      }

      // 3. Delete the entire contact / chat
      if (action === 'delete_chat') {
        const messagesSnapshot = await messagesRef.get();
        if (!messagesSnapshot.empty) {
          const batch = firestore.batch();
          messagesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }

        // Delete parent chat document
        await chatRef.delete();

        console.log(`[Firestore] 🗑️ Deleted entire chat +${cleanPhone}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, action: 'delete_chat', phone: cleanPhone }),
        };
      }

      // 4. Delete a booking
      if (action === 'delete_booking') {
        const { bookingId } = body;
        if (bookingId) {
          if (cleanPhone) {
            await chatRef.collection('bookings').doc(bookingId).delete().catch(() => {});
          }
          await firestore.collection('bookings').doc(bookingId).delete().catch(() => {});
        }
        console.log(`[Firestore] 🗑️ Deleted booking ${bookingId || ''}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, action: 'delete_booking', bookingId }),
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid action "${action}"` }),
      };
    }

    // ── GET: Fetch all chats with subcollections in parallel ──────────────────
    const chatsRef = firestore.collection('chats');
    const snapshot = await chatsRef.get();
    const chatsResult = {};

    await Promise.all(
      snapshot.docs.map(async (doc) => {
        const phone = doc.id;
        const chatData = doc.data();
        const contactName = chatData.contactName || phone;
        const botPausedUntil = chatData.botPausedUntil || null;

        const messagesSnapshot = await chatsRef
          .doc(phone)
          .collection('messages')
          .orderBy('timestamp', 'asc')
          .get();

        const messages = messagesSnapshot.docs.map((msgDoc) => {
          const data = msgDoc.data();
          const mediaUrl = data.mediaUrl || (data.mediaId ? `/api/media?id=${data.mediaId}` : null);
          const isRead = data.isRead !== undefined ? data.isRead : (data.sender === 'user' ? false : true);
          const status = data.status || (data.sender === 'user' ? (isRead ? 'read' : 'unread') : 'sent');

          // Ensure timestamp is a valid UNIX timestamp in seconds (string)
          let timestampStr = Math.floor(Date.now() / 1000).toString();
          if (data.timestamp) {
            if (typeof data.timestamp.toMillis === 'function') {
              timestampStr = Math.floor(data.timestamp.toMillis() / 1000).toString();
            } else if (typeof data.timestamp._seconds === 'number') {
              timestampStr = data.timestamp._seconds.toString();
            } else if (typeof data.timestamp === 'number') {
              timestampStr = data.timestamp > 1e11
                ? Math.floor(data.timestamp / 1000).toString()
                : Math.floor(data.timestamp).toString();
            } else if (typeof data.timestamp === 'string' && !isNaN(Number(data.timestamp))) {
              timestampStr = data.timestamp;
            }
          }

          const msgObj = {
            from: data.sender === 'user' ? phone : data.sender || 'admin',
            id: data.messageId || msgDoc.id,
            timestamp: timestampStr,
            type: data.mediaType || 'text',
            mediaType: data.mediaType || undefined,
            mediaUrl: mediaUrl || undefined,
            mediaId: data.mediaId || undefined,
            status,
            isRead,
            error: data.error || undefined,
            errorDetails: data.errorDetails || undefined,
          };

          if (data.mediaType === 'image') {
            msgObj.image = { id: data.mediaId, caption: data.caption || data.text, mime_type: data.mimeType, link: mediaUrl, url: mediaUrl };
          } else if (data.mediaType === 'audio') {
            msgObj.audio = { id: data.mediaId, mime_type: data.mimeType, link: mediaUrl, url: mediaUrl };
          } else if (data.mediaType === 'video') {
            msgObj.video = { id: data.mediaId, caption: data.caption || data.text, mime_type: data.mimeType, link: mediaUrl, url: mediaUrl };
          } else if (data.mediaType === 'document') {
            msgObj.document = { id: data.mediaId, filename: data.caption || data.text, mime_type: data.mimeType, link: mediaUrl, url: mediaUrl };
          } else {
            msgObj.text = { body: data.text || '' };
          }

          const payload = {
            entry: [
              {
                changes: [
                  {
                    value: {
                      messages: [msgObj],
                    },
                  },
                ],
              },
            ],
            status,
            isRead,
            error: data.error || undefined,
            errorDetails: data.errorDetails || undefined,
          };

          return {
            id: msgDoc.id,
            timestamp: timestampStr,
            status,
            isRead,
            error: data.error || undefined,
            errorDetails: data.errorDetails || undefined,
            payload,
          };
        });

        chatsResult[phone] = {
          contactName,
          botPausedUntil,
          messages,
        };
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(chatsResult),
    };
  } catch (err) {
    console.error('Error in chats function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
