// webhook.js — Simulated Meta Webhook handler
// In a real Vite project, these would be Express/Node.js routes or Vite API plugins.
// This module exports handler functions that mirror the actual webhook route logic.

const META_VERIFY_TOKEN = import.meta.env.VITE_META_VERIFY_TOKEN || 'YOUR_VERIFY_TOKEN';

/**
 * GET /api/webhook
 * Handles Meta's webhook verification handshake.
 *
 * Meta sends: hub.mode, hub.verify_token, hub.challenge
 * We must return hub.challenge as plain text with HTTP 200.
 *
 * Express route equivalent:
 *   app.get('/api/webhook', webhookVerificationHandler);
 */
export function webhookVerificationHandler(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Webhook GET] Verification request received', { mode, token });

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('[Webhook GET] ✅ Token verified — returning challenge');
    res.status(200).send(challenge);
  } else {
    console.error('[Webhook GET] ❌ Token mismatch — forbidden');
    res.status(403).send('Forbidden');
  }
}

/**
 * POST /api/webhook
 * Parses incoming status updates and messages from Meta.
 *
 * Express route equivalent:
 *   app.post('/api/webhook', webhookPostHandler);
 */
export function webhookPostHandler(req, res) {
  const body = req.body;

  console.log('[Webhook POST] Incoming payload:', JSON.stringify(body, null, 2));

  if (body.object !== 'whatsapp_business_account') {
    return res.status(400).send('Not a WhatsApp Business event');
  }

  body.entry?.forEach((entry) => {
    entry.changes?.forEach((change) => {
      const value = change.value;

      // ── Status Updates ────────────────────────────────────────────────────
      value.statuses?.forEach((status) => {
        console.log('[Webhook] Message status update:', {
          messageId: status.id,
          recipientId: status.recipient_id,
          status: status.status, // sent | delivered | read | failed
          timestamp: new Date(status.timestamp * 1000).toISOString(),
        });
      });

      // ── Incoming Messages ─────────────────────────────────────────────────
      value.messages?.forEach((message) => {
        console.log('[Webhook] Incoming message:', {
          from: message.from,
          id: message.id,
          type: message.type,
          text: message.text?.body,
          timestamp: new Date(message.timestamp * 1000).toISOString(),
        });

        // TODO: Implement reply automation logic here
        // e.g., if message.text.body === '1', send booking details
      });
    });
  });

  // Always respond 200 quickly to acknowledge receipt
  res.status(200).send('EVENT_RECEIVED');
}

/**
 * Simulated webhook event dispatcher for frontend demonstration.
 * Mimics receiving a "delivered" status update from Meta.
 */
export function simulateWebhookEvent(messageId, recipientPhone) {
  const mockPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '966XXXXXXXX',
                phone_number_id: 'PHONE_NUMBER_ID',
              },
              statuses: [
                {
                  id: messageId,
                  status: 'delivered',
                  timestamp: Math.floor(Date.now() / 1000),
                  recipient_id: recipientPhone.replace('+', ''),
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  console.group('🔔 Simulated Webhook Event (Delivered Status)');
  console.log(JSON.stringify(mockPayload, null, 2));
  console.groupEnd();

  return mockPayload;
}
