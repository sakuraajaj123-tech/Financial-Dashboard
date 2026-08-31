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
} from 'date-fns';
import { useUnits, getBookingRevenueForMonth } from './useUnits';
import { useMakkahRentals } from './useMakkahRentals';

const TRANSACTIONS_COLLECTION = 'transactions';

export const CATEGORY_COLORS = {
  maintenance: '#f43f5e',   // rose
  utilities: '#f59e0b',     // amber
  cleaning: '#06b6d4',      // cyan
  supplies: '#8b5cf6',      // violet
  marketing: '#ec4899',     // pink
  taxes: '#64748b',         // slate
  salaries: '#3b82f6',      // blue
  rent: '#10b981',          // emerald
  business: '#14b8a6',      // teal
  consulting: '#6366f1',    // indigo
  investment: '#84cc16',    // lime
  personal: '#d946ef',      // fuchsia
  gathern: '#8b5cf6',       // violet / purple (Gathern)
  direct_booking: '#3b82f6',// blue (Direct)
  makkah_rental: '#10b981', // emerald (Makkah Building)
  other: '#94a3b8',         // gray
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
  const {
    allConfirmedPayments,
    loading: makkahLoading,
    deletePayment,
  } = useMakkahRentals();

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

  // ─── 1. Apartment Bookings Active in Selected Month (Ledger Items & Revenue) ──
  const monthBookingEntries = useMemo(() => {
    const entries = [];
    units.forEach((unit) => {
      (unit.bookings || []).forEach((b) => {
        const proratedRev = getBookingRevenueForMonth(b, selectedYear, selectedMonthIndex);
        if (proratedRev > 0) {
          const isGathern = (b.source || '').toLowerCase() === 'gathern';
          const tenantTitle = b.tenantName
            ? `${b.tenantName} - ${unit.name || `وحدة ${unit.number}`}`
            : unit.name || `وحدة ${unit.number}`;

          entries.push({
            id: `booking-${unit.id}-${b.id}`,
            rawBookingId: b.id,
            unitId: unit.id,
            unitNumber: unit.number,
            title: tenantTitle,
            tenantName: b.tenantName || '',
            phone: b.phone || '',
            type: 'income',
            category: isGathern ? 'gathern' : 'direct_booking',
            frequency: 'one-time',
            amount: Math.round(proratedRev),
            effectiveAmount: Math.round(proratedRev),
            totalBookingAmount: Number(b.amount) || 0,
            date: b.checkIn || format(new Date(selectedYear, selectedMonthIndex, 1), 'yyyy-MM-dd'),
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            source: b.source || 'Direct Call',
            isBooking: true,
            isMakkahRental: false,
            isManual: false,
          });
        }
      });
    });
    return entries;
  }, [units, selectedYear, selectedMonthIndex]);

  const monthPropertyIncome = useMemo(() => {
    return monthBookingEntries.reduce((sum, item) => sum + item.effectiveAmount, 0);
  }, [monthBookingEntries]);

  // ─── 2. Confirmed Makkah Rental Payments in Selected Month ────────────────
  const monthMakkahEntries = useMemo(() => {
    return allConfirmedPayments
      .filter((p) => {
        if (!p.paidDate) return false;
        const pDate = parseISO(p.paidDate);
        return isValid(pDate) && pDate.getFullYear() === selectedYear && pDate.getMonth() === selectedMonthIndex;
      })
      .map((p) => ({
        id: p.id || `mpay-${p.tenantId}-${p.paidDate}`,
        tenantId: p.tenantId,
        tenantName: p.tenantName || 'مستأجر',
        unitNumber: p.unitNumber || '',
        title: `عمارة مكة ${p.unitNumber ? `- شقة ${p.unitNumber}` : ''} (${p.tenantName || 'مستأجر'})`,
        type: 'income',
        category: 'makkah_rental',
        frequency: 'one-time',
        amount: Number(p.amount) || 0,
        effectiveAmount: Number(p.amount) || 0,
        date: p.paidDate,
        isBooking: false,
        isMakkahRental: true,
        isManual: false,
      }));
  }, [allConfirmedPayments, selectedYear, selectedMonthIndex]);

  const monthMakkahIncome = useMemo(() => {
    return monthMakkahEntries.reduce((sum, item) => sum + item.effectiveAmount, 0);
  }, [monthMakkahEntries]);

  // ─── 3. Filtered Manual Transactions for Selected Month (Recurring Engine) ─
  const monthManualTransactions = useMemo(() => {
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
          isBooking: false,
          isMakkahRental: false,
          isManual: true,
        };
      });
  }, [transactions, selectedYear, selectedMonthIndex]);

  // ─── 4. Manual Income Sum for Selected Month ──────────────────────────────
  const monthManualIncome = useMemo(() => {
    return monthManualTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.effectiveAmount, 0);
  }, [monthManualTransactions]);

  // ─── 5. Grand Total Income (Apartment Bookings + Makkah Confirmed + Manual) ──
  const monthTotalIncome = useMemo(() => {
    return monthPropertyIncome + monthMakkahIncome + monthManualIncome;
  }, [monthPropertyIncome, monthMakkahIncome, monthManualIncome]);

  // ─── 6. Total Expenses Sum for Selected Month ─────────────────────────────
  const monthTotalExpense = useMemo(() => {
    return monthManualTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.effectiveAmount, 0);
  }, [monthManualTransactions]);

  // ─── 7. Net Profit / Loss for Selected Month ──────────────────────────────
  const monthNetCashFlow = useMemo(() => {
    return monthTotalIncome - monthTotalExpense;
  }, [monthTotalIncome, monthTotalExpense]);

  const isNetProfit = monthNetCashFlow >= 0;

  const profitMargin = monthTotalIncome > 0
    ? Math.round((monthNetCashFlow / monthTotalIncome) * 100)
    : 0;

  // ─── 8. Unified Month Ledger Transactions (Bookings + Makkah + Manual) ─────
  const monthLedgerTransactions = useMemo(() => {
    const combined = [
      ...monthBookingEntries,
      ...monthMakkahEntries,
      ...monthManualTransactions,
    ];

    // Sort descending by date (newest first)
    combined.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      const createdA = new Date(a.createdAt || 0).getTime();
      const createdB = new Date(b.createdAt || 0).getTime();
      return createdB - createdA;
    });

    return combined;
  }, [monthBookingEntries, monthMakkahEntries, monthManualTransactions]);

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

  const deleteLedgerItem = useCallback(async (item) => {
    if (item.isManual) {
      await deleteTransaction(item.id);
    } else if (item.isMakkahRental && item.tenantId) {
      await deletePayment(item.tenantId, item.id);
    }
  }, [deleteTransaction, deletePayment]);

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

    // Transactions for active month (Unified Bookings + Makkah + Manual)
    transactions: monthLedgerTransactions,
    manualTransactions: monthManualTransactions,
    bookingEntries: monthBookingEntries,
    makkahEntries: monthMakkahEntries,
    allTransactions: transactions,
    loading: unitsLoading || makkahLoading || transactionsLoading,

    // Month isolated calculations
    monthPropertyIncome,
    monthMakkahIncome,
    monthManualIncome,
    monthTotalIncome,
    monthTotalExpense,
    monthNetCashFlow,
    isNetProfit,
    profitMargin,

    // Legacy aliases for full backward compatibility
    totalPropertyIncome: monthPropertyIncome,
    totalMakkahIncome: monthMakkahIncome,
    totalManualIncome: monthManualIncome,
    totalIncome: monthTotalIncome,
    totalExpense: monthTotalExpense,
    netCashFlow: monthNetCashFlow,

    // Actions
    addTransaction,
    deleteTransaction,
    deleteLedgerItem,
    updateTransaction,
    units,
  };
}
