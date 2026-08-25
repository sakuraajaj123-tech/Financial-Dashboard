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
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        start: parseISO(b.checkIn),
        end: parseISO(b.checkOut),
        tenant: b.tenantName,
        source: b.source,
      }));
  }, [bookings]);

  function getDayStatus(day) {
    const dayStr = format(day, 'yyyy-MM-dd');
    const checkInBooking = bookedRanges.find((b) => b.checkIn === dayStr);
    const checkOutBooking = bookedRanges.find((b) => b.checkOut === dayStr);
    const middleBooking = bookedRanges.find((b) => b.checkIn < dayStr && dayStr < b.checkOut);
    const isTurnover = Boolean(checkInBooking && checkOutBooking);

    if (isTurnover) {
      return {
        type: 'turnover',
        tooltip: isArabic
          ? `${formatDualDate(day, isArabic, formatBookingDate)} — تبديل حجوزات: مغادرة ${checkOutBooking.tenant} (1:00 م) / وصول ${checkInBooking.tenant} (4:00 م)`
          : `${formatDualDate(day, isArabic, formatBookingDate)} — Turnover: ${checkOutBooking.tenant} departs (1:00 PM) / ${checkInBooking.tenant} arrives (4:00 PM)`,
      };
    }

    if (middleBooking) {
      return {
        type: 'booked',
        tooltip: `${formatDualDate(day, isArabic, formatBookingDate)} — ${middleBooking.tenant} (${formatSource(middleBooking.source, isArabic)})`,
      };
    }

    if (checkInBooking) {
      return {
        type: 'checkIn',
        tooltip: isArabic
          ? `${formatDualDate(day, isArabic, formatBookingDate)} — دخول 4:00 م: ${checkInBooking.tenant} (${formatSource(checkInBooking.source, isArabic)})`
          : `${formatDualDate(day, isArabic, formatBookingDate)} — Check-in 4:00 PM: ${checkInBooking.tenant} (${formatSource(checkInBooking.source, isArabic)})`,
      };
    }

    if (checkOutBooking) {
      return {
        type: 'checkOut',
        tooltip: isArabic
          ? `${formatDualDate(day, isArabic, formatBookingDate)} — مغادرة 1:00 م: ${checkOutBooking.tenant} (متاح الليلة من 4:00 م)`
          : `${formatDualDate(day, isArabic, formatBookingDate)} — Check-out 1:00 PM: ${checkOutBooking.tenant} (Available tonight from 4:00 PM)`,
      };
    }

    return {
      type: 'available',
      tooltip: `${formatDualDate(day, isArabic, formatBookingDate)} — ${t('calendar.available')}`,
    };
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
          <div className="flex items-center gap-2.5 text-xs font-medium flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/60" />
              <span className="text-slate-400">{t('calendar.booked')}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-rose-500/50 to-emerald-500/50 border border-emerald-500/30" />
              <span className="text-slate-400">{isArabic ? 'مغادرة (متاح الليلة)' : 'Checkout (Free night)'}</span>
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
          const dayStatus = getDayStatus(day);

          let dayStyle = 'border border-transparent';
          let textStyle = 'text-slate-300';

          if (!inMonth) {
            textStyle = 'text-slate-700 opacity-40';
          } else if (isTodayDay) {
            textStyle = 'text-white font-bold';
          }

          if (inMonth) {
            if (dayStatus.type === 'turnover') {
              dayStyle = 'bg-gradient-to-r from-rose-500/25 via-purple-500/20 to-rose-500/25 border-rose-500/40';
              textStyle = 'text-rose-200 font-medium';
            } else if (dayStatus.type === 'booked') {
              dayStyle = 'bg-rose-500/20 border-rose-500/30';
              textStyle = 'text-rose-200';
            } else if (dayStatus.type === 'checkIn') {
              dayStyle = 'bg-gradient-to-r from-slate-900/60 to-rose-500/25 border-rose-500/30';
              textStyle = 'text-rose-100';
            } else if (dayStatus.type === 'checkOut') {
              dayStyle = 'bg-gradient-to-r from-rose-500/20 via-emerald-500/15 to-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/20';
              textStyle = 'text-emerald-200';
            } else {
              dayStyle = 'bg-slate-900/50 border-slate-700/30 hover:bg-emerald-500/10 hover:border-emerald-500/30';
            }
          }

          return (
            <div
              key={idx}
              className={`relative flex flex-col items-center justify-center py-2 rounded-xl text-xs transition-all select-none ${textStyle} ${dayStyle} ${
                isTodayDay ? 'ring-2 ring-indigo-500/60 shadow-md shadow-indigo-500/10' : ''
              }`}
              title={inMonth ? dayStatus.tooltip : ''}
            >
              <span className="font-bold text-[12px]">{item.primaryNum}</span>
              {item.secondaryNum && (
                <span className="text-[9px] text-slate-500 leading-none mt-0.5">
                  {item.secondaryNum}
                </span>
              )}
              {inMonth && (dayStatus.type === 'booked' || dayStatus.type === 'turnover') && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-rose-400" />
              )}
              {inMonth && dayStatus.type === 'checkIn' && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
              {inMonth && dayStatus.type === 'checkOut' && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
