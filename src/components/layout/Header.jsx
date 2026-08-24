// Header.jsx — Top navigation bar

import { Plus, Calendar, Menu } from 'lucide-react';
import { Button } from '../shared/Button';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

export function Header({
  onAddBooking,
  onToggleSidebar,
  title,
  subtitle,
  addLabel,
  onAddAction,
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  const handleAdd = onAddAction || onAddBooking;
  const label = addLabel || t('header.addBooking');

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-700/50 px-4 lg:px-6 py-3.5">
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        {/* Left/Start: Hamburger (mobile only) + Title area */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 -ms-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 md:hidden flex-shrink-0 transition-colors focus:outline-none"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white truncate">{title || t('header.dashboardTitle')}</h2>
            {subtitle ? (
              <p className="text-xs text-slate-400 truncate">{subtitle}</p>
            ) : (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {today}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Add Action CTA */}
          {handleAdd && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleAdd}
              id="header-action-btn"
            >
              <span className="hidden sm:inline">{label}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
