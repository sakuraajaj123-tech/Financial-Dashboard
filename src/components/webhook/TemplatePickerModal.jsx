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
  Layers,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Helper to compute live preview of template text with substituted variables.
 */
function renderLivePreview(text, paramValues, variables = []) {
  if (!text) return '';
  let preview = text;
  variables.forEach((_, idx) => {
    const placeholder = `{{${idx + 1}}}`;
    const val = paramValues[idx];
    const replacement = val && val.trim() ? val.trim() : placeholder;
    preview = preview.split(placeholder).join(replacement);
  });
  return preview;
}

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
        tpl.name?.toLowerCase().includes(q) ||
        tpl.text?.toLowerCase().includes(q) ||
        tpl.language?.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl) => {
    setErrorMsg('');
    setSuccessMsg('');
    const varCount = Array.isArray(tpl.variables) ? tpl.variables.length : 0;

    setSelectedTemplate(tpl);
    const initialParams = {};
    if (varCount > 0) {
      tpl.variables.forEach((_, idx) => {
        initialParams[idx] = '';
      });
    }
    setParamValues(initialParams);
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
      setErrorMsg(
        t('webhook.variableRequired', { name: varName }) ||
          `يرجى إدخال قيمة المتغير (${varName})`
      );
      return;
    }

    setIsSending(true);

    try {
      await onSendTemplate({
        to: activePhone,
        templateName: selectedTemplate.name,
        language: selectedTemplate.language || 'ar',
        parameters,
        displayName: selectedTemplate.name,
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
                className="px-2.5 py-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-700/60 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
                title={t('webhook.manageTemplates') || 'إدارة وحفظ القوالب'}
              >
                <Settings className="w-3.5 h-3.5" />
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
        {!selectedTemplate && templates.length > 0 && (
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
            <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-400 font-medium">
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
            /* ── Step 2: Fill Parameters & Live Preview ─────────────── */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors mb-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{t('webhook.changeTemplate') || 'اختيار قالب آخر'}</span>
              </button>

              {/* Selected Template Summary Card */}
              <div className="p-3.5 bg-[#1f2c34] border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400">{selectedTemplate.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-semibold">
                      {selectedTemplate.language}
                    </span>
                  </div>
                </div>
                {selectedTemplate.text && (
                  <p className="text-xs text-slate-300 bg-[#111b21]/80 p-2.5 rounded-lg border border-white/5 whitespace-pre-wrap leading-relaxed">
                    {selectedTemplate.text}
                  </p>
                )}
              </div>

              {/* Dynamic Variable Inputs */}
              {selectedTemplate.variables && selectedTemplate.variables.length > 0 ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('webhook.fillVariables') || 'إدخال قيم المتغيرات:'}</span>
                    </label>
                  </div>

                  {selectedTemplate.variables.map((varName, idx) => (
                    <div key={idx} className="space-y-1 bg-[#202c33] p-3 rounded-xl border border-slate-700/60">
                      <label className="block text-xs font-medium text-slate-300 flex items-center justify-between">
                        <span>
                          <span className="font-mono text-emerald-400 font-bold mr-1.5">{'{{' + (idx + 1) + '}}'}</span>
                          <span className="font-semibold text-emerald-200">{varName}</span>
                        </span>
                        <span className="text-[10px] text-rose-400 font-normal">* مطلوب</span>
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
                        className="w-full bg-[#2a3942] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                        autoFocus={idx === 0}
                      />
                    </div>
                  ))}

                  {/* Live Message Preview */}
                  {selectedTemplate.text && (
                    <div className="mt-3 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('webhook.livePreview') || 'معاينة الرسالة الحية قبل الإرسال:'}</span>
                      </div>
                      <div className="p-3 bg-[#111b21] rounded-lg border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {renderLivePreview(selectedTemplate.text, paramValues, selectedTemplate.variables)}
                      </div>
                    </div>
                  )}
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
            /* ── Step 1: Select Template from List ──────────────────── */
            <div className="space-y-3">
              {filteredTemplates.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-2.5 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500">
                    <FileCode2 className="w-6 h-6 text-emerald-400/60" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">
                    {searchQuery
                      ? t('webhook.noMatchingTemplates') || 'لا توجد قوالب مطابقة للبحث'
                      : t('webhook.noTemplates') || 'لا توجد قوالب محفوظة بعد'}
                  </p>
                  {onOpenManager && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenManager();
                      }}
                      className="mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('webhook.addNewTemplate') || 'إضافة قالب جديد'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTemplates.map((tpl) => {
                    const varCount = Array.isArray(tpl.variables) ? tpl.variables.length : 0;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className="p-3.5 bg-[#1f2c34]/80 hover:bg-[#202c33] border border-slate-700/50 hover:border-emerald-500/40 rounded-xl transition-all cursor-pointer flex flex-col gap-2 group shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-mono font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                              {tpl.name}
                            </h4>
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono">
                              {tpl.language}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {varCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                                {varCount} {t('webhook.variablesSuffix') || 'متغيرات'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-semibold">
                                {t('webhook.oneClickSend') || 'إرسال فوري'}
                              </span>
                            )}
                            <button
                              type="button"
                              className="w-7 h-7 rounded-full bg-emerald-600 group-hover:bg-emerald-500 text-white flex items-center justify-center transition-transform group-hover:scale-105 shadow rtl:-scale-x-100"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Template Text Snippet */}
                        {tpl.text && (
                          <p className="text-xs text-slate-300 bg-[#111b21]/60 p-2.5 rounded-lg border border-white/5 line-clamp-2 leading-relaxed whitespace-pre-wrap font-normal" dir="auto">
                            {tpl.text}
                          </p>
                        )}
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
