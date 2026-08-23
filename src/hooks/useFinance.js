// useFinance.js — Central state management hook for Personal & Business Cash Flow
// Manages manual transactions in Firestore and calculates dynamic Total Property Income from useUnits.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { useUnits } from './useUnits';

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

const DEFAULT_CATEGORY_COLOR = '#a855f7';

export function useFinance() {
  const { units, loading: unitsLoading } = useUnits();
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // ─── Real-time Firestore transactions subscription ───────────────────────
  useEffect(() => {
    const colRef = collection(db, TRANSACTIONS_COLLECTION);

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const live = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          amount: Number(d.data().amount) || 0,
        }));

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

  // ─── Dynamic Property Income calculation from all unit bookings ───────────
  const totalPropertyIncome = useMemo(() => {
    return units.reduce((total, unit) => {
      const unitBookingsSum = (unit.bookings || []).reduce((sum, b) => {
        return sum + (Number(b.amount) || 0);
      }, 0);
      return total + unitBookingsSum;
    }, 0);
  }, [units]);

  // ─── Manual Income Sum ──────────────────────────────────────────────────
  const totalManualIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  // ─── Grand Total Income (Property Bookings + Manual Entries) ─────────────
  const totalIncome = useMemo(() => {
    return totalPropertyIncome + totalManualIncome;
  }, [totalPropertyIncome, totalManualIncome]);

  // ─── Total Expenses Sum ─────────────────────────────────────────────────
  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  // ─── Net Cash Flow ──────────────────────────────────────────────────────
  const netCashFlow = useMemo(() => {
    return totalIncome - totalExpense;
  }, [totalIncome, totalExpense]);

  // ─── Expenses by Category Breakdown (for PieChart & analytics) ──────────
  const expensesByCategory = useMemo(() => {
    const expenseTx = transactions.filter((t) => t.type === 'expense');
    if (expenseTx.length === 0 || totalExpense === 0) return [];

    const map = {};
    expenseTx.forEach((t) => {
      const cat = t.category || 'other';
      map[cat] = (map[cat] || 0) + (Number(t.amount) || 0);
    });

    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        value: amount,
        percentage: Math.round((amount / totalExpense) * 100),
        color: CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, totalExpense]);

  // ─── Mutations: Add, Delete, Update ─────────────────────────────────────
  const addTransaction = useCallback(async (transactionData) => {
    try {
      const colRef = collection(db, TRANSACTIONS_COLLECTION);
      const newEntry = {
        title: transactionData.title?.trim() || 'Untitled Transaction',
        type: transactionData.type === 'income' ? 'income' : 'expense',
        amount: Number(transactionData.amount) || 0,
        date: transactionData.date || new Date().toISOString().slice(0, 10),
        frequency: transactionData.frequency || 'one-time',
        category: transactionData.category || 'other',
        createdAt: new Date().toISOString(),
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
      await updateDoc(docRef, {
        ...updatedData,
        amount: Number(updatedData.amount) || 0,
        updatedAt: new Date().toISOString(),
      });
      console.log(`[Finance] ✅ Transaction updated: ${transactionId}`);
    } catch (err) {
      console.error('[Finance] ❌ Failed to update transaction:', err);
      throw err;
    }
  }, []);

  return {
    transactions,
    loading: unitsLoading || transactionsLoading,
    totalPropertyIncome,
    totalManualIncome,
    totalIncome,
    totalExpense,
    netCashFlow,
    expensesByCategory,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    units,
  };
}
