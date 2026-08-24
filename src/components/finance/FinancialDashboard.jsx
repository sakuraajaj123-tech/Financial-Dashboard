// FinancialDashboard.jsx — Main Financial & Cash Flow Dashboard view
// Features Month Switcher with strict isolation, 3 dynamic KPI summary cards
// (Total Income, Total Expenses, Net Profit/Loss with dynamic Green/Red styling),
// and a Month-Isolated Ledger Table with 4-mode recurring transactions support.

import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Search,
  Trash2,
  Building2,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { Button } from '../shared/Button';
import { useTranslation } from 'react-i18next';
import { CATEGORY_COLORS } from '../../hooks/useFinance';
import {
  formatBookingDate,
  formatFullMonthYear,
  ARABIC_MONTHS,
  ENGLISH_FULL_MONTHS,
} from '../../utils/dateFormatter';
import { format } from 'date-fns';

export function FinancialDashboard({
  financeData,
  onOpenAddModal,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const {
    selectedMonth = format(new Date(), 'yyyy-MM'),
    setSelectedMonth,
    selectedYear = new Date().getFullYear(),
    selectedMonthIndex = new Date().getMonth(),
    goToPrevMonth,
    goToNextMonth,
    goToCurrentMonth,
    transactions = [],
    monthPropertyIncome = 0,
    monthManualIncome = 0,
    monthTotalIncome = 0,
    monthTotalExpense = 0,
    monthNetCashFlow = 0,
    isNetProfit = true,
    profitMargin = 0,
    deleteTransaction,
  } = financeData;

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [deletingId, setDeletingId] = useState(null);

  const currentMonthISO = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const isCurrentMonthActive = selectedMonth === currentMonthISO;

  // Formatted display for selected month
  const activeMonthDate = useMemo(() => {
    return new Date(selectedYear, selectedMonthIndex, 1);
  }, [selectedYear, selectedMonthIndex]);

  const activeMonthDisplay = useMemo(() => {
    return formatFullMonthYear(activeMonthDate, isArabic);
  }, [activeMonthDate, isArabic]);

  // Year options for quick select (e.g. 2 years past to 2 years future)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  }, []);

  // Filtered transactions for the ledger table
  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const localizedCat = t(`finance.categories.${item.category}`, item.category).toLowerCase();
      const titleMatch = (item.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      const catMatch = (item.category || '').toLowerCase().includes(searchQuery.toLowerCase()) || localizedCat.includes(searchQuery.toLowerCase());
      return matchesType && (titleMatch || catMatch);
    });
  }, [transactions, typeFilter, searchQuery, t]);

  const handleDelete = async (id) => {
    if (window.confirm(t('finance.ledger.deleteConfirm'))) {
      setDeletingId(id);
      try {
        await deleteTransaction(id);
      } catch (err) {
        console.error('Delete error:', err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Month change from select dropdown
  const handleMonthSelect = (newMonthIdx) => {
    const mStr = String(Number(newMonthIdx) + 1).padStart(2, '0');
    if (setSelectedMonth) {
      setSelectedMonth(`${selectedYear}-${mStr}`);
    }
  };

  const handleYearSelect = (newYear) => {
    const mStr = String(selectedMonthIndex + 1).padStart(2, '0');
    if (setSelectedMonth) {
      setSelectedMonth(`${newYear}-${mStr}`);
    }
  };

  const expenseEntriesCount = useMemo(() => {
    return transactions.filter((t) => t.type === 'expense').length;
  }, [transactions]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ─── Top Month Switcher & Controls Toolbar ────────────────────────────── */}
      <section className="rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-800/80 border border-slate-700/60 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Active Month Label & Quick Nav */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight capitalize">
                  {activeMonthDisplay}
                </h2>
                {isCurrentMonthActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    {t('finance.monthSelector.currentMonth')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('header.financialSubtitle')}
              </p>
            </div>
          </div>

          {/* Month Switcher Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Prev / Next Month Buttons */}
            <div className="flex items-center bg-slate-950/80 border border-slate-700/80 rounded-xl p-1 shadow-inner">
              <button
                type="button"
                onClick={goToPrevMonth}
                title={t('finance.monthSelector.prevMonth')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isArabic ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              {/* Month Dropdown */}
              <select
                value={selectedMonthIndex}
                onChange={(e) => handleMonthSelect(e.target.value)}
                className="bg-transparent text-xs font-bold text-white px-2 py-1 outline-none cursor-pointer"
              >
                {(isArabic ? ARABIC_MONTHS : ENGLISH_FULL_MONTHS).map((mName, idx) => (
                  <option key={idx} value={idx} className="bg-slate-900 text-white font-medium">
                    {mName}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={selectedYear}
                onChange={(e) => handleYearSelect(e.target.value)}
                className="bg-transparent text-xs font-bold text-indigo-400 px-2 py-1 outline-none border-l rtl:border-l-0 rtl:border-r border-slate-800 cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white font-medium">
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={goToNextMonth}
                title={t('finance.monthSelector.nextMonth')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isArabic ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Jump to Current Month Button if not already on current month */}
            {!isCurrentMonthActive && (
              <button
                type="button"
                onClick={goToCurrentMonth}
                className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {t('finance.monthSelector.currentMonth')}
              </button>
            )}

            {/* Add Transaction CTA */}
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={onOpenAddModal}
            >
              {t('header.addTransaction')}
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Simplified 3-Card Summary at Top ─────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        
        {/* 1. Total Income (إجمالي الإيرادات) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-teal-900/10 border border-emerald-500/30 p-5 lg:p-6 shadow-xl shadow-emerald-500/10 backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300">
          <div className="absolute -top-8 -right-8 rtl:-right-auto rtl:-left-8 w-28 h-28 rounded-full bg-emerald-500 opacity-15 blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                {t('finance.kpis.totalIncome')}
              </p>
              
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                  SAR {monthTotalIncome.toLocaleString()}
                </span>
              </div>

              {/* Dynamic Property Income + Manual breakdown badge */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  {t('finance.kpis.propertyIncome')}: SAR {monthPropertyIncome.toLocaleString()}
                </span>
                {monthManualIncome > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-200 font-bold border border-slate-700">
                    +{t('finance.kpis.manualIncome')}: SAR {monthManualIncome.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 2. Total Expenses (إجمالي المصاريف) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-600/5 to-pink-900/10 border border-rose-500/30 p-5 lg:p-6 shadow-xl shadow-rose-500/10 backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300">
          <div className="absolute -top-8 -right-8 rtl:-right-auto rtl:-left-8 w-28 h-28 rounded-full bg-rose-500 opacity-15 blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                {t('finance.kpis.totalExpenses')}
              </p>
              
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                  SAR {monthTotalExpense.toLocaleString()}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 font-bold border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  {t('finance.kpis.expenseCount', { count: expenseEntriesCount })}
                </span>
              </div>
            </div>

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/20">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 3. Net Profit / Loss (الصافي - ربح / خسارة) — Dynamic Green/Red Card */}
        <div
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${
            isNetProfit
              ? 'from-emerald-500/15 via-teal-600/10 to-slate-900/40 border-emerald-500/40 shadow-emerald-500/10'
              : 'from-rose-500/20 via-rose-700/10 to-slate-900/40 border-rose-500/40 shadow-rose-500/15'
          } border p-5 lg:p-6 shadow-xl backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300`}
        >
          <div
            className={`absolute -top-8 -right-8 rtl:-right-auto rtl:-left-8 w-28 h-28 rounded-full ${
              isNetProfit ? 'bg-emerald-500' : 'bg-rose-500'
            } opacity-20 blur-2xl pointer-events-none`}
          />

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {t('finance.kpis.netCashFlow')}
              </p>
              
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight ${
                    isNetProfit ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isNetProfit ? '+' : '-'} SAR {Math.abs(monthNetCashFlow).toLocaleString()}
                </span>
              </div>

              {/* Status Badge: ربح / Surplus or خسارة / Deficit */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-extrabold text-xs shadow-sm ${
                    isNetProfit
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {isNetProfit ? (
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  {isNetProfit ? t('finance.kpis.positiveCashFlow') : t('finance.kpis.negativeCashFlow')}
                </span>

                {monthTotalIncome > 0 && (
                  <span className="text-xs text-slate-400 font-semibold px-2 py-1 bg-slate-900/60 rounded-lg border border-slate-800">
                    {t('finance.kpis.profitMargin', { margin: profitMargin })}
                  </span>
                )}
              </div>
            </div>

            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                isNetProfit
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/20'
                  : 'bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-rose-500/20'
              } shadow-lg`}
            >
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bottom Section: Month-Isolated Transaction Ledger Table ──────────── */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/60 border border-slate-700/50 shadow-xl backdrop-blur-sm overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-5 border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {t('finance.ledger.title')}
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                {activeMonthDisplay}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('finance.ledger.subtitle')}
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-white flex-1 sm:w-64 focus-within:border-indigo-500 transition-colors shadow-inner">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder={t('finance.ledger.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-xs text-slate-200 placeholder-slate-500 w-full"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('finance.ledger.filterAll')}
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('income')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  typeFilter === 'income'
                    ? 'bg-emerald-600/80 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('finance.ledger.filterIncome')}
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('expense')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  typeFilter === 'expense'
                    ? 'bg-rose-600/80 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('finance.ledger.filterExpense')}
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500 shadow-inner">
                <Calendar className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-slate-300">
                {t('finance.ledger.noTransactions')}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('finance.ledger.noTransactionsSubtitle')}
              </p>
              <div className="mt-5">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={onOpenAddModal}
                >
                  {t('header.addTransaction')}
                </Button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left rtl:text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">{t('finance.ledger.colDate')}</th>
                  <th className="px-5 py-3.5">{t('finance.ledger.colTitle')}</th>
                  <th className="px-5 py-3.5">{t('finance.ledger.colType')}</th>
                  <th className="px-5 py-3.5">{t('finance.ledger.colCategory')}</th>
                  <th className="px-5 py-3.5">{t('finance.ledger.colFrequency')}</th>
                  <th className="px-5 py-3.5 text-right rtl:text-left">{t('finance.ledger.colAmount')}</th>
                  <th className="px-5 py-3.5 text-center">{t('finance.ledger.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const catColor = CATEGORY_COLORS[tx.category] || '#94a3b8';
                  const isWeekly = (tx.frequency || '').toLowerCase().trim() === 'weekly';
                  const displayAmount = tx.effectiveAmount ?? tx.amount;

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Date */}
                      <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formatBookingDate(tx.date, isArabic)}
                        </div>
                      </td>

                      {/* Title */}
                      <td className="px-5 py-3.5 text-white font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{tx.title}</span>
                          {isWeekly && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {t('finance.ledger.weeklyCalcBadge')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isIncome
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDownRight className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-400" />
                          )}
                          {isIncome
                            ? t('finance.ledger.typeIncome')
                            : t('finance.ledger.typeExpense')}
                        </span>
                      </td>

                      {/* Category Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-slate-200 text-[11px] font-medium bg-slate-800/80 border border-slate-700/60"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: catColor }}
                          />
                          {t(`finance.categories.${tx.category}`, tx.category)}
                        </span>
                      </td>

                      {/* Frequency Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-300">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-medium capitalize">
                          <Repeat className="w-3 h-3 text-indigo-400" />
                          {t(`finance.frequencies.${tx.frequency}`, tx.frequency)}
                        </span>
                      </td>

                      {/* Amount Column */}
                      <td
                        className={`px-5 py-3.5 font-bold whitespace-nowrap text-right rtl:text-left text-sm ${
                          isIncome ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        <div className="flex flex-col items-end rtl:items-start">
                          <span>
                            {isIncome ? '+' : '-'} SAR {Number(displayAmount || 0).toLocaleString()}
                          </span>
                          {isWeekly && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({t('finance.ledger.originalWeeklyAmount', { amount: Number(tx.amount || 0).toLocaleString() })})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id)}
                          disabled={deletingId === tx.id}
                          title={t('finance.ledger.deleteTooltip')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

