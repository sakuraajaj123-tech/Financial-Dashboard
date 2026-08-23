// FinancialDashboard.jsx — Main Financial & Cash Flow Dashboard view
// Features 3 KPI cards (Total Income with dynamic property revenue, Total Expenses, Net Cash Flow),
// an expense breakdown Pie Chart, and a Ledger Table with sorting and filtering.

import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Search,
  Trash2,
  Building2,
  PieChart as PieIcon,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '../shared/Button';
import { useTranslation } from 'react-i18next';
import { CATEGORY_COLORS } from '../../hooks/useFinance';

function FinancialTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: data.color || '#6366f1' }}
        />
        <p className="text-sm font-bold text-white capitalize">{data.displayName || data.category}</p>
      </div>
      <p className="text-xs text-slate-300 font-semibold">
        SAR {data.value.toLocaleString()}
      </p>
      <p className="text-[11px] text-indigo-400 font-medium mt-0.5">
        {data.percentage}% of total expenses
      </p>
    </div>
  );
}

export function FinancialDashboard({
  financeData,
  onOpenAddModal,
}) {
  const { t } = useTranslation();
  const {
    transactions = [],
    totalPropertyIncome = 0,
    totalManualIncome = 0,
    totalIncome = 0,
    totalExpense = 0,
    netCashFlow = 0,
    expensesByCategory = [],
    deleteTransaction,
  } = financeData;

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [deletingId, setDeletingId] = useState(null);

  // Translate category names for the chart
  const localizedExpenseCategories = useMemo(() => {
    return expensesByCategory.map((item) => ({
      ...item,
      displayName: t(`finance.categories.${item.category}`, item.category),
    }));
  }, [expensesByCategory, t]);

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

  const profitMargin = totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ─── Top Section: 3 KPI Cards ────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {/* 1. Total Income */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-600/5 border border-emerald-500/20 p-5 lg:p-6 shadow-xl shadow-emerald-500/10 backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-emerald-500 opacity-10 blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                {t('finance.kpis.totalIncome')}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  SAR {totalIncome.toLocaleString()}
                </span>
              </div>

              {/* Dynamic Property Income breakdown badge */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-medium">
                  <Building2 className="w-3 h-3 text-emerald-400" />
                  {t('finance.kpis.propertyIncome')}: SAR {totalPropertyIncome.toLocaleString()}
                </span>
                {totalManualIncome > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                    +{t('finance.kpis.manualIncome')}: SAR {totalManualIncome.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 2. Total Expenses */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-600/5 border border-rose-500/20 p-5 lg:p-6 shadow-xl shadow-rose-500/10 backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-rose-500 opacity-10 blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1">
                {t('finance.kpis.totalExpenses')}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  SAR {totalExpense.toLocaleString()}
                </span>
              </div>

              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {t('finance.charts.expenseSubtitle')}
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/20">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 3. Net Cash Flow */}
        <div
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${
            netCashFlow >= 0
              ? 'from-indigo-500/15 to-violet-600/5 border-indigo-500/30 shadow-indigo-500/10'
              : 'from-rose-500/15 to-rose-700/10 border-rose-500/30 shadow-rose-500/10'
          } border p-5 lg:p-6 shadow-xl backdrop-blur-sm group hover:scale-[1.01] transition-transform duration-300`}
        >
          <div
            className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${
              netCashFlow >= 0 ? 'bg-indigo-500' : 'bg-rose-500'
            } opacity-10 blur-2xl pointer-events-none`}
          />

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {t('finance.kpis.netCashFlow')}
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  SAR {netCashFlow.toLocaleString()}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-md font-semibold ${
                    netCashFlow >= 0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {netCashFlow >= 0
                    ? t('finance.kpis.positiveCashFlow')
                    : t('finance.kpis.negativeCashFlow')}
                </span>
                {totalIncome > 0 && (
                  <span className="text-slate-400">
                    {t('finance.kpis.profitMargin', { margin: profitMargin })}
                  </span>
                )}
              </div>
            </div>

            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                netCashFlow >= 0
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              } shadow-lg`}
            >
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Middle Section: Expense Breakdown Chart & Stats ────────────────── */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/60 border border-slate-700/50 p-5 lg:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-indigo-400" />
              {t('finance.charts.expenseBreakdown')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('finance.charts.expenseSubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
              SAR {totalExpense.toLocaleString()} {t('finance.charts.categoryTotal')}
            </span>
          </div>
        </div>

        {expensesByCategory.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
              <PieIcon className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">
              {t('finance.charts.noExpenses')}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {t('finance.charts.noExpensesSubtitle')}
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              {t('header.addTransaction')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Pie Chart */}
            <div className="lg:col-span-5 flex items-center justify-center min-h-[260px]">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Tooltip content={<FinancialTooltip />} />
                  <Pie
                    data={localizedExpenseCategories}
                    dataKey="value"
                    nameKey="displayName"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {localizedExpenseCategories.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || CATEGORY_COLORS[entry.category] || '#6366f1'}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category Bars & Legend */}
            <div className="lg:col-span-7 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {localizedExpenseCategories.map((cat) => (
                  <div
                    key={cat.category}
                    className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {cat.displayName}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-white whitespace-nowrap">
                        SAR {cat.value.toLocaleString()}
                      </span>
                    </div>

                    {/* Progress share bar */}
                    <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400">
                      <span>{t('finance.charts.share')}</span>
                      <span className="font-semibold text-slate-300">{cat.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── Bottom Section: Transaction Ledger Table ────────────────────────── */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/60 border border-slate-700/50 shadow-xl backdrop-blur-sm overflow-hidden">
        {/* Table Controls */}
        <div className="p-5 border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {t('finance.ledger.title')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('finance.ledger.subtitle')}
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-white flex-1 sm:w-64 focus-within:border-indigo-500 transition-colors">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder={t('finance.ledger.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-xs text-slate-200 placeholder-slate-500 w-full"
              />
            </div>

            {/* Type Filters */}
            <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
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
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
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
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  typeFilter === 'expense'
                    ? 'bg-rose-600/80 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('finance.ledger.filterExpense')}
              </button>
            </div>

            {/* Add Entry CTA */}
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

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="py-14 text-center px-4">
              <p className="text-sm font-semibold text-slate-400">
                {t('finance.ledger.noTransactions')}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('finance.ledger.noTransactionsSubtitle')}
              </p>
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
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Date */}
                      <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {tx.date || '—'}
                        </div>
                      </td>

                      {/* Title */}
                      <td className="px-5 py-3.5 text-white font-semibold">
                        {tx.title}
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
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-400">
                        <span className="capitalize text-[11px]">
                          {t(`finance.frequencies.${tx.frequency}`, tx.frequency)}
                        </span>
                      </td>

                      {/* Amount */}
                      <td
                        className={`px-5 py-3.5 font-bold whitespace-nowrap text-right rtl:text-left text-sm ${
                          isIncome ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isIncome ? '+' : '-'} SAR {Number(tx.amount || 0).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id)}
                          disabled={deletingId === tx.id}
                          title={t('finance.ledger.deleteTooltip')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
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
