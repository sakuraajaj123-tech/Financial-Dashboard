// DatePicker.jsx — Modern Dual-Calendar Date Picker (Gregorian & Hijri) with Toggle Button
// Allows seamless date selection in both Hijri (هجري) and Gregorian (ميلادي) calendars.

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday as isFnsToday,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  getHijriParts,
  getHijriMonthGrid,
  addHijriMonths,
  subHijriMonths,
  formatHijriDate,
  formatHijriMonthYear,
  formatDualDate,
  toMiddayDate,
  DAY_NAMES_SHORT_AR,
  DAY_NAMES_SHORT_EN,
} from '../../utils/hijriCalendar';
import { formatBookingDate, formatFullMonthYear } from '../../utils/dateFormatter';

export function DatePicker({
  value,
  onChange,
  label,
  error,
  icon: Icon = CalendarIcon,
  placeholder,
  minDate,
  maxDate,
  required = false,
  disabled = false,
  initialCalendarType,
  showDualPreview = true,
  className = '',
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // Calendar type: 'gregorian' or 'hijri'
  const [calendarType, setCalendarType] = useState(
    initialCalendarType || (isArabic ? 'hijri' : 'gregorian')
  );
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef(null);

  // Active view date for navigation
  const selectedDateObj = useMemo(() => {
    if (!value) return null;
    try {
      const parsed = parseISO(value);
      return isValid(parsed) ? toMiddayDate(parsed) : null;
    } catch {
      return null;
    }
  }, [value]);

  const [viewDate, setViewDate] = useState(() => selectedDateObj || toMiddayDate(new Date()));

  // Synchronize viewDate when value changes
  useEffect(() => {
    if (selectedDateObj) {
      setViewDate(selectedDateObj);
    }
  }, [selectedDateObj]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Month navigation handlers
  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (calendarType === 'hijri') {
      setViewDate((prev) => subHijriMonths(prev, 1));
    } else {
      setViewDate((prev) => subMonths(prev, 1));
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (calendarType === 'hijri') {
      setViewDate((prev) => addHijriMonths(prev, 1));
    } else {
      setViewDate((prev) => addMonths(prev, 1));
    }
  };

  const handleGoToday = (e) => {
    e.stopPropagation();
    const today = toMiddayDate(new Date());
    setViewDate(today);
    onChange(format(today, 'yyyy-MM-dd'));
  };

  const handleSelectDay = (dayDate) => {
    const formatted = format(dayDate, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  // Day header labels
  const dayHeaders = isArabic ? DAY_NAMES_SHORT_AR : DAY_NAMES_SHORT_EN;

  // Month title display
  const monthHeaderLabel = useMemo(() => {
    if (calendarType === 'hijri') {
      return formatHijriMonthYear(viewDate, isArabic);
    }
    return formatFullMonthYear(viewDate, isArabic);
  }, [calendarType, viewDate, isArabic]);

  // Secondary month label in header
  const secondaryMonthLabel = useMemo(() => {
    if (calendarType === 'hijri') {
      return formatFullMonthYear(viewDate, isArabic);
    }
    return formatHijriMonthYear(viewDate, isArabic);
  }, [calendarType, viewDate, isArabic]);

  // Grid days generation
  const gridData = useMemo(() => {
    if (calendarType === 'hijri') {
      const { days } = getHijriMonthGrid(viewDate);
      return days.map((d) => {
        const disabled =
          (minDate && isBefore(startOfDay(d.date), startOfDay(minDate))) ||
          (maxDate && isAfter(startOfDay(d.date), startOfDay(maxDate)));
        const selected = selectedDateObj ? isSameDay(d.date, selectedDateObj) : false;
        return {
          date: d.date,
          isoDate: d.isoDate,
          primaryNumber: d.hijriDay,
          secondaryNumber: d.date.getDate(),
          inCurrentMonth: d.inCurrentMonth,
          isToday: d.isToday,
          selected,
          disabled,
          fullLabel: `${formatHijriDate(d.date, isArabic)} / ${formatBookingDate(d.date, isArabic)}`,
        };
      });
    }

    // Gregorian grid
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const gDays = eachDayOfInterval({ start: calStart, end: calEnd });

    return gDays.map((d) => {
      const inCurrentMonth = isSameMonth(d, viewDate);
      const isToday = isFnsToday(d);
      const selected = selectedDateObj ? isSameDay(d, selectedDateObj) : false;
      const disabled =
        (minDate && isBefore(startOfDay(d), startOfDay(minDate))) ||
        (maxDate && isAfter(startOfDay(d), startOfDay(maxDate)));
      const hp = getHijriParts(d);

      return {
        date: d,
        isoDate: format(d, 'yyyy-MM-dd'),
        primaryNumber: d.getDate(),
        secondaryNumber: hp.day,
        inCurrentMonth,
        isToday,
        selected,
        disabled,
        fullLabel: `${formatBookingDate(d, isArabic)} / ${formatHijriDate(d, isArabic)}`,
      };
    });
  }, [calendarType, viewDate, selectedDateObj, minDate, maxDate, isArabic]);

  // Formatted trigger label
  const triggerDisplay = useMemo(() => {
    if (!value) return placeholder || (isArabic ? 'اختر التاريخ...' : 'Select date...');
    if (calendarType === 'hijri') {
      return formatHijriDate(value, isArabic);
    }
    return formatBookingDate(value, isArabic);
  }, [value, calendarType, isArabic, placeholder]);

  const secondaryTriggerDisplay = useMemo(() => {
    if (!value) return null;
    if (calendarType === 'hijri') {
      return formatBookingDate(value, isArabic);
    }
    return formatHijriDate(value, isArabic);
  }, [value, calendarType, isArabic]);

  return (
    <div className={`relative space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
          <span>{label}</span>
          {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      {/* Input / Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${
          disabled
            ? 'bg-slate-950/40 border-slate-800 text-slate-600 cursor-not-allowed'
            : isOpen
            ? 'bg-slate-950 border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10'
            : error
            ? 'bg-slate-950/80 border-rose-500/80 hover:border-rose-400'
            : 'bg-slate-950/80 border-slate-700/80 hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <span
              className={`text-sm font-medium truncate block ${
                value ? 'text-white font-semibold' : 'text-slate-500'
              }`}
            >
              {triggerDisplay}
            </span>
          </div>
        </div>

        {/* Secondary date preview badge */}
        {value && showDualPreview && (
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/90 text-indigo-300 border border-slate-700/80 flex-shrink-0">
            {secondaryTriggerDisplay}
          </span>
        )}

        {/* Calendar Mode Indicator */}
        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex-shrink-0">
          {calendarType === 'hijri' ? (isArabic ? 'هجري' : 'Hijri') : (isArabic ? 'ميلادي' : 'Greg')}
        </span>
      </div>

      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

      {/* Popover Calendar */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1.5 left-0 right-0 sm:left-auto sm:right-auto sm:w-[320px] rounded-2xl bg-slate-900 border border-slate-700/80 p-4 shadow-2xl backdrop-blur-xl animate-slide-up space-y-3"
          style={{ maxWidth: '100vw' }}
        >
          {/* Top Bar: Hijri/Gregorian Toggle + Today button */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
            {/* Toggle Button: [ هجري | ميلادي ] */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950/90 border border-slate-700/60 shadow-inner">
              <button
                type="button"
                onClick={() => setCalendarType('hijri')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  calendarType === 'hijri'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isArabic ? 'هجري' : 'Hijri'}
              </button>
              <button
                type="button"
                onClick={() => setCalendarType('gregorian')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  calendarType === 'gregorian'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isArabic ? 'ميلادي' : 'Gregorian'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoToday}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors border border-slate-700/60"
            >
              {t('calendar.today')}
            </button>
          </div>

          {/* Month Navigation & Month Title */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              title={t('calendar.prevMonth')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>

            <div className="text-center">
              <h4 className="text-xs font-bold text-white tracking-wide">
                {monthHeaderLabel}
              </h4>
              <p className="text-[10px] text-slate-400 font-medium">
                {secondaryMonthLabel}
              </p>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              title={t('calendar.nextMonth')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>

          {/* Day Names Header */}
          <div className="grid grid-cols-7 gap-1">
            {dayHeaders.map((d, idx) => (
              <div
                key={idx}
                className="text-center text-[10px] font-bold text-slate-500 py-0.5"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {gridData.map((dayItem, idx) => {
              let cellStyle =
                'relative flex flex-col items-center justify-center h-8 rounded-lg text-xs font-medium transition-all select-none ';

              if (!dayItem.inCurrentMonth) {
                cellStyle += 'text-slate-700 opacity-40 hover:opacity-80 hover:bg-slate-800/40 cursor-pointer';
              } else if (dayItem.disabled) {
                cellStyle += 'text-slate-700 cursor-not-allowed';
              } else if (dayItem.selected) {
                cellStyle +=
                  calendarType === 'hijri'
                    ? 'bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/30 cursor-pointer'
                    : 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30 cursor-pointer';
              } else if (dayItem.isToday) {
                cellStyle +=
                  'ring-1 ring-indigo-400/60 text-indigo-300 font-bold hover:bg-slate-800 cursor-pointer';
              } else {
                cellStyle += 'text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={dayItem.disabled}
                  onClick={() => !dayItem.disabled && handleSelectDay(dayItem.date)}
                  className={cellStyle}
                  title={dayItem.fullLabel}
                >
                  <span className="leading-none text-[11px] font-bold">
                    {dayItem.primaryNumber}
                  </span>
                  <span
                    className={`text-[8px] leading-none mt-0.5 ${
                      dayItem.selected ? 'text-white/80' : 'text-slate-500'
                    }`}
                  >
                    {dayItem.secondaryNumber}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Date Summary at bottom */}
          {value && (
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="truncate">
                {formatDualDate(value, isArabic, formatBookingDate)}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
              >
                {isArabic ? 'تم' : 'Done'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
