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
 *   pickerType   — 'checkIn' | 'checkOut' | undefined
 *   checkInValue — string 'YYYY-MM-DD' when pickerType === 'checkOut'
 *   selectedRange — { checkIn: '', checkOut: '' } — to shade the chosen range
 */
export function BookingCalendarPicker({
  value,
  onChange,
  bookings = [],
  minDate,
  pickerType,
  checkInValue,
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
    if (checkInValue) {
      try {
        const parsed = parseISO(checkInValue);
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
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          start: startOfDay(parseISO(b.checkIn)),
          end: startOfDay(parseISO(b.checkOut)),
          tenant: b.tenantName || '',
        })),
    [bookings]
  );

  // For check-out picker, find the earliest existing booking check-in on or after checkInValue
  const firstBlockedCheckIn = useMemo(() => {
    if (pickerType !== 'checkOut' || !checkInValue) return null;
    const upcoming = bookedRanges
      .filter((b) => b.checkIn >= checkInValue)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    return upcoming.length > 0 ? upcoming[0].checkIn : null;
  }, [pickerType, checkInValue, bookedRanges]);

  const rangeStart = selectedRange.checkIn ? startOfDay(parseISO(selectedRange.checkIn)) : null;
  const rangeEnd = selectedRange.checkOut ? startOfDay(parseISO(selectedRange.checkOut)) : null;

  // Day classification helper
  function getDayInfo(day) {
    const dayStr = format(day, 'yyyy-MM-dd');
    const checkInBooking = bookedRanges.find((b) => b.checkIn === dayStr);
    const checkOutBooking = bookedRanges.find((b) => b.checkOut === dayStr);
    const middleBooking = bookedRanges.find((b) => b.checkIn < dayStr && dayStr < b.checkOut);
    const isTurnover = Boolean(checkInBooking && checkOutBooking);

    // Is before minDate (past date)
    const isPast = minDate ? isBefore(startOfDay(day), startOfDay(minDate)) : false;

    let isBlocked = false;
    let isBooked = false;
    let isTransitionAvailable = false;
    let tooltip = '';

    if (isPast) {
      isBlocked = true;
      isBooked = false;
      tooltip = isArabic ? 'تاريخ سابق (غير متاح)' : (t('calendar.unavailable') || 'Unavailable');
    } else if (pickerType === 'checkIn') {
      if (middleBooking) {
        isBlocked = true;
        isBooked = true;
        tooltip = `${t('calendar.booked')} — ${middleBooking.tenant}`;
      } else if (isTurnover) {
        isBlocked = true;
        isBooked = true;
        tooltip = isArabic
          ? `يوم تبديل كامل (مغادرة ${checkOutBooking.tenant} 1:00 م / دخول ${checkInBooking.tenant} 4:00 م)`
          : `Full turnover (${checkOutBooking.tenant} leaves 1:00 PM / ${checkInBooking.tenant} arrives 4:00 PM)`;
      } else if (checkInBooking) {
        isBlocked = true;
        isBooked = true;
        tooltip = isArabic
          ? `محجوز للدخول 4:00 م — ${checkInBooking.tenant}`
          : `Check-in occupied (4:00 PM) — ${checkInBooking.tenant}`;
      } else if (checkOutBooking) {
        // Prior guest leaves at 1:00 PM; new guest can enter at 4:00 PM!
        isBlocked = false;
        isTransitionAvailable = true;
        tooltip = isArabic
          ? `متاح للدخول 4:00 م (مغادرة ${checkOutBooking.tenant} 1:00 م)`
          : `Available for Check-in 4:00 PM (${checkOutBooking.tenant} departs 1:00 PM)`;
      } else {
        isBlocked = false;
        tooltip = `${dayStr} (${formatHijriDate(day, isArabic)})`;
      }
    } else if (pickerType === 'checkOut') {
      if (checkInValue && dayStr <= checkInValue) {
        isBlocked = true;
        isBooked = false;
        tooltip = isArabic ? 'يجب أن يكون تاريخ المغادرة بعد الوصول' : 'Check-out must be after check-in';
      } else if (firstBlockedCheckIn && dayStr > firstBlockedCheckIn) {
        isBlocked = true;
        isBooked = middleBooking || Boolean(checkInBooking);
        tooltip = isArabic ? 'لا يمكن الحجز عبر فترة محجوزة مسبقاً' : 'Cannot book across an existing reservation';
      } else if (firstBlockedCheckIn && dayStr === firstBlockedCheckIn) {
        // Departs at 1:00 PM on the same day the next guest arrives at 4:00 PM!
        isBlocked = false;
        isTransitionAvailable = true;
        tooltip = isArabic
          ? `متاح للمغادرة 1:00 م (وصول ${checkInBooking?.tenant || ''} 4:00 م)`
          : `Available for Check-out 1:00 PM (Next guest ${checkInBooking?.tenant || ''} arrives 4:00 PM)`;
      } else if (middleBooking) {
        isBlocked = true;
        isBooked = true;
        tooltip = `${t('calendar.booked')} — ${middleBooking.tenant}`;
      } else if (checkOutBooking && !checkInBooking) {
        isBlocked = true;
        isBooked = true;
        tooltip = isArabic
          ? `محجوز الليلة السابقة — ${checkOutBooking.tenant}`
          : `Occupied previous night — ${checkOutBooking.tenant}`;
      } else {
        isBlocked = false;
        tooltip = `${dayStr} (${formatHijriDate(day, isArabic)})`;
      }
    } else {
      // Generic mode
      if (middleBooking || isTurnover) {
        isBlocked = true;
        isBooked = true;
        tooltip = `${t('calendar.booked')} — ${(middleBooking || checkInBooking)?.tenant}`;
      } else {
        isBlocked = false;
        tooltip = `${dayStr} (${formatHijriDate(day, isArabic)})`;
      }
    }

    return {
      dayStr,
      isBlocked,
      isBooked,
      isPast,
      isTransitionAvailable,
      tooltip,
      middleBooking,
      checkInBooking,
      checkOutBooking,
      isTurnover,
    };
  }

  function isSelected(day) {
    return value ? isSameDay(day, parseISO(value)) : false;
  }

  function isInSelectedRange(day) {
    if (!rangeStart || !rangeEnd) return false;
    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  }

  function handleDayClick(day, dayInfo) {
    if (dayInfo.isBlocked) return;
    onChange(dayInfo.dayStr);
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
          const dayInfo = getDayInfo(day);
          const selected = isSelected(day);
          const inRange = inMonth && isInSelectedRange(day);

          let cellClass =
            'relative flex items-center justify-center h-7 rounded-lg text-[11px] font-medium transition-all ';

          if (!inMonth) {
            cellClass += 'text-slate-700 cursor-default opacity-40';
          } else if (selected) {
            cellClass +=
              calendarType === 'hijri'
                ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400/50 cursor-pointer z-10'
                : 'bg-indigo-500 text-white font-bold ring-2 ring-indigo-400/50 cursor-pointer z-10';
          } else if (dayInfo.isBooked) {
            cellClass += 'bg-rose-500/15 text-rose-400/60 cursor-not-allowed';
          } else if (dayInfo.isBlocked) {
            cellClass += 'text-slate-600/60 cursor-not-allowed bg-slate-900/30';
          } else if (dayInfo.isTransitionAvailable) {
            cellClass += 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/20 cursor-pointer';
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
              onClick={() => inMonth && !dayInfo.isBlocked && handleDayClick(day, dayInfo)}
              title={inMonth ? dayInfo.tooltip : ''}
            >
              <span>{item.displayNum}</span>
              {dayInfo.isBooked && inMonth && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-500/60" />
              )}
              {dayInfo.isTransitionAvailable && inMonth && !selected && (
                <span className="absolute top-0.5 end-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/40 text-[10px] text-slate-400">
        <div className="flex items-center gap-2.5 flex-wrap">
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
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            {isArabic ? 'تبديل متاح' : 'Turnover ok'}
          </span>
        </div>
      </div>
    </div>
  );
}
