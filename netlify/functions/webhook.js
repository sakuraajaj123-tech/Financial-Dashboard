// netlify/functions/webhook.js
// Netlify Serverless Function for Meta WhatsApp Cloud API Webhook
// Handles real-time events and Dynamic WhatsApp Interactive Auto-Reply Menu (Buttons & Lists without triggers).

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Firebase Admin SDK Initialization (singleton for cold starts) ──────────
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

// ── Default Fallback Bot Menu (if Firestore document not yet created) ───────
const DEFAULT_BOT_MENU = {
  welcomeMessage: "مرحباً بك في شققنا المفروشة 🏨\nيسعدنا خدمتكم! يرجى اختيار الخدمة المطلوبة من القائمة أدناه:",
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

// ── Read dynamic Bot Menu from Firestore (settings/bot_menu) ───────────────
async function getBotMenuSettings() {
  try {
    const firestore = getFirestore();
    if (!firestore) return DEFAULT_BOT_MENU;
    const docSnap = await firestore.collection('settings').doc('bot_menu').get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return {
        welcomeMessage: data.welcomeMessage ?? DEFAULT_BOT_MENU.welcomeMessage,
        menuOptions: Array.isArray(data.menuOptions) ? data.menuOptions : DEFAULT_BOT_MENU.menuOptions,
      };
    }
  } catch (err) {
    console.warn('[Firestore] Warning reading bot_menu, using fallback:', err.message);
  }
  return DEFAULT_BOT_MENU;
}

// ── Firestore: Save a message to chats/{phone}/messages ────────────────────
async function saveMessage(phone, { sender, text, messageId, contactName, mediaId, mediaType, mimeType, caption, mediaUrl }) {
  try {
    const firestore = getFirestore();
    if (!firestore) return;
    const cleanPhone = phone.replace('+', '').trim();
    const chatRef = firestore.collection('chats').doc(cleanPhone);

    await chatRef.set(
      {
        contactName: contactName || cleanPhone,
        lastMessage: text?.substring(0, 100) || '',
        lastMessageAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const msgData = {
      sender,       // "user" or "bot" or "admin"
      text: text || '',
      messageId: messageId || '',
      timestamp: FieldValue.serverTimestamp(),
      isRead: sender === 'user' ? false : true,
      status: sender === 'user' ? 'unread' : 'sent',
    };

    if (mediaId) msgData.mediaId = mediaId;
    if (mediaType) msgData.mediaType = mediaType;
    if (mediaUrl) msgData.mediaUrl = mediaUrl;
    if (mimeType) msgData.mimeType = mimeType;
    if (caption) msgData.caption = caption;

    await chatRef.collection('messages').add(msgData);

    console.log(`[Firestore] ✅ Saved ${sender} ${mediaType || 'text'} message for ${cleanPhone}`);
  } catch (err) {
    console.error(`[Firestore] ❌ Failed to save message for ${phone}:`, err.message);
  }
}

// ── Helper: Send a WhatsApp message via Meta Cloud API ─────────────────────
async function sendWhatsAppMessage(phoneNumberId, accessToken, to, payload) {
  const endpoint = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    ...payload,
  };

  console.log(`[Auto-Reply] Sending to ${to}:`, JSON.stringify(body, null, 2));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[Auto-Reply] ❌ Meta API error:', JSON.stringify(data, null, 2));
  } else {
    console.log('[Auto-Reply] ✅ Sent successfully:', data);
  }
  return data;
}

