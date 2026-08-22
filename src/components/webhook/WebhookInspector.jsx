import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, Wifi, WifiOff, Copy, Check, Send, Loader2, User, FileText, Trash2, Bot, Mic, ImagePlus, X, Square, Play, Pause, Download, ArrowLeft } from 'lucide-react';
import { sendFreeTextReply, sendTermsTemplate, sendMediaMessage } from '../../api/whatsapp';
import { convertBlobToMp3 } from '../../utils/audioEncoder';
import { JsonViewer } from './JsonViewer';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, startAfter, getDocs } from 'firebase/firestore';

// ── Voice Message Audio Player Component ──────────────────────────────────────
function VoiceMessagePlayer({ src, isOutgoing, mimeType }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setIsLoading(true);
      setHasError(false);
      audioRef.current.play().catch(err => {
        console.warn('Audio play error:', err);
        setHasError(true);
        setIsLoading(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      setIsLoading(false);
      setHasError(false);
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const cycleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  return (
    <div className={`p-2.5 rounded-xl border flex flex-col gap-2 min-w-[240px] max-w-[320px] ${
      isOutgoing
        ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-50'
        : 'bg-slate-900/60 border-white/10 text-slate-100'
    }`} dir="ltr">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => { setIsPlaying(true); setIsLoading(false); }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={() => { setHasError(true); setIsLoading(false); }}
      />

      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md shrink-0 ${
            isOutgoing
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              : 'bg-indigo-500 hover:bg-indigo-400 text-white'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Scrubber & Timeline */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="relative w-full flex items-center h-3">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              disabled={duration === 0}
              className="w-full h-1.5 bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-emerald-400 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '0:00'}</span>
          </div>
        </div>

        {/* Speed Toggle */}
        <button
          type="button"
          onClick={cycleSpeed}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors text-slate-300 shrink-0"
          title="Playback speed"
        >
          {playbackRate}x
        </button>

        {/* Download */}
        <a
          href={src}
          download="voice-message.ogg"
          target="_blank"
          rel="noreferrer"
          className="text-slate-400 hover:text-slate-200 transition-colors shrink-0 p-1"
          title="Download audio"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </div>

      {hasError && (
        <div className="text-[10px] text-rose-400 flex items-center justify-between bg-rose-500/10 px-2 py-1 rounded">
          <span>تعذر تشغيل الصوت</span>
          <a href={src} target="_blank" rel="noreferrer" className="underline ml-2">فتح مباشرة</a>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const getWebhookTopic = () => {
  return localStorage.getItem('pms_webhook_topic') || 'pms_webhook_live';
};

// Determine if a payload is an incoming user message (not a bot/status event)
function getMessageDirection(payload) {
  const changes = payload?.entry?.[0]?.changes?.[0]?.value;
  if (!changes?.messages?.length) return null; // status update, not a message
  const msg = changes.messages[0];
  // Bot and admin messages are outgoing
  if (msg.from === 'bot' || msg.from === 'admin') return 'outgoing';
  return 'incoming';
}

function extractMessageText(payload) {
  const changes = payload?.entry?.[0]?.changes?.[0]?.value;
  if (!changes?.messages?.length) return null;
  const msg = changes.messages[0];
  if (msg.type === 'text') return msg.text?.body || '';
  if (msg.type === 'interactive' && msg.interactive?.type === 'list_reply')
    return msg.interactive.list_reply.title;
  if (msg.type === 'image') return msg.image?.caption || '📸 صورة';
  if (msg.type === 'audio') return '🎵 رسالة صوتية';
  if (msg.type === 'video') return msg.video?.caption || '🎥 فيديو';
  if (msg.type === 'document') return `📄 ${msg.document?.filename || 'مستند'}`;
  return null;
}

function getMsgMetaId(event) {
  return event?.payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || null;
}

function isSameMessage(a, b) {
  if (!a || !b) return false;
  // 1. Direct ID match
  if (a.id && b.id && a.id === b.id) return true;

  // 2. Meta WhatsApp message ID match (e.g. wamid.HBgM...)
  const metaA = getMsgMetaId(a);
  const metaB = getMsgMetaId(b);
  if (metaA && metaB && metaA === metaB) return true;
  if (metaA && b.id && metaA === b.id) return true;
  if (metaB && a.id && metaB === a.id) return true;

  // 3. Fallback heuristic: same direction + same content + timestamps within 5 seconds
  const dirA = getMessageDirection(a.payload);
  const dirB = getMessageDirection(b.payload);
  if (dirA === dirB && dirA !== null) {
    const textA = extractMessageText(a.payload);
    const textB = extractMessageText(b.payload);
    const timeA = parseInt(a.timestamp || 0);
    const timeB = parseInt(b.timestamp || 0);
    if (textA !== null && textB !== null && textA === textB && Math.abs(timeA - timeB) <= 5) {
      return true;
    }
  }

  return false;
}

// ── Transform a Firestore message doc into the event shape MessageBubble expects ─
function transformFirestoreMessage(doc, phone) {
  const data = doc.data();
  const docId = doc.id;

  const mediaUrl = data.mediaUrl || (data.mediaId ? `/api/media?id=${data.mediaId}` : null);
  const isRead = data.isRead !== undefined ? data.isRead : (data.sender === 'user' ? false : true);
  const status = data.status || (data.sender === 'user' ? (isRead ? 'read' : 'unread') : 'sent');

  // Normalise Firestore timestamps → UNIX-seconds string
  let timestampStr = Math.floor(Date.now() / 1000).toString();
  if (data.timestamp) {
    if (typeof data.timestamp.toMillis === 'function') {
      // Client SDK Timestamp object
      timestampStr = Math.floor(data.timestamp.toMillis() / 1000).toString();
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
    id: data.messageId || docId,
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

  return {
    id: docId,
    timestamp: timestampStr,
    status,
    isRead,
    error: data.error || undefined,
    errorDetails: data.errorDetails || undefined,
    payload: {
      entry: [{ changes: [{ value: { messages: [msgObj] } }] }],
      status,
      isRead,
      error: data.error || undefined,
      errorDetails: data.errorDetails || undefined,
    },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SendTermsPanel({ onSendSuccess }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [variable, setVariable] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = async () => {
    if (!phone.trim() || !variable.trim() || status === 'sending') return;
    const targetPhone = phone.trim();
    const varVal = variable.trim();
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await sendTermsTemplate(targetPhone, varVal);
      setStatus('sent');
      if (onSendSuccess) {
        onSendSuccess(targetPhone, `[قالب الشروط: ${varVal}]`, res?.messages?.[0]?.id);
      }
      setTimeout(() => setStatus('idle'), 3000);
      setPhone('');
      setVariable('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to send template');
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 shadow-xl flex-shrink-0 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-indigo-400" />
        <h3 className="font-bold text-slate-200">إرسال قالب "الشروط" (Terms Template)</h3>
      </div>
      {status === 'error' && (
        <div className="mb-3 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-400 font-medium">
          {errorMsg}
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-end gap-3">
        <div className="flex-1 w-full">
          <label className="block text-xs text-slate-400 mb-1">رقم الهاتف (مع رمز الدولة، بدون +)</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="مثال: 966500000000"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 outline-none transition-colors"
            dir="ltr"
          />
        </div>
        <div className="w-full sm:w-32">
          <label className="block text-xs text-slate-400 mb-1">الرقم (1 إلى 10)</label>
          <input
            type="number"
            min="1"
            max="10"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            placeholder="مثال: 4"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 outline-none transition-colors text-center"
            dir="ltr"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!phone.trim() || !variable.trim() || status === 'sending'}
          className="w-full sm:w-auto px-6 py-2 h-[38px] bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shrink-0"
        >
          {status === 'sending' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : status === 'sent' ? (
            <><Check className="w-4 h-4" /> تم الإرسال</>
          ) : (
            <><Send className="w-4 h-4" /> إرسال القالب</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Image compression utility ────────────────────────────────────────────────
function compressImage(file, maxDim = 1080, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Helper: pick best audio MIME type for MediaRecorder ──────────────────────
function getAudioMimeType() {
  // Prefer ogg/opus for native WhatsApp voice note rendering
  const preferred = [
    'audio/ogg; codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/webm; codecs=opus',
    'audio/webm',
  ];
  for (const mime of preferred) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return ''; // let browser pick default
}

function ReplyBox({ to, onSendSuccess }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Image preview state ─────────────────────────────────
  const [imagePreview, setImagePreview] = useState(null); // { file, dataUrl, base64, mimeType }
  const [caption, setCaption] = useState('');

  // ── Voice recording state ───────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);

  // ── Send text message ───────────────────────────────────
  const handleSend = () => {
    if (!text.trim() || status === 'sending') return;
    const msgText = text.trim();

    // 1. Clear input immediately so user can keep typing
    setText('');
    setErrorMsg('');

    // 2. Inject optimistic placeholder into chat thread instantly
    const tempId = onSendSuccess ? onSendSuccess(to, msgText, null, null, 'optimistic') : null;

    // 3. Fire API in background — don't block the UI
    setStatus('sending');
    sendFreeTextReply(to, msgText)
      .then(res => {
        setStatus('sent');
        // Replace the optimistic placeholder with the real confirmed message
        if (onSendSuccess && tempId) {
          onSendSuccess(to, msgText, res?.messages?.[0]?.id, null, 'confirm', tempId);
        }
        setTimeout(() => setStatus('idle'), 3000);
      })
      .catch(err => {
        setStatus('error');
        setErrorMsg(err.message || 'Failed to send');
        // Mark the optimistic message as failed
        if (onSendSuccess && tempId) {
          onSendSuccess(to, msgText, null, null, 'fail', tempId);
        }
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Image selection + compression ───────────────────────
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { base64, mimeType } = await compressImage(file);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      setImagePreview({ file, dataUrl, base64, mimeType });
      setCaption('');
    } catch (err) {
      console.error('Image compression failed:', err);
      setErrorMsg('فشل ضغط الصورة');
    }
    // Reset file input so the same file can be re-selected
    e.target.value = '';
  };

  const handleCancelImage = () => {
    setImagePreview(null);
    setCaption('');
  };

  const handleSendImage = () => {
    if (!imagePreview || status === 'sending') return;
    setErrorMsg('');

    // 1. Capture snapshot and clear preview immediately
    const { base64, mimeType, dataUrl } = imagePreview;
    const captionText = caption;
    setImagePreview(null);
    setCaption('');

    // 2. Inject optimistic placeholder with local dataUrl so image appears instantly
    const optimisticMedia = {
      mediaType: 'image',
      mimeType,
      caption: captionText || null,
      localObjectUrl: dataUrl, // show local preview while uploading
    };
    const tempId = onSendSuccess
      ? onSendSuccess(to, captionText || '📸 صورة', null, optimisticMedia, 'optimistic')
      : null;

    // 3. Send in background
    setStatus('sending');
    sendMediaMessage(to, base64, mimeType, 'image', captionText || undefined)
      .then(res => {
        setStatus('sent');
        if (onSendSuccess && tempId) {
          onSendSuccess(to, captionText || '📸 صورة', res?.messages?.[0]?.id, {
            mediaType: 'image',
            mediaId: res?.mediaId,
            mimeType,
            caption: captionText || null,
          }, 'confirm', tempId);
        }
        setTimeout(() => setStatus('idle'), 3000);
      })
      .catch(err => {
        setStatus('error');
        setErrorMsg(err.message || 'فشل إرسال الصورة');
        if (onSendSuccess && tempId) {
          onSendSuccess(to, captionText || '📸 صورة', null, null, 'fail', tempId);
        }
      });
  };

  // ── Voice recording (push-to-talk) ──────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = getAudioMimeType();
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(recordingTimerRef.current);
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const rawBlob = new Blob(audioChunksRef.current, { type: actualMime });
        audioChunksRef.current = [];

        if (rawBlob.size < 500) {
          // Too short — ignore
          setIsRecording(false);
          setRecordingDuration(0);
          return;
        }

        setIsRecording(false);
        setRecordingDuration(0);
        setErrorMsg('');

        // 1. Create a temporary object URL so the audio player works immediately
        const localObjectUrl = URL.createObjectURL(rawBlob);
        const optimisticMedia = {
          mediaType: 'audio',
          mimeType: 'audio/mp3',
          localObjectUrl,
        };
        const tempId = onSendSuccess
          ? onSendSuccess(to, '🎵 رسالة صوتية', null, optimisticMedia, 'optimistic')
          : null;

        // 2. Convert + upload in background
        setStatus('sending');
        convertBlobToMp3(rawBlob)
          .then(mp3Blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(mp3Blob);
          }))
          .then(base64 => sendMediaMessage(to, base64, 'audio/mp3', 'audio'))
          .then(res => {
            setStatus('sent');
            const uploadedId = res?.mediaId;
            if (onSendSuccess && tempId) {
              onSendSuccess(to, '🎵 رسالة صوتية', res?.messages?.[0]?.id, {
                mediaType: 'audio',
                mediaId: uploadedId,
                mediaUrl: res?.mediaUrl || (uploadedId ? `/api/media?id=${uploadedId}` : null),
                mimeType: 'audio/mp3',
              }, 'confirm', tempId);
            }
            setTimeout(() => setStatus('idle'), 3000);
          })
          .catch(err => {
            console.error('Error sending audio message:', err);
            setStatus('error');
            setErrorMsg(err.message || 'فشل إرسال التسجيل الصوتي');
            if (onSendSuccess && tempId) {
              onSendSuccess(to, '🎵 رسالة صوتية', null, null, 'fail', tempId);
            }
          });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setErrorMsg('لا يمكن الوصول إلى الميكروفون');
      setStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ── Image preview overlay ───────────────────────────────
  if (imagePreview) {
    return (
      <div className="bg-[#1f2c34] border-t border-slate-700/50 p-3 flex-shrink-0">
        {status === 'error' && (
          <div className="mb-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-400 font-medium">
            {errorMsg}
          </div>
        )}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900/60 mb-2">
          <img
            src={imagePreview.dataUrl}
            alt="Preview"
            className="max-h-48 w-full object-contain bg-slate-950/50"
          />
          <button
            onClick={handleCancelImage}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-end gap-2">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="إضافة تعليق... (اختياري)"
            className="flex-1 bg-[#2a3942] border-0 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendImage(); } }}
            dir="auto"
          />
          <button
            onClick={handleSendImage}
            disabled={status === 'sending'}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center transition-all shadow-md"
          >
            {status === 'sending' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-4 h-4 ml-0.5 rtl:-scale-x-100" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Recording overlay ───────────────────────────────────
  if (isRecording) {
    return (
      <div className="bg-[#1f2c34] border-t border-slate-700/50 p-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Cancel button */}
          <button
            onClick={cancelRecording}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-all"
            title="إلغاء"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Recording indicator */}
          <div className="flex-1 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-sm text-slate-200 font-mono tracking-wider">
              {formatDuration(recordingDuration)}
            </span>
            <span className="text-xs text-rose-400 animate-pulse">جارٍ التسجيل...</span>
          </div>

          {/* Stop / Send button */}
          <button
            onClick={stopRecording}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-md"
            title="إيقاف و إرسال"
          >
            <Send className="w-4 h-4 ml-0.5 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    );
  }

  // ── Default text input ──────────────────────────────────
  return (
    <div className="bg-[#1f2c34] border-t border-slate-700/50 p-3 flex-shrink-0">
      {status === 'error' && (
        <div className="mb-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-400 font-medium">
          {errorMsg}
        </div>
      )}
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <div className="flex items-end gap-2">
        {/* Image picker button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'sending'}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-[#2a3942] hover:bg-[#35464f] disabled:opacity-40 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all"
          title="إرسال صورة"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('webhook.typePlaceholder')}
          disabled={status === 'sending'}
          className="flex-1 bg-[#2a3942] border-0 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all disabled:opacity-50 min-h-[44px] max-h-32"
          style={{ height: 'auto' }}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
        />

        {/* If there's text, show Send; otherwise show Mic */}
        {text.trim() ? (
          <button
            onClick={handleSend}
            disabled={status === 'sending'}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center transition-all shadow-md rtl:-scale-x-100"
          >
            {status === 'sending' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status === 'sent' ? (
              <Check className="w-5 h-5" />
            ) : (
              <Send className="w-4 h-4 ml-0.5" />
            )}
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={status === 'sending'}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center transition-all shadow-md"
            title="تسجيل رسالة صوتية"
          >
            {status === 'sending' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status === 'sent' ? (
              <Check className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const num = typeof ts === 'number' ? ts : parseInt(ts, 10);
  if (isNaN(num) || num <= 0) return '';
  const date = new Date(num > 1e11 ? num : num * 1000);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── MessageBubble with WhatsApp-style alignment ──────────────────────────────
function MessageBubble({ event, onDelete }) {
  const { t } = useTranslation();
  const payload = event.payload;

  const isMessage = payload?.entry?.[0]?.changes?.[0]?.value?.messages;

  const time = formatTimestamp(event.timestamp);

  if (isMessage) {
    const msg = isMessage[0];
    const msgType = msg.type || msg.mediaType || 'unknown';
    const direction = getMessageDirection(payload);
    const isOutgoing = direction === 'outgoing' || msg.from === 'bot' || msg.from === 'admin';

    const mediaId = msg.mediaId || msg.image?.id || msg.audio?.id || msg.video?.id || msg.document?.id || msg.sticker?.id;
    const mediaUrl = msg.mediaUrl || (mediaId ? `/api/media?id=${mediaId}` : (msg.image?.link || msg.image?.url || msg.audio?.link || msg.audio?.url || msg.video?.link || msg.video?.url || null));

    return (
      <div className={`flex mb-2 group/msg relative w-full ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        {/* Avatar for incoming (on the left) */}
        {!isOutgoing && (
          <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0 mr-2 self-end mb-1">
            <User className="w-3.5 h-3.5 text-indigo-300" />
          </div>
        )}

        <div className={`max-w-[75%] flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
          {/* Bubble */}
          <div className={`relative px-3.5 py-2 rounded-2xl shadow-sm text-sm ${
            isOutgoing
              ? 'bg-[#005c4b] text-slate-100 rounded-br-sm'
              : 'bg-[#202c33] text-slate-100 rounded-bl-sm border border-white/5'
          }`}>
            {isOutgoing && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300/80 font-medium mb-1" dir="ltr">
                <Bot className="w-2.5 h-2.5" />
                {msg.from === 'admin' ? 'Admin' : 'Auto-reply'}
              </span>
            )}

            {/* Media: Image */}
            {msgType === 'image' && (
              <div className="mb-1">
                {mediaUrl ? (
                  <a href={mediaUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-slate-900/50">
                    <img
                      src={mediaUrl}
                      alt={msg.image?.caption || 'Image'}
                      className="max-w-[260px] max-h-[300px] object-cover rounded-xl hover:opacity-95 transition-opacity"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg text-xs text-slate-300">
                    📸 صورة
                  </div>
                )}
                {msg.image?.caption && (
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed break-words text-sm" dir="auto">
                    {msg.image.caption}
                  </p>
                )}
              </div>
            )}

            {/* Media: Audio */}
            {(msgType === 'audio' || msg.mediaType === 'audio') && (
              <div className="my-1">
                {mediaUrl ? (
                  <VoiceMessagePlayer
                    src={mediaUrl}
                    isOutgoing={isOutgoing}
                    mimeType={msg.audio?.mime_type || msg.mimeType}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg text-xs text-slate-300">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span>🎵 رسالة صوتية</span>
                  </div>
                )}
              </div>
            )}

            {/* Media: Video */}
            {msgType === 'video' && (
              <div className="mb-1">
                {mediaUrl ? (
                  <video
                    controls
                    className="max-w-[260px] max-h-[260px] rounded-xl bg-black"
                    src={mediaUrl}
                    preload="metadata"
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg text-xs text-slate-300">
                    🎥 فيديو
                  </div>
                )}
                {msg.video?.caption && (
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed break-words text-sm" dir="auto">
                    {msg.video.caption}
                  </p>
                )}
              </div>
            )}

            {/* Media: Document */}
            {msgType === 'document' && (
              <div className="my-1">
                {mediaUrl ? (
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="flex items-center gap-2.5 p-2.5 bg-slate-900/60 hover:bg-slate-900 rounded-xl transition-colors text-xs text-slate-200"
                  >
                    <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span className="truncate max-w-[180px] font-medium">
                      {msg.document?.filename || 'تحميل المستند'}
                    </span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg text-xs text-slate-300">
                    📄 مستند
                  </div>
                )}
              </div>
            )}

            {/* Media: Sticker */}
            {msgType === 'sticker' && (
              <div className="my-1">
                {mediaUrl ? (
                  <img src={mediaUrl} alt="Sticker" className="w-28 h-28 object-contain" />
                ) : (
                  <span className="text-xl">👾</span>
                )}
              </div>
            )}

            {/* Text or Interactive List Reply */}
            {msgType === 'text' && (
              <p className="whitespace-pre-wrap leading-relaxed break-words text-sm" dir="auto">
                {msg.text?.body || ''}
              </p>
            )}

            {msgType === 'interactive' && msg.interactive?.type === 'list_reply' && (
              <p className="whitespace-pre-wrap leading-relaxed break-words text-sm font-medium text-emerald-300" dir="auto">
                ↩ {msg.interactive.list_reply.title}
              </p>
            )}

            {/* Fallback for other types */}
            {!['image', 'audio', 'video', 'document', 'sticker', 'text', 'interactive'].includes(msgType) && (
              <p className="whitespace-pre-wrap leading-relaxed break-words text-sm" dir="auto">
                📎 {msgType}
              </p>
            )}

            <div className={`flex items-center gap-1 mt-1 ${isOutgoing ? 'justify-end' : 'justify-start'}`} dir="ltr">
              <span className="text-[10px] text-slate-400">{time}</span>
              {isOutgoing && (
                event._optimistic === 'sending' ? (
                  <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                ) : event._optimistic === 'failed' ? (
                  <span className="text-[9px] text-rose-400 font-semibold">!</span>
                ) : (
                  <Check className="w-3 h-3 text-emerald-400" />
                )
              )}
            </div>
          </div>

          {/* Raw payload toggle */}
          <details className="mt-0.5 max-w-full group">
            <summary className="text-[10px] font-semibold text-slate-600 hover:text-slate-400 cursor-pointer select-none flex items-center gap-1 transition-colors px-1" dir="ltr">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              {t('webhook.viewRaw')}
            </summary>
            <div className="mt-1 bg-slate-950/80 border border-slate-800 rounded-lg p-2 overflow-hidden max-w-[280px]" dir="ltr">
              <JsonViewer data={payload} />
            </div>
          </details>
        </div>

        {/* Avatar for outgoing (on the right) */}
        {isOutgoing && (
          <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center flex-shrink-0 ml-2 self-end mb-1">
            <Bot className="w-3.5 h-3.5 text-emerald-300" />
          </div>
        )}

        {/* Delete on hover */}
        {onDelete && (
          <button
            onClick={onDelete}
            title="Delete message"
            className={`absolute top-0 opacity-0 group-hover/msg:opacity-100 p-1.5 bg-slate-800/80 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-full transition-all z-10 ${
              isOutgoing ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'
            }`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WebhookInspector() {
  const { t } = useTranslation();

  // Initial load without caching
  const [chats, setChats] = useState({});

  const [activePhone, setActivePhone] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevActivePhoneRef = useRef(activePhone);
  const prevMessagesLengthRef = useRef(0);
  const activePhoneRef = useRef(activePhone);
  const notifiedIdsRef = useRef(new Set());

  // ── Pagination State & Refs ──────────────────────────────────────────────────
  // Chat Sidebar Pagination
  const [chatsLimit, setChatsLimit] = useState(20);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);

  // Message History Pagination
  const [historicalMessages, setHistoricalMessages] = useState({}); // { [phone]: Message[] }
  const [hasMoreMessages, setHasMoreMessages] = useState({});       // { [phone]: boolean }
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const oldestMsgDocRef = useRef({});                                // { [phone]: DocumentSnapshot }
  const isFetchingOlderRef = useRef(false);
  const isPrependingHistoryRef = useRef(false);                      // blocks auto-scroll during pagination
  const prevNewestMsgIdRef = useRef(null);

  const topic = getWebhookTopic();
  const netlifyBaseUrl = window.location.origin;
  const webhookUrl = `${netlifyBaseUrl}/api/webhook?topic=${topic}`;

  const activeChat = activePhone ? chats[activePhone] : null;
  const activeHistorical = activePhone ? (historicalMessages[activePhone] || []) : [];
  const activeRealtime = activeChat?.messages || [];

  // Merge historical older messages + real-time 50 newest messages
  const activeMessages = useMemo(() => {
    if (!activePhone) return [];
    const map = new Map();
    // 1. Add historical older messages
    activeHistorical.forEach(m => map.set(m.id, m));
    // 2. Add real-time recent messages (overwrites matching IDs with confirmed data)
    activeRealtime.forEach(m => map.set(m.id, m));

    // 3. Sort chronologically (ascending)
    return Array.from(map.values()).sort(
      (a, b) => parseInt(a.timestamp || 0) - parseInt(b.timestamp || 0)
    );
  }, [activePhone, activeHistorical, activeRealtime]);

  const activeMessagesLength = activeMessages.length;

  // ── Load More Handlers ──────────────────────────────────────────────────────
  const handleLoadMoreChats = useCallback(() => {
    if (!hasMoreChats || isLoadingMoreChats) return;
    setIsLoadingMoreChats(true);
    setChatsLimit(prev => prev + 20);
  }, [hasMoreChats, isLoadingMoreChats]);

  const handleLoadOlderMessages = useCallback(async (phone) => {
    if (!phone || isLoadingOlder || isFetchingOlderRef.current) return;
    if (hasMoreMessages[phone] === false) return;
    const oldestDoc = oldestMsgDocRef.current[phone];
    if (!oldestDoc) return;

    isFetchingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const olderQuery = query(
        collection(db, 'chats', phone, 'messages'),
        orderBy('timestamp', 'desc'),
        startAfter(oldestDoc),
        limit(50)
      );
      const olderSnap = await getDocs(olderQuery);

      if (olderSnap.empty || olderSnap.docs.length < 50) {
        setHasMoreMessages(prev => ({ ...prev, [phone]: false }));
      }

      if (!olderSnap.empty) {
        oldestMsgDocRef.current[phone] = olderSnap.docs[olderSnap.docs.length - 1];
        const olderMsgs = olderSnap.docs.map(doc => transformFirestoreMessage(doc, phone));

        // 1. Capture exact DOM scroll dimensions IMMEDIATELY before prepending state update
        const container = scrollContainerRef.current;
        const prevScrollHeight = container ? container.scrollHeight : 0;
        const prevScrollTop = container ? container.scrollTop : 0;

        // 2. Set flag to block auto-scroll effect from triggering on this render
        isPrependingHistoryRef.current = true;

        // 3. Prepend older messages to state
        setHistoricalMessages(prev => {
          const existing = prev[phone] || [];
          const newUnique = olderMsgs.filter(om => !existing.some(em => isSameMessage(em, om)));
          return {
            ...prev,
            [phone]: [...existing, ...newUnique],
          };
        });

        // 4. Anchor scroll position right after DOM renders prepended messages
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const heightDiff = newScrollHeight - prevScrollHeight;
            container.scrollTop = prevScrollTop + heightDiff;
          }
        });
      }
    } catch (err) {
      console.error(`[Firestore] Error loading older messages for ${phone}:`, err);
    } finally {
      setIsLoadingOlder(false);
      isFetchingOlderRef.current = false;
    }
  }, [isLoadingOlder, hasMoreMessages]);

  const handleChatListScroll = (e) => {
    const container = e.currentTarget;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 50 && hasMoreChats && !isLoadingMoreChats) {
      handleLoadMoreChats();
    }
  };

  const handleMessageScroll = (e) => {
    const container = e.currentTarget;
    if (container.scrollTop < 60 && activePhone && hasMoreMessages[activePhone] !== false && !isLoadingOlder && !isFetchingOlderRef.current) {
      handleLoadOlderMessages(activePhone);
    }
  };

  // Smart auto-scroll to bottom (strictly for chat switch or genuine new incoming/outgoing messages)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isChatSwitch = prevActivePhoneRef.current !== activePhone;
    prevActivePhoneRef.current = activePhone;

    const prevLength = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = activeMessagesLength;

    if (isChatSwitch) {
      // Always scroll to bottom instantly when switching chat
      prevNewestMsgIdRef.current = activeMessages[activeMessagesLength - 1]?.id || null;
      container.scrollTop = container.scrollHeight;
      return;
    }

    // STRICT GUARD: If we just loaded historical older messages, skip auto-scrolling
    if (isPrependingHistoryRef.current) {
      isPrependingHistoryRef.current = false;
      return;
    }

    // Only scroll if a NEW message was appended to the BOTTOM (newest message ID changed)
    const currentNewestMsg = activeMessages[activeMessagesLength - 1];
    const currentNewestId = currentNewestMsg?.id || null;
    const isNewMessageAtBottom = currentNewestId && currentNewestId !== prevNewestMsgIdRef.current;
    prevNewestMsgIdRef.current = currentNewestId;

    if (isNewMessageAtBottom && activeMessagesLength > prevLength) {
      const payload = currentNewestMsg?.payload;
      const direction = getMessageDirection(payload);
      const isOutgoing = direction === 'outgoing' || currentNewestMsg?.from === 'bot' || currentNewestMsg?.from === 'admin' || currentNewestMsg?._optimistic;

      // Threshold to detect if the user is already near bottom (<= 150px)
      const threshold = 150; // px
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

      if (isOutgoing || isNearBottom) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        });
      }
    }
  }, [activePhone, activeMessagesLength, activeMessages]);

  // Keep activePhoneRef in sync for use inside stable callbacks & onSnapshot
  useEffect(() => { activePhoneRef.current = activePhone; }, [activePhone]);

  // ── Browser Notification helper ────────────────────────────────────────────
  const sendBrowserNotification = useCallback((contactName, text) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(`💬 ${contactName}`, {
        body: text || 'New WhatsApp message',
        icon: '/favicon.ico',
        tag: contactName, // prevent duplicate stacking for same sender
      });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          new Notification(`💬 ${contactName}`, {
            body: text || 'New WhatsApp message',
            icon: '/favicon.ico',
            tag: contactName,
          });
        }
      });
    }
  }, []);

  // ── Process incoming SSE payload (notifications only – data comes via onSnapshot) ──
  const handleIncomingPayload = useCallback((payload) => {
    const changes = payload?.entry?.[0]?.changes?.[0]?.value;
    if (!changes?.messages || changes.messages.length === 0) return;

    const phone = changes.messages[0].from;
    const contactName = changes.contacts?.[0]?.profile?.name || phone;
    const messageText = extractMessageText(payload);
    const dir = getMessageDirection(payload);
    const isUserMessage = dir === 'incoming';
    const currentActivePhone = activePhoneRef.current;
    const msgId = changes.messages[0].id;

    // Browser notification for incoming user messages when not on their chat
    if (isUserMessage && phone !== currentActivePhone && msgId) {
      if (!notifiedIdsRef.current.has(msgId)) {
        notifiedIdsRef.current.add(msgId);
        sendBrowserNotification(
          contactName !== 'Unknown' ? contactName : `+${phone}`,
          messageText
        );
      }
    }
  }, [sendBrowserNotification]);

  // ── Optimistic UI Helpers ──────────────────────────────────────────────────

  // Step 1 – Immediately inject a "sending" placeholder into the chat thread.
  // Returns the tempId so the caller can confirm or fail it later.
  const addOptimisticMessage = useCallback((phone, text, media) => {
    const cleanPhone = phone.replace('+', '').trim();
    const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // For audio optimistic, use object URL so the player works immediately
    const mediaUrl = media?.localObjectUrl || media?.mediaUrl || (media?.mediaId ? `/api/media?id=${media.mediaId}` : null);

    const msgObj = {
      from: 'admin',
      id: tempId,
      timestamp,
      type: media?.mediaType || 'text',
      mediaType: media?.mediaType || undefined,
      mediaUrl: mediaUrl || undefined,
      mediaId: media?.mediaId || undefined,
    };

    if (media?.mediaType === 'image') {
      msgObj.image = { id: media.mediaId, caption: media.caption, mime_type: media.mimeType, link: mediaUrl, url: mediaUrl };
    } else if (media?.mediaType === 'audio') {
      msgObj.audio = { id: media.mediaId, mime_type: media.mimeType, link: mediaUrl, url: mediaUrl };
    } else if (media?.mediaType === 'video') {
      msgObj.video = { id: media.mediaId, caption: media.caption, mime_type: media.mimeType, link: mediaUrl, url: mediaUrl };
    } else {
      msgObj.text = { body: text };
    }

    const optimisticEvent = {
      id: tempId,
      timestamp,
      _optimistic: 'sending', // flag rendered by MessageBubble
      payload: {
        entry: [{ changes: [{ value: { messages: [msgObj] } }] }],
      },
    };

    setChats(prev => {
      const existing = prev[cleanPhone] || { contactName: cleanPhone, messages: [], unread: 0 };
      return {
        ...prev,
        [cleanPhone]: {
          ...existing,
          botPausedUntil: Date.now() + 24 * 60 * 60 * 1000,
          messages: [...existing.messages, optimisticEvent].sort(
            (a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)
          ),
        },
      };
    });

    return tempId;
  }, []);

  // Step 2a – Replace the optimistic placeholder with the real confirmed message.
  const confirmOptimisticMessage = useCallback((phone, tempId, realMessageId, media) => {
    const cleanPhone = phone.replace('+', '').trim();
    setChats(prev => {
      const existing = prev[cleanPhone];
      if (!existing) return prev;
      const messages = existing.messages.map(m => {
        if (m.id !== tempId) return m;
        // Swap temp placeholder with the real message data
        const realMediaUrl = media?.mediaUrl || (media?.mediaId ? `/api/media?id=${media.mediaId}` : null);
        const realMsg = m.payload.entry[0].changes[0].value.messages[0];
        // Revoke the temporary object URL to free memory
        if (realMsg.mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(realMsg.mediaUrl);
        // Patch in real IDs
        realMsg.id = realMessageId || tempId;
        realMsg.mediaId = media?.mediaId || realMsg.mediaId;
        realMsg.mediaUrl = realMediaUrl || realMsg.mediaUrl;
        if (realMsg.image) { realMsg.image.id = media?.mediaId; realMsg.image.link = realMediaUrl; realMsg.image.url = realMediaUrl; }
        if (realMsg.audio) { realMsg.audio.id = media?.mediaId; realMsg.audio.link = realMediaUrl; realMsg.audio.url = realMediaUrl; }
        return { ...m, id: realMessageId || tempId, _optimistic: undefined }; // remove sending flag
      });
      return { ...prev, [cleanPhone]: { ...existing, messages } };
    });
  }, []);

  // Step 2b – Mark the placeholder as failed so user sees the "!" indicator.
  const failOptimisticMessage = useCallback((phone, tempId) => {
    const cleanPhone = phone.replace('+', '').trim();
    setChats(prev => {
      const existing = prev[cleanPhone];
      if (!existing) return prev;
      const messages = existing.messages.map(m =>
        m.id === tempId ? { ...m, _optimistic: 'failed' } : m
      );
      return { ...prev, [cleanPhone]: { ...existing, messages } };
    });
  }, []);

  // ── Delete Handlers ────────────────────────────────────────────────────────
  const handleDeleteChat = async (e, phone) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the entire chat with +${phone}?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, action: 'delete_chat' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setChats(prev => {
        const next = { ...prev };
        delete next[phone];
        return next;
      });
      if (activePhone === phone) setActivePhone(null);
    } catch (err) {
      console.error('Failed to delete chat:', err);
      alert(`Failed to delete chat: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearMessages = async (phone) => {
    if (!window.confirm(`Clear all messages for +${phone}? The contact will remain.`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, action: 'clear_messages' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setChats(prev => ({
        ...prev,
        [phone]: { ...prev[phone], messages: [], unread: 0 },
      }));
    } catch (err) {
      console.error('Failed to clear messages:', err);
      alert(`Failed to clear messages: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteMessage = async (phone, messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      // Optimistically remove from state
      setChats(prev => ({
        ...prev,
        [phone]: {
          ...prev[phone],
          messages: (prev[phone]?.messages || []).filter(m => m.id !== messageId),
        },
      }));
      const res = await fetch('/api/chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, action: 'delete_message', messageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert(`Failed to delete message: ${err.message}`);
    }
  };

  // Open a chat, clear its unread badge, and mark messages as read in the backend
  const handleOpenChat = (phone) => {
    activePhoneRef.current = phone;
    setActivePhone(phone);
    setChats(prev => {
      const current = prev[phone];
      if (!current) return prev;
      return {
        ...prev,
        [phone]: {
          ...current,
          unread: 0,
          messages: (current.messages || []).map(m => ({ ...m, isRead: true, status: 'read' })),
        },
      };
    });

    // Mark as read in the backend
    fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, action: 'mark_read' }),
    }).catch(err => console.error('Failed to mark chat as read in backend:', err));
  };

  // ── Real-time Firestore Listeners (with pagination limit & fallback) ──────
  useEffect(() => {
    const messageUnsubs = {};      // { [phone]: unsubscribe fn }
    const chatMetaCache = {};      // { [phone]: { contactName, botPausedUntil } }
    const initializedPhones = new Set(); // tracks first-snapshot-received per phone

    const chatsRef = collection(db, 'chats');
    let chatsQuery;
    try {
      chatsQuery = query(chatsRef, orderBy('updatedAt', 'desc'), limit(chatsLimit));
    } catch (e) {
      chatsQuery = query(chatsRef, limit(chatsLimit));
    }

    // 1. Listen to the top-level chats collection for contact metadata (up to chatsLimit)
    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      if (snapshot.docs.length < chatsLimit) {
        setHasMoreChats(false);
      } else {
        setHasMoreChats(true);
      }
      setIsLoadingMoreChats(false);

      snapshot.docChanges().forEach((change) => {
        const phone = change.doc.id;
        const data = change.doc.data();

        if (change.type === 'added' || change.type === 'modified') {
          // Cache metadata so message handlers can read it without a stale closure
          chatMetaCache[phone] = {
            contactName: data.contactName || phone,
            botPausedUntil: data.botPausedUntil || null,
          };

          // For metadata-only updates, patch state immediately
          if (change.type === 'modified') {
            setChats(prev => {
              const existing = prev[phone];
              if (!existing) return prev;
              const cn = data.contactName || existing.contactName;
              const bp = data.botPausedUntil ?? existing.botPausedUntil;
              if (existing.contactName === cn && existing.botPausedUntil === bp) return prev;
              return { ...prev, [phone]: { ...existing, contactName: cn, botPausedUntil: bp } };
            });
          }

          // 2. Set up messages subcollection listener (50 most recent messages)
          if (!messageUnsubs[phone]) {
            const q = query(
              collection(db, 'chats', phone, 'messages'),
              orderBy('timestamp', 'desc'),
              limit(50)
            );

            messageUnsubs[phone] = onSnapshot(q, (msgSnapshot) => {
              // Store oldest doc snapshot for startAfter pagination
              if (msgSnapshot.docs.length > 0 && !oldestMsgDocRef.current[phone]) {
                oldestMsgDocRef.current[phone] = msgSnapshot.docs[msgSnapshot.docs.length - 1];
              }

              // Set initial hasMoreMessages for this phone
              setHasMoreMessages(prev => {
                if (prev[phone] !== undefined) return prev;
                return { ...prev, [phone]: msgSnapshot.docs.length >= 50 };
              });

              // Reverse docs so they are chronological (ascending)
              const firestoreMessages = msgSnapshot.docs
                .map(doc => transformFirestoreMessage(doc, phone))
                .reverse();

              const meta = chatMetaCache[phone] || {};
              const currentActivePhone = activePhoneRef.current;
              const isActive = phone === currentActivePhone;

              // ── Update chats state ──────────────────────────────────────
              setChats(prev => {
                const existing = prev[phone];

                const pendingOptimistic = (existing?.messages || []).filter(
                  m => m._optimistic && !firestoreMessages.some(fm => isSameMessage(fm, m))
                );

                const allMessages = [...firestoreMessages, ...pendingOptimistic].sort(
                  (a, b) => parseInt(a.timestamp || 0) - parseInt(b.timestamp || 0)
                );

                if (isActive) {
                  allMessages.forEach(m => { m.isRead = true; });
                }

                const unread = isActive ? 0 : allMessages.filter(m => !m.isRead).length;

                return {
                  ...prev,
                  [phone]: {
                    contactName: meta.contactName || existing?.contactName || phone,
                    botPausedUntil: meta.botPausedUntil ?? existing?.botPausedUntil ?? null,
                    messages: allMessages,
                    unread,
                  },
                };
              });

              // ── Notifications (side-effects) ─────
              if (!initializedPhones.has(phone)) {
                initializedPhones.add(phone);
                firestoreMessages.forEach(m => notifiedIdsRef.current.add(m.id));
              } else if (!isActive) {
                const newIncoming = firestoreMessages.filter(m => {
                  const dir = getMessageDirection(m.payload);
                  return dir === 'incoming' && !m.isRead && !notifiedIdsRef.current.has(m.id);
                });
                if (newIncoming.length > 0) {
                  const last = newIncoming[newIncoming.length - 1];
                  notifiedIdsRef.current.add(last.id);
                  sendBrowserNotification(
                    meta.contactName || `+${phone}`,
                    extractMessageText(last.payload)
                  );
                }
                firestoreMessages.forEach(m => notifiedIdsRef.current.add(m.id));
              }

              // Mark as read in backend if active chat has new unread incoming
              if (isActive) {
                const hasNewUnread = firestoreMessages.some(
                  m => !m.isRead && getMessageDirection(m.payload) === 'incoming'
                );
                if (hasNewUnread) {
                  fetch('/api/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, action: 'mark_read' }),
                  }).catch(() => {});
                }
              }
            }, (error) => {
              console.error(`[Firestore] Messages listener error for ${phone}:`, error);
            });
          }
        } else if (change.type === 'removed') {
          if (messageUnsubs[phone]) {
            messageUnsubs[phone]();
            delete messageUnsubs[phone];
          }
          delete chatMetaCache[phone];
          initializedPhones.delete(phone);

          setChats(prev => {
            if (!prev[phone]) return prev;
            const next = { ...prev };
            delete next[phone];
            return next;
          });
        }
      });
    }, (error) => {
      console.error('[Firestore] Chats collection listener error:', error);
    });

    return () => {
      unsubChats();
      Object.values(messageUnsubs).forEach(unsub => unsub());
    };
  }, [chatsLimit, sendBrowserNotification]);

  // ── Live ntfy.sh SSE stream ────────────────────────────────────────────────
  useEffect(() => {
    setConnectionStatus('connecting');
    const eventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);
    eventSource.onopen  = () => setConnectionStatus('connected');
    eventSource.onerror = () => setConnectionStatus('disconnected');
    eventSource.onmessage = (event) => {
      try {
        const rawData = JSON.parse(event.data);
        if (rawData.event === 'message') {
          const webhookPayload = JSON.parse(rawData.message);
          handleIncomingPayload(webhookPayload);
        }
      } catch (err) { console.error('Failed to parse ntfy event:', err); }
    };
    return () => eventSource.close();
  }, [topic, handleIncomingPayload]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const chatList = Object.entries(chats)
    .map(([phone, data]) => ({
      phone,
      ...data,
      latestMessageTime: data.messages.length > 0 ? data.messages[data.messages.length - 1].timestamp : '0',
    }))
    .sort((a, b) => parseInt(b.latestMessageTime) - parseInt(a.latestMessageTime));

  return (
    <div className="w-full h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] overflow-hidden flex flex-col space-y-2.5 sm:space-y-3 animate-fade-in max-w-6xl mx-auto min-h-0">
      {/* Connection Banner */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-2xl p-3 sm:p-4 shadow-xl relative overflow-hidden flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-shrink-0">
              {t('webhook.liveLink')}
            </h3>
            <span className={`sm:hidden inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0 ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : connectionStatus === 'connecting'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {connectionStatus === 'connected' ? (
                <><Wifi className="w-3 h-3" /> {t('webhook.connectionActive')}</>
              ) : connectionStatus === 'connecting' ? (
                <><Wifi className="w-3 h-3 animate-spin" /> {t('webhook.connecting')}</>
              ) : (
                <><WifiOff className="w-3 h-3" /> {t('webhook.disconnected')}</>
              )}
            </span>
          </div>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-indigo-300 outline-none select-all text-left min-w-0"
              dir="ltr"
            />
            <button
              onClick={copyWebhookUrl}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0"
            >
              {copiedUrl ? <><Check className="w-3.5 h-3.5" /> <span className="hidden xs:inline">{t('webhook.copied')}</span></> : <><Copy className="w-3.5 h-3.5" /> <span className="hidden xs:inline">{t('webhook.copyUrl')}</span></>}
            </button>
          </div>

          <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : connectionStatus === 'connecting'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {connectionStatus === 'connected' ? (
              <><Wifi className="w-3.5 h-3.5" /> {t('webhook.connectionActive')}</>
            ) : connectionStatus === 'connecting' ? (
              <><Wifi className="w-3.5 h-3.5 animate-spin" /> {t('webhook.connecting')}</>
            ) : (
              <><WifiOff className="w-3.5 h-3.5" /> {t('webhook.disconnected')}</>
            )}
          </span>
        </div>
      </div>

      <SendTermsPanel onSendSuccess={(phone, text, messageId, media) => {
        addOptimisticMessage(phone, text, media);
      }} />

      {/* Chat Interface Container (Master-Detail on Mobile, Side-by-Side on Desktop) */}
      <div className="w-full flex-1 min-h-0 flex flex-col md:flex-row bg-slate-950/50 backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl relative">

        {/* Left Pane: Contacts / Chats List (Shown on Mobile when activePhone is null, or on Desktop) */}
        <div className={`w-full md:w-80 md:flex flex-shrink-0 bg-[#111b21] border-r rtl:border-r-0 rtl:border-l border-slate-700/50 flex-col h-full min-h-0 ${
          activePhone ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="p-3.5 sm:p-4 border-b border-slate-700/50 bg-[#202c33] flex items-center justify-between flex-shrink-0">
            <h2 className="text-base font-bold text-white">{t('webhook.chats')}</h2>
            <span className="text-xs text-slate-400 font-mono">{chatList.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0" onScroll={handleChatListScroll}>
            {chatList.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                {t('webhook.noChats')}
                <br />
                <span className="text-xs opacity-70 mt-2 block">{t('webhook.waitingHint')}</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {chatList.map((chat) => (
                  <button
                    key={chat.phone}
                    onClick={() => handleOpenChat(chat.phone)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-800/40 transition-colors flex items-center gap-3 active:bg-slate-800/70 ${
                      activePhone === chat.phone ? 'bg-slate-800/60 border-l-2 rtl:border-l-0 rtl:border-r-2 border-emerald-500' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-indigo-400" />
                      </div>
                      {/* Unread badge */}
                      {chat.unread > 0 && (
                        <span className="absolute -top-1 -right-1 rtl:-right-auto rtl:-left-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white leading-none">
                          {chat.unread > 99 ? '99+' : chat.unread}
                        </span>
                      )}
                    </div>

                    {/* Name & number */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-semibold truncate ${chat.unread > 0 ? 'text-white' : 'text-slate-300'}`}>
                          {chat.contactName}
                        </h4>
                        {formatTimestamp(chat.latestMessageTime) && (
                          <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2 rtl:ml-0 rtl:mr-2">
                            {formatTimestamp(chat.latestMessageTime)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate" dir="ltr">+{chat.phone}</p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteChat(e, chat.phone)}
                      disabled={isDeleting}
                      title="Delete Chat"
                      className="p-1.5 bg-transparent hover:bg-rose-500/10 text-slate-600 hover:text-rose-400 rounded-full transition-all disabled:opacity-50 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                ))}

                {/* Chat Sidebar Pagination Control */}
                {hasMoreChats && (
                  <div className="p-3 text-center">
                    <button
                      onClick={handleLoadMoreChats}
                      disabled={isLoadingMoreChats}
                      className="w-full py-2 px-3 bg-slate-900/80 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-indigo-300 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700/40"
                    >
                      {isLoadingMoreChats ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          <span>جارٍ تحميل المزيد...</span>
                        </>
                      ) : (
                        <span>تحميل المزيد من المحادثات</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Window (Shown on Mobile when activePhone is set, or on Desktop) */}
        <div className={`w-full md:flex-1 md:flex flex-col bg-[#0b141a] h-full min-h-0 ${
          activePhone ? 'flex' : 'hidden md:flex'
        }`}>
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="bg-[#202c33] border-b border-slate-700/50 px-3 sm:px-4 py-3 flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
                {/* Mobile Back Button (Visible ONLY on mobile) */}
                <button
                  type="button"
                  onClick={() => setActivePhone(null)}
                  className="p-1.5 -ms-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl md:hidden flex items-center justify-center shrink-0 transition-colors"
                  title="الرجوع لقائمة المحادثات"
                  aria-label="Back to contacts list"
                >
                  <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                </button>

                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-200 text-xs sm:text-sm truncate">{activeChat.contactName}</h3>
                    {activeChat.botPausedUntil && activeChat.botPausedUntil > Date.now() && (
                      <span
                        className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium flex items-center gap-1"
                        title="البوت متوقف مؤقتاً لمدة 24 ساعة بسبب إرسال رسالة يدوية"
                      >
                        <Bot className="w-3 h-3 text-amber-400/80" />
                        <span className="hidden sm:inline">محادثة يدوية (البوت متوقف)</span>
                        <span className="sm:hidden">يدوي</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-mono truncate" dir="ltr">+{activePhone}</p>
                </div>
                <button
                  onClick={() => handleClearMessages(activePhone)}
                  disabled={isDeleting || activeMessages.length === 0}
                  className="px-2.5 sm:px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Clear</span>
                </button>
              </div>

              {/* Message History (Scrollable Area) */}
              <div
                ref={scrollContainerRef}
                onScroll={handleMessageScroll}
                className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 flex flex-col relative min-h-0"
                dir="ltr"
              >
                {/* Subtle WhatsApp-style tiled bg */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{ backgroundImage: "url('https://static.whatsapp.net/rsrc.php/v3/yl/r/rrotdJpG0qL.png')", backgroundRepeat: 'repeat' }}
                />
                <div className="relative z-10 flex-1 flex flex-col justify-end">
                  {/* Message History Pagination Control */}
                  {activePhone && hasMoreMessages[activePhone] !== false && (
                    <div className="text-center py-2 flex justify-center items-center my-1 z-20">
                      <button
                        onClick={() => handleLoadOlderMessages(activePhone)}
                        disabled={isLoadingOlder}
                        className="px-3.5 py-1 bg-[#202c33]/90 hover:bg-slate-800 border border-slate-700/50 text-xs text-indigo-300 rounded-full transition-all shadow-md flex items-center gap-2 disabled:opacity-50 select-none"
                      >
                        {isLoadingOlder ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            <span>جارٍ تحميل الرسائل الأقدم...</span>
                          </>
                        ) : (
                          <>
                            <ArrowLeft className="w-3.5 h-3.5 rotate-90 text-indigo-400" />
                            <span>تحميل الرسائل الأقدم</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {activePhone && hasMoreMessages[activePhone] === false && activeMessages.length > 0 && (
                    <div className="text-center py-2 text-[11px] text-slate-500 font-mono select-none my-1">
                      بداية المحادثة
                    </div>
                  )}

                  {activeMessages.length === 0 && (
                    <div className="text-center text-slate-600 text-sm py-8">No messages yet</div>
                  )}
                  {activeMessages.map((event) => (
                    <MessageBubble
                      key={event.id}
                      event={event}
                      onDelete={() => handleDeleteMessage(activePhone, event.id)}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area (Fixed at bottom) */}
              <ReplyBox
                to={activePhone}
                onSendSuccess={(phone, text, messageId, media, action, tempId) => {
                  if (action === 'optimistic') {
                    return addOptimisticMessage(phone, text, media);
                  } else if (action === 'confirm') {
                    confirmOptimisticMessage(phone, tempId, messageId, media);
                  } else if (action === 'fail') {
                    failOptimisticMessage(phone, tempId);
                  }
                }}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 bg-slate-900/20 p-6 text-center">
              <MessageSquare className="w-14 h-14 sm:w-16 sm:h-16 mb-4 opacity-20 text-indigo-400" />
              <p className="text-sm sm:text-base font-medium">{t('webhook.selectChat')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

