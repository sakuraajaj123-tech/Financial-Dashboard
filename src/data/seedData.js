// seedData.js — Seed data for 8-unit apartment PMS
// Units: 1–8 | All Available (متاح)
// Cleared of active bookings, tenant names, and revenue data

export const BOOKING_SOURCES = {
  GATHERN: 'Gathern',
  DIRECT: 'Direct Call',
};

export const UNIT_STATUS = {
  OCCUPIED: 'Occupied',
  AVAILABLE: 'Available',
};

export const seedUnits = [
  {
    id: 'unit-1',
    number: '1',
    name: 'وحدة 1',
    floor: 1,
    bedrooms: 2,
    status: UNIT_STATUS.AVAILABLE,
    currentBookingId: null,
    bookings: [],
  },
  {
    id: 'unit-2',
    number: '2',
    name: 'وحدة 2',
    floor: 1,
    bedrooms: 1,
    status: UNIT_STATUS.AVAILABLE,
    currentBookingId: null,
    bookings: [],
  },
  {
    id: 'unit-3',
    number: '3',
    name: 'وحدة 3',
    floor: 1,
    bedrooms: 2,
    status: UNIT_STATUS.AVAILABLE,
    currentBookingId: null,
    bookings: [],
  },
  {
    id: 'unit-4',
    number: '4',
    name: 'وحدة 4',
    floor: 2,
    bedrooms: 1,
    status: UNIT_STATUS.AVAILABLE,
    currentBookingId: null,
    bookings: [],
  },
  {
    id: 'unit-5',
    number: '5',
    name: 'وحدة 5',
    floor: 2,
    bedrooms: 2,
    status: UNIT_STATUS.AVAILABLE,
    currentBookingId: null,
    bookings: [],
  },
  {
    id: 'unit-6',
    number: '6',
    name: 'وحدة 6',
    floor: 2,
    bedrooms: 1,
    status: UNIT_STATUS.AVAILABLE,
    currentBookingId: null,
    bookings: [],
  },
  {
    id: 'unit-7',
    number: '7',
    name: 'وحدة 7',
    floor: 3,
    bedrooms: 2,
    status: UNIT_STATUS.AVAILABLE,
    currentBookingId: null,
    bookings: [],
  },
  {
    id: 'unit-8',
    number: '8',
    name: 'وحدة 8',
    floor: 3,
    bedrooms: 1,
    status: UNIT_STATUS.AVAILABLE,
    currentBookingId: null,
    bookings: [],
  },
];
