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

const UNITS_COLLECTION      = 'units';
const REMINDERS_COLLECTION  = 'pending_reminders';

// ─── Build the two reminder docs for a booking ─────────────────────────────
// ISO strings sort lexicographically correctly, so the scheduled function
// can query:  where('triggerTime', '<=', now.toISOString())
function buildReminderDocs(
  bookingId,
  unitId,
  unitNumber,
  checkIn,
  checkOut,
  entryReminderMinutes = 180,
  exitReminderMinutes = 15
) {
  const entryOffsetMs = (Number(entryReminderMinutes) || 180) * 60 * 1000;
  const exitOffsetMs  = (Number(exitReminderMinutes) || 15) * 60 * 1000;

  const entryTrigger = new Date(
    new Date(checkIn).getTime() - entryOffsetMs
  ).toISOString();

  const exitTrigger = new Date(
    new Date(checkOut).getTime() - exitOffsetMs
  ).toISOString();

  return [
    {
      id:          `${bookingId}_entry`,
      data: {
        bookingId,
        unitId,
        unitNumber:           String(unitNumber),
        type:                 'entry',
        template:             'entry_reminder',
        triggerTime:          entryTrigger,
        entryReminderMinutes: Number(entryReminderMinutes) || 180,
        createdAt:            new Date().toISOString(),
      },
    },
    {
      id:          `${bookingId}_exit`,
      data: {
        bookingId,
        unitId,
        unitNumber:          String(unitNumber),
        type:                'exit',
        template:            'reminder',
        triggerTime:         exitTrigger,
        exitReminderMinutes: Number(exitReminderMinutes) || 15,
        createdAt:           new Date().toISOString(),
      },
    },
  ];
}

