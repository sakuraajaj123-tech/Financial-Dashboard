// AvailabilityCalendar.jsx — Simple visual calendar for upcoming availability

import { useMemo } from 'react';
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

export function AvailabilityCalendar({ bookings = [], month = new Date() }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [month]);

  const bookedRanges = useMemo(() => {
    return bookings.map((b) => ({
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
    return new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-US', {
      month: 'long',
      year: 'numeric',
    }).format(month);
  }, [month, isArabic]);

  const dayNames = isArabic
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-200">
          {t('calendar.monthAvailability', { month: monthLabel })}
        </h4>
        <div className="flex items-center gap-3 text-xs">
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

      {/* Day names header */}
      <div className="grid grid-cols-7 mb-2">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day, idx) => {
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const booking = getBookingForDay(day);

          return (
            <div
              key={idx}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-colors ${
                !inMonth
                  ? 'text-slate-700'
                  : today
                  ? 'text-white font-bold'
                  : booking
                  ? 'text-rose-300'
                  : 'text-slate-400'
              } ${
                booking && inMonth
                  ? 'bg-rose-500/15'
                  : inMonth && !booking
                  ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                  : ''
              } ${today ? 'ring-1 ring-indigo-500/60' : ''}`}
              title={
                booking
                  ? `${booking.tenant} (${booking.source})`
                  : inMonth
                  ? t('calendar.available')
                  : ''
              }
            >
              <span>{format(day, 'd')}</span>
              {booking && inMonth && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
