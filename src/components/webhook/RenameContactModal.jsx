import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, User, X, Check, RotateCcw, Loader2, Sparkles } from 'lucide-react';

export function RenameContactModal({
  isOpen,
  onClose,
  phone = '',
  currentName = '',
  waProfileName = '',
  isCustomName = false,
  onSave,
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName || waProfileName || phone || '');
      setErrorMsg('');
      setIsSaving(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, currentName, waProfileName, phone]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg(t('webhook.enterContactName') || 'Please enter a valid contact name');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      if (onSave) {
        await onSave(phone, trimmed, false);
      }
      setIsSaving(false);
      onClose();
    } catch (err) {
      console.error('Error renaming contact:', err);
      setErrorMsg(err.message || 'Failed to save contact name');
      setIsSaving(false);
    }
  };

  const handleResetToWa = async () => {
    if (!waProfileName && !phone) return;
    const targetName = waProfileName || phone;
    setIsSaving(true);
    setErrorMsg('');
    try {
      if (onSave) {
        // Passing resetToWa = true
        await onSave(phone, targetName, true);
      }
      setIsSaving(false);
      onClose();
    } catch (err) {
      console.error('Error resetting contact name:', err);
      setErrorMsg(err.message || 'Failed to reset contact name');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-[#1f2c33] border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700/60 bg-[#202c33] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {t('webhook.renameContact') || 'Rename Contact'}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                +{phone}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {t('webhook.editContactName') || 'Contact Name'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('webhook.enterContactName') || 'e.g. John Doe - Apt 101'}
                disabled={isSaving}
                className="w-full bg-[#111b21] border border-slate-700/80 rounded-xl ps-10 pe-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                dir="auto"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                  }
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {t('webhook.renameContactTip') || 'Customize how this contact appears across the dashboard.'}
            </p>
          </div>

          {/* Original WhatsApp Profile Name Suggestion */}
          {waProfileName && waProfileName !== name && (
            <div className="p-3 bg-slate-900/60 border border-slate-700/40 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  {t('webhook.originalWaName') || 'Original WhatsApp Name'}
                </span>
                <span className="text-xs font-semibold text-emerald-300 truncate block mt-0.5">
                  {waProfileName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setName(waProfileName)}
                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1"
                title={t('webhook.useWaName') || 'Use WhatsApp Name'}
              >
                <Sparkles className="w-3 h-3" />
                <span>{t('webhook.useWaName') || 'Use Name'}</span>
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-700/40">
            {isCustomName && waProfileName ? (
              <button
                type="button"
                onClick={handleResetToWa}
                disabled={isSaving}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title={t('webhook.resetToWaName') || 'Reset to WhatsApp Name'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('webhook.resetToWaName') || 'Reset Name'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
              >
                {t('common.cancel') || 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:bg-slate-700"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('common.saving') || 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('webhook.saveName') || 'Save Name'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
