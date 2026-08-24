import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function QuickRepliesModal({ isOpen, onClose, quickReply, onSave }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(quickReply?.id);

  useEffect(() => {
    if (isOpen) {
      setTitle(quickReply?.title || '');
      setContent(quickReply?.content || '');
      setError('');
      setIsSaving(false);
    }
  }, [isOpen, quickReply]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!title.trim()) {
      setError(t('webhook.quickReplyTitleRequired') || 'يرجى إدخال عنوان الرسالة');
      return;
    }
    if (!content.trim()) {
      setError(t('webhook.quickReplyContentRequired') || 'يرجى كتابة نص الرسالة');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSave({
        title: title.trim(),
        content: content.trim(),
      });
      onClose();
    } catch (err) {
      console.error('Failed to save quick reply:', err);
      setError(err.message || t('common.error') || 'فشل حفظ الرسالة');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-[#111b21] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#202c33] border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">
              {isEdit ? t('webhook.editQuickReply') : t('webhook.addQuickReply')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/60 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              {t('webhook.quickReplyTitle')} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('webhook.quickReplyTitlePlaceholder')}
              maxLength={80}
              className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              autoFocus
              dir="auto"
            />
            <div className="flex justify-end text-[10px] text-slate-500">
              <span>{title.length}/80</span>
            </div>
          </div>

          {/* Content Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              {t('webhook.quickReplyContent')} <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('webhook.quickReplyContentPlaceholder')}
              rows={5}
              maxLength={2000}
              className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-y min-h-[100px] max-h-[260px]"
              dir="auto"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span className="text-slate-400/80">{t('webhook.quickReplyTip') || 'يمكنك حفظ نصوص الردود اليومية أو روابط التقييم والمعلومات'}</span>
              <span>{content.length}/2000</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim() || !content.trim()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('common.loading')}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('common.save')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
