import { useState, useMemo } from 'react';
import {
  X,
  FileCode2,
  Search,
  Send,
  Plus,
  Loader2,
  Check,
  AlertCircle,
  Settings,
  CornerDownLeft,
  Globe2,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function TemplatePickerModal({
  isOpen,
  onClose,
  templates = [],
  activePhone = '',
  contactName = '',
  onSendTemplate,
  onOpenManager,
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [paramValues, setParamValues] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase().trim();
    return templates.filter(
      (tpl) =>
        tpl.title?.toLowerCase().includes(q) ||
        tpl.name?.toLowerCase().includes(q) ||
        tpl.description?.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl) => {
    setErrorMsg('');
    setSuccessMsg('');
    const varCount = Array.isArray(tpl.variables) ? tpl.variables.length : 0;

    // If static template (0 variables), we can prompt or send directly
    if (varCount === 0) {
      setSelectedTemplate(tpl);
      setParamValues({});
    } else {
      setSelectedTemplate(tpl);
      const initialParams = {};
      tpl.variables.forEach((_, idx) => {
        initialParams[idx] = '';
      });
      setParamValues(initialParams);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate || !activePhone || isSending) return;
    setErrorMsg('');
    setSuccessMsg('');

    const varList = Array.isArray(selectedTemplate.variables) ? selectedTemplate.variables : [];
    const parameters = varList.map((_, idx) => String(paramValues[idx] || '').trim());

    // Validate that all required parameters are entered
    const missingIndex = parameters.findIndex((val) => !val);
    if (varList.length > 0 && missingIndex !== -1) {
      const varName = varList[missingIndex] || `{{${missingIndex + 1}}}`;
      setErrorMsg(t('webhook.variableRequired', { name: varName }) || `يرجى إدخال قيمة المتغير (${varName})`);
      return;
    }

    setIsSending(true);

    try {
      await onSendTemplate({
        to: activePhone,
        templateName: selectedTemplate.name,
        language: selectedTemplate.language || 'ar',
        parameters,
        displayName: selectedTemplate.title || selectedTemplate.name,
      });

      setSuccessMsg(t('webhook.templateSentSuccess') || 'تم إرسال قالب الواتساب بنجاح!');
      setTimeout(() => {
        setIsSending(false);
        onClose();
        setSelectedTemplate(null);
      }, 1200);
    } catch (err) {
      console.error('Failed to send template:', err);
      setErrorMsg(err.message || t('common.error') || 'فشل إرسال القالب');
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl bg-[#111b21] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        dir="auto"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#202c33] border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileCode2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{t('webhook.sendApprovedTemplate') || 'إرسال قالب واتساب معتمد'}</span>
              </h3>
              {activePhone && (
                <p className="text-xs text-slate-400 font-mono flex items-center gap-1" dir="ltr">
                  <span>To:</span>
                  <span className="text-emerald-400 font-semibold">{contactName || `+${activePhone}`}</span>
                  <span className="text-slate-500">(+{activePhone})</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenManager && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenManager();
                }}
                className="p-2 text-slate-400 hover:text-emerald-300 hover:bg-slate-700/60 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
                title={t('webhook.manageTemplates') || 'إدارة وحفظ القوالب'}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">{t('webhook.manageTemplatesShort') || 'إدارة القوالب'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/60 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar (when choosing template) */}
        {!selectedTemplate && (
          <div className="p-3 bg-[#182229] border-b border-slate-800/80 flex-shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 rtl:left-auto rtl:right-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('webhook.searchTemplatesPlaceholder') || 'بحث في القوالب المعتمدة...'}
                className="w-full bg-[#2a3942] border-0 rounded-xl pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0">
          {errorMsg && (
            <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-300 font-semibold">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {selectedTemplate ? (
            /* ── Step 2: Fill Parameters & Confirm Send ─────────────── */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors mb-2 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{t('webhook.changeTemplate') || 'اختيار قالب آخر'}</span>
              </button>

              {/* Selected Template Summary Card */}
              <div className="p-3.5 bg-[#1f2c34] border border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-bold text-white">{selectedTemplate.title}</h4>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-semibold">
                    {selectedTemplate.language}
                  </span>
                </div>
                <p className="text-xs font-mono text-emerald-400 mb-1">name: {selectedTemplate.name}</p>
                {selectedTemplate.description && (
                  <p className="text-xs text-slate-400">{selectedTemplate.description}</p>
                )}
              </div>

              {/* Dynamic Variable Inputs */}
              {selectedTemplate.variables && selectedTemplate.variables.length > 0 ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('webhook.fillVariables') || 'إدخال قيم متغيرات القالب:'}</span>
                    </label>
                  </div>

                  {selectedTemplate.variables.map((varName, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="block text-xs font-medium text-slate-400">
                        <span className="font-mono text-emerald-400 font-semibold mr-1.5">{'{{' + (idx + 1) + '}}'}</span>
                        <span>{varName}</span> <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={paramValues[idx] || ''}
                        onChange={(e) =>
                          setParamValues((prev) => ({
                            ...prev,
                            [idx]: e.target.value,
                          }))
                        }
                        placeholder={t('webhook.varValuePlaceholder', { name: varName }) || `أدخل ${varName}`}
                        className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                        autoFocus={idx === 0}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-slate-400">
                  {t('webhook.noVariablesRequired') || 'هذا القالب جاهز للإرسال الفوري ولا يتطلب إدخال متغيرات.'}
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  disabled={isSending}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
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
                      <span className="rtl:-scale-x-100">{t('webhook.sendTemplateBtn') || 'إرسال القالب'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ── Step 1: Select Template from Grid ──────────────────── */
            <div className="space-y-3">
              {filteredTemplates.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                  <FileCode2 className="w-8 h-8 text-slate-600 mb-1" />
                  <p className="text-xs font-semibold text-slate-300">
                    {searchQuery ? t('webhook.noMatchingTemplates') || 'لا توجد قوالب مطابقة' : t('webhook.noTemplates') || 'لا توجد قوالب محفوظة'}
                  </p>
                  {onOpenManager && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenManager();
                      }}
                      className="mt-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('webhook.addNewTemplate') || 'إضافة قالب جديد'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((tpl) => {
                    const varCount = Array.isArray(tpl.variables) ? tpl.variables.length : 0;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className="p-3 bg-[#1f2c34]/70 hover:bg-[#202c33] border border-slate-700/50 hover:border-emerald-500/40 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-emerald-300 transition-colors truncate">
                              {tpl.title}
                            </h4>
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono">
                              {tpl.language}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500 truncate" dir="ltr">
                            name: {tpl.name}
                          </p>
                          {tpl.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                              {tpl.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {varCount > 0 ? (
                            <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                              {varCount} {t('webhook.variablesSuffix') || 'متغيرات'}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-semibold">
                              {t('webhook.oneClickSend') || 'إرسال فوري'}
                            </span>
                          )}

                          <button
                            type="button"
                            className="w-8 h-8 rounded-full bg-emerald-600 group-hover:bg-emerald-500 text-white flex items-center justify-center transition-transform group-hover:scale-105 shadow rtl:-scale-x-100"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
