// useMakkahRentals.js — State management and Firestore synchronization for Makkah Building Rentals
// Manages tenants, dynamic due date calculations, status badges, and collection 'makkah_tenants'.

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
import { addMonths, format, parseISO, differenceInDays, startOfDay, isValid } from 'date-fns';

const MAKKAH_COLLECTION = 'makkah_tenants';

/**
 * Calculates nextDueDate, status, and days difference dynamically
 * @param {string} lastPaidDate - YYYY-MM-DD
 * @param {number|string} intervalMonths - 1, 3, 6, 12
 */
export function calculateRentalSchedule(lastPaidDate, intervalMonths) {
  try {
    const interval = Number(intervalMonths) || 1;
    let parsedLastPaid;

    if (lastPaidDate) {
      parsedLastPaid = parseISO(lastPaidDate);
    }

    if (!parsedLastPaid || !isValid(parsedLastPaid)) {
      parsedLastPaid = new Date();
    }

    const dueDateObj = addMonths(parsedLastPaid, interval);
    const nextDueDate = format(dueDateObj, 'yyyy-MM-dd');

    const today = startOfDay(new Date());
    const dueDay = startOfDay(dueDateObj);
    const dayDiff = differenceInDays(dueDay, today);

    const isOverdue = dayDiff < 0;
    const isDueToday = dayDiff === 0;
    const daysOverdue = isOverdue ? Math.abs(dayDiff) : 0;
    const daysLeft = dayDiff >= 0 ? dayDiff : 0;

    return {
      nextDueDate,
      dueDateObj,
      isOverdue,
      isDueToday,
      daysOverdue,
      daysLeft,
      status: isOverdue ? 'overdue' : 'paid',
    };
  } catch (err) {
    console.error('Error calculating rental schedule:', err);
    return {
      nextDueDate: lastPaidDate || format(new Date(), 'yyyy-MM-dd'),
      dueDateObj: new Date(),
      isOverdue: false,
      isDueToday: false,
      daysOverdue: 0,
      daysLeft: 0,
      status: 'paid',
    };
  }
}

export function useMakkahRentals() {
  const [rawTenants, setRawTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── Real-time Firestore Subscription ─────────────────────────────────────
  useEffect(() => {
    const colRef = collection(db, MAKKAH_COLLECTION);

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        setRawTenants(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[MakkahRentals] Firestore snapshot error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ─── Enriched Tenants with dynamic calculations & sorting ─────────────────
  const tenants = useMemo(() => {
    const enriched = rawTenants.map((t) => {
      const interval = Number(t.paymentIntervalMonths) || 1;
      const rentAmount = Number(t.rentAmount) || 0;
      const schedule = calculateRentalSchedule(t.lastPaidDate, interval);

      return {
        ...t,
        rentAmount,
        paymentIntervalMonths: interval,
        ...schedule,
      };
    });

    // Sort priority: Overdue first (most overdue first), then upcoming due dates (soonest first)
    enriched.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.isOverdue && b.isOverdue) {
        return b.daysOverdue - a.daysOverdue;
      }
      return a.daysLeft - b.daysLeft;
    });

    return enriched;
  }, [rawTenants]);

  // ─── KPI Metrics ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalUnits = tenants.length;
    const totalRentValue = tenants.reduce((sum, t) => sum + (t.rentAmount || 0), 0);

    const overdueTenants = tenants.filter((t) => t.isOverdue);
    const overdueCount = overdueTenants.length;
    const overdueAmount = overdueTenants.reduce((sum, t) => sum + (t.rentAmount || 0), 0);

    const paidTenants = tenants.filter((t) => !t.isOverdue);
    const paidCount = paidTenants.length;
    const paidPercentage = totalUnits > 0 ? Math.round((paidCount / totalUnits) * 100) : 0;

    return {
      totalUnits,
      totalRentValue,
      overdueCount,
      overdueAmount,
      paidCount,
      paidPercentage,
    };
  }, [tenants]);

  // ─── Mutations ────────────────────────────────────────────────────────────
  const addTenant = useCallback(async (tenantData) => {
    try {
      const colRef = collection(db, MAKKAH_COLLECTION);
      const lastPaidDate = tenantData.lastPaidDate || format(new Date(), 'yyyy-MM-dd');
      const parsedLastPaid = parseISO(lastPaidDate);
      const validLastPaid = isValid(parsedLastPaid) ? parsedLastPaid : new Date();
      const expireDate = addMonths(validLastPaid, 24);

      const newEntry = {
        name: tenantData.name?.trim() || 'مستأجر بدون اسم',
        phone: tenantData.phone?.trim() || '',
        unitNumber: tenantData.unitNumber?.trim() || '',
        rentAmount: Number(tenantData.rentAmount) || 0,
        paymentIntervalMonths: Number(tenantData.paymentIntervalMonths) || 1,
        lastPaidDate,
        notes: tenantData.notes?.trim() || '',
        createdAt: new Date().toISOString(),
        expireAt: Timestamp.fromDate(expireDate),
      };

      const docRef = await addDoc(colRef, newEntry);
      console.log(`[MakkahRentals] ✅ Tenant added with ID: ${docRef.id}`);
      return docRef.id;
    } catch (err) {
      console.error('[MakkahRentals] ❌ Failed to add tenant:', err);
      throw err;
    }
  }, []);

  const updateTenant = useCallback(async (tenantId, updatedData) => {
    try {
      const docRef = doc(db, MAKKAH_COLLECTION, tenantId);
      const updates = {
        ...updatedData,
        rentAmount: Number(updatedData.rentAmount) || 0,
        paymentIntervalMonths: Number(updatedData.paymentIntervalMonths) || 1,
        updatedAt: new Date().toISOString(),
      };

      if (updatedData.lastPaidDate) {
        const parsed = parseISO(updatedData.lastPaidDate);
        const valid = isValid(parsed) ? parsed : new Date();
        updates.expireAt = Timestamp.fromDate(addMonths(valid, 24));
      }

      await updateDoc(docRef, updates);
      console.log(`[MakkahRentals] ✅ Tenant updated: ${tenantId}`);
    } catch (err) {
      console.error('[MakkahRentals] ❌ Failed to update tenant:', err);
      throw err;
    }
  }, []);

  const deleteTenant = useCallback(async (tenantId) => {
    try {
      const docRef = doc(db, MAKKAH_COLLECTION, tenantId);
      await deleteDoc(docRef);
      console.log(`[MakkahRentals] ✅ Tenant deleted: ${tenantId}`);
    } catch (err) {
      console.error('[MakkahRentals] ❌ Failed to delete tenant:', err);
      throw err;
    }
  }, []);

  const markAsPaid = useCallback(async (tenantId, customDate = null) => {
    try {
      const dateToSet = customDate || format(new Date(), 'yyyy-MM-dd');
      const docRef = doc(db, MAKKAH_COLLECTION, tenantId);
      await updateDoc(docRef, {
        lastPaidDate: dateToSet,
        updatedAt: new Date().toISOString(),
      });
      console.log(`[MakkahRentals] ✅ Tenant ${tenantId} marked as paid on ${dateToSet}`);
    } catch (err) {
      console.error('[MakkahRentals] ❌ Failed to mark tenant as paid:', err);
      throw err;
    }
  }, []);

  return {
    tenants,
    loading,
    error,
    kpis,
    addTenant,
    updateTenant,
    deleteTenant,
    markAsPaid,
  };
}
