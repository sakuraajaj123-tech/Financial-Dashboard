// useFinance.js — Central state management hook for Personal & Business Cash Flow
// Features strict Month Isolation, 4-mode Recurring Transactions Engine,
// 24-Month Data Sustainability with TTL expireAt timestamps, and dynamic Property Income integration.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  parseISO,
  format,
  addMonths,
  subMonths,
  isValid,
  isBefore,
  isAfter,
} from 'date-fns';
import { useUnits, getBookingRevenueForMonth } from './useUnits';

const TRANSACTIONS_COLLECTION = 'transactions';

export const CATEGORY_COLORS = {
  maintenance: '#f43f5e', // rose
  utilities: '#f59e0b',   // amber
  cleaning: '#06b6d4',    // cyan
  supplies: '#8b5cf6',    // violet
  marketing: '#ec4899',   // pink
  taxes: '#64748b',       // slate
  salaries: '#3b82f6',    // blue
  rent: '#10b981',        // emerald
  business: '#14b8a6',    // teal
  consulting: '#6366f1',  // indigo
  investment: '#84cc16',  // lime
  personal: '#d946ef',    // fuchsia
  other: '#94a3b8',       // gray
};

/**
 * Checks if a transaction is active in the target year and month (0-indexed).
 * 
 * Recurrence Rules:
 * - 'one-time': Valid only in the exact recorded date's month and year.
 * - 'weekly': Valid in every month on or after its start date. Monthly amount is 4-week total (amount * 4).
 * - 'monthly': Valid in every month on or after its start date. Monthly amount is amount.
 * - 'annual' / 'annually': Valid in every matching month on or after its start date. Monthly amount is amount.
 */
export function isTransactionActiveInMonth(tx, targetYear, targetMonthIndex) {
  if (!tx || !tx.date) return false;
  const txDate = parseISO(tx.date);
  if (!isValid(txDate)) return false;

  const txYear = txDate.getFullYear();
  const txMonthIndex = txDate.getMonth();

  const targetStartDate = new Date(targetYear, targetMonthIndex, 1);
  const txStartDate = new Date(txYear, txMonthIndex, 1);

  const freq = (tx.frequency || 'one-time').toLowerCase().trim();

  switch (freq) {
    case 'weekly':
      // Active for all months on or after start date
      return targetStartDate >= txStartDate;

    case 'monthly':
      // Active for all months on or after start date
      return targetStartDate >= txStartDate;

    case 'annual':
    case 'annually':
      // Active if target month matches the transaction start month AND is on or after start date
      return targetStartDate >= txStartDate && targetMonthIndex === txMonthIndex;

    case 'one-time':
    default:
      // Active only in the exact recorded month & year
      return txYear === targetYear && txMonthIndex === targetMonthIndex;
  }
}

/**
 * Calculates the monthly contribution amount for a transaction in a given active month.
 * Weekly transactions calculate as a 4-week monthly total (amount * 4).
 */
export function getTransactionMonthAmount(tx) {
  const baseAmount = Number(tx.amount) || 0;
  const freq = (tx.frequency || 'one-time').toLowerCase().trim();
  if (freq === 'weekly') {
    return baseAmount * 4;
  }
  return baseAmount;
}

