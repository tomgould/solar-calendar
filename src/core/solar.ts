import { seasonInstant } from './astro';
import { type DayNumber, civilFromDay, utcDayOfInstant, weekday } from './days';

/**
 * The solar calendar. Year N starts on the first Monday on or after the March
 * equinox of Gregorian year N, taking the equinox's UTC date. Thirteen months
 * of 28 days make 364 days; when the next start is 371 days away, the year
 * ends with a 7-day leap week, treated here as month 14.
 */

export const MIN_YEAR = 1600;
export const MAX_YEAR = 2400;
export const MONTHS = 13;
export const DAYS_PER_MONTH = 28;
export const LEAP_WEEK = 14;

export interface SolarDate {
  year: number;
  /** 1 to 13, or LEAP_WEEK */
  month: number;
  /** 1 to 28 (1 to 7 in the leap week) */
  day: number;
  /** 1 to 364, or 371 in a leap-week year */
  dayOfYear: number;
}

const startCache = new Map<number, DayNumber>();

export function equinoxDay(year: number): DayNumber {
  return utcDayOfInstant(seasonInstant(year, 'march-equinox'));
}

export function yearStart(year: number): DayNumber {
  let start = startCache.get(year);
  if (start === undefined) {
    const equinox = equinoxDay(year);
    start = equinox + ((7 - weekday(equinox)) % 7);
    startCache.set(year, start);
  }
  return start;
}

export function yearLength(year: number): number {
  return yearStart(year + 1) - yearStart(year);
}

export function hasLeapWeek(year: number): boolean {
  return yearLength(year) === 371;
}

export function monthsInYear(year: number): number {
  return hasLeapWeek(year) ? LEAP_WEEK : MONTHS;
}

export function daysInMonth(month: number): number {
  return month === LEAP_WEEK ? 7 : DAYS_PER_MONTH;
}

export function solarYearOf(n: DayNumber): number {
  const gregorianYear = civilFromDay(n).year;
  return n < yearStart(gregorianYear) ? gregorianYear - 1 : gregorianYear;
}

export function toSolar(n: DayNumber): SolarDate {
  const year = solarYearOf(n);
  const offset = n - yearStart(year);
  if (offset >= MONTHS * DAYS_PER_MONTH) {
    return { year, month: LEAP_WEEK, day: offset - MONTHS * DAYS_PER_MONTH + 1, dayOfYear: offset + 1 };
  }
  return { year, month: Math.floor(offset / DAYS_PER_MONTH) + 1, day: (offset % DAYS_PER_MONTH) + 1, dayOfYear: offset + 1 };
}

export function fromSolar(year: number, month: number, day: number): DayNumber {
  return yearStart(year) + (month - 1) * DAYS_PER_MONTH + day - 1;
}

/** First and last day of a solar month, inclusive. */
export function monthSpan(year: number, month: number): [DayNumber, DayNumber] {
  const first = fromSolar(year, month, 1);
  return [first, first + daysInMonth(month) - 1];
}

export function inSupportedRange(n: DayNumber): boolean {
  const year = solarYearOf(n);
  return year >= MIN_YEAR && year <= MAX_YEAR;
}
