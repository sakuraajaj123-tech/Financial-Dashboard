// App.jsx — Main Application Assembly

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Eye } from 'lucide-react';
import i18n from './i18n';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { UnitCard } from './components/dashboard/UnitCard';
import { UnitDetailView } from './components/unit/UnitDetailView';
import { PortfolioAnalyticsView } from './components/analytics/PortfolioAnalyticsView';
import { FinancialDashboard } from './components/finance/FinancialDashboard';
import { AddBookingModal } from './components/modals/AddBookingModal';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { WebhookInspector } from './components/webhook/WebhookInspector';
import { BotMenuSettings } from './components/settings/BotMenuSettings';
import { AdminPhonesSettings } from './components/settings/AdminPhonesSettings';
import { MakkahRentals } from './components/makkah/MakkahRentals';
import { useUnits } from './hooks/useUnits';
import { useFinance } from './hooks/useFinance';
import { BOOKING_SOURCES } from './data/seedData';
import { formatBookingDate, formatSource } from './utils/dateFormatter';

export default function App() {
  const { t } = useTranslation();
  const {
    units,
    kpis,
    loading,
    addBooking,
    updateBooking,
    deleteBooking,
    getUnit,
    getCurrentTenant,
    getPortfolioMonthlyRevenue,
    getPortfolioSourceSplit,
  } = useUnits();

  const financeData = useFinance();

  const [activeView, setActiveView] = useState('dashboard');
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isMakkahModalOpen, setIsMakkahModalOpen] = useState(false);
  const [bookingUnitPreselect, setBookingUnitPreselect] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [dashboardSourceFilter, setDashboardSourceFilter] = useState('all'); // 'all' | 'gathern' | 'direct'
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('all'); // 'all' | 'occupied' | 'available'

  const handleDeleteBooking = useCallback((unitId, bookingId, phone) => {
    deleteBooking(unitId, bookingId);
    fetch('/api/chats', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_booking', bookingId, phone }),
    }).catch((err) => console.error('Failed to delete booking on server:', err));
  }, [deleteBooking]);

  // ─── RTL / Language sync ──────────────────────────────────────────────────
  useEffect(() => {
    const savedLang = localStorage.getItem('pms_language') || 'en';
    document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = savedLang;

    // Listen to language changes and update document dir
    const handleLangChange = (lng) => {
      document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lng;
    };
    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleViewUnit = (unit) => {
    setSelectedUnitId(unit.id);
  };

  const handleBackToDashboard = () => {
    setSelectedUnitId(null);
  };

  const handleOpenBookingModal = (unit = null) => {
    setEditingBooking(null);
    setBookingUnitPreselect(unit);
    setIsBookingModalOpen(true);
  };

  const handleViewBookingDetails = (booking, unit) => {
    setEditingBooking(booking);
    setBookingUnitPreselect(unit || getUnit(booking.unitId));
    setIsBookingModalOpen(true);
  };

  const handleSaveBooking = async (unitId, bookingData, bookingId) => {
    if (bookingId || editingBooking) {
      await updateBooking(unitId, bookingId || editingBooking.id, bookingData);
    } else {
      await addBooking(unitId, bookingData);
    }
  };

  const handleSaveTransaction = async (transactionData) => {
    await financeData.addTransaction(transactionData);
  };

  // ─── Mobile Sidebar State ──────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ─── Render Helpers ───────────────────────────────────────────────────────
  const selectedUnit = selectedUnitId ? getUnit(selectedUnitId) : null;
  const isArabic = i18n.language === 'ar';

  const matchingBookings = useMemo(() => {
    const q = dashboardSearchQuery.toLowerCase().trim();
    if (!q) return [];
    const results = [];
    units.forEach((unit) => {
      (unit.bookings || []).forEach((b) => {
        const name = (b.guestName || b.tenantName || '').toLowerCase();
        const phone = (b.phone || '').toLowerCase();
        const unitNum = String(unit.number || '').toLowerCase();
        const isGathern =
          b.source === BOOKING_SOURCES.GATHERN ||
          String(b.source).toLowerCase().includes('gathern');

        const matchesSearch = name.includes(q) || phone.includes(q) || unitNum === q;
        const matchesSource =
          dashboardSourceFilter === 'all' ||
          (dashboardSourceFilter === 'gathern' && isGathern) ||
          (dashboardSourceFilter === 'direct' && !isGathern);

        if (matchesSearch && matchesSource) {
          results.push({
            ...b,
            unit,
            isCurrent: b.id === unit.currentBookingId,
          });
        }
      });
    });
    return results;
  }, [units, dashboardSearchQuery, dashboardSourceFilter]);

  const filteredUnits = useMemo(() => {
    const q = dashboardSearchQuery.toLowerCase().trim();
    return units.filter((unit) => {
      if (dashboardStatusFilter === 'occupied' && unit.status !== 'Occupied') return false;
      if (dashboardStatusFilter === 'available' && unit.status !== 'Available') return false;

      if (!q) {
        if (dashboardSourceFilter === 'all') return true;
        const current = getCurrentTenant(unit);
        const currentIsGathern =
          current &&
          (current.source === BOOKING_SOURCES.GATHERN ||
            String(current.source).toLowerCase().includes('gathern'));
        if (dashboardSourceFilter === 'gathern') return currentIsGathern;
        if (dashboardSourceFilter === 'direct') return current && !currentIsGathern;
        return true;
      }

      if (String(unit.number).includes(q)) return true;

      const current = getCurrentTenant(unit);
      if (current) {
        const curName = (current.guestName || current.tenantName || '').toLowerCase();
        const curPhone = (current.phone || '').toLowerCase();
        const isGathern =
          current.source === BOOKING_SOURCES.GATHERN ||
          String(current.source).toLowerCase().includes('gathern');
        const sourceOk =
          dashboardSourceFilter === 'all' ||
          (dashboardSourceFilter === 'gathern' && isGathern) ||
          (dashboardSourceFilter === 'direct' && !isGathern);
        if ((curName.includes(q) || curPhone.includes(q)) && sourceOk) return true;
      }

      return (unit.bookings || []).some((b) => {
        const name = (b.guestName || b.tenantName || '').toLowerCase();
        const phone = (b.phone || '').toLowerCase();
        const isGathern =
          b.source === BOOKING_SOURCES.GATHERN ||
          String(b.source).toLowerCase().includes('gathern');
        const sourceOk =
          dashboardSourceFilter === 'all' ||
          (dashboardSourceFilter === 'gathern' && isGathern) ||
          (dashboardSourceFilter === 'direct' && !isGathern);
        return (name.includes(q) || phone.includes(q)) && sourceOk;
      });
    });
  }, [units, dashboardSearchQuery, dashboardStatusFilter, dashboardSourceFilter, getCurrentTenant]);

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans selection:bg-indigo-500/30">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={(view) => {
          setSelectedUnitId(null);
          setActiveView(view);
          setIsSidebarOpen(false);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 ltr:md:ml-64 rtl:md:mr-64 md:ms-64 flex flex-col min-h-screen overflow-hidden w-full">
        <Header
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          addLabel={
            activeView === 'finance'
              ? t('header.addTransaction')
              : activeView === 'makkah-rentals'
              ? t('header.addMakkahTenant')
              : t('header.addBooking')
          }
          onAddAction={
            activeView === 'finance'
              ? () => setIsTransactionModalOpen(true)
              : activeView === 'makkah-rentals'
              ? () => setIsMakkahModalOpen(true)
              : () => handleOpenBookingModal()
          }
          title={
            activeView === 'reminders'
              ? t('header.remindersTitle')
              : activeView === 'bot-settings'
              ? t('header.botSettingsTitle')
              : activeView === 'webhook-inspector'
              ? t('header.webhookTitle')
              : activeView === 'analytics'
              ? t('header.analyticsTitle')
              : activeView === 'finance'
              ? t('header.financialTitle')
              : activeView === 'makkah-rentals'
              ? t('header.makkahTitle')
              : selectedUnit
              ? `${t('unit.unit')} ${selectedUnit.number}`
              : t('header.dashboardTitle')
          }
          subtitle={
            activeView === 'reminders'
              ? t('header.remindersSubtitle')
              : activeView === 'bot-settings'
              ? t('header.botSettingsSubtitle')
              : activeView === 'webhook-inspector'
              ? t('header.webhookSubtitle')
              : activeView === 'analytics'
              ? t('header.analyticsSubtitle')
              : activeView === 'finance'
              ? t('header.financialSubtitle')
              : activeView === 'makkah-rentals'
              ? t('header.makkahSubtitle')
              : selectedUnit
              ? `${selectedUnit.bedrooms} ${t('unitDetail.bedrooms')} • ${t('unit.floor')} ${selectedUnit.floor}`
              : t('header.dashboardSubtitle')
          }
        />

        <div className={`flex-1 ${activeView === 'webhook-inspector' ? 'overflow-hidden p-2 sm:p-3 lg:p-4 flex flex-col min-h-0' : 'overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-6'}`}>
          {activeView === 'reminders' ? (
            <AdminPhonesSettings />
          ) : activeView === 'bot-settings' ? (
            <BotMenuSettings />
          ) : activeView === 'webhook-inspector' ? (
            <WebhookInspector />
          ) : activeView === 'finance' ? (
            <FinancialDashboard
              financeData={financeData}
              onOpenAddModal={() => setIsTransactionModalOpen(true)}
            />
          ) : activeView === 'makkah-rentals' ? (
            <MakkahRentals
              isExternalModalOpen={isMakkahModalOpen}
              onCloseExternalModal={() => setIsMakkahModalOpen(false)}
            />
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
              <div className="flex flex-col items-center gap-4 animate-fade-in">
                <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-400 font-medium">{t('common.loadingUnits')}</p>
              </div>
            </div>
          ) : activeView === 'analytics' ? (
            <PortfolioAnalyticsView
              kpis={kpis}
              units={units}
              monthlyRevenue={getPortfolioMonthlyRevenue()}
              sourceSplit={getPortfolioSourceSplit()}
              onSelectUnit={handleViewUnit}
            />
          ) : selectedUnit ? (
            <UnitDetailView
              unit={selectedUnit}
              onBack={handleBackToDashboard}
              onAddBooking={handleOpenBookingModal}
              onDeleteBooking={handleDeleteBooking}
              onViewBookingDetails={handleViewBookingDetails}
            />
          ) : (
            /* Units Grid & Guest Search */
            <section className="animate-slide-up space-y-4">
              {/* Header & Search Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 border border-slate-700/50 p-3 sm:p-4 rounded-2xl backdrop-blur-sm shadow-xl">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                      {t('dashboard.allUnits')}
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      ({filteredUnits.length} / {units.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium text-slate-400 mt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                      {t('dashboard.occupied')} ({kpis.occupiedUnits})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {t('dashboard.available')} ({kpis.availableUnits})
                    </span>
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search Guest Name / Phone / Unit */}
                  <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-white focus-within:border-indigo-500 transition-colors flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={t('dashboard.searchPlaceholder')}
                      value={dashboardSearchQuery}
                      onChange={(e) => setDashboardSearchQuery(e.target.value)}
                      className="bg-transparent outline-none text-xs text-slate-200 placeholder-slate-500 w-full"
                    />
                    {dashboardSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDashboardSearchQuery('')}
                        className="p-0.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                        title={t('common.cancel')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Source Filter (Gathern vs Direct) */}
                  <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setDashboardSourceFilter('all')}
                      className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                        dashboardSourceFilter === 'all'
                          ? 'bg-slate-700 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t('dashboard.filterAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardSourceFilter('gathern')}
                      className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                        dashboardSourceFilter === 'gathern'
                          ? 'bg-violet-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      {t('dashboard.filterGathern')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardSourceFilter('direct')}
                      className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                        dashboardSourceFilter === 'direct'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      {t('dashboard.filterDirect')}
                    </button>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setDashboardStatusFilter('all')}
                      className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                        dashboardStatusFilter === 'all'
                          ? 'bg-slate-700 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t('dashboard.filterAllStatus')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardStatusFilter('occupied')}
                      className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                        dashboardStatusFilter === 'occupied'
                          ? 'bg-rose-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t('dashboard.filterOccupied')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardStatusFilter('available')}
                      className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                        dashboardStatusFilter === 'available'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t('dashboard.filterAvailable')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Matching Guest Bookings List (shown when search query is active) */}
              {dashboardSearchQuery.trim() && matchingBookings.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/60 border border-indigo-500/30 p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      {t('dashboard.matchingBookings')} ({matchingBookings.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {matchingBookings.map((b) => {
                      const isGathern =
                        b.source === BOOKING_SOURCES.GATHERN ||
                        String(b.source).toLowerCase().includes('gathern');
                      return (
                        <div
                          key={`${b.unit.id}-${b.id}`}
                          className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all flex flex-col justify-between gap-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {(b.guestName || b.tenantName || 'G').charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-white text-sm truncate">
                                  {b.guestName || b.tenantName}
                                </p>
                                <p className="text-xs text-slate-400 font-mono" dir="ltr">
                                  {b.phone}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                isGathern
                                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                              }`}
                            >
                              {formatSource(b.source, isArabic)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                            <div>
                              <span className="font-semibold text-indigo-400">
                                {t('unit.unit')} {b.unit.number}
                              </span>
                              <span className="mx-1.5 text-slate-600">•</span>
                              <span>
                                {formatBookingDate(b.checkIn, isArabic)} - {formatBookingDate(b.checkOut, isArabic)}
                              </span>
                            </div>
                            <span className="font-bold text-emerald-400">
                              SAR {Number(b.amount).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleViewBookingDetails(b, b.unit)}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('dashboard.viewDetails')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewUnit(b.unit)}
                              className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                            >
                              {t('unit.unit')} {b.unit.number}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Units Grid or Empty Search State */}
              {filteredUnits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800">
                  <Search className="w-10 h-10 mb-3 text-slate-600" />
                  <p className="text-base font-semibold text-slate-300">
                    {t('dashboard.noMatchingBookings')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">"{dashboardSearchQuery}"</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardSearchQuery('');
                      setDashboardSourceFilter('all');
                      setDashboardStatusFilter('all');
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {t('dashboard.clearSearch')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredUnits.map((unit) => (
                    <UnitCard
                      key={unit.id}
                      unit={unit}
                      currentTenant={getCurrentTenant(unit)}
                      onViewDetails={handleViewUnit}
                      onAddBooking={handleOpenBookingModal}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Global Modals */}
      {isBookingModalOpen && (
        <AddBookingModal
          units={units}
          preselectedUnit={bookingUnitPreselect}
          initialBooking={editingBooking}
          onClose={() => {
            setIsBookingModalOpen(false);
            setEditingBooking(null);
          }}
          onSubmit={handleSaveBooking}
        />
      )}

      {isTransactionModalOpen && (
        <AddTransactionModal
          isOpen={isTransactionModalOpen}
          onClose={() => setIsTransactionModalOpen(false)}
          onSubmit={handleSaveTransaction}
        />
      )}
    </div>
  );
}

