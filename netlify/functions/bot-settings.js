// netlify/functions/bot-settings.js
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

const DEFAULT_BOT_MENU = {
  welcomeMessage: "مرحباً بك في شققنا المفروشة 🏨\nيسعدنا خدمتكم! يرجى اختيار الخدمة المطلوبة من القائمة أدناه:",
  fallbackMessage: "عذراً، لم أفهم اختيارك. يرجى الاختيار من القائمة أدناه أو الضغط على 🏠 القائمة الرئيسية للبدء من جديد.",
  menuOptions: [
    {
      id: "opt_prices",
      title: "أنواع الشقق والأسعار",
      responseText: "إليك أنواع الشقق المتوفرة لدينا:\nيرجى اختيار نوع الشقة لمعرفة التفاصيل والأسعار:",
      subOptions: [
        {
          id: "opt_2rooms",
          title: "غرفتين وصالة",
          responseText: "⭕️ شقة غرفتين وصالة ⭕️\n\nشقة من غرفتين نوم وصالة ومطبخ وحمام نظيفة ومميزة جداً بتصميم فندقي 5 نجوم.\n\n♦️ السعر اليومي: 270 ريال\n♦️ الويكند: 330 ريال\n♦️ الشهري: 4000 ريال (خصم 40%)\n\n📍 الموقع: حي الوفاء خلف الحمدانية",
          subOptions: []
        },
        {
          id: "opt_lux",
          title: "استديو فاخر",
          responseText: "⭕️ استديو فاخر ⭕️\n\nاستديو مكون من غرفة كبيرة ومطبخ وحمام مؤثث تأثيث فندقي راقي.\n\n♦️ السعر اليومي: 140 ريال\n♦️ الويكند: 160 ريال\n♦️ الشهري: 2500 ريال\n\n📍 الموقع: حي الوفاء خلف الحمدانية",
          subOptions: []
        },
        {
          id: "opt_2p",
          title: "استديو لشخصين",
          responseText: "⭕️ غرفة بسرير مزدوج ⭕️\n\nغرفة بحمام تكفي شخصين مع كوفي كورنر ومكتب عمل ومدخل خاص.\n\n♦️ السعر اليومي: 120 ريال\n♦️ الويكند: 140 ريال\n♦️ الشهري: 2000 ريال\n\n📍 الموقع: حي الوفاء خلف الحمدانية",
          subOptions: []
        },
        {
          id: "opt_eco",
          title: "استديو اقتصادي",
          responseText: "⭕️ غرفة اقتصادية للعزاب ⭕️\n\nغرفة مؤثثة مع دورة مياه، بتصميم هادئ ومريح ونظافة عالية.\n\n♦️ السعر اليومي: 100 ريال\n♦️ الويكند: 120 ريال\n♦️ الشهري: 1300 ريال\n\n📍 الموقع: حي الوفاء خلف الحمدانية",
          subOptions: []
        }
      ]
    },
    {
      id: "opt_terms",
      title: "الشروط والأحكام",
      responseText: "🔺 الشروط والأحكام 🔺\n\n1- الالتزام بعدد الضيوف المحدد.\n2- الالتزام بوقت المغادرة المحدد.\n3- دفع التأمين بالتحويل ويسترد خلال 24 ساعة من المغادرة.\n4- يمنع منعاً باتاً اصطحاب الحيوانات.\n5- يمنع الحفلات والالتزام بالهدوء.\n6- عدم إتلاف أو الإضرار بمحتويات الشقة.\n7- ممنوع استخدام الشيشة والمعسل داخل الشقق.",
      subOptions: []
    },
    {
      id: "opt_support",
      title: "التحدث لخدمة العملاء",
      responseText: "سيقوم أحد ممثلي خدمة العملاء بالتواصل معك مباشرة في أقرب وقت ممكن! 👨‍💼📞",
      subOptions: []
    }
  ]
};

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
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

    const docRef = firestore.collection('settings').doc('bot_menu');

    // ── GET: Read bot menu settings ──────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            data: DEFAULT_BOT_MENU,
            isDefault: true,
          }),
        };
      }

      const data = docSnap.data();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          data: {
            welcomeMessage: data.welcomeMessage ?? DEFAULT_BOT_MENU.welcomeMessage,
            menuOptions: Array.isArray(data.menuOptions) ? data.menuOptions : DEFAULT_BOT_MENU.menuOptions,
            updatedAt: data.updatedAt ? (data.updatedAt.toMillis ? data.updatedAt.toMillis() : data.updatedAt) : null,
          },
          isDefault: false,
        }),
      };
    }

    // ── POST: Save bot menu settings ─────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { welcomeMessage, menuOptions } = body;

      if (!Array.isArray(menuOptions)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'menuOptions must be an array' }),
        };
      }

      const payloadToSave = {
        welcomeMessage: typeof welcomeMessage === 'string' ? welcomeMessage : DEFAULT_BOT_MENU.welcomeMessage,
        menuOptions,
        updatedAt: FieldValue.serverTimestamp(),
      };

      await docRef.set(payloadToSave, { merge: true });

      console.log('[BotSettings] ✅ Saved bot menu settings to Firestore (settings/bot_menu)');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Settings saved successfully',
          data: payloadToSave,
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  } catch (err) {
    console.error('[BotSettings] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
