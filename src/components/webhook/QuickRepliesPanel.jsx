import { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Send,
  Edit2,
  Trash2,
  CornerDownLeft,
  X,
  MessageSquare,
  Loader2,
  Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function QuickRepliesPanel({
  isOpen,
  onClose,
  quickReplies = [],
  loading = false,
  onUse,
  onSend,
  onAddNew,
  onEdit,
  onDelete,
  activePhone = null,
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [sentSuccessId, setSentSuccessId] = useState(null);

  const filteredReplies = useMemo(() => {
    if (!searchQuery.trim()) return quickReplies;
    const q = searchQuery.toLowerCase().trim();
    return quickReplies.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.content?.toLowerCase().includes(q)
    );
  }, [quickReplies, searchQuery]);

  if (!isOpen) return null;

  const handleSendDirect = async (item) => {
    if (!onSend || sendingId) return;
    setSendingId(item.id);
    try {
      await onSend(item.content);
      setSentSuccessId(item.id);
      setTimeout(() => {
        setSentSuccessId(null);
        setSendingId(null);
      }, 1800);
    } catch (err) {
      console.error('Failed to send quick reply:', err);
      setSendingId(null);
    }
  };

  const handleUse = (item) => {
    if (onUse) {
      onUse(item.content);
    }
    onClose();
  };

  const handleDelete = (e, item) => {
    e.stopPropagation();
    if (window.confirm(t('webhook.deleteQuickReplyConfirm') || 'هل أنت متأكد من حذف هذه الرسالة المختصرة؟')) {
      onDelete(item.id);
    }
  };

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-30 mb-2 mx-2 sm:mx-3 bg-[#111b21]/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[380px] sm:max-h-[420px] animate-scale-up"
      dir="auto"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#202c33] border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{t('webhook.quickReplies')}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-700/60 text-[10px] text-slate-300 font-mono">
              {quickReplies.length}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAddNew}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{t('webhook.addQuickReply')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/60 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Filter (shown if there are items or user is searching) */}
      {(quickReplies.length > 3 || searchQuery) && (
        <div className="p-2.5 bg-[#182229] border-b border-slate-800/80 flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 left-3 rtl:left-auto rtl:right-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('webhook.searchQuickReplies')}
              className="w-full bg-[#2a3942] border-0 rounded-xl pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 -translate-y-1/2 right-2.5 rtl:right-auto rtl:left-2.5 text-slate-400 hover:text-white text-xs"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Replies List Body */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0 divide-y-0">
        {loading ? (
          <div className="py-10 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span className="text-xs">{t('common.loading')}</span>
          </div>
        ) : filteredReplies.length === 0 ? (
          <div className="py-8 px-4 text-center flex flex-col items-center justify-center gap-2.5 text-slate-400">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500 mb-1">
              <MessageSquare className="w-6 h-6 text-emerald-400/60" />
            </div>
            <p className="text-xs font-semibold text-slate-300">
              {searchQuery ? t('webhook.noMatchingQuickReplies') || 'لا توجد نتائج مطابقة' : t('webhook.noQuickReplies')}
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
              {searchQuery ? t('webhook.tryDifferentSearch') || 'جرب البحث بكلمة أخرى' : t('webhook.noQuickRepliesHint')}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={onAddNew}
                className="mt-2 px-3.5 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('webhook.addQuickReply')}</span>
              </button>
            )}
          </div>
        ) : (
          filteredReplies.map((item) => {
            const isSendingThis = sendingId === item.id;
            const isSentSuccess = sentSuccessId === item.id;

            return (
              <div
                key={item.id}
                className="p-3 bg-[#1f2c34]/70 hover:bg-[#202c33] border border-slate-700/40 hover:border-emerald-500/30 rounded-xl transition-all flex flex-col gap-2 group/card shadow-sm"
              >
                {/* Title & Actions Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-bold truncate">
                      {item.title}
                    </span>
                  </div>

                  {/* Top-right edit/delete icons */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/card:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      title={t('webhook.editQuickReply')}
                      className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item)}
                      title={t('common.delete')}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content snippet */}
                <p className="text-xs text-slate-200 leading-relaxed font-normal whitespace-pre-wrap line-clamp-3 bg-slate-900/40 p-2 rounded-lg border border-white/5">
                  {item.content}
                </p>

                {/* Buttons row */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {/* Use / Insert Button */}
                  <button
                    type="button"
                    onClick={() => handleUse(item)}
                    title={t('webhook.useQuickReplyTooltip') || 'إدراج النص في صندوق الكتابة للتعديل عليه'}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <CornerDownLeft className="w-3 h-3 text-indigo-400" />
                    <span>{t('webhook.useQuickReply')}</span>
                  </button>

                  {/* One-Click Direct Send Button */}
                  {activePhone && (
                    <button
                      type="button"
                      onClick={() => handleSendDirect(item)}
                      disabled={isSendingThis}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm rtl:-scale-x-100"
                    >
                      {isSendingThis ? (
                        <Loader2 className="w-3 h-3 animate-spin rtl:-scale-x-100" />
                      ) : isSentSuccess ? (
                        <Check className="w-3 h-3 text-emerald-200 rtl:-scale-x-100" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span className="rtl:-scale-x-100">
                        {isSentSuccess ? t('webhook.termsSent') : t('webhook.sendQuickReply')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
