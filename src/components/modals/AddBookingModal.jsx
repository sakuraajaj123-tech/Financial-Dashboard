import { useState, useEffect, useRef } from 'react';
import { X, User, Phone, Calendar, DollarSign, Home, FileText, Clock, Bell } from 'lucide-react';
import { Button } from '../shared/Button';
import { BOOKING_SOURCES } from '../../data/seedData';
import { useTranslation } from 'react-i18next';
import { BookingCalendarPicker } from './BookingCalendarPicker';
import { parseISO, isBefore, isAfter, startOfDay } from 'date-fns';

const initialForm = {
  unitId: '',
  tenantName: '',
  phone: '',
  checkIn: '',
  checkOut: '',
  checkInTime: '16:00',
  checkOutTime: '13:00',
  entryReminderMinutes: '180', // Default: 3 hours before check-in
  exitReminderMinutes: '15',   // Default: 15 minutes before check-out
  customEntryMinutes: '',
  customExitMinutes: '',
  source: BOOKING_SOURCES.DIRECT,
  amount: '',
  notes: '',
};

// ─── Sub-components defined outside parent to prevent focus-loss re-mounting ───

function InputWrapper({ label, error, icon: Icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
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

// ─── Helpers to extract date & time safely ───────────────────────────────────

function extractDateStr(isoOrDate) {
  if (!isoOrDate) return '';
  if (typeof isoOrDate === 'string' && isoOrDate.includes('T')) {
    const d = new Date(isoOrDate);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return typeof isoOrDate === 'string' ? isoOrDate : '';
}

function extractTimeStr(isoOrDate, fallback = '16:00') {
  if (!isoOrDate) return fallback;
  if (typeof isoOrDate === 'string' && isoOrDate.includes('T')) {
    const d = new Date(isoOrDate);
    if (!isNaN(d.getTime())) {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }
  return fallback;
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AddBookingModal({
  units,
  onClose,
  onSubmit,
  preselectedUnit,
  initialBooking = null,
}) {
  const { t } = useTranslation();
  const isEditMode = !!initialBooking;

  const [form, setForm] = useState(() => {
    if (initialBooking) {
      const checkInDate = extractDateStr(initialBooking.checkIn);
      const checkOutDate = extractDateStr(initialBooking.checkOut);
      const checkInTime = initialBooking.checkInTime || extractTimeStr(initialBooking.checkIn, '16:00');
      const checkOutTime = initialBooking.checkOutTime || extractTimeStr(initialBooking.checkOut, '13:00');
      const entryMin = initialBooking.entryReminderMinutes != null ? String(initialBooking.entryReminderMinutes) : '180';
      const exitMin = initialBooking.exitReminderMinutes != null ? String(initialBooking.exitReminderMinutes) : '15';

      const isPresetEntry = ['15', '30', '45', '60', '120', '180', '240', '360', '720', '1440'].includes(entryMin);
      const isPresetExit = ['5', '10', '15', '30', '45', '60', '120', '180'].includes(exitMin);

      return {
        unitId: initialBooking.unitId || preselectedUnit?.id || '',
        tenantName: initialBooking.tenantName || '',
        phone: initialBooking.phone || '',
        checkIn: checkInDate,
        checkOut: checkOutDate,
        checkInTime,
        checkOutTime,
        entryReminderMinutes: isPresetEntry ? entryMin : 'custom',
        customEntryMinutes: isPresetEntry ? '' : entryMin,
        exitReminderMinutes: isPresetExit ? exitMin : 'custom',
        customExitMinutes: isPresetExit ? '' : exitMin,
        source: initialBooking.source || BOOKING_SOURCES.DIRECT,
        amount: initialBooking.amount != null ? String(initialBooking.amount) : '',
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

  // Derive the bookings of the currently selected unit for the calendar
  const selectedUnit = units.find((u) => u.id === form.unitId) || null;
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
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    // Clear date-range errors when either date or time changes
    if (field === 'checkIn' || field === 'checkOut' || field === 'checkInTime' || field === 'checkOutTime') {
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
      if (form.checkIn >= form.checkOut)
        errs.checkOut = t('modal.checkOutBeforeCheckIn');
      else if (hasOverlap(form.checkIn, form.checkOut, unitBookings, initialBooking?.id))
        errs.dateRange = t('modal.datesOverlap') || 'These dates overlap with an existing booking.';
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
    await new Promise((r) => setTimeout(r, 300));

    // Combine date + time into full ISO 8601 strings for accurate Firestore timestamps
    const combineDateTime = (date, time) => {
      if (!date) return date;
      const t = time || '00:00';
      return new Date(`${date}T${t}:00`).toISOString();
    };

    const effectiveEntryMinutes =
      form.entryReminderMinutes === 'custom'
        ? Number(form.customEntryMinutes) || 180
        : Number(form.entryReminderMinutes) || 180;

    const effectiveExitMinutes =
      form.exitReminderMinutes === 'custom'
        ? Number(form.customExitMinutes) || 15
        : Number(form.exitReminderMinutes) || 15;

    onSubmit(
      form.unitId,
      {
        tenantName: form.tenantName.trim(),
        phone: form.phone.trim(),
        source: form.source,
        checkIn: combineDateTime(form.checkIn, form.checkInTime),
        checkOut: combineDateTime(form.checkOut, form.checkOutTime),
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        entryReminderMinutes: effectiveEntryMinutes,
        exitReminderMinutes: effectiveExitMinutes,
        amount: form.amount ? Number(form.amount) : 0,
        notes: form.notes.trim(),
      },
      initialBooking?.id
    );
    setSubmitting(false);
    onClose();
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
              {isEditMode ? t('modal.bookingDetails') : t('modal.newBooking')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditMode ? t('modal.bookingDetailsSubtitle') : t('modal.modalSubtitle')}
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
              onChange={(e) => {
                handleChange('unitId', e.target.value);
                // Reset dates when unit changes so calendar updates
                setForm((prev) => ({ ...prev, unitId: e.target.value, checkIn: '', checkOut: '' }));
              }}
              className={inputClass(errors.unitId)}
            >
              <option value="">{t('modal.selectUnit')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {t('unit.unit')} {u.number} — {u.bedrooms} {t('unit.bed')} • {t('unit.floor')} {u.floor} ({u.status})
                </option>
              ))}
            </select>
          </InputWrapper>

          {/* Client name */}
          <InputWrapper label={t('modal.clientName')} error={errors.tenantName} icon={User}>
            <input
              ref={!preselectedUnit ? firstInputRef : undefined}
              type="text"
              placeholder={t('modal.clientNamePlaceholder')}
              value={form.tenantName}
              onChange={(e) => handleChange('tenantName', e.target.value)}
              className={inputClass(errors.tenantName)}
            />
          </InputWrapper>

          {/* Phone (Optional) */}
          <InputWrapper label={t('modal.phone')} error={errors.phone} icon={Phone}>
            <input
              type="tel"
              placeholder={t('modal.phonePlaceholder')}
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={inputClass(errors.phone)}
            />
          </InputWrapper>

          {/* Date pickers — side by side, each with its own calendar */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Check-in */}
              <div className="space-y-1.5">
                <label className={`flex items-center gap-1.5 text-xs font-medium ${errors.checkIn ? 'text-rose-400' : 'text-slate-400'}`}>
                  <Calendar className="w-3 h-3" />
                  {t('modal.checkIn')}
                  {form.checkIn && (
                    <span className="ml-auto text-indigo-400 font-semibold tabular-nums">
                      {form.checkIn}
                    </span>
                  )}
                </label>
                <BookingCalendarPicker
                  value={form.checkIn}
                  onChange={(val) => handleChange('checkIn', val)}
                  bookings={unitBookings}
                  minDate={new Date()}
                  selectedRange={{ checkIn: form.checkIn, checkOut: form.checkOut }}
                />
                {/* Check-in time & reminder controls */}
                <div className="mt-2.5 space-y-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  {/* Time input */}
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-xs text-slate-400 flex-1">{t('modal.checkInTime')}</span>
                    <input
                      type="time"
                      value={form.checkInTime}
                      onChange={(e) => handleChange('checkInTime', e.target.value)}
                      className="w-28 bg-slate-900/80 border border-slate-700/60 hover:border-slate-600 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
                    />
                  </div>

                  {/* Reminder offset selector */}
                  <div className="flex items-center gap-2 pt-1.5 border-t border-slate-700/30">
                    <Bell className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-slate-400 flex-1">{t('modal.reminderBefore')}</span>
                    <select
                      value={form.entryReminderMinutes}
                      onChange={(e) => handleChange('entryReminderMinutes', e.target.value)}
                      className="w-44 bg-slate-900/80 border border-slate-700/60 hover:border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
                    >
                      <option value="15">{t('modal.preset15m')}</option>
                      <option value="30">{t('modal.preset30m')}</option>
                      <option value="45">{t('modal.preset45m')}</option>
                      <option value="60">{t('modal.preset1h')}</option>
                      <option value="120">{t('modal.preset2h')}</option>
                      <option value="180">{t('modal.preset3h')}</option>
                      <option value="240">{t('modal.preset4h')}</option>
                      <option value="360">{t('modal.preset6h')}</option>
                      <option value="720">{t('modal.preset12h')}</option>
                      <option value="1440">{t('modal.preset24h')}</option>
                      <option value="custom">{t('modal.customMinutes')}</option>
                    </select>
                  </div>

                  {/* Custom minutes input if selected */}
                  {form.entryReminderMinutes === 'custom' && (
                    <div className="flex items-center gap-2 pl-5 rtl:pr-5 rtl:pl-0 pt-1">
                      <input
                        type="number"
                        min="1"
                        placeholder="180"
                        value={form.customEntryMinutes}
                        onChange={(e) => handleChange('customEntryMinutes', e.target.value)}
                        className="w-24 bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/40"
                      />
                      <span className="text-[11px] text-slate-400">{t('modal.minutes')}</span>
                    </div>
                  )}
                </div>
                {errors.checkIn && <p className="text-xs text-rose-400">{errors.checkIn}</p>}
              </div>

              {/* Check-out */}
              <div className="space-y-1.5">
                <label className={`flex items-center gap-1.5 text-xs font-medium ${errors.checkOut ? 'text-rose-400' : 'text-slate-400'}`}>
                  <Calendar className="w-3 h-3" />
                  {t('modal.checkOut')}
                  {form.checkOut && (
                    <span className="ml-auto text-indigo-400 font-semibold tabular-nums">
                      {form.checkOut}
                    </span>
                  )}
                </label>
                <BookingCalendarPicker
                  value={form.checkOut}
                  onChange={(val) => handleChange('checkOut', val)}
                  bookings={unitBookings}
                  minDate={form.checkIn ? new Date(form.checkIn) : new Date()}
                  selectedRange={{ checkIn: form.checkIn, checkOut: form.checkOut }}
                />

                {/* Check-out time & reminder controls */}
                <div className="mt-2.5 space-y-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  {/* Time input */}
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-xs text-slate-400 flex-1">{t('modal.checkOutTime')}</span>
                    <input
                      type="time"
                      value={form.checkOutTime}
                      onChange={(e) => handleChange('checkOutTime', e.target.value)}
                      className="w-28 bg-slate-900/80 border border-slate-700/60 hover:border-slate-600 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
                    />
                  </div>

                  {/* Reminder offset selector */}
                  <div className="flex items-center gap-2 pt-1.5 border-t border-slate-700/30">
                    <Bell className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-slate-400 flex-1">{t('modal.reminderBefore')}</span>
                    <select
                      value={form.exitReminderMinutes}
                      onChange={(e) => handleChange('exitReminderMinutes', e.target.value)}
                      className="w-44 bg-slate-900/80 border border-slate-700/60 hover:border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
                    >
                      <option value="5">5 {t('modal.minutes')}</option>
                      <option value="10">10 {t('modal.minutes')}</option>
                      <option value="15">{t('modal.presetExit15m')}</option>
                      <option value="30">{t('modal.preset30m')}</option>
                      <option value="45">{t('modal.preset45m')}</option>
                      <option value="60">{t('modal.preset1h')}</option>
                      <option value="120">{t('modal.preset2h')}</option>
                      <option value="180">{t('modal.preset3h')}</option>
                      <option value="custom">{t('modal.customMinutes')}</option>
                    </select>
                  </div>

                  {/* Custom minutes input if selected */}
                  {form.exitReminderMinutes === 'custom' && (
                    <div className="flex items-center gap-2 pl-5 rtl:pr-5 rtl:pl-0 pt-1">
                      <input
                        type="number"
                        min="1"
                        placeholder="15"
                        value={form.customExitMinutes}
                        onChange={(e) => handleChange('customExitMinutes', e.target.value)}
                        className="w-24 bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/40"
                      />
                      <span className="text-[11px] text-slate-400">{t('modal.minutes')}</span>
                    </div>
                  )}
                </div>
                {errors.checkOut && <p className="text-xs text-rose-400">{errors.checkOut}</p>}
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

          {/* Source + Amount row */}
          <div className="grid grid-cols-2 gap-3">
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
              {isEditMode ? t('modal.close') : t('modal.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              {submitting
                ? t('modal.saving')
                : isEditMode
                ? t('modal.saveChanges')
                : t('modal.createBooking')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
