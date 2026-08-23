// UnitCard.jsx — Unit card for dashboard grid

import { Eye, Plus, MessageCircle, BedDouble, Calendar, Shield } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../shared/Button';
import { UNIT_STATUS } from '../../data/seedData';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useTranslation } from 'react-i18next';

export function UnitCard({ unit, currentTenant, onViewDetails, onAddBooking, onWhatsApp }) {
  const { t } = useTranslation();
  const isOccupied = unit.status === UNIT_STATUS.OCCUPIED;
  const daysUntilCheckout = currentTenant
    ? differenceInDays(parseISO(currentTenant.checkOut), new Date())
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
          : 'bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-slate-700/40 hover:border-emerald-500/30 hover:shadow-emerald-500/10'
        }`}
      onClick={() => onViewDetails(unit)}
    >
      {/* Top accent bar */}
      <div
        className={`h-1 w-full ${
          isOccupied
            ? 'bg-gradient-to-r from-rose-500 to-pink-600'
            : 'bg-gradient-to-r from-emerald-500 to-teal-600'
        }`}
      />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">{t('unit.unit')} {unit.number}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
              <BedDouble className="w-3 h-3" />
              <span className="text-xs">{unit.bedrooms} {t('unit.bed')} • {t('unit.floor')} {unit.floor}</span>
            </div>
          </div>
          <StatusBadge status={unit.status} size="sm" />
        </div>

        {/* Tenant info */}
        {isOccupied && currentTenant ? (
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">
                  {currentTenant.tenantName.charAt(0)}
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-200 truncate">
                {currentTenant.tenantName}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 ${urgencyColor}`}>
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs">
                {t('unit.checkout')}: {format(parseISO(currentTenant.checkOut), 'MMM d, yyyy')}
                {daysUntilCheckout !== null && (
                  <span className="ml-1 font-semibold">
                    ({daysUntilCheckout <= 0 ? t('unit.today') : t('unit.daysLeft', { count: daysUntilCheckout })})
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                currentTenant.source === 'Gathern'
                  ? 'bg-violet-500/15 text-violet-400'
                  : 'bg-blue-500/15 text-blue-400'
              }`}>
                {currentTenant.source}
              </span>
              <span className="text-xs text-slate-500">
                SAR {currentTenant.amount.toLocaleString()}
              </span>
              {Number(currentTenant.insurance) > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  {t('unit.insurance')}: {Number(currentTenant.insurance).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-4">
            <span className="text-xs text-emerald-500/70 font-medium">{t('unit.readyForBooking')}</span>
          </div>
        )}

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
          {isOccupied && currentTenant && (
            <Button
              variant="whatsapp"
              size="xs"
              icon={MessageCircle}
              onClick={() => onWhatsApp(currentTenant, unit.number)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
