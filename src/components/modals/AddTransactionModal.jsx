// AddTransactionModal.jsx — Modal form to create personal & business income/expense transactions

import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Tag, Repeat, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '../shared/Button';
import { useTranslation } from 'react-i18next';

const EXPENSE_CATEGORIES = [
  'maintenance',
  'utilities',
  'cleaning',
  'supplies',
  'marketing',
  'taxes',
  'salaries',
  'personal',
  'other',
];

const INCOME_CATEGORIES = [
  'rent',
  'business',
  'consulting',
  'investment',
  'other',
];

const FREQUENCIES = ['one-time', 'weekly', 'monthly', 'annual'];

function InputWrapper({ label, error, icon: Icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
}

export function AddTransactionModal({ isOpen, onClose, onSubmit }) {
  const { t } = useTranslation();

  const [type, setType] = useState('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState('one-time');
  const [category, setCategory] = useState('maintenance');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update default category when type changes if current category isn't in new list
  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'income') {
      setCategory('business');
    } else {
      setCategory('maintenance');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setType('expense');
      setTitle('');
      setAmount('');
      setDate(new Date().toISOString().slice(0, 10));
      setFrequency('one-time');
      setCategory('maintenance');
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!title.trim()) {
      errs.title = t('finance.modal.titleRequired');
    }
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = t('finance.modal.amountRequired');
    }
    if (!date) {
      errs.date = t('finance.modal.dateRequired');
    }
    if (!category) {
      errs.category = t('finance.modal.categoryRequired');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        title: title.trim(),
        amount: Number(amount),
        date,
        frequency,
        category,
      });
      onClose();
    } catch (err) {
      console.error('Failed to add transaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/70 shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">
              {t('finance.modal.title')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('finance.modal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type Segmented Control */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">
              {t('finance.modal.type')}
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-300" />
                {t('finance.modal.income')}
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  type === 'expense'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingDown className="w-4 h-4 text-rose-300" />
                {t('finance.modal.expense')}
              </button>
            </div>
          </div>

          {/* Title */}
          <InputWrapper label={t('finance.modal.entryTitle')} error={errors.title} icon={FileText}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('finance.modal.entryTitlePlaceholder')}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </InputWrapper>

          {/* Amount & Date in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputWrapper label={t('finance.modal.amount')} error={errors.amount} icon={DollarSign}>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t('finance.modal.amountPlaceholder')}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <span className="absolute right-3 rtl:right-auto rtl:left-3 top-2.5 text-xs font-bold text-slate-400">
                  SAR
                </span>
              </div>
            </InputWrapper>

            <InputWrapper label={t('finance.modal.date')} error={errors.date} icon={Calendar}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </InputWrapper>
          </div>

          {/* Category & Frequency in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputWrapper label={t('finance.modal.category')} error={errors.category} icon={Tag}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                {currentCategories.map((catKey) => (
                  <option key={catKey} value={catKey} className="bg-slate-900 text-white">
                    {t(`finance.categories.${catKey}`, catKey)}
                  </option>
                ))}
              </select>
            </InputWrapper>

            <InputWrapper label={t('finance.modal.frequency')} icon={Repeat}>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                {FREQUENCIES.map((freqKey) => (
                  <option key={freqKey} value={freqKey} className="bg-slate-900 text-white">
                    {t(`finance.frequencies.${freqKey}`, freqKey)}
                  </option>
                ))}
              </select>
            </InputWrapper>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('finance.modal.cancel')}
            </Button>
            <Button
              type="submit"
              variant={type === 'income' ? 'success' : 'primary'}
              size="md"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('finance.modal.saving') : t('finance.modal.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
