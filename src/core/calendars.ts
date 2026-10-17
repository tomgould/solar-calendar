import { seasonInstant } from './astro';
import { type DayNumber, dayFromCivil, utcDayOfInstant } from './days';

/**
 * Other calendars that festivals are dated in: Western Easter, the Julian and
 * Coptic calendars (Coptic and Orthodox feasts), and the Persian (Solar Hijri)
 * calendar. Each gives day numbers, like everything else in the core.
 */

/** Julian Day number of 1970-01-01, day number 0 */
const JULIAN_DAY_OF_EPOCH = 2440588;

/** Western Easter Sunday in a Gregorian year (the anonymous Gregorian algorithm, Meeus chapter 8). */
export function easterSunday(year: number): DayNumber {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dayFromCivil(year, month, day);
}

/** A date in the Julian calendar, which Orthodox and Coptic Christmas follow. */
export function dayFromJulian(year: number, month: number, day: number): DayNumber {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083 - JULIAN_DAY_OF_EPOCH;
}

/**
 * A date in the Coptic calendar: 12 months of 30 days and a 13th of 5, or 6
 * in the year before a Julian leap year. Year 1 began on 29 August AD 284
 * (Julian). From Reingold and Dershowitz, Calendrical Calculations.
 */
export function dayFromCoptic(year: number, month: number, day: number): DayNumber {
  // Their fixed day 1 is 1 January AD 1 (Gregorian); 1970-01-01 is fixed day 719163
  const COPTIC_EPOCH = 103605;
  return COPTIC_EPOCH - 1 + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day - 719163;
}

/** Days in a Coptic month that every year has: the 13th has 5, or 6 in leap years. */
export const COPTIC_MONTH_DAYS = (month: number) => (month === 13 ? 5 : 30);

/**
 * Nowruz, 1 Farvardin, in a Gregorian year. Iran's rule: the day of the March
 * equinox in Tehran (UTC+3:30), or the next day if the equinox comes after
 * noon there.
 */
export function persianNewYear(gregorianYear: number): DayNumber {
  const TEHRAN_NOON_AHEAD_MS = (3.5 + 12) * 3600_000;
  return utcDayOfInstant(seasonInstant(gregorianYear, 'march-equinox') + TEHRAN_NOON_AHEAD_MS);
}

/** Days in a Persian month that every year has: 31 for months 1 to 6, 30 for 7 to 11, and 29 (30 in leap years) for 12. */
export const PERSIAN_MONTH_DAYS = (month: number) => (month <= 6 ? 31 : month <= 11 ? 30 : 29);

/** A date in the Persian year that starts at Nowruz in the given Gregorian year. */
export function dayFromPersian(gregorianYear: number, month: number, day: number): DayNumber {
  const before = month <= 7 ? (month - 1) * 31 : 6 * 31 + (month - 7) * 30;
  return persianNewYear(gregorianYear) + before + day - 1;
}
