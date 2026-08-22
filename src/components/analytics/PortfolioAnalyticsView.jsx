// PortfolioAnalyticsView.jsx — Full property analytics view

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { KPIGrid } from '../dashboard/KPIGrid';
import { useTranslation } from 'react-i18next';
import { UNIT_STATUS } from '../../data/seedData';
import { StatusBadge } from '../shared/StatusBadge';
import { Building2, DollarSign, CalendarCheck } from 'lucide-react';

const PIE_COLORS = ['#8b5cf6', '#3b82f6'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-bold text-white">
          SAR {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="text-sm font-bold text-white">
        {payload[0].name}: {payload[0].value} {payload[0].value !== 1 ? 'bookings' : 'booking'}
      </p>
      <p className="text-xs text-indigo-400 font-semibold mt-0.5">{payload[0].payload.pct}%</p>
    </div>
  );
}

export function PortfolioAnalyticsView({
  kpis,
  units,
  monthlyRevenue = [],
  sourceSplit = [],
  onSelectUnit,
}) {
  const { t } = useTranslation();

  const totalAllRevenue = units.reduce(
    (total, u) => total + u.bookings.reduce((sum, b) => sum + b.amount, 0),
    0
  );
  const totalAllBookings = units.reduce((total, u) => total + u.bookings.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top KPI Grid */}
      <section>
        <KPIGrid kpis={kpis} />
      </section>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Trend */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/60 border border-slate-700/50 p-5 lg:p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h4 className="text-base font-bold text-white tracking-wide">
                {t('kpi.monthlyRevenue')} - Trend
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Historical revenue distribution across all units</p>
            </div>
            <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              SAR {totalAllRevenue.toLocaleString()} Total
            </div>
          </div>

          {monthlyRevenue.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-12">No revenue data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyRevenue} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar
                  dataKey="revenue"
                  fill="url(#portfolioRevenueGrad)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={44}
                />
                <defs>
                  <linearGradient id="portfolioRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Source Split Donut */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/60 border border-slate-700/50 p-5 lg:p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
          <div>
            <h4 className="text-base font-bold text-white tracking-wide">
              {t('kpi.bookingSources')}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Distribution by booking platform</p>
          </div>

          {sourceSplit.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-12">No source data available</p>
          ) : (
            <div className="my-auto py-4">
              <div className="flex justify-center">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={sourceSplit}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sourceSplit.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 mt-4">
                {sourceSplit.map((entry, index) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[index] }}
                      />
                      <span className="text-sm font-medium text-slate-300 truncate">
                        {entry.name}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-bold text-white">{entry.pct}%</span>
                      <span className="text-xs text-slate-500 ms-1.5">({entry.value})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unit Performance Breakdown */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/60 border border-slate-700/50 p-5 lg:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white tracking-wide">
                Unit Revenue & Performance Overview
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Individual unit earnings and occupancy metrics</p>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium hidden sm:block">
            {units.length} units total
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400">
                <th className="py-3 px-4">{t('unit.unit')}</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Bedrooms / Floor</th>
                <th className="py-3 px-4">Total Bookings</th>
                <th className="py-3 px-4 text-right rtl:text-left">Total Earnings</th>
                {onSelectUnit && <th className="py-3 px-4 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {units.map((unit) => {
                const revenue = unit.bookings.reduce((sum, b) => sum + b.amount, 0);
                const bookingsCount = unit.bookings.length;
                return (
                  <tr
                    key={unit.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => onSelectUnit && onSelectUnit(unit)}
                  >
                    <td className="py-3.5 px-4 font-bold text-white">
                      {t('unit.unit')} {unit.number}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={unit.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">
                      {unit.bedrooms} {t('unit.bed')} • {t('unit.floor')} {unit.floor}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {bookingsCount}
                    </td>
                    <td className="py-3.5 px-4 text-right rtl:text-left font-semibold text-emerald-400">
                      SAR {revenue.toLocaleString()}
                    </td>
                    {onSelectUnit && (
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-all"
                        >
                          {t('unit.details')}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
