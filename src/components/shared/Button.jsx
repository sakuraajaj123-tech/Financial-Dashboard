// Button.jsx — Reusable button component with variants

import { clsx } from 'clsx';

const variants = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 border border-indigo-500/50',
  secondary:
    'bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 border border-slate-600/50',
  danger:
    'bg-rose-600/80 hover:bg-rose-500/80 text-white border border-rose-500/50',
  ghost:
    'bg-transparent hover:bg-slate-700/40 text-slate-300 border border-transparent',
  whatsapp:
    'bg-green-600/80 hover:bg-green-500/80 text-white border border-green-500/50 shadow-lg shadow-green-500/20',
  success:
    'bg-emerald-600/80 hover:bg-emerald-500/80 text-white border border-emerald-500/50',
};

const sizes = {
  xs: 'text-xs px-2.5 py-1.5 gap-1',
  sm: 'text-xs px-3 py-2 gap-1.5',
  md: 'text-sm px-4 py-2.5 gap-2',
  lg: 'text-base px-6 py-3 gap-2',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  icon: Icon,
  ...props
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-slate-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-3.5 w-3.5 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