// ── Helper: Check if auto-replies are paused for a specific user (24h human window) ──
async function isBotPaused(phone) {
  try {
    const firestore = getFirestore();
    if (!firestore) return false;
    const cleanPhone = phone.replace('+', '').trim();
    const chatDoc = await firestore.collection('chats').doc(cleanPhone).get();
    if (!chatDoc.exists) return false;
    const data = chatDoc.data();
    if (data?.botPausedUntil) {
      const now = Date.now();
      const pausedUntil =
        typeof data.botPausedUntil === 'number'
          ? data.botPausedUntil
          : data.botPausedUntil.toMillis
          ? data.botPausedUntil.toMillis()
          : 0;

      if (now < pausedUntil) {
        console.log(`[Auto-Reply] ⏸️ Bot is paused for +${cleanPhone} until ${new Date(pausedUntil).toISOString()}`);
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('[Firestore] Error checking botPaused status:', err.message);
    return false;
  }
}

// ── Helper: Get & Set User's current position in the Menu hierarchy ────────
async function getUserMenuState(phone) {
  try {
    const firestore = getFirestore();
    if (!firestore) return null;
    const cleanPhone = phone.replace('+', '').trim();
    const chatDoc = await firestore.collection('chats').doc(cleanPhone).get();
    if (chatDoc.exists) {
      return chatDoc.data()?.menuState || null;
    }
  } catch (err) {
    console.warn('[Firestore] Error getting menuState:', err.message);
  }
  return null;
}

async function setUserMenuState(phone, menuState) {
  try {
    const firestore = getFirestore();
    if (!firestore) return;
    const cleanPhone = phone.replace('+', '').trim();
    await firestore.collection('chats').doc(cleanPhone).set(
      {
        menuState: menuState || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] Error setting menuState:', err.message);
  }
}

// ── Recursive Node Finder in Menu Tree by ID ────────────────────────────────
function findNodeById(nodes, targetId) {
  if (!targetId || !Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (node.subOptions && node.subOptions.length > 0) {
      const found = findNodeById(node.subOptions, targetId);
      if (found) return found;
    }
  }
  return null;
}

// ── 1. Interactive Message Builder ──────────────────────────────────────────
// Appends "التواصل مع خدمة العملاء" and "العودة للقائمة الرئيسية" so user always has access
function buildInteractiveMenuPayload(bodyText, rawOptions = [], isSubMenu = false, headerText = null) {
  const safeBody = (bodyText || 'يرجى اختيار أحد الخيارات أدناه:').slice(0, 1024);
  const footerText = 'اختر للمتابعة أو المساعدة'.slice(0, 60);

  // Clone options and append the two universal options if not already present
  const options = [...rawOptions];

  const hasSupport = options.some(
    (o) => o.id === 'btn_support' || o.id === 'opt_support' || (o.title && o.title.includes('خدمة العملاء'))
  );
  const hasMainMenu = options.some(
    (o) => o.id === 'btn_main_menu' || (o.title && (o.title.includes('الرئيسية') || o.title.includes('العودة')))
  );

  if (!hasSupport) {
    options.push({ id: 'btn_support', title: 'التواصل مع خدمة العملاء' });
  }
  if (isSubMenu && !hasMainMenu) {
    options.push({ id: 'btn_main_menu', title: 'العودة للقائمة الرئيسية' });
  }

  // 1. Quick Reply Buttons (1 to 3 options)
  if (options.length >= 1 && options.length <= 3) {
    const buttons = options.map((opt) => {
      // Meta WhatsApp button title max length is 20 characters
      const rawTitle = (opt.title || 'اختيار').trim();
      const title = rawTitle.slice(0, 20);
      return {
        type: 'reply',
        reply: {
          id: (opt.id || `opt_${Math.random().toString(36).slice(2)}`).slice(0, 256),
          title: title || 'اختيار',
        },
      };
    });

    const interactivePayload = {
      type: 'button',
      body: {
        text: safeBody,
      },
      footer: {
        text: footerText,
      },
      action: {
        buttons,
      },
    };

    if (headerText && headerText.trim()) {
      interactivePayload.header = {
        type: 'text',
        text: headerText.trim().slice(0, 60),
      };
    }

    return {
      type: 'interactive',
      interactive: interactivePayload,
    };
  }

  // 2. Interactive List (4 to 10 options) - with main section and navigation/support section
  if (options.length >= 4 && options.length <= 10) {
    const mainRows = [];
    const navigationRows = [];

    options.forEach((opt) => {
      const rawTitle = (opt.title || 'خيار').trim();
      const row = {
        id: (opt.id || `opt_${Math.random().toString(36).slice(2)}`).slice(0, 200),
        title: rawTitle.slice(0, 24),
      };

      if (opt.id === 'btn_support' || opt.id === 'btn_main_menu') {
        navigationRows.push(row);
      } else {
        mainRows.push(row);
      }
    });

    const sections = [];
    if (mainRows.length > 0) {
      sections.push({
        title: (headerText || (isSubMenu ? 'الخيارات المتاحة' : 'الخدمات والاستفسارات')).slice(0, 24),
        rows: mainRows,
      });
    }
    if (navigationRows.length > 0) {
      sections.push({
        title: 'المساعدة والدعم'.slice(0, 24),
        rows: navigationRows,
      });
    }

    const interactivePayload = {
      type: 'list',
      body: {
        text: safeBody,
      },
      footer: {
        text: footerText,
      },
      action: {
        button: 'قائمة الخيارات',
        sections,
      },
    };

    // Header mapped dynamically if provided, or omitted completely (never hardcoded)
    if (headerText && headerText.trim()) {
      interactivePayload.header = {
        type: 'text',
        text: headerText.trim().slice(0, 60),
      };
    }

    return {
      type: 'interactive',
      interactive: interactivePayload,
    };
  }

  // 3. Fallback: Formatted Text (when > 10 options or empty)
  let formattedText = safeBody;
  if (options.length > 0) {
    const list = options.map((opt) => `• *${opt.title || 'خيار'}*`).join('\n');
    formattedText = `${formattedText}\n\n${list}`;
  }

  return {
    type: 'text',
    text: {
      body: formattedText,
    },
  };
}

// ── Leaf Response Interactive Builder ────────────────────────────────────────
// Provides quick-reply buttons (Deduplicates Customer Service button if isCustomerService is true)
function buildLeafResponsePayload(responseText, isCustomerService = false) {
  const safeBody = (responseText || 'تمت معالجة طلبك بنجاح.').slice(0, 1024);
  const buttons = [];

  // When responding to Customer Service, omit the redundant CS button
  if (!isCustomerService) {
    buttons.push({
      type: 'reply',
      reply: {
        id: 'btn_support',
        title: 'خدمة العملاء 👨‍💼',
      },
    });
  }

  // Always provide the Main Menu return button
  buttons.push({
    type: 'reply',
    reply: {
      id: 'btn_main_menu',
      title: 'القائمة الرئيسية 🏠',
    },
  });

  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: safeBody,
      },
      footer: {
        text: isCustomerService ? 'العودة للرئيسية' : 'خيارات المتابعة والدعم',
      },
      action: {
        buttons,
      },
    },
  };
}

