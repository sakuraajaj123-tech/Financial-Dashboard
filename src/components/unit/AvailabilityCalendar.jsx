// AvailabilityCalendar.jsx — Simple visual calendar for upcoming availability with Hijri & Gregorian toggle

import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatFullMonthYear, formatSource, formatBookingDate } from '../../utils/dateFormatter';
import {
  getHijriMonthGrid,
  formatHijriMonthYear,
  formatHijriDate,
  formatDualDate,
  DAY_NAMES_AR,
  DAY_NAMES_EN,
} from '../../utils/hijriCalendar';

export function AvailabilityCalendar({
  bookings = [],
  month = new Date(),
  calendarType: externalCalendarType,
  onToggleCalendarType,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [internalCalendarType, setInternalCalendarType] = useState(isArabic ? 'hijri' : 'gregorian');
  const calendarType = externalCalendarType !== undefined ? externalCalendarType : internalCalendarType;

  const setCalendarType = (type) => {
    if (onToggleCalendarType) {
      onToggleCalendarType(type);
    } else {
      setInternalCalendarType(type);
    }
  };

  const bookedRanges = useMemo(() => {
    return bookings
      .filter((b) => b.checkIn && b.checkOut)
      .map((b) => ({
        start: parseISO(b.checkIn),
        end: parseISO(b.checkOut),
        tenant: b.tenantName,
        source: b.source,
      }));
  }, [bookings]);

  function getBookingForDay(day) {
    return bookedRanges.find((range) =>
      isWithinInterval(day, { start: range.start, end: range.end })
    );
  }

  const monthLabel = useMemo(() => {
    if (calendarType === 'hijri') {
      return formatHijriMonthYear(month, isArabic);
    }
    return formatFullMonthYear(month, isArabic);
  }, [calendarType, month, isArabic]);

  const calendarDays = useMemo(() => {
    if (calendarType === 'hijri') {
      const { days } = getHijriMonthGrid(month);
      return days.map((d) => ({
        date: d.date,
        primaryNum: d.hijriDay,
        secondaryNum: d.date.getDate(),
        inMonth: d.inCurrentMonth,
        isToday: d.isToday,
      }));
    }

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const gDays = eachDayOfInterval({ start: calStart, end: calEnd });

    return gDays.map((d) => ({
      date: d,
      primaryNum: d.getDate(),
      secondaryNum: null,
      inMonth: isSameMonth(d, month),
      isToday: isToday(d),
    }));
  }, [calendarType, month]);

  const dayNames = isArabic ? DAY_NAMES_AR : DAY_NAMES_EN;

  return (
    <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-5 space-y-4">
      {/* Calendar Header with Title, Toggle, and Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-200">
            {t('calendar.monthAvailability', { month: monthLabel })}
          </h4>
        </div>

        <div className="flex items-center gap-3">
          {/* Calendar Type Toggle: [ هجري | ميلادي ] */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-900/90 border border-slate-700/60 shadow-inner">
            <button
              type="button"
              onClick={() => setCalendarType('hijri')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
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
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                calendarType === 'gregorian'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isArabic ? 'ميلادي' : 'Gregorian'}
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/60" />
              <span className="text-slate-400">{t('calendar.booked')}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30" />
              <span className="text-slate-400">{t('calendar.available')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Day names header */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[11px] font-bold text-slate-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((item, idx) => {
          const day = item.date;
          const inMonth = item.inMonth;
          const isTodayDay = item.isToday;
          const booking = getBookingForDay(day);

          return (
            <div
              key={idx}
              className={`relative flex flex-col items-center justify-center py-2 rounded-xl text-xs transition-all select-none ${
                !inMonth
                  ? 'text-slate-700 opacity-40'
                  : isTodayDay
                  ? 'text-white font-bold'
                  : booking
                  ? 'text-rose-200'
                  : 'text-slate-300'
              } ${
                booking && inMonth
                  ? 'bg-rose-500/20 border border-rose-500/30'
                  : inMonth && !booking
                  ? 'bg-slate-900/50 border border-slate-700/30 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                  : 'border border-transparent'
              } ${isTodayDay ? 'ring-2 ring-indigo-500/60 shadow-md shadow-indigo-500/10' : ''}`}
              title={
                booking
                  ? `${formatDualDate(day, isArabic, formatBookingDate)} — ${booking.tenant} (${formatSource(
                      booking.source,
                      isArabic
                    )})`
                  : inMonth
                  ? `${formatDualDate(day, isArabic, formatBookingDate)} — ${t('calendar.available')}`
                  : ''
              }
            >
              <span className="font-bold text-[12px]">{item.primaryNum}</span>
              {item.secondaryNum && (
                <span className="text-[9px] text-slate-500 leading-none mt-0.5">
                  {item.secondaryNum}
                </span>
              )}
              {booking && inMonth && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-rose-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
