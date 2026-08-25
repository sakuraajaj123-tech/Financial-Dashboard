// src/utils/hijriCalendar.js
// Umm al-Qura Hijri calendar utilities, conversion, grid generation, and dual-calendar helpers.

import { parseISO, isValid, format, isToday as isFnsToday } from 'date-fns';

export const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الثاني',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi\' al-Awwal',
  'Rabi\' al-Thani',
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  'Sha\'ban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qi\'dah',
  'Dhu al-Hijjah',
];

export const DAY_NAMES_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
export const DAY_NAMES_SHORT_AR = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
export const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_SHORT_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Convert any date input into a valid JavaScript Date at midday (to avoid timezone shifts)
 */
export function toMiddayDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    if (!isValid(dateInput)) return new Date();
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0);
  }
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    if (cleanStr.includes('T')) {
      const p = parseISO(cleanStr);
      if (isValid(p)) return new Date(p.getFullYear(), p.getMonth(), p.getDate(), 12, 0, 0);
    }
    const parts = cleanStr.split(/[-/]/);
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d, 12, 0, 0);
    }
    const d = new Date(cleanStr);
    if (isValid(d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput > 1e11 ? dateInput : dateInput * 1000);
    if (isValid(d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }
  return new Date();
}

/**
 * Extract Hijri date parts (day, month 1-12, year) using native Intl API
 */
export function getHijriParts(dateInput) {
  const d = toMiddayDate(dateInput);
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(d);
    let day = 1;
    let month = 1;
    let year = 1448;
    for (const p of parts) {
      if (p.type === 'day') day = parseInt(p.value, 10);
      if (p.type === 'month') month = parseInt(p.value, 10);
      if (p.type === 'year') year = parseInt(p.value, 10);
    }
    const monthIndex = Math.max(0, Math.min(11, month - 1));
    return {
      day,
      month,
      monthIndex,
      year,
      monthNameAr: HIJRI_MONTHS_AR[monthIndex],
      monthNameEn: HIJRI_MONTHS_EN[monthIndex],
    };
  } catch (err) {
    console.error('Hijri conversion error:', err);
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      monthIndex: d.getMonth(),
      year: 1448,
      monthNameAr: HIJRI_MONTHS_AR[0],
      monthNameEn: HIJRI_MONTHS_EN[0],
    };
  }
}

/**
 * Find the Gregorian start Date of the Hijri month containing dateInput
 */
export function getHijriMonthStart(dateInput) {
  const d = toMiddayDate(dateInput);
  const { month, year } = getHijriParts(d);
  let cur = new Date(d.getTime());
  // Step backwards one day at a time until previous day is in a different Hijri month
  while (true) {
    const prev = new Date(cur.getTime() - 86400000);
    const p = getHijriParts(prev);
    if (p.month !== month || p.year !== year) break;
    cur = prev;
  }
  return cur;
}

/**
 * Find the Gregorian end Date of the Hijri month containing dateInput
 */
export function getHijriMonthEnd(dateInput) {
  const d = toMiddayDate(dateInput);
  const { month, year } = getHijriParts(d);
  let cur = new Date(d.getTime());
  // Step forward one day at a time until next day is in a different Hijri month
  while (true) {
    const next = new Date(cur.getTime() + 86400000);
    const p = getHijriParts(next);
    if (p.month !== month || p.year !== year) break;
    cur = next;
  }
  return cur;
}

/**
 * Add or subtract n Hijri months from a given date
 */
export function addHijriMonths(dateInput, amount) {
  let cur = getHijriMonthStart(dateInput);
  if (amount > 0) {
    for (let i = 0; i < amount; i++) {
      const end = getHijriMonthEnd(cur);
      cur = new Date(end.getTime() + 86400000);
    }
  } else if (amount < 0) {
    for (let i = 0; i < Math.abs(amount); i++) {
      const prevEnd = new Date(cur.getTime() - 86400000);
      cur = getHijriMonthStart(prevEnd);
    }
  }
  return cur;
}

export function subHijriMonths(dateInput, amount) {
  return addHijriMonths(dateInput, -amount);
}

/**
 * Generate full 7-column calendar matrix for the Hijri month containing dateInput
 */
