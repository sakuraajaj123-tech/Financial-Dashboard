import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, Check, Send, Loader2, User, FileText, Trash2, Bot, Mic, ImagePlus, X, Play, Pause, Download, ArrowLeft, Sparkles } from 'lucide-react';
import { sendFreeTextReply, sendMediaMessage } from '../../api/whatsapp';
import { convertBlobToMp3 } from '../../utils/audioEncoder';
import { JsonViewer } from './JsonViewer';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, startAfter, getDocs } from 'firebase/firestore';
import { useQuickReplies } from '../../hooks/useQuickReplies';
import { QuickRepliesPanel } from './QuickRepliesPanel';
import { QuickRepliesModal } from './QuickRepliesModal';

// ── Voice Message Audio Player Component ──────────────────────────────────────
function VoiceMessagePlayer({ src, isOutgoing, mimeType }) {
  const { t } = useTranslation();
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
          title={t('webhook.downloadDocument')}
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </div>

      {hasError && (
        <div className="text-[10px] text-rose-400 flex items-center justify-between bg-rose-500/10 px-2 py-1 rounded">
          <span>{t('webhook.audioError')}</span>
          <a href={src} target="_blank" rel="noreferrer" className="underline ml-2">{t('webhook.openDirectly')}</a>
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

function extractMessageText(payload, t = null) {
  const changes = payload?.entry?.[0]?.changes?.[0]?.value;
  if (!changes?.messages?.length) return null;
  const msg = changes.messages[0];
  if (msg.type === 'text') return msg.text?.body || '';
  if (msg.type === 'interactive' && msg.interactive?.type === 'list_reply')
    return msg.interactive.list_reply.title;
  if (msg.type === 'image') return msg.image?.caption || (t ? t('webhook.captionImage') : '📸 Photo');
  if (msg.type === 'audio') return t ? t('webhook.captionAudio') : '🎵 Voice message';
  if (msg.type === 'video') return msg.video?.caption || (t ? t('webhook.captionVideo') : '🎥 Video');
  if (msg.type === 'document') return `📄 ${msg.document?.filename || (t ? t('webhook.captionDocument') : 'Document')}`;
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
  return '';
}

function ReplyBox({ to, onSendSuccess }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Quick Replies state ──────────────────────────────────
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, quickReply: null });
  const { quickReplies, loading: loadingQuickReplies, addQuickReply, updateQuickReply, deleteQuickReply } = useQuickReplies();

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

  // ── Direct Send for Quick Replies ───────────────────────
  const handleSendQuickReplyDirect = async (textToSend) => {
    if (!textToSend?.trim() || status === 'sending') return;
    const msgText = textToSend.trim();
    setErrorMsg('');

    const tempId = onSendSuccess ? onSendSuccess(to, msgText, null, null, 'optimistic') : null;
    setStatus('sending');

    try {
      const res = await sendFreeTextReply(to, msgText);
      setStatus('sent');
      if (onSendSuccess && tempId) {
        onSendSuccess(to, msgText, res?.messages?.[0]?.id, null, 'confirm', tempId);
      }
      setTimeout(() => setStatus('idle'), 3000);
      return res;
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to send');
      if (onSendSuccess && tempId) {
        onSendSuccess(to, msgText, null, null, 'fail', tempId);
      }
      throw err;
    }
  };

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
      setErrorMsg(t('webhook.imageCompressionFailed'));
    }
    e.target.value = '';
  };

  const handleCancelImage = () => {
    setImagePreview(null);
    setCaption('');
  };

  const handleSendImage = () => {
    if (!imagePreview || status === 'sending') return;
    setErrorMsg('');

    const { base64, mimeType, dataUrl } = imagePreview;
    const captionText = caption;
    setImagePreview(null);
    setCaption('');

    const optimisticMedia = {
      mediaType: 'image',
      mimeType,
      caption: captionText || null,
      localObjectUrl: dataUrl,
    };
    const tempId = onSendSuccess
      ? onSendSuccess(to, captionText || t('webhook.captionImage'), null, optimisticMedia, 'optimistic')
      : null;

    setStatus('sending');
    sendMediaMessage(to, base64, mimeType, 'image', captionText || undefined)
      .then(res => {
        setStatus('sent');
        if (onSendSuccess && tempId) {
          onSendSuccess(to, captionText || t('webhook.captionImage'), res?.messages?.[0]?.id, {
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
        setErrorMsg(err.message || t('webhook.imageSendFailed'));
        if (onSendSuccess && tempId) {
          onSendSuccess(to, captionText || t('webhook.captionImage'), null, null, 'fail', tempId);
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
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const rawBlob = new Blob(audioChunksRef.current, { type: actualMime });
        audioChunksRef.current = [];

        if (rawBlob.size < 500) {
          setIsRecording(false);
          setRecordingDuration(0);
          return;
        }

        setIsRecording(false);
        setRecordingDuration(0);
        setErrorMsg('');

        const localObjectUrl = URL.createObjectURL(rawBlob);
        const optimisticMedia = {
          mediaType: 'audio',
          mimeType: 'audio/mp3',
          localObjectUrl,
        };
        const tempId = onSendSuccess
          ? onSendSuccess(to, t('webhook.captionAudio'), null, optimisticMedia, 'optimistic')
          : null;

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
              onSendSuccess(to, t('webhook.captionAudio'), res?.messages?.[0]?.id, {
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
            setErrorMsg(err.message || t('webhook.audioSendFailed'));
            if (onSendSuccess && tempId) {
              onSendSuccess(to, t('webhook.captionAudio'), null, null, 'fail', tempId);
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
      setErrorMsg(t('webhook.micAccessError'));
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

  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

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
            placeholder={t('webhook.addCaptionPlaceholder')}
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

  if (isRecording) {
    return (
      <div className="bg-[#1f2c34] border-t border-slate-700/50 p-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={cancelRecording}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-all"
            title={t('webhook.cancelRecording')}
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex-1 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-sm text-slate-200 font-mono tracking-wider">
              {formatDuration(recordingDuration)}
            </span>
            <span className="text-xs text-rose-400 animate-pulse">{t('webhook.recording')}</span>
          </div>

          <button
            onClick={stopRecording}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-md"
            title={t('webhook.stopAndSend')}
          >
            <Send className="w-4 h-4 ml-0.5 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1f2c34] border-t border-slate-700/50 p-2.5 sm:p-3 flex-shrink-0 relative">
      {/* Quick Replies Overlay Panel */}
      <QuickRepliesPanel
        isOpen={showQuickReplies}
        onClose={() => setShowQuickReplies(false)}
        quickReplies={quickReplies}
        loading={loadingQuickReplies}
        activePhone={to}
        onUse={(content) => {
          setText(content);
          if (textareaRef.current) {
            textareaRef.current.focus();
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
              }
            }, 50);
          }
        }}
        onSend={handleSendQuickReplyDirect}
        onAddNew={() => setModalState({ isOpen: true, quickReply: null })}
        onEdit={(item) => setModalState({ isOpen: true, quickReply: item })}
        onDelete={deleteQuickReply}
      />

      {/* Quick Replies Create/Edit Modal */}
      <QuickRepliesModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, quickReply: null })}
        quickReply={modalState.quickReply}
        onSave={async ({ title, content }) => {
          if (modalState.quickReply?.id) {
            await updateQuickReply(modalState.quickReply.id, { title, content });
          } else {
            await addQuickReply({ title, content });
          }
        }}
      />

      {status === 'error' && (
        <div className="mb-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-400 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Quick Replies Chips Bar */}
      {quickReplies.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-1 text-xs">
          <button
            type="button"
            onClick={() => setShowQuickReplies(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
              showQuickReplies
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-[#2a3942] hover:bg-[#35464f] text-emerald-400 border border-emerald-500/30'
            }`}
            title={t('webhook.quickReplies')}
          >
            <Sparkles className="w-3 h-3" />
            <span>{t('webhook.quickReplies')}</span>
            <span className="text-[10px] px-1 py-0.2 rounded-full bg-slate-900/60 font-mono">
              {quickReplies.length}
            </span>
          </button>

          {quickReplies.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setText(item.content);
                if (textareaRef.current) {
                  textareaRef.current.focus();
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto';
                      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
                    }
                  }, 50);
                }
              }}
              className="px-2.5 py-1 rounded-full bg-[#2a3942]/80 hover:bg-[#35464f] text-slate-300 hover:text-white text-xs whitespace-nowrap shrink-0 border border-slate-700/50 transition-colors flex items-center gap-1"
              title={item.content}
            >
              <span>{item.title}</span>
            </button>
          ))}

          {quickReplies.length > 5 && (
            <button
              type="button"
              onClick={() => setShowQuickReplies(true)}
              className="px-2 py-1 rounded-full bg-slate-800 text-slate-400 hover:text-white text-xs shrink-0"
            >
              +{quickReplies.length - 5}
            </button>
          )}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'sending'}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-[#2a3942] hover:bg-[#35464f] disabled:opacity-40 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all"
          title={t('webhook.sendImage')}
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        {/* Quick Replies Toggle Button */}
        <button
          type="button"
          onClick={() => setShowQuickReplies(prev => !prev)}
          disabled={status === 'sending'}
          className={`relative flex-shrink-0 w-10 h-10 rounded-full transition-all flex items-center justify-center ${
            showQuickReplies
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-[#2a3942] hover:bg-[#35464f] disabled:opacity-40 text-slate-400 hover:text-emerald-400'
          }`}
          title={t('webhook.quickReplies')}
        >
          <Sparkles className="w-5 h-5" />
          {quickReplies.length > 0 && !showQuickReplies && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#1f2c34]" />
          )}
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
            title={t('webhook.recordVoice')}
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
        {!isOutgoing && (
          <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0 mr-2 rtl:mr-0 rtl:ml-2 self-end mb-1">
            <User className="w-3.5 h-3.5 text-indigo-300" />
          </div>
        )}

        <div className={`max-w-[75%] flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
          <div className={`relative px-3.5 py-2 rounded-2xl shadow-sm text-sm ${
            isOutgoing
              ? 'bg-[#005c4b] text-slate-100 rounded-br-sm'
              : 'bg-[#202c33] text-slate-100 rounded-bl-sm border border-white/5'
          }`}>
            {isOutgoing && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300/80 font-medium mb-1" dir="ltr">
                <Bot className="w-2.5 h-2.5" />
                {msg.from === 'admin' ? t('webhook.adminLabel') : t('webhook.autoReplyLabel')}
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
                    {t('webhook.captionImage')}
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
                    <span>{t('webhook.captionAudio')}</span>
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
                    {t('webhook.captionVideo')}
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
                      {msg.document?.filename || t('webhook.downloadDocument')}
                    </span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg text-xs text-slate-300">
                    {t('webhook.captionDocument')}
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

        {isOutgoing && (
          <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center flex-shrink-0 ml-2 rtl:ml-0 rtl:mr-2 self-end mb-1">
            <Bot className="w-3.5 h-3.5 text-emerald-300" />
          </div>
        )}

        {onDelete && (
          <button
            onClick={onDelete}
            title={t('common.delete')}
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

  const [chats, setChats] = useState({});
  const [activePhone, setActivePhone] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevActivePhoneRef = useRef(activePhone);
  const prevMessagesLengthRef = useRef(0);
  const activePhoneRef = useRef(activePhone);
  const notifiedIdsRef = useRef(new Set());

  // ── Pagination State & Refs ──────────────────────────────────────────────────
  const [chatsLimit, setChatsLimit] = useState(20);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);

  const [historicalMessages, setHistoricalMessages] = useState({});
  const [hasMoreMessages, setHasMoreMessages] = useState({});
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const oldestMsgDocRef = useRef({});
  const isFetchingOlderRef = useRef(false);
  const isPrependingHistoryRef = useRef(false);
  const prevNewestMsgIdRef = useRef(null);

  const topic = getWebhookTopic();

  const activeChat = activePhone ? chats[activePhone] : null;
  const activeHistorical = activePhone ? (historicalMessages[activePhone] || []) : [];
  const activeRealtime = activeChat?.messages || [];

  const activeMessages = useMemo(() => {
    if (!activePhone) return [];
    const map = new Map();
    activeHistorical.forEach(m => map.set(m.id, m));
    activeRealtime.forEach(m => map.set(m.id, m));

    return Array.from(map.values()).sort(
      (a, b) => parseInt(a.timestamp || 0) - parseInt(b.timestamp || 0)
    );
  }, [activePhone, activeHistorical, activeRealtime]);

  const activeMessagesLength = activeMessages.length;

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

        const container = scrollContainerRef.current;
        const prevScrollHeight = container ? container.scrollHeight : 0;
        const prevScrollTop = container ? container.scrollTop : 0;

        isPrependingHistoryRef.current = true;

        setHistoricalMessages(prev => {
          const existing = prev[phone] || [];
          const newUnique = olderMsgs.filter(om => !existing.some(em => isSameMessage(em, om)));
          return {
            ...prev,
            [phone]: [...existing, ...newUnique],
          };
        });

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

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isChatSwitch = prevActivePhoneRef.current !== activePhone;
    prevActivePhoneRef.current = activePhone;

    const prevLength = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = activeMessagesLength;

    if (isChatSwitch) {
      prevNewestMsgIdRef.current = activeMessages[activeMessagesLength - 1]?.id || null;
      container.scrollTop = container.scrollHeight;
      return;
    }

    if (isPrependingHistoryRef.current) {
      isPrependingHistoryRef.current = false;
      return;
    }

    const currentNewestMsg = activeMessages[activeMessagesLength - 1];
    const currentNewestId = currentNewestMsg?.id || null;
    const isNewMessageAtBottom = currentNewestId && currentNewestId !== prevNewestMsgIdRef.current;
    prevNewestMsgIdRef.current = currentNewestId;

    if (isNewMessageAtBottom && activeMessagesLength > prevLength) {
      const payload = currentNewestMsg?.payload;
      const direction = getMessageDirection(payload);
      const isOutgoing = direction === 'outgoing' || currentNewestMsg?.from === 'bot' || currentNewestMsg?.from === 'admin' || currentNewestMsg?._optimistic;

      const threshold = 150;
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

  useEffect(() => { activePhoneRef.current = activePhone; }, [activePhone]);

  const sendBrowserNotification = useCallback((contactName, text) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(`💬 ${contactName}`, {
        body: text || 'New WhatsApp message',
        icon: '/favicon.ico',
        tag: contactName,
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

  const handleIncomingPayload = useCallback((payload) => {
    const changes = payload?.entry?.[0]?.changes?.[0]?.value;
    if (!changes?.messages || changes.messages.length === 0) return;

    const phone = changes.messages[0].from;
    const contactName = changes.contacts?.[0]?.profile?.name || phone;
    const messageText = extractMessageText(payload, t);
    const dir = getMessageDirection(payload);
    const isUserMessage = dir === 'incoming';
    const currentActivePhone = activePhoneRef.current;
    const msgId = changes.messages[0].id;

    if (isUserMessage && phone !== currentActivePhone && msgId) {
      if (!notifiedIdsRef.current.has(msgId)) {
        notifiedIdsRef.current.add(msgId);
        sendBrowserNotification(
          contactName !== 'Unknown' ? contactName : `+${phone}`,
          messageText
        );
      }
    }
  }, [sendBrowserNotification, t]);

  const addOptimisticMessage = useCallback((phone, text, media) => {
    const cleanPhone = phone.replace('+', '').trim();
    const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
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
      _optimistic: 'sending',
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

  const confirmOptimisticMessage = useCallback((phone, tempId, realMessageId, media) => {
    const cleanPhone = phone.replace('+', '').trim();
    setChats(prev => {
      const existing = prev[cleanPhone];
      if (!existing) return prev;
      const messages = existing.messages.map(m => {
        if (m.id !== tempId) return m;
        const realMediaUrl = media?.mediaUrl || (media?.mediaId ? `/api/media?id=${media.mediaId}` : null);
        const realMsg = m.payload.entry[0].changes[0].value.messages[0];
        if (realMsg.mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(realMsg.mediaUrl);
        realMsg.id = realMessageId || tempId;
        realMsg.mediaId = media?.mediaId || realMsg.mediaId;
        realMsg.mediaUrl = realMediaUrl || realMsg.mediaUrl;
        if (realMsg.image) { realMsg.image.id = media?.mediaId; realMsg.image.link = realMediaUrl; realMsg.image.url = realMediaUrl; }
        if (realMsg.audio) { realMsg.audio.id = media?.mediaId; realMsg.audio.link = realMediaUrl; realMsg.audio.url = realMediaUrl; }
        return { ...m, id: realMessageId || tempId, _optimistic: undefined };
      });
      return { ...prev, [cleanPhone]: { ...existing, messages } };
    });
  }, []);

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

  const handleDeleteChat = async (e, phone) => {
    e.stopPropagation();
    if (!window.confirm(t('webhook.deleteChatConfirm', { phone }))) return;
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
    if (!window.confirm(t('webhook.clearChatConfirm', { phone }))) return;
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
    if (!window.confirm(t('webhook.deleteMessageConfirm'))) return;
    try {
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

    fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, action: 'mark_read' }),
    }).catch(err => console.error('Failed to mark chat as read in backend:', err));
  };

  useEffect(() => {
    const messageUnsubs = {};
    const chatMetaCache = {};
    const initializedPhones = new Set();

    const chatsRef = collection(db, 'chats');
    let chatsQuery;
    try {
      chatsQuery = query(chatsRef, orderBy('updatedAt', 'desc'), limit(chatsLimit));
    } catch (e) {
      chatsQuery = query(chatsRef, limit(chatsLimit));
    }

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
          chatMetaCache[phone] = {
            contactName: data.contactName || phone,
            botPausedUntil: data.botPausedUntil || null,
          };

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

          if (!messageUnsubs[phone]) {
            const q = query(
              collection(db, 'chats', phone, 'messages'),
              orderBy('timestamp', 'desc'),
              limit(50)
            );

            messageUnsubs[phone] = onSnapshot(q, (msgSnapshot) => {
              if (msgSnapshot.docs.length > 0 && !oldestMsgDocRef.current[phone]) {
                oldestMsgDocRef.current[phone] = msgSnapshot.docs[msgSnapshot.docs.length - 1];
              }

              setHasMoreMessages(prev => {
                if (prev[phone] !== undefined) return prev;
                return { ...prev, [phone]: msgSnapshot.docs.length >= 50 };
              });

              const firestoreMessages = msgSnapshot.docs
                .map(doc => transformFirestoreMessage(doc, phone))
                .reverse();

              const meta = chatMetaCache[phone] || {};
              const currentActivePhone = activePhoneRef.current;
              const isActive = phone === currentActivePhone;

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
                    extractMessageText(last.payload, t)
                  );
                }
                firestoreMessages.forEach(m => notifiedIdsRef.current.add(m.id));
              }

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
  }, [chatsLimit, sendBrowserNotification, t]);

  useEffect(() => {
    const eventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);
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

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const chatList = Object.entries(chats)
    .map(([phone, data]) => ({
      phone,
      ...data,
      latestMessageTime: data.messages.length > 0 ? data.messages[data.messages.length - 1].timestamp : '0',
    }))
    .sort((a, b) => parseInt(b.latestMessageTime) - parseInt(a.latestMessageTime));

  return (
    <div className="w-full h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] overflow-hidden flex flex-col space-y-2.5 sm:space-y-3 animate-fade-in max-w-6xl mx-auto min-h-0">
      {/* Chat Interface Container */}
      <div className="w-full flex-1 min-h-0 flex flex-col md:flex-row bg-slate-950/50 backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl relative">

        {/* Left Pane: Contacts / Chats List */}
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
                    className={`w-full text-left rtl:text-right px-4 py-3 hover:bg-slate-800/40 transition-colors flex items-center gap-3 active:bg-slate-800/70 ${
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
                      title={t('common.delete')}
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
                          <span>{t('webhook.loadingMore')}</span>
                        </>
                      ) : (
                        <span>{t('webhook.loadMoreChats')}</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Window */}
        <div className={`w-full md:flex-1 md:flex flex-col bg-[#0b141a] h-full min-h-0 ${
          activePhone ? 'flex' : 'hidden md:flex'
        }`}>
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="bg-[#202c33] border-b border-slate-700/50 px-3 sm:px-4 py-3 flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
                {/* Mobile Back Button */}
                <button
                  type="button"
                  onClick={() => setActivePhone(null)}
                  className="p-1.5 -ms-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl md:hidden flex items-center justify-center shrink-0 transition-colors"
                  title={t('webhook.backToChats')}
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
                        title={t('webhook.botPausedTooltip')}
                      >
                        <Bot className="w-3 h-3 text-amber-400/80" />
                        <span className="hidden sm:inline">{t('webhook.manualChatBadge')}</span>
                        <span className="sm:hidden">{t('webhook.manualChatBadgeShort')}</span>
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
                  <span className="hidden xs:inline">{t('webhook.clearChat')}</span>
                </button>
              </div>

              {/* Message History */}
              <div
                ref={scrollContainerRef}
                onScroll={handleMessageScroll}
                className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 flex flex-col relative min-h-0"
                dir="ltr"
              >
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{ backgroundImage: "url('https://static.whatsapp.net/rsrc.php/v3/yl/r/rrotdJpG0qL.png')", backgroundRepeat: 'repeat' }}
                />
                <div className="relative z-10 flex-1 flex flex-col justify-end">
                  {/* Pagination control */}
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
                            <span>{t('webhook.loadingOlderMessages')}</span>
                          </>
                        ) : (
                          <>
                            <ArrowLeft className="w-3.5 h-3.5 rotate-90 text-indigo-400" />
                            <span>{t('webhook.loadOlderMessages')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {activePhone && hasMoreMessages[activePhone] === false && activeMessages.length > 0 && (
                    <div className="text-center py-2 text-[11px] text-slate-500 font-mono select-none my-1">
                      {t('webhook.conversationStart')}
                    </div>
                  )}

                  {activeMessages.length === 0 && (
                    <div className="text-center text-slate-600 text-sm py-8">{t('webhook.noMessages')}</div>
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

              {/* Input Area */}
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
