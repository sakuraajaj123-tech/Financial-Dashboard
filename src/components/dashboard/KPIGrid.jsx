// KPIGrid.jsx — Grid of 4 KPI summary cards

import { TrendingUp, DollarSign, Users, Home } from 'lucide-react';
import { KPICard } from './KPICard';
import { useTranslation } from 'react-i18next';

export function KPIGrid({ kpis }) {
  const { t } = useTranslation();
  const { occupancyRate, monthlyRevenue, gathernPct, directPct, availableUnits, totalUnits } = kpis;

  const availablePct = totalUnits > 0 ? Math.round((availableUnits / totalUnits) * 100) : 0;

  const formatCurrency = (val) =>
    new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title={t('kpi.occupancyRate')}
        value={`${occupancyRate}%`}
        subtitle={t('kpi.occupancySubtitle', { occupied: kpis.occupiedUnits, total: kpis.totalUnits })}
        icon={TrendingUp}
        color="indigo"
      />
      <KPICard
        title={t('kpi.monthlyRevenue')}
        value={formatCurrency(monthlyRevenue)}
        subtitle={t('kpi.revenueSubtitle')}
        icon={DollarSign}
        color="emerald"
      />
      <KPICard
        title={t('kpi.bookingSources')}
        value={`${gathernPct}% / ${directPct}%`}
        subtitle={t('kpi.sourcesSubtitle')}
        icon={Users}
        color="violet"
      />
      <KPICard
        title={t('kpi.availableUnits')}
        value={availableUnits}
        subtitle={t('kpi.availableSubtitle', { pct: availablePct })}
        icon={Home}
        color={availableUnits > 0 ? 'emerald' : 'rose'}
      />
    </div>
  );
}
