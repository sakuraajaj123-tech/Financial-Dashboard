// MakkahPaymentModal.jsx — Modal to confirm receipt of Makkah Building rental payment
// Records the payment date and amount, updates the tenant schedule, and posts income to Financial Dashboard.

import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, FileText, CheckCircle2, User, Home, Clock } from 'lucide-react';
import { Button } from '../shared/Button';
import { DatePicker } from '../shared/DatePicker';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { formatPaymentInterval } from '../../utils/dateFormatter';

export function MakkahPaymentModal({
  isOpen,
  tenant,
  onClose,
  onConfirm,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentAmount, setPaymentAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && tenant) {
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentAmount(tenant.rentAmount ? String(tenant.rentAmount) : '');
      setNotes('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, tenant]);

  if (!isOpen || !tenant) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = Number(paymentAmount);
    if (!paymentAmount || isNaN(numAmount) || numAmount <= 0) {
      setError(t('makkah.modal.rentRequired'));
      return;
    }
    if (!paymentDate) {
      setError(t('makkah.modal.dateRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(tenant, paymentDate, numAmount, notes.trim());
      onClose();
    } catch (err) {
      console.error('Failed to confirm payment:', err);
      setError(err.message || 'Failed to process payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-md my-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {t('makkah.paymentModal.title')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('makkah.paymentModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tenant Summary Pill */}
        <div className="p-4 mx-6 mt-5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold flex-shrink-0">
              {tenant.unitNumber}
            </div>
            <div className="truncate">
              <p className="font-bold text-white truncate">{tenant.name}</p>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Home className="w-3 h-3 text-slate-500" />
                {t('makkah.paymentModal.unit')}: {tenant.unitNumber}
              </p>
            </div>
          </div>
          <div className="text-right rtl:text-left flex-shrink-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/60">
              {formatPaymentInterval(tenant.paymentIntervalMonths, isArabic)}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 pt-4">
          {/* Payment Amount Input */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('makkah.paymentModal.rentAmount')}</span>
              <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={paymentAmount}
                onChange={(e) => {
                  setPaymentAmount(e.target.value);
                  if (error) setError('');
                }}
                placeholder="0.00"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                required
              />
              <span className="absolute right-3 rtl:right-auto rtl:left-3 top-2.5 text-xs font-bold text-emerald-400">
                SAR
              </span>
            </div>
          </div>

          {/* Payment Date Picker */}
          <DatePicker
            label={t('makkah.paymentModal.paymentDate')}
            value={paymentDate}
            onChange={(val) => {
              setPaymentDate(val);
              if (error) setError('');
            }}
            icon={Calendar}
            required
          />

          {/* Notes (Optional) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('makkah.paymentModal.notes')}</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('makkah.paymentModal.notesPlaceholder')}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('makkah.paymentModal.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white"
            >
              {isSubmitting
                ? t('makkah.paymentModal.confirming')
                : t('makkah.paymentModal.confirm')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
