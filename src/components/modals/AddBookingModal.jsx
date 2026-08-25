// AddBookingModal.jsx — Modal form for booking creation and details/edit mode

import { useState, useEffect, useRef } from 'react';
import { X, User, Phone, Calendar, DollarSign, Home, FileText, Clock, Bell, Shield } from 'lucide-react';
import { Button } from '../shared/Button';
import { BOOKING_SOURCES } from '../../data/seedData';
import { useTranslation } from 'react-i18next';
import { BookingCalendarPicker } from './BookingCalendarPicker';
import { parseISO, isBefore, isAfter, startOfDay, addDays, differenceInCalendarDays } from 'date-fns';
import { formatDualDate, formatBookingDate } from '../../utils/dateFormatter';

const ENTRY_REMINDER_OPTIONS = [
  { value: 15, labelEn: '15 minutes before', labelAr: 'قبل 15 دقيقة' },
  { value: 30, labelEn: '30 minutes before', labelAr: 'قبل 30 دقيقة' },
  { value: 60, labelEn: '1 hour before', labelAr: 'قبل ساعة واحدة' },
  { value: 120, labelEn: '2 hours before', labelAr: 'قبل ساعتين' },
  { value: 180, labelEn: '3 hours before (Default)', labelAr: 'قبل 3 ساعات (افتراضي)' },
  { value: 360, labelEn: '6 hours before', labelAr: 'قبل 6 ساعات' },
  { value: 720, labelEn: '12 hours before', labelAr: 'قبل 12 ساعة' },
  { value: 1440, labelEn: '24 hours before', labelAr: 'قبل 24 ساعة (يوم)' },
];

const EXIT_REMINDER_OPTIONS = [
  { value: 15, labelEn: '15 minutes before (Default)', labelAr: 'قبل 15 دقيقة (افتراضي)' },
  { value: 30, labelEn: '30 minutes before', labelAr: 'قبل 30 دقيقة' },
  { value: 60, labelEn: '1 hour before', labelAr: 'قبل ساعة واحدة' },
  { value: 120, labelEn: '2 hours before', labelAr: 'قبل ساعتين' },
  { value: 180, labelEn: '3 hours before', labelAr: 'قبل 3 ساعات' },
];

const initialForm = {
  unitId: '',
  tenantName: '',
  phone: '',
  checkIn: '',
  checkInTime: '16:00',
  checkOut: '',
  checkOutTime: '13:00',
  entryReminderMinutes: 180,
  exitReminderMinutes: 15,
  source: BOOKING_SOURCES.DIRECT,
  amount: '',
  insurance: '',
  notes: '',
};

// ─── Sub-components defined outside parent to prevent focus-loss re-mounting ───

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

const inputClass = (hasError) =>
  `w-full bg-slate-800/60 border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:ring-2 focus:ring-indigo-500/40 ${
    hasError ? 'border-rose-500/60' : 'border-slate-700/50 hover:border-slate-600/60'
  }`;

// ─── Overlap detection ─────────────────────────────────────────────────────────

function hasOverlap(checkIn, checkOut, bookings, excludeBookingId = null) {
  if (!checkIn || !checkOut || !bookings) return false;
  const newStart = startOfDay(parseISO(checkIn));
  const newEnd = startOfDay(parseISO(checkOut));
  return bookings
    .filter((b) => b.id !== excludeBookingId && b.checkIn && b.checkOut)
    .some((b) => {
      const bStart = startOfDay(parseISO(b.checkIn));
      const bEnd = startOfDay(parseISO(b.checkOut));
      // Overlap when newStart < bEnd AND newEnd > bStart
      return isBefore(newStart, bEnd) && isAfter(newEnd, bStart);
    });
}

// ─── Automated Pricing Matrix ──────────────────────────────────────────────────

