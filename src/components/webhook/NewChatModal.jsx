import { useState, useMemo } from 'react';
import {
  X,
  UserPlus,
  Send,
  Phone,
  User,
  FileCode2,
  Loader2,
  Check,
  AlertCircle,
  Settings,
  Layers,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NewChatModal({
  isOpen,
  onClose,
  templates = [],
  onSendAndStartChat,
  onOpenTemplateManager,
}) {
  const { t } = useTranslation();

  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [paramValues, setParamValues] = useState({});
  const [templateSearch, setTemplateSearch] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected template object
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || (templates.length > 0 ? templates[0] : null);
  }, [templates, selectedTemplateId]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const q = templateSearch.toLowerCase().trim();
    return templates.filter(
      (tpl) =>
        tpl.title?.toLowerCase().includes(q) ||
        tpl.name?.toLowerCase().includes(q)
    );
  }, [templates, templateSearch]);

  if (!isOpen) return null;

  const handleTemplateChange = (tplId) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl && Array.isArray(tpl.variables)) {
      const initial = {};
      tpl.variables.forEach((_, idx) => {
        initial[idx] = '';
      });
      setParamValues(initial);
    } else {
      setParamValues({});
    }
  };

  const handleParamChange = (idx, value) => {
    setParamValues((prev) => ({
      ...prev,
      [idx]: value,
    }));
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    setErrorMsg('');

    const cleanPhone = phone.replace(/[^0-9]/g, '').trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMsg(t('webhook.invalidPhoneNumber') || 'يرجى إدخال رقم هاتف دولي صحيح (مثال: 9665XXXXXXXX)');
      return;
    }

    if (!activeTemplate) {
      setErrorMsg(t('webhook.selectTemplateRequired') || 'يرجى اختيار قالب معتمد لإرساله للرقم الجديد');
      return;
    }

    const varList = Array.isArray(activeTemplate.variables) ? activeTemplate.variables : [];
    const parameters = varList.map((_, idx) => String(paramValues[idx] || '').trim());

    const missingIndex = parameters.findIndex((val) => !val);
    if (varList.length > 0 && missingIndex !== -1) {
      const varName = varList[missingIndex] || `{{${missingIndex + 1}}}`;
      setErrorMsg(t('webhook.variableRequired', { name: varName }) || `يرجى إدخال قيمة المتغير (${varName})`);
      return;
    }

    setIsSending(true);

    try {
      await onSendAndStartChat({
        phone: cleanPhone,
        contactName: contactName.trim() || cleanPhone,
        templateName: activeTemplate.name,
        language: activeTemplate.language || 'ar',
        parameters,
        displayName: activeTemplate.title || activeTemplate.name,
      });

      setIsSending(false);
      onClose();
      // Reset state
      setPhone('');
      setContactName('');
      setParamValues({});
    } catch (err) {
      console.error('Failed to send template to new number:', err);
      setErrorMsg(err.message || t('common.error') || 'فشل إرسال الرسالة إلى الرقم الجديد');
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl bg-[#111b21] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        dir="auto"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#202c33] border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{t('webhook.startNewChatTitle') || 'بدء محادثة مع رقم جديد (إرسال قالب)'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {t('webhook.startNewChatSubtitle') || 'أرسل رسالة بقالب معتمد لرقم جديد لفتح نافذة المحادثة.'}
              </p>
            </div>
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
        <form onSubmit={handleSend} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-400 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Recipient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('webhook.recipientPhone') || 'رقم هاتف المستلم'} <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="966500000000"
                className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                dir="ltr"
                autoFocus
              />
              <span className="text-[10px] text-slate-500 block">
                {t('webhook.phoneHint') || 'مع رمز الدولة بدون صفر أو علامة + (مثال: 9665XXXXXXXX)'}
              </span>
            </div>

            {/* Contact Name (Optional) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t('webhook.recipientName') || 'اسم جهة الاتصال (اختياري)'}</span>
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={t('webhook.namePlaceholder') || 'مثال: محمد الغامدي'}
                className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
              <span className="text-[10px] text-slate-500 block">
                {t('webhook.contactNameTip') || 'لتمييز المحادثة في قائمة الرسائل.'}
              </span>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('webhook.chooseTemplate') || 'اختر القالب المعتمد للإرسال'} <span className="text-rose-400">*</span></span>
              </label>
              {onOpenTemplateManager && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTemplateManager();
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  <span>{t('webhook.manageTemplates') || 'إدارة القوالب'}</span>
                </button>
              )}
            </div>

            {/* Templates Selector Dropdown / Grid */}
            {templates.length === 0 ? (
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                {t('webhook.noTemplates') || 'لا توجد قوالب محفوظة.'}{' '}
                {onOpenTemplateManager && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTemplateManager();
                    }}
                    className="text-emerald-400 underline ml-1"
                  >
                    {t('webhook.addNewTemplate') || 'أضف قالباً الآن'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin">
                {templates.map((tpl) => {
                  const isSelected = activeTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleTemplateChange(tpl.id)}
                      className={`p-2.5 rounded-xl border text-left rtl:text-right cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                          : 'bg-[#1f2c34]/70 border-slate-700/60 hover:bg-[#202c33] text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold truncate">{tpl.title}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                          {tpl.language}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 truncate" dir="ltr">
                        {tpl.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dynamic Variables if selected template requires them */}
          {activeTemplate && activeTemplate.variables && activeTemplate.variables.length > 0 && (
            <div className="space-y-3 p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('webhook.fillVariables') || 'قيم متغيرات القالب:'}</span>
              </label>

              {activeTemplate.variables.map((varName, idx) => (
                <div key={idx} className="space-y-1">
                  <label className="block text-xs font-medium text-slate-400">
                    <span className="font-mono text-emerald-400 mr-1.5">{'{{' + (idx + 1) + '}}'}</span>
                    <span>{varName}</span> <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={paramValues[idx] || ''}
                    onChange={(e) => handleParamChange(idx, e.target.value)}
                    placeholder={t('webhook.varValuePlaceholder', { name: varName }) || `أدخل ${varName}`}
                    className="w-full bg-[#202c33] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSending || !phone.trim() || !activeTemplate}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md rtl:-scale-x-100"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin rtl:-scale-x-100" />
                  <span className="rtl:-scale-x-100">{t('common.loading')}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span className="rtl:-scale-x-100">{t('webhook.sendAndStartChat') || 'إرسال وبدء المحادثة'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
