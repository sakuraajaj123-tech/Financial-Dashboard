// BookingCalendarPicker.jsx — Inline date picker with booking overlap awareness & Hijri/Gregorian toggle

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isWithinInterval,
  parseISO,
  isBefore,
  startOfDay,
  isValid,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatFullMonthYear } from '../../utils/dateFormatter';
import {
  getHijriMonthGrid,
  addHijriMonths,
  subHijriMonths,
  formatHijriMonthYear,
  formatHijriDate,
  toMiddayDate,
} from '../../utils/hijriCalendar';

/**
 * BookingCalendarPicker
 *
 * Props:
 *   value        — ISO date string (YYYY-MM-DD) of the selected date, or ''
 *   onChange     — (isoString: string) => void
 *   bookings     — existing bookings array [{checkIn, checkOut, tenantName}]
 *   minDate      — optional Date: disables days before this
 *   label        — string label shown above the picker
 *   selectedRange — { checkIn: '', checkOut: '' } — to shade the chosen range
 */
export function BookingCalendarPicker({
  value,
  onChange,
  bookings = [],
  minDate,
  selectedRange = {},
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [calendarType, setCalendarType] = useState(isArabic ? 'hijri' : 'gregorian');

  const today = startOfDay(new Date());
  const initialMonth = (() => {
    if (value) {
      try {
        const parsed = parseISO(value);
        if (isValid(parsed)) return toMiddayDate(parsed);
      } catch { /* fall through */ }
    }
    return toMiddayDate(today);
  })();
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const bookedRanges = useMemo(
    () =>
      (bookings || [])
        .filter((b) => b.checkIn && b.checkOut)
        .map((b) => ({
          start: startOfDay(parseISO(b.checkIn)),
          end: startOfDay(parseISO(b.checkOut)),
          tenant: b.tenantName || '',
        })),
    [bookings]
  );

  const rangeStart = selectedRange.checkIn ? startOfDay(parseISO(selectedRange.checkIn)) : null;
  const rangeEnd = selectedRange.checkOut ? startOfDay(parseISO(selectedRange.checkOut)) : null;

  function isBooked(day) {
    return bookedRanges.some((r) => isWithinInterval(day, { start: r.start, end: r.end }));
  }

  function getBooking(day) {
    return bookedRanges.find((r) => isWithinInterval(day, { start: r.start, end: r.end }));
  }

  function isSelected(day) {
    return value ? isSameDay(day, parseISO(value)) : false;
  }

  function isInSelectedRange(day) {
    if (!rangeStart || !rangeEnd) return false;
    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  }

  function isDisabled(day) {
    if (minDate && isBefore(startOfDay(day), startOfDay(minDate))) return true;
    return false;
  }

  function handleDayClick(day) {
    if (isDisabled(day)) return;
    onChange(format(day, 'yyyy-MM-dd'));
  }

  const handlePrevMonth = () => {
    if (calendarType === 'hijri') {
      setViewMonth((m) => subHijriMonths(m, 1));
    } else {
      setViewMonth((m) => subMonths(m, 1));
    }
  };

  const handleNextMonth = () => {
    if (calendarType === 'hijri') {
      setViewMonth((m) => addHijriMonths(m, 1));
    } else {
      setViewMonth((m) => addMonths(m, 1));
    }
  };

  const monthLabel = useMemo(() => {
    if (calendarType === 'hijri') {
      return formatHijriMonthYear(viewMonth, isArabic);
    }
    return formatFullMonthYear(viewMonth, isArabic);
  }, [calendarType, viewMonth, isArabic]);

  const calendarDays = useMemo(() => {
    if (calendarType === 'hijri') {
      const { days } = getHijriMonthGrid(viewMonth);
      return days.map((d) => ({
        date: d.date,
        displayNum: d.hijriDay,
        inMonth: d.inCurrentMonth,
        isToday: d.isToday,
      }));
    }

    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const gDays = eachDayOfInterval({ start: calStart, end: calEnd });

    return gDays.map((d) => ({
      date: d,
      displayNum: d.getDate(),
      inMonth: isSameMonth(d, viewMonth),
      isToday: isToday(d),
    }));
  }, [calendarType, viewMonth]);

  const dayHeaders = isArabic
    ? ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-2.5 select-none">
      {/* Calendar Top Header: Navigation & Hijri/Gregorian Toggle */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-700/40">
        {/* Toggle [ هجري | ميلادي ] */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-900/90 border border-slate-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => setCalendarType('hijri')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
              calendarType === 'hijri'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isArabic ? 'هجري' : 'Hijri'}
          </button>
          <button
            type="button"
            onClick={() => setCalendarType('gregorian')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
              calendarType === 'gregorian'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isArabic ? 'ميلادي' : 'Gregorian'}
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
          <span className="text-xs font-bold text-slate-200 px-1 truncate max-w-[130px]">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-500 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((item, idx) => {
          const day = item.date;
          const inMonth = item.inMonth;
          const todayDay = item.isToday;
          const booked = inMonth && isBooked(day);
          const booking = booked ? getBooking(day) : null;
          const selected = isSelected(day);
          const inRange = inMonth && isInSelectedRange(day);
          const disabled = isDisabled(day);

          let cellClass =
            'relative flex items-center justify-center h-7 rounded-lg text-[11px] font-medium transition-all ';

          if (!inMonth) {
            cellClass += 'text-slate-700 cursor-default opacity-40';
          } else if (disabled) {
            cellClass += 'text-slate-700 cursor-not-allowed';
          } else if (selected) {
            cellClass +=
              calendarType === 'hijri'
                ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400/50 cursor-pointer z-10'
                : 'bg-indigo-500 text-white font-bold ring-2 ring-indigo-400/50 cursor-pointer z-10';
          } else if (booked) {
            cellClass += 'bg-rose-500/20 text-rose-300 cursor-not-allowed';
          } else if (inRange) {
            cellClass += 'bg-indigo-500/15 text-indigo-300 cursor-pointer';
          } else if (todayDay) {
            cellClass += 'ring-1 ring-indigo-500/50 text-indigo-300 hover:bg-slate-700/60 cursor-pointer';
          } else {
            cellClass += 'text-slate-300 hover:bg-slate-700/60 cursor-pointer';
          }

          return (
            <div
              key={idx}
              className={cellClass}
              onClick={() => inMonth && !booked && handleDayClick(day)}
              title={
                booked
                  ? `${t('calendar.booked')} — ${booking?.tenant}`
                  : disabled
                  ? t('calendar.unavailable')
                  : inMonth
                  ? `${format(day, 'yyyy-MM-dd')} (${formatHijriDate(day, isArabic)})`
                  : ''
              }
            >
              <span>{item.displayNum}</span>
              {booked && inMonth && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/40 text-[10px] text-slate-400">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-rose-500/40 inline-block" />
            {t('calendar.booked')}
          </span>
          <span className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-sm inline-block ${
                calendarType === 'hijri' ? 'bg-emerald-600' : 'bg-indigo-500'
              }`}
            />
            {t('calendar.selected')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-slate-700 inline-block" />
            {t('calendar.available')}
          </span>
        </div>
      </div>
    </div>
  );
}
