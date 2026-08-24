// MakkahTenantModal.jsx — Modal to Add or Edit Makkah Building Tenants
// Fields: Name, Phone, Unit Number, Rent Amount, Payment Interval (1, 3, 6, 12 months), Last Paid Date, and Notes.

import { useState, useEffect } from 'react';
import { X, User, Phone, Home, DollarSign, Calendar, Repeat, FileText } from 'lucide-react';
import { Button } from '../shared/Button';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

const INTERVAL_OPTIONS = [
  { value: 1, labelKey: '1' },
  { value: 3, labelKey: '3' },
  { value: 6, labelKey: '6' },
  { value: 12, labelKey: '12' },
];

function InputWrapper({ label, error, icon: Icon, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        <span>{label}</span>
        {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
}

export function MakkahTenantModal({
  isOpen,
  initialTenant = null,
  onClose,
  onSubmit,
}) {
  const { t } = useTranslation();
  const isEditing = Boolean(initialTenant && initialTenant.id);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [paymentIntervalMonths, setPaymentIntervalMonths] = useState(1);
  const [lastPaidDate, setLastPaidDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTenant) {
        setName(initialTenant.name || '');
        setPhone(initialTenant.phone || '');
        setUnitNumber(initialTenant.unitNumber || '');
        setRentAmount(initialTenant.rentAmount ? String(initialTenant.rentAmount) : '');
        setPaymentIntervalMonths(Number(initialTenant.paymentIntervalMonths) || 1);
        setLastPaidDate(initialTenant.lastPaidDate || format(new Date(), 'yyyy-MM-dd'));
        setNotes(initialTenant.notes || '');
      } else {
        setName('');
        setPhone('');
        setUnitNumber('');
        setRentAmount('');
        setPaymentIntervalMonths(1);
        setLastPaidDate(format(new Date(), 'yyyy-MM-dd'));
        setNotes('');
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, initialTenant]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!name.trim()) {
      errs.name = t('makkah.modal.nameRequired');
    }
    if (!phone.trim()) {
      errs.phone = t('makkah.modal.phoneRequired');
    }
    if (!unitNumber.trim()) {
      errs.unitNumber = t('makkah.modal.unitRequired');
    }
    const numRent = Number(rentAmount);
    if (!rentAmount || isNaN(numRent) || numRent <= 0) {
      errs.rentAmount = t('makkah.modal.rentRequired');
    }
    if (!lastPaidDate) {
      errs.lastPaidDate = t('makkah.modal.dateRequired');
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
        name: name.trim(),
        phone: phone.trim(),
        unitNumber: unitNumber.trim(),
        rentAmount: Number(rentAmount),
        paymentIntervalMonths: Number(paymentIntervalMonths),
        lastPaidDate,
        notes: notes.trim(),
      }, initialTenant?.id);
      onClose();
    } catch (err) {
      console.error('Failed to save tenant:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
              {isEditing ? t('makkah.modal.editTitle') : t('makkah.modal.addTitle')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditing ? t('makkah.modal.editSubtitle') : t('makkah.modal.addSubtitle')}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tenant Name */}
          <InputWrapper
            label={t('makkah.modal.name')}
            error={errors.name}
            icon={User}
            required
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('makkah.modal.namePlaceholder')}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </InputWrapper>

          {/* Phone & Unit Number in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputWrapper
              label={t('makkah.modal.phone')}
              error={errors.phone}
              icon={Phone}
              required
            >
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('makkah.modal.phonePlaceholder')}
                dir="ltr"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-left"
              />
            </InputWrapper>

            <InputWrapper
              label={t('makkah.modal.unitNumber')}
              error={errors.unitNumber}
              icon={Home}
              required
            >
              <input
                type="text"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder={t('makkah.modal.unitNumberPlaceholder')}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </InputWrapper>
          </div>

          {/* Rent Amount & Payment Interval in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputWrapper
              label={t('makkah.modal.rentAmount')}
              error={errors.rentAmount}
              icon={DollarSign}
              required
            >
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value)}
                  placeholder={t('makkah.modal.rentAmountPlaceholder')}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <span className="absolute right-3 rtl:right-auto rtl:left-3 top-2.5 text-xs font-bold text-slate-400">
                  SAR
                </span>
              </div>
            </InputWrapper>

            <InputWrapper
              label={t('makkah.modal.paymentInterval')}
              icon={Repeat}
              required
            >
              <select
                value={paymentIntervalMonths}
                onChange={(e) => setPaymentIntervalMonths(Number(e.target.value))}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {t(`makkah.intervals.${opt.labelKey}`)}
                  </option>
                ))}
              </select>
            </InputWrapper>
          </div>

          {/* Last Paid Date */}
          <InputWrapper
            label={t('makkah.modal.lastPaidDate')}
            error={errors.lastPaidDate}
            icon={Calendar}
            required
          >
            <input
              type="date"
              value={lastPaidDate}
              onChange={(e) => setLastPaidDate(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </InputWrapper>

          {/* Notes (Optional) */}
          <InputWrapper label={t('makkah.modal.notes')} icon={FileText}>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('makkah.modal.notesPlaceholder')}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            />
          </InputWrapper>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('makkah.modal.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('makkah.modal.saving') : t('makkah.modal.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
