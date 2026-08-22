// ── Firebase Client SDK Configuration ──────────────────────────────────────
// Supports a single JSON object in VITE_FIREBASE_KEYS or individual env vars.

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

let firebaseConfig = {};

const rawKeys = import.meta.env.VITE_FIREBASE_KEYS;
if (rawKeys) {
  try {
    firebaseConfig = typeof rawKeys === 'string' ? JSON.parse(rawKeys) : rawKeys;
  } catch (err) {
    console.error('[Firebase] Failed to parse VITE_FIREBASE_KEYS JSON:', err);
  }
} else {
  firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

