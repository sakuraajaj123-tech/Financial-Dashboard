// whatsapp.js — WhatsApp Client Module
// Can operate in simulated mode (development) or call the Netlify serverless function (/api/whatsapp/send)

/**
 * Builds the Meta Cloud API payload for a booking confirmation template message.
 */
export function buildBookingConfirmationPayload(booking, unitNumber) {
  return {
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

/**
 * Sends a WhatsApp booking confirmation.
 * In development without backend credentials, runs simulated mode.
 * On Netlify / production with credentials, calls the serverless API.
 */
export async function sendWhatsAppConfirmation(booking, unitNumber) {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking, unitNumber }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const metaMsg = errorData?.details?.error?.message || errorData?.error || `Server returned ${response.status}`;
    throw new Error(metaMsg);
  }

  return await response.json();
}

/**
 * Sends a free-text reply to a phone number within the 24h WhatsApp window.
 */
export async function sendFreeTextReply(to, text) {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'freetext', to, text }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const metaMsg = errorData?.details?.error?.message || errorData?.error || `Server returned ${response.status}`;
    throw new Error(metaMsg);
  }

  return await response.json();
}

/**
 * Sends the hello_world template (en_US) to a phone number.
 */
export async function sendHelloWorldTemplate(to) {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'hello_world', to }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const metaMsg = errorData?.details?.error?.message || errorData?.error || `Server returned ${response.status}`;
    throw new Error(metaMsg);
  }

  return await response.json();
}

/**
 * Sends the "terms" template (ar) to a phone number, injecting the variable.
 */
export async function sendTermsTemplate(to, variableValue) {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'send_terms', to, variableValue }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const metaMsg = errorData?.details?.error?.message || errorData?.error || `Server returned ${response.status}`;
    throw new Error(metaMsg);
  }

  return await response.json();
}

/**
 * Sends a media message (image or audio) to a phone number via WhatsApp.
 * Uploads the media to Meta first, then sends it as a message.
 * @param {string} to - Recipient phone number
 * @param {string} base64Media - Base64-encoded media content (no data: prefix)
 * @param {string} mimeType - MIME type (e.g. 'image/jpeg', 'audio/mp3', 'audio/ogg; codecs=opus')
 * @param {'image'|'audio'|'video'|'document'} mediaType - WhatsApp media type
 * @param {string} [caption] - Optional caption (images only)
 */
export async function sendMediaMessage(to, base64Media, mimeType, mediaType, caption) {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'media', to, base64Media, mimeType, mediaType, caption }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const metaMsg = errorData?.details?.error?.message
      || errorData?.details?.error?.error_data?.details
      || errorData?.error
      || `Server returned ${response.status}`;
    throw new Error(metaMsg);
  }

  return await response.json();
}

/**
 * Sends the "entry_reminder" template (ar) to a phone number.
 */
export async function sendEntryReminder(to, unitNumber = '1') {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'entry_reminder', to, unitNumber }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const metaMsg = errorData?.details?.error?.message || errorData?.error || `Server returned ${response.status}`;
    throw new Error(metaMsg);
  }

  return await response.json();
}

/**
 * Sends the "reminder" template (ar) to a phone number.
 */
export async function sendExitReminder(to, unitNumber = '1') {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'reminder', to, unitNumber }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const metaMsg = errorData?.details?.error?.message || errorData?.error || `Server returned ${response.status}`;
    throw new Error(metaMsg);
  }

  return await response.json();
}

/**
 * Sends a generic approved WhatsApp template to a phone number.
 * Can be used for cold chats (>24h window expired) and initiating new conversations.
 * @param {Object} params
 * @param {string} params.to - Recipient phone number
 * @param {string} params.templateName - Name of the WhatsApp template
 * @param {string} [params.language='ar'] - Template language code (e.g. 'ar', 'en_US')
 * @param {Array<string|Object>} [params.parameters] - Template body parameter values
 * @param {Array<Object>} [params.components] - Optional custom template components
 * @param {string} [params.displayName] - Friendly template title for chat history
 */
export async function sendGenericTemplate({ to, templateName, language = 'ar', parameters = [], components = null, displayName = '' }) {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'template',
      to,
      templateName,
      language,
      parameters,
      components,
      displayName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const metaMsg =
      errorData?.details?.error?.message ||
      errorData?.details?.error?.error_data?.details ||
      errorData?.error ||
      `Server returned ${response.status}`;
    throw new Error(metaMsg);
  }

  return await response.json();
}