function getDailyRate(uNum, isGathern, dayOfWeek) {
  const isWeekend = dayOfWeek === 4 || dayOfWeek === 5; // Thursday (4) or Friday (5)

  if (uNum >= 1 && uNum <= 5) {
    if (isGathern) {
      return isWeekend ? 279 : 244;
    } else {
      return isWeekend ? 330 : 270;
    }
  } else if (uNum === 6) {
    if (isGathern) {
      return isWeekend ? 135 : 126;
    } else {
      return 140; // Direct: 140 (All days)
    }
  } else if (uNum === 7) {
    if (isGathern) {
      return isWeekend ? 118 : 109;
    } else {
      return isWeekend ? 150 : 130;
    }
  } else if (uNum === 8) {
    if (isGathern) {
      return isWeekend ? 102 : 84;
    } else {
      return isWeekend ? 120 : 100;
    }
  }
  return null;
}

function getInsuranceAmount(uNum) {
  if (uNum >= 1 && uNum <= 5) return 300;
  if (uNum === 6) return 200;
  if (uNum === 7) return 200;
  if (uNum === 8) return 150;
  return null;
}

export function calculateSuggestedPricing(unitNumber, source, checkInDate, checkOutDate) {
  const uNum = Number(unitNumber);
  if (!uNum) return { price: null, insurance: null };

  const isGathern = source === BOOKING_SOURCES.GATHERN;
  const insurance = getInsuranceAmount(uNum);

  if (!checkInDate) {
    // Default 1-night weekday rate if no dates chosen yet
    const price = getDailyRate(uNum, isGathern, 0); // 0 = Sunday (weekday)
    return { price, insurance };
  }

  const startDate = parseISO(checkInDate);

  if (checkOutDate) {
    const endDate = parseISO(checkOutDate);
    const nights = differenceInCalendarDays(endDate, startDate);

    if (nights > 0) {
      let totalPrice = 0;
      for (let i = 0; i < nights; i++) {
        const currentDay = addDays(startDate, i);
        const dayOfWeek = currentDay.getDay();
        const dailyRate = getDailyRate(uNum, isGathern, dayOfWeek);
        if (dailyRate !== null) {
          totalPrice += dailyRate;
        }
      }
      return { price: totalPrice, insurance };
    }
  }

  // Single night if checkOut is not provided or not after checkIn
  const dayOfWeek = startDate.getDay();
  const price = getDailyRate(uNum, isGathern, dayOfWeek);
  return { price, insurance };
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AddBookingModal({
  units,
  onClose,
  onSubmit,
  preselectedUnit,
  initialBooking = null,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const isEdit = Boolean(initialBooking);

  const [form, setForm] = useState(() => {
    if (initialBooking) {
      return {
        unitId: preselectedUnit?.id || initialBooking.unitId || '',
        tenantName: initialBooking.tenantName || '',
        phone: initialBooking.phone || '',
        checkIn: initialBooking.checkIn || '',
        checkInTime: initialBooking.checkInTime || '16:00',
        checkOut: initialBooking.checkOut || '',
        checkOutTime: initialBooking.checkOutTime || '13:00',
        entryReminderMinutes: initialBooking.entryReminderMinutes ?? 180,
        exitReminderMinutes: initialBooking.exitReminderMinutes ?? 15,
        source: initialBooking.source || BOOKING_SOURCES.DIRECT,
        amount: initialBooking.amount !== undefined ? String(initialBooking.amount) : '',
        insurance: initialBooking.insurance !== undefined && initialBooking.insurance !== null ? String(initialBooking.insurance) : '',
        notes: initialBooking.notes || '',
      };
    }
    return {
      ...initialForm,
      unitId: preselectedUnit?.id || '',
    };
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const overlayRef = useRef(null);
  const firstInputRef = useRef(null);

  // Track previous dependencies to support non-destructive edit mode
  const prevPricingDepsRef = useRef({
    unitId: form.unitId,
    source: form.source,
    checkIn: form.checkIn,
    checkOut: form.checkOut,
    isInitial: true,
  });

  // Auto-fill price & insurance based on Unit, Source, Check-In Date, and Check-Out Date
  useEffect(() => {
    // In edit mode, do not overwrite saved booking values on initial mount
    if (isEdit && prevPricingDepsRef.current.isInitial) {
      prevPricingDepsRef.current.isInitial = false;
      return;
    }

    const hasDepsChanged =
      prevPricingDepsRef.current.unitId !== form.unitId ||
      prevPricingDepsRef.current.source !== form.source ||
      prevPricingDepsRef.current.checkIn !== form.checkIn ||
      prevPricingDepsRef.current.checkOut !== form.checkOut;

    // In edit mode, only auto-fill if the user actively changes unit, source, or dates
    if (isEdit && !hasDepsChanged) return;

    prevPricingDepsRef.current = {
      unitId: form.unitId,
      source: form.source,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      isInitial: false,
    };

    const targetUnit = units.find((u) => u.id === form.unitId) || preselectedUnit;
    const unitNum = targetUnit?.number || (form.unitId ? String(form.unitId).replace(/[^0-9]/g, '') : null);

    if (unitNum) {
      const { price, insurance } = calculateSuggestedPricing(
        unitNum,
        form.source,
        form.checkIn,
        form.checkOut
      );
      setForm((prev) => ({
        ...prev,
        ...(price !== null ? { amount: String(price) } : {}),
        ...(insurance !== null ? { insurance: String(insurance) } : {}),
      }));
    }
  }, [form.unitId, form.source, form.checkIn, form.checkOut, units, preselectedUnit, isEdit]);

  // Derive the bookings of the currently selected unit for the calendar
  const selectedUnit = units.find((u) => u.id === form.unitId) || preselectedUnit || null;
  const unitBookings = selectedUnit?.bookings || [];

  useEffect(() => {
    const timer = setTimeout(() => firstInputRef.current?.focus(), 100);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleChange(field, value) {
    if (field === 'checkIn') {
      setForm((prev) => {
        let newCheckOut = prev.checkOut;
        if (newCheckOut && (newCheckOut <= value || hasOverlap(value, newCheckOut, unitBookings, initialBooking?.id))) {
          newCheckOut = '';
        }
        return { ...prev, checkIn: value, checkOut: newCheckOut };
      });
      setErrors((prev) => ({ ...prev, checkIn: null, checkOut: null, dateRange: null }));
      return;
    }

    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    if (field === 'checkOut') {
      setErrors((prev) => ({ ...prev, checkIn: null, checkOut: null, dateRange: null }));
    }
  }

  function validate() {
    const errs = {};
    if (!form.unitId) errs.unitId = t('modal.selectUnitError');
    if (!form.tenantName.trim()) errs.tenantName = t('modal.nameRequired');
    if (!form.checkIn) errs.checkIn = t('modal.checkInRequired');
    if (!form.checkOut) errs.checkOut = t('modal.checkOutRequired');
    if (form.checkIn && form.checkOut) {
      if (form.checkIn >= form.checkOut) {
        errs.checkOut = t('modal.checkOutBeforeCheckIn');
      } else if (hasOverlap(form.checkIn, form.checkOut, unitBookings, initialBooking?.id)) {
        errs.dateRange = t('modal.datesOverlap') || 'These dates overlap with an existing booking.';
      }
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(
        form.unitId,
        {
          id: initialBooking?.id,
          tenantName: form.tenantName.trim(),
          phone: form.phone.trim(),
          source: form.source,
          checkIn: form.checkIn,
          checkInTime: form.checkInTime || '16:00',
          checkOut: form.checkOut,
          checkOutTime: form.checkOutTime || '13:00',
          entryReminderMinutes: Number(form.entryReminderMinutes),
          exitReminderMinutes: Number(form.exitReminderMinutes),
          amount: form.amount ? Number(form.amount) : 0,
          insurance: form.insurance ? Number(form.insurance) : 0,
          notes: form.notes.trim(),
        },
        initialBooking?.id
      );
      onClose();
    } catch (err) {
      console.error('Failed to save booking:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/40 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r from-indigo-500/5 to-violet-500/5">
          <div>
            <h3 className="text-lg font-bold text-white">
              {isEdit ? t('modal.bookingDetails') : t('modal.newBooking')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit ? t('modal.detailsSubtitle') : t('modal.modalSubtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">

          {/* Unit selection */}
          <InputWrapper label={t('modal.unit')} error={errors.unitId} icon={Home}>
            <select
              value={form.unitId}
              disabled={isEdit}
              onChange={(e) => {
                handleChange('unitId', e.target.value);
                setForm((prev) => ({ ...prev, unitId: e.target.value, checkIn: '', checkOut: '' }));
              }}
              className={`${inputClass(errors.unitId)} ${isEdit ? 'opacity-75 cursor-not-allowed bg-slate-800/90' : ''}`}
            >
              <option value="">{t('modal.selectUnit')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {t('unit.unit')} {u.number} — {u.bedrooms} {t('unit.bed')} • {t('unit.floor')} {u.floor} ({u.status})
                </option>
              ))}
            </select>
          </InputWrapper>

          {/* Client name + Phone row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputWrapper label={t('modal.clientName')} error={errors.tenantName} icon={User}>
              <input
                ref={!preselectedUnit && !isEdit ? firstInputRef : undefined}
                type="text"
                placeholder={t('modal.clientNamePlaceholder')}
                value={form.tenantName}
                onChange={(e) => handleChange('tenantName', e.target.value)}
                className={inputClass(errors.tenantName)}
              />
            </InputWrapper>

            <InputWrapper label={t('modal.phone')} error={errors.phone} icon={Phone}>
              <input
                type="tel"
                placeholder={t('modal.phonePlaceholder')}
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={inputClass(errors.phone)}
              />
            </InputWrapper>
          </div>

          {/* Date pickers — side by side, each with its own calendar */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Check-in */}
              <div className="space-y-1.5">
                <label className={`flex items-center justify-between gap-1.5 text-xs font-medium ${errors.checkIn ? 'text-rose-400' : 'text-slate-400'}`}>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {t('modal.checkIn')}
                  </span>
                  {form.checkIn && (
                    <span className="text-indigo-400 font-semibold tabular-nums text-[11px]">
                      {formatDualDate(form.checkIn, isArabic, formatBookingDate)}
                    </span>
                  )}
                </label>
                <BookingCalendarPicker
                  pickerType="checkIn"
                  value={form.checkIn}
                  onChange={(val) => handleChange('checkIn', val)}
                  bookings={unitBookings.filter((b) => b.id !== initialBooking?.id)}
                  minDate={isEdit ? undefined : new Date()}
                  selectedRange={{ checkIn: form.checkIn, checkOut: form.checkOut }}
                />
                {errors.checkIn && <p className="text-xs text-rose-400 font-medium">{errors.checkIn}</p>}
              </div>

              {/* Check-out */}
              <div className="space-y-1.5">
                <label className={`flex items-center justify-between gap-1.5 text-xs font-medium ${errors.checkOut ? 'text-rose-400' : 'text-slate-400'}`}>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {t('modal.checkOut')}
                  </span>
                  {form.checkOut && (
                    <span className="text-indigo-400 font-semibold tabular-nums text-[11px]">
                      {formatDualDate(form.checkOut, isArabic, formatBookingDate)}
                    </span>
                  )}
                </label>
                <BookingCalendarPicker
                  pickerType="checkOut"
                  checkInValue={form.checkIn}
                  value={form.checkOut}
                  onChange={(val) => handleChange('checkOut', val)}
                  bookings={unitBookings.filter((b) => b.id !== initialBooking?.id)}
                  minDate={form.checkIn ? addDays(parseISO(form.checkIn), 1) : (isEdit ? undefined : new Date())}
                  selectedRange={{ checkIn: form.checkIn, checkOut: form.checkOut }}
                />
                {errors.checkOut && <p className="text-xs text-rose-400 font-medium">{errors.checkOut}</p>}
              </div>
            </div>

            {/* Overlap error spanning both calendars */}
            {errors.dateRange && (
              <div className="mt-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
                <span className="text-rose-400 text-base leading-none mt-px">⚠</span>
                <p className="text-sm text-rose-400 font-medium">{errors.dateRange}</p>
              </div>
            )}
          </div>

          {/* Time pickers & Reminder offsets section */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-4">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {t('modal.remindersSectionTitle')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Check-in Time & Offset */}
              <div className="space-y-3">
                <InputWrapper label={t('modal.checkInTime')} icon={Clock}>
                  <input
                    type="time"
                    value={form.checkInTime}
                    onChange={(e) => handleChange('checkInTime', e.target.value)}
                    className={inputClass(false)}
                  />
                </InputWrapper>

                <InputWrapper label={t('modal.entryReminder')} icon={Bell}>
                  <select
                    value={form.entryReminderMinutes}
                    onChange={(e) => handleChange('entryReminderMinutes', Number(e.target.value))}
                    className={inputClass(false)}
                  >
                    {ENTRY_REMINDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isArabic ? opt.labelAr : opt.labelEn}
                      </option>
                    ))}
                  </select>
                </InputWrapper>
              </div>

              {/* Check-out Time & Offset */}
              <div className="space-y-3">
                <InputWrapper label={t('modal.checkOutTime')} icon={Clock}>
                  <input
                    type="time"
                    value={form.checkOutTime}
                    onChange={(e) => handleChange('checkOutTime', e.target.value)}
                    className={inputClass(false)}
                  />
                </InputWrapper>

                <InputWrapper label={t('modal.exitReminder')} icon={Bell}>
                  <select
                    value={form.exitReminderMinutes}
                    onChange={(e) => handleChange('exitReminderMinutes', Number(e.target.value))}
                    className={inputClass(false)}
                  >
                    {EXIT_REMINDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isArabic ? opt.labelAr : opt.labelEn}
                      </option>
                    ))}
                  </select>
                </InputWrapper>
              </div>
            </div>
          </div>

          {/* Source + Amount + Insurance row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InputWrapper label={t('modal.bookingSource')} icon={FileText}>
              <select
                value={form.source}
                onChange={(e) => handleChange('source', e.target.value)}
                className={inputClass(false)}
              >
                <option value={BOOKING_SOURCES.DIRECT}>{t('modal.directCall')}</option>
                <option value={BOOKING_SOURCES.GATHERN}>{t('modal.gathern')}</option>
              </select>
            </InputWrapper>

            <InputWrapper label={t('modal.totalAmount')} error={errors.amount} icon={DollarSign}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="5000"
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className={inputClass(errors.amount)}
              />
            </InputWrapper>

            <InputWrapper label={t('modal.insurance')} icon={Shield}>
              <input
                type="text"
                inputMode="numeric"
                placeholder={t('modal.insurancePlaceholder') || '0'}
                value={form.insurance}
                onChange={(e) => handleChange('insurance', e.target.value)}
                className={inputClass(false)}
              />
            </InputWrapper>
          </div>

          {/* Notes (Optional) */}
          <InputWrapper label={t('modal.notes')} icon={FileText}>
            <textarea
              rows={2}
              placeholder={t('modal.notesPlaceholder')}
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className={`${inputClass(false)} resize-none`}
            />
          </InputWrapper>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              {t('modal.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              {submitting
                ? t('modal.saving')
                : isEdit
                ? t('modal.saveChanges')
                : t('modal.createBooking')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

