// UnitCard.jsx — Unit card for dashboard grid with upcoming reservation support

import { useMemo } from 'react';
import { Eye, Plus, Calendar, Shield } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../shared/Button';
import { UNIT_STATUS } from '../../data/seedData';
import { parseISO, differenceInDays, startOfDay } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatBookingDate, formatSource } from '../../utils/dateFormatter';

export function UnitCard({ unit, currentTenant, onViewDetails, onAddBooking }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const isOccupied = unit.status === UNIT_STATUS.OCCUPIED;

  // Checkout countdown for currently occupied unit
  const daysUntilCheckout = currentTenant
    ? differenceInDays(startOfDay(parseISO(currentTenant.checkOut)), startOfDay(new Date()))
    : null;

  // Find earliest active upcoming reservation for available unit
  const nextBooking = useMemo(() => {
    if (isOccupied || !Array.isArray(unit.bookings) || unit.bookings.length === 0) return null;
    const today = startOfDay(new Date());
    const upcoming = unit.bookings.filter((b) => {
      if (!b || !b.checkIn) return false;
      if (b.status === 'cancelled') return false;
      return startOfDay(parseISO(b.checkIn)) >= today;
    });
    if (upcoming.length === 0) return null;
    upcoming.sort((a, b) => parseISO(a.checkIn) - parseISO(b.checkIn));
    return upcoming[0];
  }, [isOccupied, unit.bookings]);

  // Check-in countdown for next upcoming reservation
  const daysUntilCheckIn = nextBooking
    ? differenceInDays(startOfDay(parseISO(nextBooking.checkIn)), startOfDay(new Date()))
    : null;

  const urgencyColor =
    daysUntilCheckout !== null && daysUntilCheckout <= 3
      ? 'text-rose-400'
      : daysUntilCheckout !== null && daysUntilCheckout <= 7
      ? 'text-amber-400'
      : 'text-slate-400';

  return (
    <div
      className={`relative group rounded-2xl border backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer
        ${isOccupied
          ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/50 hover:border-rose-500/30 hover:shadow-rose-500/10'
          : nextBooking
          ? 'bg-gradient-to-br from-slate-800/70 to-slate-900/80 border-slate-700/50 hover:border-emerald-500/40 hover:shadow-emerald-500/10'
          : 'bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-slate-700/40 hover:border-emerald-500/30 hover:shadow-emerald-500/10'
        }`}
      onClick={() => onViewDetails(unit)}
    >
      {/* Top accent bar */}
      <div
        className={`h-1 w-full ${
          isOccupied
            ? 'bg-gradient-to-r from-rose-500 to-pink-600'
            : nextBooking
            ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500'
            : 'bg-gradient-to-r from-emerald-500 to-teal-600'
        }`}
      />

      <div className="p-4 flex flex-col justify-between h-full min-h-[190px]">
        <div>
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xl font-bold text-white">{t('unit.unit')} {unit.number}</span>
            <StatusBadge status={unit.status} size="sm" />
          </div>

          {/* 1. Currently Occupied Tenant Card */}
          {isOccupied && currentTenant ? (
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">
                    {(currentTenant.guestName || currentTenant.tenantName || 'T').charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-semibold text-slate-200 truncate">
                  {currentTenant.guestName || currentTenant.tenantName}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 ${urgencyColor}`}>
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span className="text-xs font-medium">
                  {t('unit.checkout')}: {formatBookingDate(currentTenant.checkOut, isArabic)}
                  {daysUntilCheckout !== null && (
                    <span className="ms-1 font-semibold">
                      ({daysUntilCheckout <= 0 ? t('unit.today') : t('unit.daysLeft', { count: daysUntilCheckout })})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 flex-wrap">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  currentTenant.source === 'Gathern' || String(currentTenant.source).toLowerCase().includes('gathern')
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'bg-blue-500/15 text-blue-400'
                }`}>
                  {formatSource(currentTenant.source, isArabic)}
                </span>
                <span className="text-xs text-slate-500">
                  SAR {Number(currentTenant.amount).toLocaleString()}
                </span>
                {Number(currentTenant.insurance) > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    {t('unit.insurance')}: {Number(currentTenant.insurance).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ) : nextBooking ? (
            /* 2. Available Unit with Upcoming Reservation Preview Card */
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">
                      {(nextBooking.guestName || nextBooking.tenantName || 'G').charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-200 truncate">
                    {nextBooking.guestName || nextBooking.tenantName}
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0 flex items-center gap-1">
                  <span>📅</span>
                  <span>{t('unit.hasUpcomingBooking')}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-emerald-400">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span className="text-xs font-medium">
                  {t('unit.checkin')}: {formatBookingDate(nextBooking.checkIn, isArabic)}
                  {daysUntilCheckIn !== null && (
                    <span className="ms-1 font-semibold text-emerald-300">
                      ({daysUntilCheckIn <= 0
                        ? t('unit.today')
                        : daysUntilCheckIn === 1
                        ? t('unit.inOneDay')
                        : t('unit.inDays', { count: daysUntilCheckIn })})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 flex-wrap">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  nextBooking.source === 'Gathern' || String(nextBooking.source).toLowerCase().includes('gathern')
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'bg-blue-500/15 text-blue-400'
                }`}>
                  {formatSource(nextBooking.source, isArabic)}
                </span>
                <span className="text-xs text-slate-500">
                  SAR {Number(nextBooking.amount).toLocaleString()}
                </span>
                {Number(nextBooking.insurance) > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    {t('unit.insurance')}: {Number(nextBooking.insurance).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* 3. Empty Available Unit Placeholder */
            <div className="flex items-center justify-center h-[76px] rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-4">
              <span className="text-xs text-emerald-500/70 font-medium">{t('unit.readyForBooking')}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="xs"
            icon={Eye}
            onClick={() => onViewDetails(unit)}
            className="flex-1"
          >
            {t('unit.details')}
          </Button>
          <Button
            variant="secondary"
            size="xs"
            icon={Plus}
            onClick={() => onAddBooking(unit)}
          />
        </div>
      </div>
    </div>
  );
}
