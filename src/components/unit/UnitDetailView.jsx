// UnitDetailView.jsx — Dedicated unit view with tabs (History & Analytics)

import { useMemo } from 'react';
import { ArrowLeft, Plus, BedDouble } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../shared/Button';
import { BookingHistoryTab } from './BookingHistoryTab';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { addMonths } from 'date-fns';
import { useTranslation } from 'react-i18next';

export function UnitDetailView({
  unit,
  onBack,
  onAddBooking,
  onDeleteBooking,
  onViewBookingDetails,
}) {
  const { t } = useTranslation();
  const nextMonth = useMemo(() => addMonths(new Date(), 1), []);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back nav + unit header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{t('unit.unit')} {unit.number}</h2>
              <StatusBadge status={unit.status} size="md" />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-slate-500">
              <BedDouble className="w-3.5 h-3.5" />
              <span className="text-xs">
                {unit.bedrooms} {unit.bedrooms > 1 ? t('unitDetail.bedrooms') : t('unitDetail.bedroom')} • {t('unit.floor')} {unit.floor}
              </span>
            </div>
          </div>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => onAddBooking(unit)}>
          {t('unitDetail.addBooking')}
        </Button>
      </div>

      {/* Main Content: Calendars & Booking History */}
      <div className="space-y-6">
        {/* Availability calendars — current & next month */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AvailabilityCalendar bookings={unit.bookings || []} month={new Date()} />
          <AvailabilityCalendar bookings={unit.bookings || []} month={nextMonth} />
        </div>

        {/* Booking history */}
        <BookingHistoryTab
          unit={{ ...unit, bookings: unit.bookings || [] }}
          onDeleteBooking={onDeleteBooking}
          onViewDetails={onViewBookingDetails}
        />
      </div>
    </div>
  );
}