export function getHijriMonthGrid(dateInput) {
  const start = getHijriMonthStart(dateInput);
  const end = getHijriMonthEnd(dateInput);
  const targetHijri = getHijriParts(start);

  const startDayOfWeek = start.getDay(); // 0 = Sunday
  const days = [];

  // Previous month padding days
  for (let i = startDayOfWeek; i > 0; i--) {
    const d = new Date(start.getTime() - i * 86400000);
    const hp = getHijriParts(d);
    days.push({
      date: d,
      isoDate: format(d, 'yyyy-MM-dd'),
      hijriDay: hp.day,
      hijriMonth: hp.month,
      hijriYear: hp.year,
      hijriMonthNameAr: hp.monthNameAr,
      hijriMonthNameEn: hp.monthNameEn,
      inCurrentMonth: false,
      isToday: isFnsToday(d),
    });
  }

  // Current Hijri month days
  let cur = new Date(start.getTime());
  while (cur.getTime() <= end.getTime()) {
    const hp = getHijriParts(cur);
    days.push({
      date: new Date(cur),
      isoDate: format(cur, 'yyyy-MM-dd'),
      hijriDay: hp.day,
      hijriMonth: hp.month,
      hijriYear: hp.year,
      hijriMonthNameAr: hp.monthNameAr,
      hijriMonthNameEn: hp.monthNameEn,
      inCurrentMonth: true,
      isToday: isFnsToday(cur),
    });
    cur = new Date(cur.getTime() + 86400000);
  }

  // Trailing next month padding days to complete standard 7-col grid
  const remainder = days.length % 7;
  if (remainder !== 0) {
    const fill = 7 - remainder;
    let nextCur = new Date(end.getTime() + 86400000);
    for (let i = 0; i < fill; i++) {
      const hp = getHijriParts(nextCur);
      days.push({
        date: new Date(nextCur),
        isoDate: format(nextCur, 'yyyy-MM-dd'),
        hijriDay: hp.day,
        hijriMonth: hp.month,
        hijriYear: hp.year,
        hijriMonthNameAr: hp.monthNameAr,
        hijriMonthNameEn: hp.monthNameEn,
        inCurrentMonth: false,
        isToday: isFnsToday(nextCur),
      });
      nextCur = new Date(nextCur.getTime() + 86400000);
    }
  }

  return {
    days,
    hijriMonth: targetHijri.month,
    hijriYear: targetHijri.year,
    monthNameAr: targetHijri.monthNameAr,
    monthNameEn: targetHijri.monthNameEn,
    startDate: start,
    endDate: end,
  };
}

/**
 * Format Hijri date (e.g., "12 ربيع الأول 1448 هـ" or "12 Rabi' al-Awwal 1448 AH")
 */
export function formatHijriDate(dateInput, isArabic = false) {
  if (!dateInput) return '—';
  const { day, year, monthNameAr, monthNameEn } = getHijriParts(dateInput);
  if (isArabic) {
    return `${day} ${monthNameAr} ${year} هـ`;
  }
  return `${day} ${monthNameEn} ${year} AH`;
}

/**
 * Format Hijri month and year (e.g., "ربيع الأول 1448 هـ" or "Rabi' al-Awwal 1448 AH")
 */
export function formatHijriMonthYear(dateInput, isArabic = false) {
  if (!dateInput) return '';
  const { year, monthNameAr, monthNameEn } = getHijriParts(dateInput);
  if (isArabic) {
    return `${monthNameAr} ${year} هـ`;
  }
  return `${monthNameEn} ${year} AH`;
}

/**
 * Format dual date showing both Gregorian and Hijri
 * Example (AR): "25 أغسطس 2026 (12 ربيع الأول 1448 هـ)"
 * Example (EN): "Aug 25, 2026 (12 Rabi' al-Awwal 1448 AH)"
 */
export function formatDualDate(dateInput, isArabic = false, gregorianFormatter) {
  if (!dateInput) return '—';
  const hijriStr = formatHijriDate(dateInput, isArabic);
  const gregStr = gregorianFormatter ? gregorianFormatter(dateInput, isArabic) : format(toMiddayDate(dateInput), 'yyyy-MM-dd');
  return `${gregStr} (${hijriStr})`;
}