// ─── Pure helpers (unchanged) ──────────────────────────────────────────────

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

  // ─── Add Booking — atomic batch write ────────────────────────────────────
  // Simultaneously:
  //   1. Appends the new booking to units/{unitId}.bookings
  //   2. Creates pending_reminders/{bookingId}_entry
  //   3. Creates pending_reminders/{bookingId}_exit
  // All three succeed or all three fail — no orphaned reminders possible.
  const addBooking = useCallback(async (unitId, bookingData) => {
    const newBooking = {
      id:                   generateId(),
      tenantName:           bookingData.tenantName,
      phone:                bookingData.phone,
      source:               bookingData.source || BOOKING_SOURCES.DIRECT,
      // Full ISO 8601 strings (date + time) for accurate reminder scheduling
      checkIn:              bookingData.checkIn,
      checkOut:             bookingData.checkOut,
      // Store the time-of-day separately for quick display/reference
      checkInTime:          bookingData.checkInTime  || '16:00',
      checkOutTime:         bookingData.checkOutTime || '13:00',
      // Reminder offsets in minutes (defaults: 180 min = 3h, 15 min)
      entryReminderMinutes: Number(bookingData.entryReminderMinutes) || 180,
      exitReminderMinutes:  Number(bookingData.exitReminderMinutes)  || 15,
      amount:               Number(bookingData.amount),
      notes:                bookingData.notes || '',
    };

    // Resolve the unit number for reminder docs (need unit from current state)
    // unitNumber is not passed in bookingData — look it up from the units collection
    try {
      const unitRef  = doc(db, UNITS_COLLECTION, unitId);
      const unitSnap = await getDoc(unitRef);
      const unitNumber = unitSnap.exists() ? (unitSnap.data().number ?? unitId) : unitId;

      // Build the two reminder descriptors with custom or default offsets
      const reminderDocs = buildReminderDocs(
        newBooking.id,
        unitId,
        unitNumber,
        newBooking.checkIn,
        newBooking.checkOut,
        newBooking.entryReminderMinutes,
        newBooking.exitReminderMinutes
      );

      // Atomic batch: booking write + 2 reminder writes
      const batch = writeBatch(db);

      // 1. Append booking to unit
      batch.update(unitRef, { bookings: arrayUnion(newBooking) });

      // 2 & 3. Create reminder docs
      for (const reminder of reminderDocs) {
        const reminderRef = doc(db, REMINDERS_COLLECTION, reminder.id);
        batch.set(reminderRef, reminder.data);
      }

      await batch.commit();
      console.log(`[PMS] Booking ${newBooking.id} added with ${reminderDocs.length} reminders (atomic batch).`);
    } catch (err) {
      console.error('[PMS] Failed to add booking (batch):', err);
      throw err; // re-throw so callers can surface the error
    }
  }, []);

  // ─── Delete Booking — atomic batch write ─────────────────────────────────
  // Simultaneously:
  //   1. Removes the booking from units/{unitId}.bookings array
  //   2. Deletes pending_reminders/{bookingId}_entry
  //   3. Deletes pending_reminders/{bookingId}_exit
  // All three succeed or all three fail — no orphaned reminder docs possible.
  const deleteBooking = useCallback(async (unitId, bookingId) => {
    try {
      const unitRef = doc(db, UNITS_COLLECTION, unitId);

      // Read is always required before a batch array-rewrite
      const snap = await getDoc(unitRef);
      if (!snap.exists()) return;

      const currentBookings = snap.data().bookings || [];
      const filtered = currentBookings.filter((b) => b.id !== bookingId);

      // Atomic batch: booking removal + 2 reminder deletions
      const batch = writeBatch(db);

      // 1. Overwrite bookings array without the deleted booking
      batch.update(unitRef, { bookings: filtered });

      // 2 & 3. Delete both reminder docs (they may already be gone if they fired — that's fine)
      batch.delete(doc(db, REMINDERS_COLLECTION, `${bookingId}_entry`));
      batch.delete(doc(db, REMINDERS_COLLECTION, `${bookingId}_exit`));

      await batch.commit();
      console.log(`[PMS] Booking ${bookingId} deleted with reminders (atomic batch).`);
    } catch (err) {
      console.error('[PMS] Failed to delete booking (batch):', err);
    }
  }, []);

  // ─── Update Booking — atomic batch write ─────────────────────────────────
  // Simultaneously:
  //   1. Updates the booking in units/{unitId}.bookings
  //   2. Updates/overwrites pending_reminders/{bookingId}_entry
  //   3. Updates/overwrites pending_reminders/{bookingId}_exit
  const updateBooking = useCallback(async (unitId, bookingId, updatedData) => {
    try {
      const unitRef  = doc(db, UNITS_COLLECTION, unitId);
      const unitSnap = await getDoc(unitRef);
      if (!unitSnap.exists()) return;

      const currentBookings = unitSnap.data().bookings || [];
      const updatedBookings = currentBookings.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            tenantName:           updatedData.tenantName,
            phone:                updatedData.phone,
            source:               updatedData.source || BOOKING_SOURCES.DIRECT,
            checkIn:              updatedData.checkIn,
            checkOut:             updatedData.checkOut,
            checkInTime:          updatedData.checkInTime  || '16:00',
            checkOutTime:         updatedData.checkOutTime || '13:00',
            entryReminderMinutes: Number(updatedData.entryReminderMinutes) || 180,
            exitReminderMinutes:  Number(updatedData.exitReminderMinutes)  || 15,
            amount:               Number(updatedData.amount),
            notes:                updatedData.notes || '',
          };
        }
        return b;
      });

      const unitNumber = unitSnap.data().number ?? unitId;

      // Re-build reminders for this booking with the updated dates/times
      const reminderDocs = buildReminderDocs(
        bookingId,
        unitId,
        unitNumber,
        updatedData.checkIn,
        updatedData.checkOut,
        updatedData.entryReminderMinutes,
        updatedData.exitReminderMinutes
      );

      const batch = writeBatch(db);

      // 1. Update unit bookings array
      batch.update(unitRef, { bookings: updatedBookings });

      // 2 & 3. Overwrite reminder docs
      for (const reminder of reminderDocs) {
        const reminderRef = doc(db, REMINDERS_COLLECTION, reminder.id);
        batch.set(reminderRef, reminder.data);
      }

      await batch.commit();
      console.log(`[PMS] Booking ${bookingId} updated with reminders (atomic batch).`);
    } catch (err) {
      console.error('[PMS] Failed to update booking (batch):', err);
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
