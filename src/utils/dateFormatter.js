// src/utils/dateFormatter.js
// Universal date and source localization helpers supporting Arabic (with Latin numerals) and English

import { parseISO, isValid } from 'date-fns';

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const ENGLISH_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const ENGLISH_FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toValidDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isValid(dateInput) ? dateInput : null;
  if (typeof dateInput === 'string') {
    const parsed = parseISO(dateInput);
    if (isValid(parsed)) return parsed;
    const fromDate = new Date(dateInput);
    if (isValid(fromDate)) return fromDate;
  }
  if (typeof dateInput === 'number') {
    const fromNum = new Date(dateInput > 1e11 ? dateInput : dateInput * 1000);
    if (isValid(fromNum)) return fromNum;
  }
  return null;
}

/**
 * Format date for booking tables & cards
 * Example: '2026-08-23' -> 'Aug 23, 2026' (EN) or '23 أغسطس 2026' (AR)
 */
export function formatBookingDate(dateInput, isArabic = false) {
  const d = toValidDate(dateInput);
  if (!d) return typeof dateInput === 'string' ? dateInput : '—';

  const day = d.getDate();
  const monthIdx = d.getMonth();
  const year = d.getFullYear();

  if (isArabic) {
    return `${day} ${ARABIC_MONTHS[monthIdx]} ${year}`;
  }
  return `${ENGLISH_MONTHS[monthIdx]} ${day}, ${year}`;
}

/**
 * Format month and 2-digit year for charts
 * Example: '2026-08-23' -> 'Aug 26' (EN) or 'أغسطس 26' (AR)
 */
export function formatMonthYear(dateInput, isArabic = false) {
  const d = toValidDate(dateInput);
  if (!d) return typeof dateInput === 'string' ? dateInput : '';

  const monthIdx = d.getMonth();
  const yearShort = String(d.getFullYear()).slice(2);

  if (isArabic) {
    return `${ARABIC_MONTHS[monthIdx]} ${yearShort}`;
  }
  return `${ENGLISH_MONTHS[monthIdx]} ${yearShort}`;
}

/**
 * Format full month and year
 * Example: 'August 2026' (EN) or 'أغسطس 2026' (AR)
 */
export function formatFullMonthYear(dateInput, isArabic = false) {
  const d = toValidDate(dateInput);
  if (!d) return typeof dateInput === 'string' ? dateInput : '';

  const monthIdx = d.getMonth();
  const year = d.getFullYear();

  if (isArabic) {
    return `${ARABIC_MONTHS[monthIdx]} ${year}`;
  }
  return `${ENGLISH_FULL_MONTHS[monthIdx]} ${year}`;
}

/**
 * Format date with time for reminder queues
 * Example: '2026-08-23T16:00:00' -> 'Aug 23, 2026 · 04:00 PM' (EN) or '23 أغسطس 2026 · 04:00 م' (AR)
 */
export function formatDateTime(dateInput, isArabic = false) {
  const d = toValidDate(dateInput);
  if (!d) return typeof dateInput === 'string' ? dateInput : '—';

  const datePart = formatBookingDate(d, isArabic);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const isPM = hours >= 12;
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');

  const period = isArabic ? (isPM ? 'م' : 'ص') : (isPM ? 'PM' : 'AM');
  return `${datePart} · ${hoursStr}:${minutes} ${period}`;
}

/**
 * Format booking source name according to active language
 */
export function formatSource(source, isArabic = false) {
  if (!source) return '';
  const s = String(source).toLowerCase().trim();
  if (s === 'direct call' || s === 'direct' || s === 'اتصال مباشر') {
    return isArabic ? 'اتصال مباشر' : 'Direct Call';
  }
  if (s === 'gathern' || s === 'جاذرن') {
    return isArabic ? 'جاذرن' : 'Gathern';
  }
  return source;
}

/**
 * Format payment interval in Arabic or English with proper grammar
 * @param {number|string} intervalMonths
 * @param {boolean} isArabic
 */
export function formatPaymentInterval(intervalMonths, isArabic = false) {
  const num = Number(intervalMonths) || 1;
  if (isArabic) {
    if (num === 1) return 'شهري (شهر واحد)';
    if (num === 2) return 'كل شهرين (شهران)';
    if (num === 3) return 'كل 3 أشهر (ربع سنوي)';
    if (num === 4) return 'كل 4 أشهر';
    if (num === 6) return 'كل 6 أشهر (نصف سنوي)';
    if (num === 12) return 'سنوي (12 شهر)';
    if (num >= 3 && num <= 10) return `كل ${num} أشهر`;
    return `كل ${num} شهراً`;
  }
  if (num === 1) return 'Monthly (1 Month)';
  if (num === 2) return 'Every 2 Months';
  if (num === 3) return 'Every 3 Months (Quarterly)';
  if (num === 4) return 'Every 4 Months';
  if (num === 6) return 'Every 6 Months (Semi-Annual)';
  if (num === 12) return 'Annually (12 Months)';
  return `Every ${num} Months`;
}

