// MakkahRentals.jsx — Makkah Building Rentals Management (ايجارات عمارة مكة)
// Features: Summary KPI cards (total units, total rent, prominent overdue counter, paid units),
// dynamic nextDueDate calculation, Paid/Overdue visual badges, 1-click 'Mark as Paid',
// pre-filled WhatsApp payment reminders, Table View, and Interactive Monthly Calendar View.

import { useState, useMemo } from 'react';
import {
  Building2,
  CheckCircle2,
  Wallet,
  Search,
  Plus,
  Phone,
  Calendar as CalendarIcon,
  Clock,
  MessageSquare,
  Check,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  CalendarDays,
  X,
  Repeat,
  FileText,
  User,
  Home,
} from 'lucide-react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useMakkahRentals } from '../../hooks/useMakkahRentals';
import { MakkahTenantModal } from '../modals/MakkahTenantModal';
import { MakkahPaymentModal } from '../modals/MakkahPaymentModal';
import { Button } from '../shared/Button';
import {
  formatBookingDate,
  formatFullMonthYear,
  formatPaymentInterval,
  formatHijriDate,
  formatHijriMonthYear,
  formatDualDate,
  getHijriMonthGrid,
  getHijriParts,
  addHijriMonths,
  subHijriMonths,
  DAY_NAMES_AR,
  DAY_NAMES_EN,
  ARABIC_MONTHS,
  ENGLISH_FULL_MONTHS,
} from '../../utils/dateFormatter';

/**
 * Format phone number to clean WhatsApp international digits
 * e.g. "0501234567" -> "966501234567", "+966501234567" -> "966501234567"
 */
function cleanWhatsAppPhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('05') && digits.length === 10) {
    digits = '966' + digits.slice(1);
  } else if (digits.startsWith('5') && digits.length === 9) {
    digits = '966' + digits;
  }
  return digits;
}

