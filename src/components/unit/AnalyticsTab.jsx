// AnalyticsTab.jsx — Unit-level analytics with Recharts

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatMonthYear, formatSource } from '../../utils/dateFormatter';

const PIE_COLORS = ['#8b5cf6', '#3b82f6'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-semibold text-white">
          SAR {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload, isArabic }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const count = item.value;
  const bookingLabel = count === 1 ? t('analytics.bookingSingle') : t('analytics.bookingPlural');
  const sourceName = formatSource(item.name, isArabic);
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-sm font-semibold text-white">
        {sourceName}: {count} {bookingLabel}
      </p>
      <p className="text-xs text-slate-400">{item.payload.pct}%</p>
    </div>
  );
}

export function AnalyticsTab({ unit, monthlyRevenue = [], sourceSplit = [] }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const totalRevenue = unit.bookings.reduce((sum, b) => sum + b.amount, 0);
  const avgRevenue = unit.bookings.length > 0
    ? Math.round(totalRevenue / unit.bookings.length)
    : 0;

  // Localize month labels in monthly revenue chart
  const localizedMonthlyRevenue = useMemo(() => {
    return monthlyRevenue.map((item) => ({
      ...item,
      monthLabel: formatMonthYear(item.date || item.month, isArabic),
    }));
  }, [monthlyRevenue, isArabic]);

  // Localize source names in source split
  const localizedSourceSplit = useMemo(() => {
    return sourceSplit.map((item) => ({
      ...item,
      displayName: formatSource(item.name, isArabic),
    }));
  }, [sourceSplit, isArabic]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('analytics.totalRevenue'), value: `SAR ${totalRevenue.toLocaleString()}`, color: 'text-emerald-400' },
          { label: t('analytics.totalBookings'), value: unit.bookings.length, color: 'text-indigo-400' },
          { label: t('analytics.avgPerBooking'), value: `SAR ${avgRevenue.toLocaleString()}`, color: 'text-violet-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3 text-center">
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Revenue Chart */}
      <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-5">
        <h4 className="text-sm font-semibold text-slate-200 mb-4">{t('analytics.monthlyRevenueTrend')}</h4>
        {localizedMonthlyRevenue.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">{t('analytics.noRevenue')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={localizedMonthlyRevenue} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar
                dataKey="revenue"
                fill="url(#revenueGrad)"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.4} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Source Split Pie Chart */}
      <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-5">
        <h4 className="text-sm font-semibold text-slate-200 mb-4">{t('analytics.clientAcquisitionSource')}</h4>
        {localizedSourceSplit.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">{t('analytics.noSources')}</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={localizedSourceSplit}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {localizedSourceSplit.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip isArabic={isArabic} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3 min-w-0">
              {localizedSourceSplit.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[index] }}
                    />
                    <span className="text-sm text-slate-300 truncate">{entry.displayName}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-bold text-white">{entry.pct}%</span>
                    <span className="text-xs text-slate-500 ms-1">({entry.value})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
