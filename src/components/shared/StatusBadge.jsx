// StatusBadge.jsx — Reusable status indicator pill

import { UNIT_STATUS } from '../../data/seedData';
import { useTranslation } from 'react-i18next';

export function StatusBadge({ status, size = 'md' }) {
  const { t } = useTranslation();
  const isOccupied = status === UNIT_STATUS.OCCUPIED;
  const label = isOccupied ? t('dashboard.occupied') : t('dashboard.available');

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${sizes[size]} ${
        isOccupied
          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isOccupied ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'
        }`}
      />
      {label}
    </span>
  );
}