export function MakkahRentals({ isExternalModalOpen = false, onCloseExternalModal }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const {
    tenants,
    loading,
    kpis,
    addTenant,
    updateTenant,
    deleteTenant,
    markAsPaid,
  } = useMakkahRentals();

  const [viewMode, setViewMode] = useState('table'); // 'table' | 'calendar'
  const [calendarType, setCalendarType] = useState(isArabic ? 'hijri' : 'gregorian');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'overdue' | 'paid'
  const [isLocalModalOpen, setIsLocalModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [selectedCalendarTenant, setSelectedCalendarTenant] = useState(null);
  const [payingTenant, setPayingTenant] = useState(null);
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const isModalOpen = isLocalModalOpen || isExternalModalOpen;

  const handleCloseModal = () => {
    setIsLocalModalOpen(false);
    setEditingTenant(null);
    if (onCloseExternalModal) onCloseExternalModal();
  };

  // ─── Filter & Search ──────────────────────────────────────────────────────
  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'overdue' && tenant.isOverdue) ||
        (statusFilter === 'paid' && !tenant.isOverdue);

      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (tenant.name || '').toLowerCase().includes(q);
      const unitMatch = (tenant.unitNumber || '').toLowerCase().includes(q);
      const phoneMatch = (tenant.phone || '').includes(q);

      return matchesStatus && (nameMatch || unitMatch || phoneMatch);
    });
  }, [tenants, statusFilter, searchQuery]);

  // ─── Calendar Days Calculation (Gregorian / Hijri) ────────────────────────
  const calendarDays = useMemo(() => {
    if (calendarType === 'hijri') {
      const { days } = getHijriMonthGrid(currentMonth);
      return days.map((d) => ({
        date: d.date,
        isoDate: d.isoDate,
        primaryNum: d.hijriDay,
        secondaryNum: d.date.getDate(),
        inMonth: d.inCurrentMonth,
        isToday: d.isToday,
        fullLabel: `${formatHijriDate(d.date, isArabic)} / ${formatBookingDate(d.date, isArabic)}`,
      }));
    }

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const gDays = eachDayOfInterval({ start: calStart, end: calEnd });

    return gDays.map((d) => {
      const hp = getHijriParts(d);
      return {
        date: d,
        isoDate: format(d, 'yyyy-MM-dd'),
        primaryNum: d.getDate(),
        secondaryNum: hp.day,
        inMonth: isSameMonth(d, currentMonth),
        isToday: isToday(d),
        fullLabel: `${formatBookingDate(d, isArabic)} / ${formatHijriDate(d, isArabic)}`,
      };
    });
  }, [calendarType, currentMonth, isArabic]);

  // Map tenants by due date (YYYY-MM-DD)
  const tenantsByDueDate = useMemo(() => {
    const map = {};
    filteredTenants.forEach((tenant) => {
      if (tenant.nextDueDate) {
        if (!map[tenant.nextDueDate]) {
          map[tenant.nextDueDate] = [];
        }
        map[tenant.nextDueDate].push(tenant);
      }
    });
    return map;
  }, [filteredTenants]);

  // Count total due in current month view (accounting for Hijri/Gregorian month)
  const currentMonthDueCount = useMemo(() => {
    if (calendarType === 'hijri') {
      const targetHp = getHijriParts(currentMonth);
      return filteredTenants.filter((tenant) => {
        if (!tenant.nextDueDate) return false;
        const hp = getHijriParts(tenant.nextDueDate);
        return hp.month === targetHp.month && hp.year === targetHp.year;
      }).length;
    }

    return filteredTenants.filter((tenant) => {
      if (!tenant.nextDueDate) return false;
      const [y, m] = tenant.nextDueDate.split('-');
      const targetYear = currentMonth.getFullYear();
      const targetMonth = String(currentMonth.getMonth() + 1).padStart(2, '0');
      return String(y) === String(targetYear) && String(m) === String(targetMonth);
    }).length;
  }, [filteredTenants, currentMonth, calendarType]);

  const monthLabel = useMemo(() => {
    if (calendarType === 'hijri') {
      return formatHijriMonthYear(currentMonth, isArabic);
    }
    return formatFullMonthYear(currentMonth, isArabic);
  }, [currentMonth, calendarType, isArabic]);

  const dayNames = isArabic ? DAY_NAMES_AR : DAY_NAMES_EN;

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setEditingTenant(null);
    setIsLocalModalOpen(true);
  };

  const handleOpenEditModal = (tenant) => {
    setEditingTenant(tenant);
    setIsLocalModalOpen(true);
  };

  const handleSaveTenant = async (tenantData, tenantId) => {
    if (tenantId) {
      await updateTenant(tenantId, tenantData);
    } else {
      await addTenant(tenantData);
    }
  };

  const handleDelete = async (tenantId) => {
    if (window.confirm(t('makkah.table.deleteConfirm'))) {
      try {
        await deleteTenant(tenantId);
        if (selectedCalendarTenant?.id === tenantId) {
          setSelectedCalendarTenant(null);
        }
      } catch (err) {
        console.error('Failed to delete tenant:', err);
      }
    }
  };

  const handleOpenPaymentModal = (tenant) => {
    setPayingTenant(tenant);
  };

  const handleConfirmPayment = async (tenant, date, amount, notes) => {
    try {
      await markAsPaid(tenant, date, amount, notes);
      setSuccessToast(t('makkah.paymentModal.successToast'));
      setTimeout(() => setSuccessToast(null), 3500);
      if (selectedCalendarTenant?.id === tenant.id) {
        setSelectedCalendarTenant(null);
      }
    } catch (err) {
      console.error('Failed to confirm payment:', err);
      throw err;
    }
  };

  const handleLaunchWhatsApp = (tenant) => {
    const cleanPhone = cleanWhatsAppPhone(tenant.phone);
    if (!cleanPhone) {
      alert(isArabic ? 'رقم الهاتف غير متوفر أو غير صحيح' : 'Phone number is invalid');
      return;
    }

    const currentMonthIndex = new Date().getMonth();
    const currentMonthName = isArabic
      ? ARABIC_MONTHS[currentMonthIndex]
      : ENGLISH_FULL_MONTHS[currentMonthIndex];

    let message = '';
    if (isArabic) {
      message = `رسالة تذكير\n\nأخي الفاضل/ ${tenant.name}\n\nالسلام عليكم ورحمة الله وبركاته.\n\nأود إشعار سيادتكم بأن موعد سداد الدفعه قد حل مع نهاية الشهر الحالي *${currentMonthName}*\n\nآمل اﻹطلاع والتكرم بالتحويل بصفه عاجله.\n\nولكم فائق التحيه.\n\nوالسلام عليكم\n\nأخوك\nأبو أدهم.`;
    } else {
      message = `Payment Reminder\n\nDear ${tenant.name},\n\nPeace be upon you and God's mercy and blessings.\n\nI would like to inform you that the payment is due with the end of the current month *${currentMonthName}*.\n\nKindly review and arrange the transfer urgently.\n\nBest regards,\n\nYours,\nAbu Adham.`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePrevMonth = () => {
    if (calendarType === 'hijri') {
      setCurrentMonth((prev) => subHijriMonths(prev, 1));
    } else {
      setCurrentMonth((prev) => subMonths(prev, 1));
    }
  };

  const handleNextMonth = () => {
    if (calendarType === 'hijri') {
      setCurrentMonth((prev) => addHijriMonths(prev, 1));
    } else {
      setCurrentMonth((prev) => addMonths(prev, 1));
    }
  };

  const handleGoToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast feedback */}
      {successToast && (
        <div className="fixed bottom-6 right-6 rtl:right-auto rtl:left-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500 text-white shadow-2xl animate-slide-up font-medium text-xs sm:text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ─── Top Section: 4 KPI Cards ────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Units / Tenants */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-600/5 border border-indigo-500/20 p-5 shadow-xl shadow-indigo-500/5 backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-indigo-500 opacity-10 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                {t('makkah.kpi.totalUnits')}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {kpis.totalUnits}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {t('makkah.kpi.totalUnitsSubtitle')}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-lg">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 2. Total Rent Value */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-600/5 border border-blue-500/20 p-5 shadow-xl shadow-blue-500/5 backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-blue-500 opacity-10 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
                {t('makkah.kpi.totalCollected')}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  SAR {kpis.totalRentValue.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {t('makkah.kpi.totalCollectedSubtitle')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3. PROMINENT OVERDUE COUNTER CARD */}
        <div
          className={`relative overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300 ${
            kpis.overdueCount > 0
              ? 'bg-gradient-to-br from-rose-500/20 via-rose-600/10 to-pink-700/5 border-rose-500/40 shadow-rose-500/15'
              : 'bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-slate-700/50'
          }`}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-rose-500 opacity-15 blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                {kpis.overdueCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                {t('makkah.kpi.overdueRentals')}
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    kpis.overdueCount > 0 ? 'text-rose-400' : 'text-slate-300'
                  }`}
                >
                  {kpis.overdueCount}
                </span>
                {kpis.overdueCount > 0 && (
                  <span className="text-xs font-bold text-rose-300">
                    (SAR {kpis.overdueAmount.toLocaleString()})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {t('makkah.kpi.overdueSubtitle', { count: kpis.overdueCount })}
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                kpis.overdueCount > 0
                  ? 'bg-rose-500/25 text-rose-400 border border-rose-500/40 shadow-lg shadow-rose-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 4. Paid on Time */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-600/5 border border-emerald-500/20 p-5 shadow-xl shadow-emerald-500/5 backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-emerald-500 opacity-10 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                {t('makkah.kpi.paidUnits')}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {kpis.paidCount}
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  ({kpis.paidPercentage}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {t('makkah.kpi.paidSubtitle', { pct: kpis.paidPercentage })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Middle Section: Controls, Table & Calendar Views ────────────────── */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/60 border border-slate-700/50 shadow-xl backdrop-blur-sm overflow-hidden">
        {/* Table/Calendar Toolbar */}
        <div className="p-5 border-b border-slate-700/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                {viewMode === 'table' ? (
                  <LayoutList className="w-5 h-5 text-indigo-400" />
                ) : (
                  <CalendarDays className="w-5 h-5 text-indigo-400" />
                )}
                {viewMode === 'table' ? t('makkah.table.title') : t('makkah.calendar.title')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {viewMode === 'table' ? t('makkah.table.subtitle') : t('makkah.calendar.subtitle')}
              </p>
            </div>
          </div>

          {/* Controls: Search, View Switcher, Filter, Add */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Switcher (Table vs Calendar) */}
            <div className="flex items-center p-1 bg-slate-950/90 rounded-xl border border-slate-800 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('makkah.views.table')}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>{t('makkah.views.table')}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('makkah.views.calendar')}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>{t('makkah.views.calendar')}</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-white flex-1 sm:w-56 focus-within:border-indigo-500 transition-colors">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder={t('makkah.table.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-xs text-slate-200 placeholder-slate-500 w-full"
              />
            </div>

            {/* Status Filter Segment */}
            <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('makkah.table.filterAll')}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('overdue')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  statusFilter === 'overdue'
                    ? 'bg-rose-600/80 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {kpis.overdueCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                )}
                {t('makkah.table.filterOverdue')}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-600/80 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('makkah.table.filterPaid')}
              </button>
            </div>

            {/* Add Tenant CTA */}
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenAddModal}
            >
              {t('makkah.addTenant')}
            </Button>
          </div>
        </div>

        {/* ─── View 1: TABLE VIEW ─────────────────────────────────────────── */}
        {viewMode === 'table' ? (
          loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400">{t('common.loading')}</p>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500 mx-auto mb-3">
                <Building2 className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-slate-300">
                {t('makkah.table.noTenants')}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('makkah.table.noTenantsSubtitle')}
              </p>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" />
                {t('makkah.addTenant')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3.5">{t('makkah.table.colUnit')}</th>
                    <th className="px-5 py-3.5">{t('makkah.table.colTenant')}</th>
                    <th className="px-5 py-3.5">{t('makkah.table.colRent')}</th>
                    <th className="px-5 py-3.5">{t('makkah.table.colInterval')}</th>
                    <th className="px-5 py-3.5">{t('makkah.table.colLastPaid')}</th>
                    <th className="px-5 py-3.5">{t('makkah.table.colNextDue')}</th>
                    <th className="px-5 py-3.5 text-center">{t('makkah.table.colStatus')}</th>
                    <th className="px-5 py-3.5 text-center">{t('makkah.table.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredTenants.map((tenant) => {
                    const isOverdue = tenant.isOverdue;
                    const isDueToday = tenant.isDueToday;

                    return (
                      <tr
                        key={tenant.id}
                        className={`hover:bg-slate-800/40 transition-colors group ${
                          isOverdue ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        {/* Unit Number */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-200 font-bold text-xs shadow-xs">
                              {tenant.unitNumber}
                            </div>
                            <span className="font-semibold text-white">
                              {tenant.unitNumber}
                            </span>
                          </div>
                        </td>

                        {/* Tenant Name & Phone */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                              {tenant.name ? tenant.name.charAt(0) : 'U'}
                            </div>
                            <div>
                              <p className="font-semibold text-white tracking-wide">
                                {tenant.name}
                              </p>
                              {tenant.phone && (
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5" dir="ltr">
                                  <Phone className="w-3 h-3 text-slate-500" />
                                  {tenant.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Rent Amount */}
                        <td className="px-5 py-3.5 whitespace-nowrap font-bold text-sm text-slate-100">
                          SAR {Number(tenant.rentAmount || 0).toLocaleString()}
                        </td>

                        {/* Payment Interval */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-300">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-slate-300">
                            {formatPaymentInterval(tenant.paymentIntervalMonths, isArabic)}
                          </span>
                        </td>

                        {/* Last Paid Date */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-300">
                          <div className="flex items-center gap-1.5 text-xs">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                            {formatBookingDate(tenant.lastPaidDate, isArabic)}
                          </div>
                        </td>

                        {/* Next Due Date */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-semibold text-xs">
                            <Clock
                              className={`w-3.5 h-3.5 ${
                                isOverdue
                                  ? 'text-rose-400'
                                  : isDueToday
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            />
                            <span
                              className={
                                isOverdue
                                  ? 'text-rose-400 font-bold'
                                  : isDueToday
                                  ? 'text-amber-400 font-bold'
                                  : 'text-emerald-400'
                              }
                            >
                              {formatBookingDate(tenant.nextDueDate, isArabic)}
                            </span>
                          </div>
                        </td>

                        {/* VISUAL STATUS BADGE */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                              {t('makkah.status.overdue')}
                              <span className="text-[10px] text-rose-400/90 font-medium">
                                ({t('makkah.status.daysOverdue', { count: tenant.daysOverdue })})
                              </span>
                            </span>
                          ) : isDueToday ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              {t('makkah.status.dueToday')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              {t('makkah.status.paid')}
                              {tenant.daysLeft > 0 && (
                                <span className="text-[10px] text-emerald-400/90 font-medium">
                                  ({t('makkah.status.daysLeft', { count: tenant.daysLeft })})
                                </span>
                              )}
                            </span>
                          )}
                        </td>

                        {/* INTERACTIVE ACTIONS */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 1. Mark as Paid */}
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(tenant)}
                              title={t('makkah.table.markPaidTooltip')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">
                                {t('makkah.status.paid')}
                              </span>
                            </button>

                            {/* 2. WhatsApp Reminder Button */}
                            <button
                              type="button"
                              onClick={() => handleLaunchWhatsApp(tenant)}
                              title={t('makkah.table.whatsappTooltip')}
                              className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                                isOverdue
                                  ? 'bg-green-600/30 text-green-400 border border-green-500/40 hover:bg-green-600 hover:text-white shadow-xs'
                                  : 'text-slate-400 hover:text-green-400 hover:bg-green-500/10'
                              }`}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>

                            {/* 3. Edit Tenant */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(tenant)}
                              title={t('makkah.table.editTooltip')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* 4. Delete Tenant */}
                            <button
                              type="button"
                              onClick={() => handleDelete(tenant.id)}
                              title={t('makkah.table.deleteTooltip')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ─── View 2: MONTHLY CALENDAR VIEW ───────────────────────────────── */
          <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
            {/* Calendar Navigation, Month Header & Hijri/Gregorian Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                {/* Month Navigation */}
                <div className="flex items-center bg-slate-950/80 rounded-xl border border-slate-800 p-1 shadow-inner">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title={t('makkah.calendar.prevMonth')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    {isArabic ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToday}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    {t('makkah.calendar.today')}
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title={t('makkah.calendar.nextMonth')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    {isArabic ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {/* Calendar Type Toggle: [ هجري | ميلادي ] */}
                <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setCalendarType('hijri')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      calendarType === 'hijri'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isArabic ? 'هجري' : 'Hijri'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarType('gregorian')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      calendarType === 'gregorian'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isArabic ? 'ميلادي' : 'Gregorian'}
                  </button>
                </div>

                <h4 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {monthLabel}
                </h4>

                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {t('makkah.calendar.dueCount', { count: currentMonthDueCount })}
                </span>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-300">{t('makkah.calendar.legendOverdue')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-slate-300">{t('makkah.calendar.legendDueToday')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-300">{t('makkah.calendar.legendUpcoming')}</span>
                </div>
              </div>
            </div>

            {/* Calendar Day Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {dayNames.map((d, i) => (
                <div
                  key={i}
                  className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-950/40 rounded-lg"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Monthly Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((dayItem, idx) => {
                const inMonth = dayItem.inMonth;
                const isCurrentToday = dayItem.isToday;
                const dayDateStr = dayItem.isoDate;
                const dueTenants = tenantsByDueDate[dayDateStr] || [];

                return (
                  <div
                    key={idx}
                    className={`min-h-[100px] sm:min-h-[120px] p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between transition-all ${
                      !inMonth
                        ? 'bg-slate-950/30 border-slate-800/40 opacity-40'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                    } ${isCurrentToday ? 'ring-2 ring-indigo-500/70 shadow-lg shadow-indigo-500/10' : ''}`}
                  >
                    {/* Top Day Header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center ${
                            isCurrentToday
                              ? calendarType === 'hijri'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/40'
                                : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                              : inMonth
                              ? 'text-slate-200'
                              : 'text-slate-500'
                          }`}
                        >
                          {dayItem.primaryNum}
                        </span>
                        {dayItem.secondaryNum && (
                          <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                            {dayItem.secondaryNum}
                          </span>
                        )}
                      </div>

                      {dueTenants.length > 0 && inMonth && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {dueTenants.length}
                        </span>
                      )}
                    </div>

                    {/* Mapped Tenant Badges for this Due Date */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px] sm:max-h-[90px] pr-0.5 custom-scrollbar">
                      {dueTenants.map((tenant) => {
                        const isOverdue = tenant.isOverdue;
                        const isDueToday = tenant.isDueToday;

                        return (
                          <button
                            key={tenant.id}
                            type="button"
                            onClick={() => setSelectedCalendarTenant(tenant)}
                            className={`w-full text-left rtl:text-right p-1 sm:p-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all duration-150 flex items-center gap-1.5 group cursor-pointer hover:scale-[1.02] shadow-xs ${
                              isOverdue
                                ? 'bg-rose-500/20 text-rose-200 border-rose-500/40 hover:bg-rose-500/30 hover:border-rose-400'
                                : isDueToday
                                ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30 hover:border-amber-400'
                                : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/30 hover:border-emerald-400'
                            }`}
                            title={`${tenant.unitNumber} - ${tenant.name} (SAR ${Number(tenant.rentAmount || 0).toLocaleString()})`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                isOverdue
                                  ? 'bg-rose-400 animate-pulse'
                                  : isDueToday
                                  ? 'bg-amber-400 animate-ping'
                                  : 'bg-emerald-400'
                              }`}
                            />
                            <div className="min-w-0 flex-1 truncate">
                              <span className="font-bold">{tenant.unitNumber}</span>
                              <span className="opacity-80 mx-1">·</span>
                              <span className="truncate">{tenant.name}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ─── Global Add/Edit Modal ─────────────────────────────────────────── */}
      {isModalOpen && (
        <MakkahTenantModal
          isOpen={isModalOpen}
          initialTenant={editingTenant}
          onClose={handleCloseModal}
          onSubmit={handleSaveTenant}
        />
      )}

      {/* ─── Confirm Payment & Record Income Modal ──────────────────────────── */}
      {Boolean(payingTenant) && (
        <MakkahPaymentModal
          isOpen={Boolean(payingTenant)}
          tenant={payingTenant}
          onClose={() => setPayingTenant(null)}
          onConfirm={handleConfirmPayment}
        />
      )}

      {/* ─── Calendar Tenant Quick Details Modal ────────────────────────────── */}
      {selectedCalendarTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {selectedCalendarTenant.unitNumber}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {t('makkah.calendar.quickDetailsTitle')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedCalendarTenant.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCalendarTenant(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs sm:text-sm">
              {/* Status Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  selectedCalendarTenant.isOverdue
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : selectedCalendarTenant.isDueToday
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {selectedCalendarTenant.isOverdue ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>
                    {selectedCalendarTenant.isOverdue
                      ? t('makkah.status.overdue')
                      : selectedCalendarTenant.isDueToday
                      ? t('makkah.status.dueToday')
                      : t('makkah.status.paid')}
                  </span>
                </div>
                <span className="font-semibold text-xs">
                  {selectedCalendarTenant.isOverdue
                    ? t('makkah.status.daysOverdue', { count: selectedCalendarTenant.daysOverdue })
                    : selectedCalendarTenant.daysLeft > 0
                    ? t('makkah.status.daysLeft', { count: selectedCalendarTenant.daysLeft })
                    : ''}
                </span>
              </div>

              {/* Tenant Details Grid */}
              <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    {t('makkah.calendar.tenantLabel')}
                  </span>
                  <span className="font-bold text-white">{selectedCalendarTenant.name}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-slate-500" />
                    {t('makkah.calendar.unitLabel')}
                  </span>
                  <span className="font-bold text-white">{selectedCalendarTenant.unitNumber}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {t('history.phone')}
                  </span>
                  <span className="font-semibold text-slate-200" dir="ltr">
                    {selectedCalendarTenant.phone || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-slate-500" />
                    {t('makkah.calendar.rentAmountLabel')}
                  </span>
                  <span className="font-extrabold text-white text-sm text-emerald-400">
                    SAR {Number(selectedCalendarTenant.rentAmount || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-slate-500" />
                    {t('makkah.calendar.intervalLabel')}
                  </span>
                  <span className="font-medium text-slate-300">
                    {formatPaymentInterval(selectedCalendarTenant.paymentIntervalMonths, isArabic)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                    {t('makkah.calendar.lastPaidLabel')}
                  </span>
                  <span className="font-medium text-slate-200 text-xs text-right rtl:text-left">
                    {formatDualDate(selectedCalendarTenant.lastPaidDate, isArabic, formatBookingDate)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {t('makkah.calendar.nextDueLabel')}
                  </span>
                  <span className="font-bold text-indigo-300 text-xs text-right rtl:text-left">
                    {formatDualDate(selectedCalendarTenant.nextDueDate, isArabic, formatBookingDate)}
                  </span>
                </div>

                {selectedCalendarTenant.notes && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      {t('makkah.calendar.notesLabel')}
                    </span>
                    <p className="text-xs text-slate-300 bg-slate-900 p-2 rounded-lg">
                      {selectedCalendarTenant.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="success"
                  size="sm"
                  icon={Check}
                  onClick={() => handleOpenPaymentModal(selectedCalendarTenant)}
                >
                  {t('makkah.status.paid')}
                </Button>

                <Button
                  variant="whatsapp"
                  size="sm"
                  icon={MessageSquare}
                  onClick={() => handleLaunchWhatsApp(selectedCalendarTenant)}
                >
                  WhatsApp
                </Button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const tEdit = selectedCalendarTenant;
                    setSelectedCalendarTenant(null);
                    handleOpenEditModal(tEdit);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                  {t('makkah.table.editTooltip')}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(selectedCalendarTenant.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('makkah.table.deleteTooltip')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