export function useFinance() {
  const { units, loading: unitsLoading } = useUnits();
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // ─── Selected Month (Strict Month Isolation) ──────────────────────────────
  // Format: 'YYYY-MM', e.g. '2026-08'
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const { selectedYear, selectedMonthIndex } = useMemo(() => {
    try {
      const parts = (selectedMonth || format(new Date(), 'yyyy-MM')).split('-');
      const y = parseInt(parts[0], 10) || new Date().getFullYear();
      const m = (parseInt(parts[1], 10) || 1) - 1; // 0-indexed
      return { selectedYear: y, selectedMonthIndex: m };
    } catch {
      const now = new Date();
      return { selectedYear: now.getFullYear(), selectedMonthIndex: now.getMonth() };
    }
  }, [selectedMonth]);

  // Month navigation helpers
  const goToPrevMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      const parts = prev.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      return format(subMonths(d, 1), 'yyyy-MM');
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      const parts = prev.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      return format(addMonths(d, 1), 'yyyy-MM');
    });
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
  }, []);

  // ─── Real-time Firestore transactions with 24-Month Rolling Window ─────────
  useEffect(() => {
    const colRef = collection(db, TRANSACTIONS_COLLECTION);
    const cutoffDateStr = format(subMonths(new Date(), 24), 'yyyy-MM-01');

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const live = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
            amount: Number(d.data().amount) || 0,
          }))
          // Client-side safeguard: Ignore records older than 24 months
          .filter((item) => !item.date || item.date >= cutoffDateStr);

        // Sort descending by date (newest first), then by createdAt
        live.sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          const createdA = new Date(a.createdAt || 0).getTime();
          const createdB = new Date(b.createdAt || 0).getTime();
          return createdB - createdA;
        });

        setTransactions(live);
        setTransactionsLoading(false);
      },
      (err) => {
        console.error('[Finance] Firestore transactions snapshot error:', err);
        setTransactionsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ─── Dynamic Property Income strictly isolated for selected month (Prorated Daily) ──
  const monthPropertyIncome = useMemo(() => {
    const rawSum = units.reduce((total, unit) => {
      const unitBookingsSum = (unit.bookings || []).reduce((sum, b) => {
        return sum + getBookingRevenueForMonth(b, selectedYear, selectedMonthIndex);
      }, 0);
      return total + unitBookingsSum;
    }, 0);
    return Math.round(rawSum);
  }, [units, selectedYear, selectedMonthIndex]);

  // ─── Filtered Transactions for the Selected Month (Recurring Engine) ──────
  const monthTransactions = useMemo(() => {
    return transactions
      .filter((tx) => isTransactionActiveInMonth(tx, selectedYear, selectedMonthIndex))
      .map((tx) => {
        const effectiveAmount = getTransactionMonthAmount(tx);
        const isWeekly = (tx.frequency || 'one-time').toLowerCase().trim() === 'weekly';
        return {
          ...tx,
          effectiveAmount,
          originalAmount: Number(tx.amount) || 0,
          isWeekly,
        };
      });
  }, [transactions, selectedYear, selectedMonthIndex]);

  // ─── Manual Income Sum for selected month ────────────────────────────────
  const monthManualIncome = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.effectiveAmount, 0);
  }, [monthTransactions]);

  // ─── Grand Total Income for selected month (Property + Manual) ───────────
  const monthTotalIncome = useMemo(() => {
    return monthPropertyIncome + monthManualIncome;
  }, [monthPropertyIncome, monthManualIncome]);

  // ─── Total Expenses Sum for selected month ───────────────────────────────
  const monthTotalExpense = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.effectiveAmount, 0);
  }, [monthTransactions]);

  // ─── Net Profit / Loss for selected month ────────────────────────────────
  const monthNetCashFlow = useMemo(() => {
    return monthTotalIncome - monthTotalExpense;
  }, [monthTotalIncome, monthTotalExpense]);

  const isNetProfit = monthNetCashFlow >= 0;

  const profitMargin = monthTotalIncome > 0
    ? Math.round((monthNetCashFlow / monthTotalIncome) * 100)
    : 0;

  // ─── Mutations: Add, Delete, Update with 24-Month expireAt TTL Timestamp ─
  const addTransaction = useCallback(async (transactionData) => {
    try {
      const colRef = collection(db, TRANSACTIONS_COLLECTION);
      const txDateStr = transactionData.date || new Date().toISOString().slice(0, 10);
      const parsedDate = parseISO(txDateStr);
      const validDate = isValid(parsedDate) ? parsedDate : new Date();

      // Automated 24-month expiration for Cloud Firestore native TTL policy
      const expireDate = addMonths(validDate, 24);

      const newEntry = {
        title: transactionData.title?.trim() || 'Untitled Transaction',
        type: transactionData.type === 'income' ? 'income' : 'expense',
        amount: Number(transactionData.amount) || 0,
        date: txDateStr,
        frequency: transactionData.frequency || 'one-time',
        category: transactionData.category || 'other',
        createdAt: new Date().toISOString(),
        expireAt: Timestamp.fromDate(expireDate),
      };

      const docRef = await addDoc(colRef, newEntry);
      console.log(`[Finance] ✅ Transaction added successfully with ID: ${docRef.id}`);
      return docRef.id;
    } catch (err) {
      console.error('[Finance] ❌ Failed to add transaction:', err);
      throw err;
    }
  }, []);

  const deleteTransaction = useCallback(async (transactionId) => {
    try {
      const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
      await deleteDoc(docRef);
      console.log(`[Finance] ✅ Transaction deleted: ${transactionId}`);
    } catch (err) {
      console.error('[Finance] ❌ Failed to delete transaction:', err);
      throw err;
    }
  }, []);

  const updateTransaction = useCallback(async (transactionId, updatedData) => {
    try {
      const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
      const updates = {
        ...updatedData,
        amount: Number(updatedData.amount) || 0,
        updatedAt: new Date().toISOString(),
      };

      if (updatedData.date) {
        const parsedDate = parseISO(updatedData.date);
        const validDate = isValid(parsedDate) ? parsedDate : new Date();
        updates.expireAt = Timestamp.fromDate(addMonths(validDate, 24));
      }

      await updateDoc(docRef, updates);
      console.log(`[Finance] ✅ Transaction updated: ${transactionId}`);
    } catch (err) {
      console.error('[Finance] ❌ Failed to update transaction:', err);
      throw err;
    }
  }, []);

  return {
    // Month state & navigation
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    selectedMonthIndex,
    goToPrevMonth,
    goToNextMonth,
    goToCurrentMonth,

    // Transactions for active month
    transactions: monthTransactions,
    allTransactions: transactions,
    loading: unitsLoading || transactionsLoading,

    // Month isolated calculations
    monthPropertyIncome,
    monthManualIncome,
    monthTotalIncome,
    monthTotalExpense,
    monthNetCashFlow,
    isNetProfit,
    profitMargin,

    // Legacy aliases for full backward compatibility
    totalPropertyIncome: monthPropertyIncome,
    totalManualIncome: monthManualIncome,
    totalIncome: monthTotalIncome,
    totalExpense: monthTotalExpense,
    netCashFlow: monthNetCashFlow,

    // Actions
    addTransaction,
    deleteTransaction,
    updateTransaction,
    units,
  };
}
