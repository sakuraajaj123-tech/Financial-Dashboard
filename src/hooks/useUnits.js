// useUnits.js — Central state management hook for the PMS
// Manages units, bookings, KPI calculations, and booking mutations
// Data is persisted in Firestore and synced in real-time across devices

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { seedUnits, UNIT_STATUS, BOOKING_SOURCES } from '../data/seedData';
import { isWithinInterval, parseISO, isAfter, isBefore, format } from 'date-fns';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';

const UNITS_COLLECTION = 'units';
const REMINDERS_COLLECTION = 'pending_reminders';

// ─── Pure helpers ──────────────────────────────────────────────────────────

function computeCurrentBooking(unit) {
  const today = new Date();
  return (
    unit.bookings.find((b) => {
      const checkIn = parseISO(b.checkIn);
      const checkOut = parseISO(b.checkOut);
      return isWithinInterval(today, { start: checkIn, end: checkOut });
    }) || null
  );
}

function enrichUnit(raw) {
  const bookings = raw.bookings || [];
  const unit = { ...raw, bookings };
  const activeBooking = computeCurrentBooking(unit);
  return {
    ...unit,
    status: activeBooking ? UNIT_STATUS.OCCUPIED : UNIT_STATUS.AVAILABLE,
    currentBookingId: activeBooking ? activeBooking.id : null,
  };
}

function generateId() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Calculates exact ISO timestamp for when a reminder should trigger.
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} timeStr 'HH:mm'
 * @param {number} offsetMinutes Minutes before the event to trigger
 * @returns {string} ISO date string in UTC
 */
export function calculateTriggerTime(dateStr, timeStr = '16:00', offsetMinutes = 0) {
  if (!dateStr) return new Date().toISOString();
  const time = timeStr || '12:00';
  const localDate = new Date(`${dateStr}T${time}:00`);
  const triggerMs = localDate.getTime() - Number(offsetMinutes || 0) * 60 * 1000;
  return new Date(triggerMs).toISOString();
}

// ─── Seed Firestore with default units if collection is empty ─────────────

