// BookingCalendarPicker.jsx — Inline date picker with booking overlap awareness

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
  isAfter,
  isBefore,
  startOfDay,
} from 'date-fns';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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
  label,
  selectedRange = {},
}) {
  const today = startOfDay(new Date());
  const initialMonth = (() => {
    if (value) {
      try {
        const parsed = parseISO(value);
        if (!isNaN(parsed.getTime())) return startOfMonth(parsed);
      } catch { /* fall through */ }
    }
    return startOfMonth(today);
  })();
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMonth]);

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
    if (minDate && isBefore(day, startOfDay(minDate))) return true;
    return false;
  }

  function handleDayClick(day) {
    if (isDisabled(day)) return;
    onChange(format(day, 'yyyy-MM-dd'));
  }

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-2 select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-slate-300">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-slate-500 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day, idx) => {
          const inMonth = isSameMonth(day, viewMonth);
          const todayDay = isToday(day);
          const booked = inMonth && isBooked(day);
          const booking = booked ? getBooking(day) : null;
          const selected = isSelected(day);
          const inRange = inMonth && isInSelectedRange(day);
          const disabled = isDisabled(day);

          let cellClass =
            'relative flex items-center justify-center h-7 rounded-lg text-[11px] font-medium transition-all ';

          if (!inMonth) {
            cellClass += 'text-slate-700 cursor-default';
          } else if (disabled) {
            cellClass += 'text-slate-700 cursor-not-allowed';
          } else if (selected) {
            cellClass += 'bg-indigo-500 text-white ring-2 ring-indigo-400/50 cursor-pointer z-10';
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
                  ? `Booked — ${booking?.tenant}`
                  : disabled
                  ? 'Unavailable'
                  : inMonth
                  ? 'Available'
                  : ''
              }
            >
              {format(day, 'd')}
              {booked && inMonth && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-1 border-t border-slate-700/40">
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-sm bg-rose-500/40 inline-block" />
          Booked
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" />
          Selected
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-sm bg-slate-700 inline-block" />
          Available
        </span>
      </div>
    </div>
  );
}
