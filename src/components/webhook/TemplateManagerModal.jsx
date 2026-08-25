import { useState, useEffect, useRef } from 'react';
import {
  X,
  FileCode2,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Globe2,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const COMMON_LANGUAGES = [
  { code: 'ar', label: 'العربية (ar)' },
  { code: 'en_US', label: 'English US (en_US)' },
  { code: 'en_GB', label: 'English UK (en_GB)' },
  { code: 'en', label: 'English (en)' },
];

/**
 * Extracts {{1}}, {{2}}, etc. from text and returns the maximum index found or count.
 */
function extractVariablesFromText(text) {
  if (!text) return [];
  const matches = text.match(/\{\{(\d+)\}\}/g) || [];
  const indices = new Set();
  matches.forEach((m) => {
    const num = parseInt(m.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) indices.add(num);
  });
  const max = indices.size > 0 ? Math.max(...Array.from(indices)) : 0;
  return Array.from({ length: max }, (_, i) => i + 1);
}

export function TemplateManagerModal({
  isOpen,
  onClose,
  templates = [],
  editingTemplate = null,
  onSave,
  onDelete,
}) {
  const { t } = useTranslation();

  // Mode: 'list' or 'form'
  const [viewMode, setViewMode] = useState('list');
  const [currentEditItem, setCurrentEditItem] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('ar');
  const [customLanguage, setCustomLanguage] = useState('');
  const [text, setText] = useState('');
  const [variableNames, setVariableNames] = useState({}); // { 0: 'اسم العميل', 1: 'رقم الوحدة' }

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  const isEdit = Boolean(currentEditItem?.id);

  const resetForm = (item = null) => {
    if (item) {
      setCurrentEditItem(item);
      setName(item.name || '');
      const isStandardLang = COMMON_LANGUAGES.some((l) => l.code === item.language);
      if (isStandardLang) {
        setLanguage(item.language || 'ar');
        setCustomLanguage('');
      } else {
        setLanguage('other');
        setCustomLanguage(item.language || '');
      }
      setText(item.text || '');

      const initialVarNames = {};
      if (Array.isArray(item.variables)) {
        item.variables.forEach((v, idx) => {
          initialVarNames[idx] = v || '';
        });
      }
      setVariableNames(initialVarNames);
    } else {
      setCurrentEditItem(null);
      setName('');
      setLanguage('ar');
      setCustomLanguage('');
      setText('');
      setVariableNames({});
    }
    setError('');
    setIsSaving(false);
  };

  useEffect(() => {
    if (isOpen) {
      if (editingTemplate) {
        resetForm(editingTemplate);
        setViewMode('form');
      } else {
        resetForm(null);
        setViewMode(templates.length === 0 ? 'form' : 'list');
      }
    }
  }, [isOpen, editingTemplate, templates.length]);

  // Sync detected variables count with variableNames object
  const detectedVars = extractVariablesFromText(text);

  const handleInsertVariable = () => {
    const nextNum = detectedVars.length + 1;
    const placeholder = `{{${nextNum}}}`;
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart || text.length;
      const end = textarea.selectionEnd || text.length;
      const newText = text.slice(0, start) + placeholder + text.slice(end);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 50);
    } else {
      setText((prev) => (prev ? `${prev} ${placeholder}` : placeholder));
    }
  };

  const handleVarNameChange = (idx, val) => {
    setVariableNames((prev) => ({
      ...prev,
      [idx]: val,
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
    const effectiveLang = language === 'other' ? customLanguage.trim() : language;

    if (!cleanName) {
      setError(t('webhook.templateNameRequired') || 'يرجى إدخال اسم القالب المعتمد في ميتا');
      return;
    }
    if (!effectiveLang) {
      setError(t('webhook.templateLangRequired') || 'يرجى تحديد لغة القالب');
      return;
    }
    if (!text.trim()) {
      setError(t('webhook.templateTextRequired') || 'يرجى كتابة نص القالب');
      return;
    }

    // Build variables array matching detected variables count
    const finalVariables = detectedVars.map((num, idx) => {
      const customName = variableNames[idx]?.trim();
      return customName || `المتغير ${num}`;
    });

    setIsSaving(true);
    setError('');

    try {
      await onSave({
        id: currentEditItem?.id,
        name: cleanName,
        language: effectiveLang,
        text: text.trim(),
        variables: finalVariables,
      });
      setViewMode('list');
      resetForm(null);
    } catch (err) {
      console.error('Failed to save WhatsApp template:', err);
      setError(err.message || t('common.error') || 'فشل حفظ القالب');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (
      window.confirm(
        t('webhook.deleteTemplateConfirm', { name: item.name }) ||
          `هل أنت متأكد من حذف القالب (${item.name})؟`
      )
    ) {
      try {
        await onDelete(item.id);
        if (currentEditItem?.id === item.id) {
          resetForm(null);
          setViewMode('list');
        }
      } catch (err) {
        console.error('Failed to delete template:', err);
        setError(err.message || 'فشل حذف القالب');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-[#111b21] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
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
                <span>{t('webhook.templateManagerTitle') || 'إدارة قوالب الواتساب (Approved Templates)'}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-700/60 text-[10px] text-slate-300 font-mono">
                  {templates.length}
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'list' ? (
              <button
                type="button"
                onClick={() => {
                  resetForm(null);
                  setViewMode('form');
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('webhook.addNewTemplate') || 'إضافة قالب جديد'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{t('webhook.backToTemplatesList') || 'عرض القوالب'}</span>
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {viewMode === 'list' ? (
            /* ── Templates List View ────────────────────────────── */
            <div className="p-4 sm:p-5 space-y-3">
              {templates.length === 0 ? (
                <div className="py-14 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500 mb-1">
                    <FileCode2 className="w-7 h-7 text-emerald-400/60" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">
                    {t('webhook.noTemplates') || 'لا توجد قوالب واتساب محفوظة بعد'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    {t('webhook.noTemplatesHint') || 'أضف اسم القالب المعتمد في Meta واللغة ونص القالب مع تسمية المتغيرات لإرسالها بنقرة واحدة.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm(null);
                      setViewMode('form');
                    }}
                    className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('webhook.addNewTemplate') || 'إضافة أول قالب'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((tpl) => {
                    const varCount = Array.isArray(tpl.variables) ? tpl.variables.length : 0;
                    return (
                      <div
                        key={tpl.id}
                        className="p-4 bg-[#1f2c34]/80 hover:bg-[#202c33] border border-slate-700/50 hover:border-emerald-500/30 rounded-xl transition-all flex flex-col gap-2.5 group shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-mono font-bold text-emerald-400">
                              {tpl.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-semibold">
                              {tpl.language}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                resetForm(tpl);
                                setViewMode('form');
                              }}
                              className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                            >
                              <Edit2 className="w-3 h-3 text-indigo-400" />
                              <span>{t('common.edit') || 'تعديل'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(tpl)}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title={t('common.delete') || 'حذف'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Template Text Preview */}
                        {tpl.text && (
                          <p className="text-xs text-slate-200 bg-[#111b21]/70 p-3 rounded-lg border border-white/5 leading-relaxed whitespace-pre-wrap font-normal" dir="auto">
                            {tpl.text}
                          </p>
                        )}

                        {/* Variables List */}
                        {varCount > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center pt-1">
                            <span className="text-[11px] text-slate-400 font-medium">{t('webhook.variablesCount', { count: varCount }) || `المتغيرات (${varCount}):`}</span>
                            {tpl.variables.map((v, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-[#2a3942] text-emerald-300 text-xs border border-emerald-500/20 font-medium"
                              >
                                <span className="font-mono text-slate-400 text-[10px] mr-1">{'{{' + (i + 1) + '}}'}</span>
                                <span>{v}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            {t('webhook.noVariablesStatic') || 'بدون متغيرات (إرسال فوري بنقرة واحدة)'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── Add / Edit Form View ────────────────────────────── */
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-400 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Meta Template Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    {t('webhook.metaTemplateName') || 'اسم القالب في ميتا (Template Name)'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    placeholder="e.g. booking_confirmation, welcome_msg"
                    className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-emerald-400 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                    dir="ltr"
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-500 block">
                    {t('webhook.metaNameTip') || 'الاسم المطابق تماماً للقالب المعتمد في WhatsApp Manager.'}
                  </span>
                </div>

                {/* Language Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t('webhook.templateLanguage') || 'اللغة (Language)'} <span className="text-rose-400">*</span></span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => setLanguage(l.code)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                          language === l.code
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-sm'
                            : 'bg-[#2a3942] border-slate-700 text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                  {language === 'other' && (
                    <input
                      type="text"
                      value={customLanguage}
                      onChange={(e) => setCustomLanguage(e.target.value)}
                      placeholder="e.g. ar_SA, fr, ur"
                      className="mt-2 w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  )}
                </div>
              </div>

              {/* Template Text Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    {t('webhook.templateTextLabel') || 'نص القالب المعتمد (Template Text Body)'} <span className="text-rose-400">*</span>
                  </label>

                  {/* Insert Variable Button */}
                  <button
                    type="button"
                    onClick={handleInsertVariable}
                    className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Insert variable placeholder like {{1}}"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{`+ إضافة متغير {{${detectedVars.length + 1}}}`}</span>
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    t('webhook.templateTextPlaceholder') ||
                    'اكتب أو الصق نص القالب هنا...\nمثال: مرحباً بك يا {{1}}، تم تأكيد حجزك للوحدة رقم {{2}} بمبلغ {{3}} ريال.'
                  }
                  rows={4}
                  className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-y min-h-[90px]"
                  dir="auto"
                />
                <span className="text-[10px] text-slate-500 block">
                  {t('webhook.templateTextTip') || 'يمكنك كتابة المتغيرات يدوياً مثل {{1}}، {{2}} أو النقر على زر إضافة متغير.'}
                </span>
              </div>

              {/* Naming Each Detected Variable */}
              {detectedVars.length > 0 ? (
                <div className="space-y-3 p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('webhook.nameEachVariable') || 'تسمية كل متغير (Naming Variables):'}</span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {detectedVars.length} {t('webhook.variablesSuffix') || 'متغيرات تم رصدها'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    {t('webhook.nameVarsTip') || 'حدد اسماً توضيحياً لكل متغير ليظهر لك عند إرسال القالب للعملاء:'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {detectedVars.map((num, idx) => (
                      <div key={num} className="space-y-1 bg-[#202c33] p-2.5 rounded-xl border border-slate-700/60">
                        <label className="block text-xs font-semibold text-emerald-300 flex items-center justify-between">
                          <span>
                            <span className="font-mono text-emerald-400 font-bold mr-1">{'{{' + num + '}}'}</span>
                            <span>{t('webhook.variableLabel', { num }) || `المتغير رقم ${num}`}</span>
                          </span>
                        </label>
                        <input
                          type="text"
                          value={variableNames[idx] || ''}
                          onChange={(e) => handleVarNameChange(idx, e.target.value)}
                          placeholder={
                            idx === 0
                              ? 'مثال: اسم العميل'
                              : idx === 1
                              ? 'مثال: رقم الوحدة'
                              : idx === 2
                              ? 'مثال: المبلغ'
                              : `اسم المتغير ${num}`
                          }
                          className="w-full bg-[#2a3942] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{t('webhook.noVarsInText') || 'القالب حالياً بدون متغيرات (سيتم إرساله بنقرة واحدة مباشرة).'}</span>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !name.trim() || !text.trim()}
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
                      <span>{isEdit ? t('common.save') : t('webhook.saveTemplateBtn') || 'حفظ القالب'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
