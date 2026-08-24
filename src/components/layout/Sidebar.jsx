// Sidebar.jsx — App navigation sidebar

import { Building2, LayoutDashboard, BarChart3, Wallet, Webhook, Bot, Bell, X, Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

export function Sidebar({ activeView, onNavigate, isOpen, onClose }) {
  const { t } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const navItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), id: 'dashboard' },
    { icon: Landmark, label: t('nav.makkahRentals'), id: 'makkah-rentals' },
    { icon: BarChart3, label: t('nav.analytics'), id: 'analytics' },
    { icon: Wallet, label: t('nav.finance'), id: 'finance' },
    { icon: Bell, label: t('nav.reminders'), id: 'reminders' },
    { icon: Webhook, label: t('nav.webhookInspector'), id: 'webhook-inspector' },
    { icon: Bot, label: t('nav.botSettings'), id: 'bot-settings' },
  ];

  const toggleLanguage = () => {
    const next = isArabic ? 'en' : 'ar';
    i18n.changeLanguage(next);
    localStorage.setItem('pms_language', next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  };

  const handleNavClick = (id) => {
    if (onNavigate) onNavigate(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 md:w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-50 transition-transform duration-300 ease-in-out rtl:left-auto rtl:right-0 rtl:border-r-0 rtl:border-l md:!transform-none md:!translate-x-0 md:rtl:!translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
      >
        {/* Logo & Mobile Close Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-white tracking-wide truncate">{t('common.brandName')}</h1>
              <p className="text-xs text-slate-400 truncate">{t('common.brandSubtitle')}</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                activeView === id
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-medium'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </nav>

        {/* Language Toggle */}
        <div className="px-3 pb-2">
          <button
            onClick={toggleLanguage}
            title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-200 group"
          >
            <span className="text-lg leading-none flex-shrink-0">🌐</span>
            <span className="flex flex-col items-start">
              <span className="text-xs font-semibold text-slate-300">{isArabic ? 'English' : 'العربية'}</span>
              <span className="text-[10px] text-slate-500">{isArabic ? 'Switch to English' : 'تبديل اللغة'}</span>
            </span>
          </button>
        </div>

        {/* User section */}
        <div className="p-3 border-t border-slate-700/50">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">PM</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{t('common.userRole')}</p>
              <p className="text-xs text-slate-500 truncate">{t('common.admin')}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
