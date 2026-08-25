import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  FileCode2,
  Globe2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const COMMON_LANGUAGES = [
  { code: 'ar', label: 'العربية (ar)' },
  { code: 'en_US', label: 'English US (en_US)' },
  { code: 'en_GB', label: 'English UK (en_GB)' },
  { code: 'en', label: 'English (en)' },
];

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
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('ar');
  const [customLanguage, setCustomLanguage] = useState('');
  const [variables, setVariables] = useState([]);
  const [newVarInput, setNewVarInput] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(currentEditItem?.id && !String(currentEditItem.id).startsWith('default_'));

  const resetForm = (item = null) => {
    if (item) {
      setCurrentEditItem(item);
      setTitle(item.title || '');
      setName(item.name || '');
      const isStandardLang = COMMON_LANGUAGES.some((l) => l.code === item.language);
      if (isStandardLang) {
        setLanguage(item.language || 'ar');
        setCustomLanguage('');
      } else {
        setLanguage('other');
        setCustomLanguage(item.language || '');
      }
      setVariables(Array.isArray(item.variables) ? [...item.variables] : []);
      setDescription(item.description || '');
    } else {
      setCurrentEditItem(null);
      setTitle('');
      setName('');
      setLanguage('ar');
      setCustomLanguage('');
      setVariables([]);
      setDescription('');
    }
    setNewVarInput('');
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

  if (!isOpen) return null;

  const handleAddVariable = (e) => {
    e?.preventDefault();
    if (!newVarInput.trim()) return;
    setVariables((prev) => [...prev, newVarInput.trim()]);
    setNewVarInput('');
  };

  const handleRemoveVariable = (index) => {
    setVariables((prev) => prev.filter((_, idx) => idx !== index));
  };

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

    setIsSaving(true);
    setError('');

    try {
      await onSave({
        id: currentEditItem?.id,
        title: title.trim() || cleanName,
        name: cleanName,
        language: effectiveLang,
        variables,
        description: description.trim(),
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
    if (window.confirm(t('webhook.deleteTemplateConfirm', { name: item.title || item.name }) || 'هل أنت متأكد من حذف هذا القالب؟')) {
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
                <span>{t('webhook.templateManagerTitle') || 'إدارة قوالب الواتساب المعتمدة (Templates)'}</span>
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
                <div className="py-12 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500 mb-1">
                    <FileCode2 className="w-7 h-7 text-emerald-400/60" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">
                    {t('webhook.noTemplates') || 'لا توجد قوالب واتساب محفوظة بعد'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    {t('webhook.noTemplatesHint') || 'أضف أسماء قوالب الرسائل المعتمدة في حساب Meta Cloud API لإرسالها للعملاء بنقرة واحدة.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm(null);
                      setViewMode('form');
                    }}
                    className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('webhook.addNewTemplate') || 'إضافة أول قالب'}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3.5 bg-[#1f2c34]/80 hover:bg-[#202c33] border border-slate-700/50 hover:border-emerald-500/30 rounded-xl transition-all flex flex-col justify-between gap-2.5 group shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-sm font-bold text-slate-100 truncate" title={tpl.title}>
                            {tpl.title}
                          </h4>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-semibold">
                              {tpl.language}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-slate-900/60 px-2.5 py-1 rounded-lg border border-white/5 mb-2">
                          <span className="text-slate-500 select-none">name:</span>
                          <span className="font-semibold truncate">{tpl.name}</span>
                        </div>

                        {tpl.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                            {tpl.description}
                          </p>
                        )}

                        {tpl.variables && tpl.variables.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center pt-1">
                            <span className="text-[10px] text-slate-500">{t('webhook.variablesCount', { count: tpl.variables.length }) || `المتغيرات (${tpl.variables.length}):`}</span>
                            {tpl.variables.map((v, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700/50"
                              >
                                {'{{' + (i + 1) + '}}'} {v}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic block pt-1">
                            {t('webhook.noVariablesStatic') || 'بدون متغيرات (إرسال فوري بنقرة واحدة)'}
                          </span>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800/80">
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
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title={t('common.delete') || 'حذف'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
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
                {/* Friendly Title */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    {t('webhook.templateFriendlyTitle') || 'الاسم التوضيحي للقالب'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('webhook.templateTitlePlaceholder') || 'مثال: ترحيب بالعميل الجديد / عرض الشتاء'}
                    className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-500 block">
                    {t('webhook.templateTitleTip') || 'اسم يسهل تذكره في لوحة التحكم للتعرف على القالب.'}
                  </span>
                </div>

                {/* Meta Template Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    {t('webhook.metaTemplateName') || 'اسم القالب في ميتا (Template Name)'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    placeholder="e.g. booking_confirmation, welcome_guest"
                    className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-emerald-400 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    {t('webhook.metaNameTip') || 'الاسم المطابق تماماً للقالب المعتمد في WhatsApp Manager (حروف إنجليزية صغيرة بدون مسافات).'}
                  </span>
                </div>
              </div>

              {/* Language Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t('webhook.templateLanguage') || 'لغة القالب المعتمدة'} <span className="text-rose-400">*</span></span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    className="mt-2 w-full sm:w-1/2 bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    dir="ltr"
                  />
                )}
              </div>

              {/* Dynamic Variables */}
              <div className="space-y-2 p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('webhook.templateVariables') || 'متغيرات نص القالب (Body Variables)'}</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {t('webhook.variablesOptional') || 'اختياري (اتركه فارغاً إذا كان القالب بدون متغيرات)'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t('webhook.variablesHelp') || 'إذا كان نص القالب يحتوي على {{1}}, {{2}}، أضف أسماء توضيحية لكل متغير لمساعدتك عند الإرسال.'}
                </p>

                {/* Variables Chips */}
                {variables.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 pb-2">
                    {variables.map((v, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2a3942] border border-emerald-500/30 text-emerald-300 text-xs font-medium"
                      >
                        <span className="font-mono text-[10px] text-slate-400">{'{{' + (idx + 1) + '}}'}</span>
                        <span>{v}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariable(idx)}
                          className="hover:text-rose-400 text-slate-400 transition-colors ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add Variable Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newVarInput}
                    onChange={(e) => setNewVarInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddVariable(e);
                      }
                    }}
                    placeholder={
                      t('webhook.addVarPlaceholder', { num: variables.length + 1 }) ||
                      `اسم المتغير {{${variables.length + 1}}} (مثال: اسم العميل، المبلغ، التاريخ)`
                    }
                    className="flex-1 bg-[#202c33] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddVariable}
                    disabled={!newVarInput.trim()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('webhook.addVarBtn') || 'إضافة المتغير'}</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {t('webhook.templateNotes') || 'ملاحظات / وصف القالب (اختياري)'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('webhook.templateNotesPlaceholder') || 'مثال: يرسل للعملاء بعد تأكيد الحجز مباشرة'}
                  className="w-full bg-[#2a3942] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

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
                  disabled={isSaving || !name.trim()}
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