// ── Helper: Extract human-readable text summary for Firestore chat logs ─────
function extractBotText(payload) {
  if (!payload) return '[رسالة تلقائية]';
  if (payload.type === 'text') {
    return payload.text?.body || '';
  }
  if (payload.type === 'interactive') {
    const inter = payload.interactive;
    if (inter?.type === 'button') {
      const buttonTitles = inter.action?.buttons?.map((b) => `[${b.reply?.title || ''}]`).join(' ') || '';
      return `${inter.body?.text || ''}\n${buttonTitles}`.trim();
    }
    if (inter?.type === 'list') {
      const rows = inter.action?.sections?.[0]?.rows?.map((r) => `• ${r.title}`).join('\n') || '';
      return `${inter.body?.text || ''}\n${rows}`.trim();
    }
  }
  return '[رسالة تفاعلية]';
}

// ── Webhook Handler ─────────────────────────────────────────────────────────
export async function handler(event, context) {
  const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || process.env.VITE_META_VERIFY_TOKEN;
  const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || process.env.VITE_META_PHONE_NUMBER_ID || '1244951792043253';
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN;

  // ── 1. GET: Webhook Handshake Verification ────────────────────────────────
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    console.log('[Webhook GET] Verification request:', { mode, token });

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      console.log('[Webhook GET] ✅ Token verified successfully');
      return {
        statusCode: 200,
        body: challenge,
      };
    } else {
      console.warn('[Webhook GET] ❌ Verification failed: token mismatch');
      return {
        statusCode: 403,
        body: 'Forbidden',
      };
    }
  }

  // ── 2. POST: Handle Incoming Webhook Events ───────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body || '{}');

      // Forward to ntfy.sh for real-time dashboard inspector
      try {
        const topic = process.env.NTFY_TOPIC || 'pms_webhook_live';
        await fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          headers: {
            Title: 'WhatsApp Webhook Event',
            Priority: 'default',
            Tags: 'whatsapp,webhook',
          },
          body: JSON.stringify(data),
        });
      } catch (ntfyErr) {
        console.warn('[ntfy.sh] Failed to broadcast live event:', ntfyErr.message);
      }

      if (PHONE_NUMBER_ID && ACCESS_TOKEN) {
        if (data.object === 'whatsapp_business_account' || data.entry) {
          const entry = data.entry?.[0];
          const changes = entry?.changes?.[0]?.value;
          const contacts = changes?.contacts;

          if (changes?.messages && changes.messages.length > 0) {
            const msg = changes.messages[0];
            const senderPhone = msg.from;
            const contactName = contacts?.[0]?.profile?.name || senderPhone;

            // Check if auto-replies are paused for this user (24-hour agent takeover)
            const botPaused = await isBotPaused(senderPhone);

            // ── 2. Handle Button & List Click Callbacks + Media & Text ───────
            let incomingText = '';
            let interactiveId = null;
            let mediaId = null;
            let mediaType = null;
            let mimeType = null;
            let caption = null;
            let mediaUrl = null;

            if (msg.type === 'interactive') {
              if (msg.interactive?.type === 'button_reply') {
                interactiveId = msg.interactive.button_reply.id;
                incomingText = msg.interactive.button_reply.title || interactiveId || '';
              } else if (msg.interactive?.type === 'list_reply') {
                interactiveId = msg.interactive.list_reply.id;
                incomingText = msg.interactive.list_reply.title || interactiveId || '';
              }
            } else if (msg.type === 'button') {
              interactiveId = msg.button?.payload || msg.button?.text;
              incomingText = msg.button?.text || interactiveId || '';
            } else if (msg.type === 'text') {
              incomingText = msg.text?.body || '';
            } else if (msg.type === 'image') {
              incomingText = '📸 [صورة]';
              mediaId = msg.image?.id;
              mediaType = 'image';
              mimeType = msg.image?.mime_type;
              caption = msg.image?.caption || null;
            } else if (msg.type === 'audio') {
              incomingText = '🎵 [رسالة صوتية]';
              mediaId = msg.audio?.id;
              mediaType = 'audio';
              mimeType = msg.audio?.mime_type;
            } else if (msg.type === 'video') {
              incomingText = '🎥 [فيديو]';
              mediaId = msg.video?.id;
              mediaType = 'video';
              mimeType = msg.video?.mime_type;
              caption = msg.video?.caption || null;
            } else if (msg.type === 'document') {
              incomingText = '📄 [مستند]';
              mediaId = msg.document?.id;
              mediaType = 'document';
              mimeType = msg.document?.mime_type;
              caption = msg.document?.filename || null;
            } else if (msg.type === 'sticker') {
              incomingText = '👾 [ملصق]';
              mediaId = msg.sticker?.id;
              mediaType = 'sticker';
              mimeType = msg.sticker?.mime_type;
            } else {
              incomingText = `[${msg.type}]`;
            }

            // If mediaId is present, resolve playable URL & metadata
            if (mediaId) {
              mediaUrl = `/api/media?id=${mediaId}`;
              try {
                let metaMediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
                  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
                });
                if (!metaMediaRes.ok) {
                  metaMediaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
                    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
                  });
                }
                if (metaMediaRes.ok) {
                  const metaMediaData = await metaMediaRes.json();
                  if (metaMediaData.mime_type && !mimeType) {
                    mimeType = metaMediaData.mime_type;
                  }
                }
              } catch (mediaErr) {
                console.warn(`[Webhook] Error fetching media metadata for ${mediaId}:`, mediaErr.message);
              }
            }

            // 1. Save incoming user message to Firestore
            await saveMessage(senderPhone, {
              sender: 'user',
              text: caption || incomingText,
              messageId: msg.id,
              contactName,
              mediaId,
              mediaType,
              mimeType,
              caption,
              mediaUrl,
            });

            // 2. Process Auto-Reply (if not paused by admin)
            if (botPaused) {
              console.log(`[Auto-Reply] ⏸️ Skipped auto-reply for +${senderPhone} (24-hour agent takeover active)`);
            } else {
              // Load dynamic bot menu from Firestore
              const botSettings = await getBotMenuSettings();
              let botPayload = null;

              // Strict Menu-Driven Bot Rules:
              // 1. Interactive Only: Only advance state/menus on message.type === 'interactive' (or 'button') using payload ID
              // 2. Text Default: For all message.type === 'text' (and non-interactive messages), ignore body content and send Main Welcome Menu
              if ((msg.type === 'interactive' || msg.type === 'button') && interactiveId) {
                if (interactiveId === 'btn_support' || interactiveId === 'opt_support') {
                  // Customer Support Action (omit redundant CS button)
                  await setUserMenuState(senderPhone, null);
                  const supportText = 'سيقوم أحد ممثلي خدمة العملاء بالتواصل معك مباشرة في أقرب وقت ممكن! 👨‍💼📞';
                  botPayload = buildLeafResponsePayload(supportText, true);
                } else if (
                  interactiveId === 'btn_main_menu' ||
                  interactiveId === 'menu_main' ||
                  interactiveId === 'opt_main_menu'
                ) {
                  // Return to Main Menu
                  await setUserMenuState(senderPhone, null);
                  botPayload = buildInteractiveMenuPayload(botSettings.welcomeMessage, botSettings.menuOptions, false);
                } else {
                  // Match strictly by payload ID in menu tree
                  const matchedOption = findNodeById(botSettings.menuOptions, interactiveId);

                  if (matchedOption) {
                    const hasSub = Array.isArray(matchedOption.subOptions) && matchedOption.subOptions.length > 0;
                    if (hasSub) {
                      // Advance state to sub-menu with dynamic title as header
                      await setUserMenuState(senderPhone, matchedOption.id);
                      botPayload = buildInteractiveMenuPayload(matchedOption.responseText, matchedOption.subOptions, true, matchedOption.title);
                    } else {
                      // Leaf option: if customer service option, omit redundant CS button
                      const isCS = matchedOption.id === 'opt_support' || matchedOption.id === 'btn_support' || (matchedOption.title && matchedOption.title.includes('خدمة العملاء'));
                      await setUserMenuState(senderPhone, null);
                      botPayload = buildLeafResponsePayload(matchedOption.responseText, isCS);
                    }
                  } else {
                    // ID not found in current menu hierarchy: reset state and send Main Welcome Menu
                    await setUserMenuState(senderPhone, null);
                    botPayload = buildInteractiveMenuPayload(botSettings.welcomeMessage, botSettings.menuOptions, false);
                  }
                }
              } else {
                // message.type === 'text' or other non-interactive incoming message
                // Ignore message body content and send Main Welcome Menu
                await setUserMenuState(senderPhone, null);
                botPayload = buildInteractiveMenuPayload(botSettings.welcomeMessage, botSettings.menuOptions, false);
              }

              // Send Interactive Auto-Reply Message
              if (botPayload) {
                const result = await sendWhatsAppMessage(PHONE_NUMBER_ID, ACCESS_TOKEN, senderPhone, botPayload);
                const botSummaryText = extractBotText(botPayload);

                // Save bot reply to Firestore
                await saveMessage(senderPhone, {
                  sender: 'bot',
                  text: botSummaryText,
                  messageId: result?.messages?.[0]?.id || '',
                  contactName,
                });
              }
            }
          }
        }
      }

      return {
        statusCode: 200,
        body: 'EVENT_RECEIVED',
      };
    } catch (err) {
      console.error('[Webhook POST] Error:', err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return {
    statusCode: 405,
    body: 'Method Not Allowed',
  };
}