async function seedFirestoreIfEmpty() {
  // Check if at least one unit exists
  const firstRef = doc(db, UNITS_COLLECTION, seedUnits[0].id);
  const firstSnap = await getDoc(firstRef);

  if (!firstSnap.exists()) {
    console.log('[PMS] Seeding Firestore with default units…');
    const promises = seedUnits.map((unit) => {
      const { status, currentBookingId, ...data } = unit;
      return setDoc(doc(db, UNITS_COLLECTION, unit.id), data);
    });
    await Promise.all(promises);
    console.log('[PMS] Seed complete — 8 units written.');
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useUnits() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  // ─── Real-time Firestore subscription ──────────────────────────────────
  useEffect(() => {
    let unsubscribe = () => {};

    async function init() {
      // Seed once if the collection doesn't exist yet
      if (!seededRef.current) {
        seededRef.current = true;
        try {
          await seedFirestoreIfEmpty();
        } catch (err) {
          console.error('[PMS] Seed failed:', err);
        }
      }

      // Subscribe to real-time updates
      const colRef = collection(db, UNITS_COLLECTION);
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const live = snapshot.docs
            .map((d) => enrichUnit({ id: d.id, ...d.data() }))
            .sort((a, b) => Number(a.number) - Number(b.number));
          setUnits(live);
          setLoading(false);
        },
        (err) => {
          console.error('[PMS] Firestore snapshot error:', err);
          setLoading(false);
        }
      );
    }

    init();
    return () => unsubscribe();
  }, []);

  // ─── KPI Calculations (unchanged logic) ────────────────────────────────
  const kpis = useMemo(() => {
    const totalUnits = units.length;
    if (totalUnits === 0) {
      return {
        totalUnits: 0, occupiedUnits: 0, availableUnits: 0, occupancyRate: 0,
        monthlyRevenue: 0, gathernBookings: 0, directBookings: 0,
        gathernPct: 0, directPct: 0, totalBookings: 0,
      };
    }

    const occupiedUnits = units.filter((u) => u.status === UNIT_STATUS.OCCUPIED).length;
    const availableUnits = totalUnits - occupiedUnits;
    const occupancyRate = Math.round((occupiedUnits / totalUnits) * 100);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let monthlyRevenue = 0;
    let gathernBookings = 0;
    let directBookings = 0;
    let totalBookings = 0;

    units.forEach((unit) => {
      unit.bookings.forEach((b) => {
        const checkIn = parseISO(b.checkIn);
        const checkOut = parseISO(b.checkOut);

        totalBookings++;
        if (b.source === BOOKING_SOURCES.GATHERN) gathernBookings++;
        else directBookings++;

        const overlaps = isBefore(checkIn, monthEnd) && isAfter(checkOut, monthStart);
        if (overlaps) {
          monthlyRevenue += b.amount;
        }
      });
    });

    const gathernPct = totalBookings > 0 ? Math.round((gathernBookings / totalBookings) * 100) : 0;
    const directPct = totalBookings > 0 ? Math.round((directBookings / totalBookings) * 100) : 0;

    return {
      totalUnits, occupiedUnits, availableUnits, occupancyRate,
      monthlyRevenue, gathernBookings, directBookings,
      gathernPct, directPct, totalBookings,
    };
  }, [units]);

  // ─── Add Booking (Firestore Atomic Batch) ─────────────────────────────
  const addBooking = useCallback(async (unitId, bookingData) => {
    const bookingId = generateId();
    const checkInTime = bookingData.checkInTime || '16:00';
    const checkOutTime = bookingData.checkOutTime || '13:00';
    const entryReminderMinutes = Number(bookingData.entryReminderMinutes ?? 180);
    const exitReminderMinutes = Number(bookingData.exitReminderMinutes ?? 15);

    const newBooking = {
      id: bookingId,
      tenantName: bookingData.tenantName,
      phone: bookingData.phone,
      source: bookingData.source || BOOKING_SOURCES.DIRECT,
      checkIn: bookingData.checkIn,
      checkInTime,
      checkOut: bookingData.checkOut,
      checkOutTime,
      entryReminderMinutes,
      exitReminderMinutes,
      amount: Number(bookingData.amount) || 0,
      notes: bookingData.notes || '',
    };

    try {
      const unitRef = doc(db, UNITS_COLLECTION, unitId);
      const unitSnap = await getDoc(unitRef);
      const unitData = unitSnap.exists() ? unitSnap.data() : {};
      const unitNumber = String(unitData.number || '');

      const entryTrigger = calculateTriggerTime(newBooking.checkIn, checkInTime, entryReminderMinutes);
      const exitTrigger = calculateTriggerTime(newBooking.checkOut, checkOutTime, exitReminderMinutes);

      const batch = writeBatch(db);

      // 1. Update unit bookings array
      batch.update(unitRef, {
        bookings: arrayUnion(newBooking),
      });

      // 2. Add pending entry reminder
      const entryRef = doc(db, REMINDERS_COLLECTION, `${bookingId}_entry`);
      batch.set(entryRef, {
        id: `${bookingId}_entry`,
        bookingId,
        unitId,
        unitNumber,
        type: 'entry',
        template: 'entry_reminder',
        triggerTime: entryTrigger,
        tenantName: newBooking.tenantName,
        phone: newBooking.phone,
        checkIn: newBooking.checkIn,
        checkInTime,
        createdAt: new Date().toISOString(),
      });

      // 3. Add pending exit reminder
      const exitRef = doc(db, REMINDERS_COLLECTION, `${bookingId}_exit`);
      batch.set(exitRef, {
        id: `${bookingId}_exit`,
        bookingId,
        unitId,
        unitNumber,
        type: 'exit',
        template: 'reminder',
        triggerTime: exitTrigger,
        tenantName: newBooking.tenantName,
        phone: newBooking.phone,
        checkOut: newBooking.checkOut,
        checkOutTime,
        createdAt: new Date().toISOString(),
      });

      await batch.commit();
      console.log(`[PMS] ✅ Booking & reminders atomically created for Unit ${unitNumber}`);
    } catch (err) {
      console.error('[PMS] ❌ Failed to add booking atomically:', err);
      throw err;
    }
  }, []);

  // ─── Update Booking (Firestore Atomic Batch) ──────────────────────────
  const updateBooking = useCallback(async (unitId, bookingId, updatedData) => {
    const checkInTime = updatedData.checkInTime || '16:00';
    const checkOutTime = updatedData.checkOutTime || '13:00';
    const entryReminderMinutes = Number(updatedData.entryReminderMinutes ?? 180);
    const exitReminderMinutes = Number(updatedData.exitReminderMinutes ?? 15);

    const updatedBooking = {
      id: bookingId,
      tenantName: updatedData.tenantName,
      phone: updatedData.phone,
      source: updatedData.source || BOOKING_SOURCES.DIRECT,
      checkIn: updatedData.checkIn,
      checkInTime,
      checkOut: updatedData.checkOut,
      checkOutTime,
      entryReminderMinutes,
      exitReminderMinutes,
      amount: Number(updatedData.amount) || 0,
      notes: updatedData.notes || '',
    };

    try {
      const unitRef = doc(db, UNITS_COLLECTION, unitId);
      const unitSnap = await getDoc(unitRef);
      if (!unitSnap.exists()) return;

      const unitData = unitSnap.data();
      const currentBookings = unitData.bookings || [];
      const updatedBookings = currentBookings.map((b) => (b.id === bookingId ? updatedBooking : b));
      const unitNumber = String(unitData.number || '');

      const entryTrigger = calculateTriggerTime(updatedBooking.checkIn, checkInTime, entryReminderMinutes);
      const exitTrigger = calculateTriggerTime(updatedBooking.checkOut, checkOutTime, exitReminderMinutes);

      const batch = writeBatch(db);

      // 1. Update unit bookings array
      batch.update(unitRef, { bookings: updatedBookings });

      // 2. Overwrite pending entry reminder
      const entryRef = doc(db, REMINDERS_COLLECTION, `${bookingId}_entry`);
      batch.set(entryRef, {
        id: `${bookingId}_entry`,
        bookingId,
        unitId,
        unitNumber,
        type: 'entry',
        template: 'entry_reminder',
        triggerTime: entryTrigger,
        tenantName: updatedBooking.tenantName,
        phone: updatedBooking.phone,
        checkIn: updatedBooking.checkIn,
        checkInTime,
        updatedAt: new Date().toISOString(),
      });

      // 3. Overwrite pending exit reminder
      const exitRef = doc(db, REMINDERS_COLLECTION, `${bookingId}_exit`);
      batch.set(exitRef, {
        id: `${bookingId}_exit`,
        bookingId,
        unitId,
        unitNumber,
        type: 'exit',
        template: 'reminder',
        triggerTime: exitTrigger,
        tenantName: updatedBooking.tenantName,
        phone: updatedBooking.phone,
        checkOut: updatedBooking.checkOut,
        checkOutTime,
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      console.log(`[PMS] ✅ Booking & reminders atomically updated for Unit ${unitNumber}`);
    } catch (err) {
      console.error('[PMS] ❌ Failed to update booking atomically:', err);
      throw err;
    }
  }, []);

  // ─── Delete Booking (Firestore Atomic Batch) ──────────────────────────
  const deleteBooking = useCallback(async (unitId, bookingId) => {
    try {
      const unitRef = doc(db, UNITS_COLLECTION, unitId);
      const snap = await getDoc(unitRef);
      if (!snap.exists()) return;

      const currentBookings = snap.data().bookings || [];
      const filtered = currentBookings.filter((b) => b.id !== bookingId);

      const batch = writeBatch(db);
      // 1. Remove from unit bookings
      batch.update(unitRef, { bookings: filtered });

      // 2. Delete pending entry & exit reminders
      const entryRef = doc(db, REMINDERS_COLLECTION, `${bookingId}_entry`);
      const exitRef = doc(db, REMINDERS_COLLECTION, `${bookingId}_exit`);
      batch.delete(entryRef);
      batch.delete(exitRef);

      await batch.commit();
      console.log(`[PMS] ✅ Booking & associated reminders deleted for ID ${bookingId}`);
    } catch (err) {
      console.error('[PMS] ❌ Failed to delete booking atomically:', err);
      throw err;
    }
  }, []);

  // ─── Get unit by ID ────────────────────────────────────────────────────
  const getUnit = useCallback(
    (unitId) => units.find((u) => u.id === unitId) || null,
    [units]
  );

  // ─── Get current tenant for a unit ────────────────────────────────────
  const getCurrentTenant = useCallback(
    (unit) => {
      if (!unit.currentBookingId) return null;
      return unit.bookings.find((b) => b.id === unit.currentBookingId) || null;
    },
    []
  );

  // ─── Get monthly revenue data per unit (for charts) ───────────────────
  const getUnitMonthlyRevenue = useCallback((unit) => {
    const months = {};
    unit.bookings.forEach((b) => {
      const key = format(parseISO(b.checkIn), 'MMM yy');
      months[key] = (months[key] || 0) + b.amount;
    });
    return Object.entries(months).map(([month, revenue]) => ({ month, revenue }));
  }, []);

  // ─── Get source split for a unit ──────────────────────────────────────
  const getUnitSourceSplit = useCallback((unit) => {
    const total = unit.bookings.length;
    if (total === 0) return [];
    const gathern = unit.bookings.filter((b) => b.source === BOOKING_SOURCES.GATHERN).length;
    const direct = total - gathern;
    return [
      { name: 'Gathern', value: gathern, pct: Math.round((gathern / total) * 100) },
      { name: 'Direct Call', value: direct, pct: Math.round((direct / total) * 100) },
    ];
  }, []);

  // ─── Get monthly revenue data across all units (portfolio charts) ────
  const getPortfolioMonthlyRevenue = useCallback(() => {
    const months = {};
    units.forEach((unit) => {
      unit.bookings.forEach((b) => {
        const key = format(parseISO(b.checkIn), 'MMM yy');
        months[key] = (months[key] || 0) + b.amount;
      });
    });
    return Object.entries(months).map(([month, revenue]) => ({ month, revenue }));
  }, [units]);

  // ─── Get source split across all units (portfolio charts) ────────────
  const getPortfolioSourceSplit = useCallback(() => {
    let gathern = 0;
    let direct = 0;
    let total = 0;
    units.forEach((unit) => {
      unit.bookings.forEach((b) => {
        total++;
        if (b.source === BOOKING_SOURCES.GATHERN) gathern++;
        else direct++;
      });
    });
    if (total === 0) return [];
    return [
      { name: 'Gathern', value: gathern, pct: Math.round((gathern / total) * 100) },
      { name: 'Direct Call', value: direct, pct: Math.round((direct / total) * 100) },
    ];
  }, [units]);

  return {
    units,
    kpis,
    loading,
    addBooking,
    updateBooking,
    deleteBooking,
    getUnit,
    getCurrentTenant,
    getUnitMonthlyRevenue,
    getUnitSourceSplit,
    getPortfolioMonthlyRevenue,
    getPortfolioSourceSplit,
  };
}
