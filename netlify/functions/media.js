// netlify/functions/media.js
// Proxy for fetching WhatsApp media files securely via Meta Cloud API
// Usage: GET /api/media?id=MEDIA_ID

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const mediaId = event.queryStringParameters?.id;
  if (!mediaId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing media id parameter' }) };
  }

  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'META_ACCESS_TOKEN not configured' }) };
  }

  try {
    // Step 1: Get the download URL from Meta (try v18.0 then v21.0)
    let metaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    if (!metaRes.ok) {
      metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      });
    }

    if (!metaRes.ok) {
      const errData = await metaRes.json().catch(() => ({}));
      console.error('[Media Proxy] Failed to get media URL:', errData);
      return {
        statusCode: metaRes.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Failed to retrieve media URL from Meta', details: errData }),
      };
    }

    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;
    const mimeType = metaData.mime_type || 'application/octet-stream';

    if (!downloadUrl) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No download URL returned by Meta' }),
      };
    }

    // Step 2: Download the actual file from Meta's CDN
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    if (!fileRes.ok) {
      console.error('[Media Proxy] Failed to download media file, status:', fileRes.status);
      return {
        statusCode: fileRes.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Failed to download media file from Meta CDN' }),
      };
    }

    // Step 3: Stream binary content back to the browser
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400', // Cache for 24h
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('[Media Proxy] Error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
