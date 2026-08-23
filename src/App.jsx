// App.jsx — Main Application Assembly

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useUnits } from './hooks/useUnits';
import { useFinance } from './hooks/useFinance';
import { sendWhatsAppConfirmation } from './api/whatsapp';
import { simulateWebhookEvent } from './api/webhook';

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
  const [bookingUnitPreselect, setBookingUnitPreselect] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);

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

  const handleQuickWhatsApp = async (booking, unitNumber) => {
    try {
      const res = await sendWhatsAppConfirmation(booking, unitNumber);
      simulateWebhookEvent(res.messages[0].id, booking.phone);
    } catch (err) {
      console.error('Failed to send WhatsApp from dashboard', err);
    }
  };

  // ─── Mobile Sidebar State ──────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ─── Render Helpers ───────────────────────────────────────────────────────
  const selectedUnit = selectedUnitId ? getUnit(selectedUnitId) : null;

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
          addLabel={activeView === 'finance' ? t('header.addTransaction') : t('header.addBooking')}
          onAddAction={
            activeView === 'finance'
              ? () => setIsTransactionModalOpen(true)
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
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
              <div className="flex flex-col items-center gap-4 animate-fade-in">
                <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-400 font-medium">Loading units…</p>
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
            /* Units Grid Only */
            <section className="animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{t('dashboard.allUnits')}</h3>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {units.map((unit) => (
                  <UnitCard
                    key={unit.id}
                    unit={unit}
                    currentTenant={getCurrentTenant(unit)}
                    onViewDetails={handleViewUnit}
                    onAddBooking={handleOpenBookingModal}
                    onWhatsApp={handleQuickWhatsApp}
                  />
                ))}
              </div>
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

