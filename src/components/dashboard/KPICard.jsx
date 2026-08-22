// KPICard.jsx — Individual KPI metric card with icon and trend

import { useTranslation } from 'react-i18next';

export function KPICard({ title, value, subtitle, icon: Icon, color = 'indigo', trend }) {
  const { t } = useTranslation();

  const colorMap = {
    indigo: {
      bg: 'from-indigo-500/10 to-indigo-600/5',
      border: 'border-indigo-500/20',
      icon: 'bg-indigo-500/15 text-indigo-400',
      ring: 'shadow-indigo-500/10',
    },
    violet: {
      bg: 'from-violet-500/10 to-violet-600/5',
      border: 'border-violet-500/20',
      icon: 'bg-violet-500/15 text-violet-400',
      ring: 'shadow-violet-500/10',
    },
    emerald: {
      bg: 'from-emerald-500/10 to-emerald-600/5',
      border: 'border-emerald-500/20',
      icon: 'bg-emerald-500/15 text-emerald-400',
      ring: 'shadow-emerald-500/10',
    },
    rose: {
      bg: 'from-rose-500/10 to-rose-600/5',
      border: 'border-rose-500/20',
      icon: 'bg-rose-500/15 text-rose-400',
      ring: 'shadow-rose-500/10',
    },
    amber: {
      bg: 'from-amber-500/10 to-amber-600/5',
      border: 'border-amber-500/20',
      icon: 'bg-amber-500/15 text-amber-400',
      ring: 'shadow-amber-500/10',
    },
  };

  const c = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.bg} border ${c.border} p-5 shadow-xl ${c.ring} backdrop-blur-sm group hover:scale-[1.02] transition-transform duration-300`}
    >
      {/* Background glow blob */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-current opacity-5 blur-2xl" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest truncate mb-1">
            {title}
          </p>
          <p className="text-2xl lg:text-3xl font-bold text-white truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
              <span className="text-slate-500">{t('kpi.vsLastMonth')}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
