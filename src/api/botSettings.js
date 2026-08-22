// src/api/botSettings.js
// Client API for retrieving and updating dynamic WhatsApp bot menu settings

export async function fetchBotMenuSettings() {
  const response = await fetch('/api/bot-settings', {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }
  return response.json();
}

export async function saveBotMenuSettings(settings) {
  const response = await fetch('/api/bot-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }
  return response.json();
}
