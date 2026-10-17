import { type DayNumber, civilFromDay, weekday } from '../core/days';
import { LEAP_WEEK, type SolarDate } from '../core/solar';
import type { NamePack } from '../names/schema';

export const LOCALE = 'en-GB';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const GREGORIAN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Saturday 17 October 2026" */
export function gregorianLong(n: DayNumber): string {
  const { year, month, day } = civilFromDay(n);
  return `${WEEKDAYS[weekday(n)]} ${day} ${GREGORIAN_MONTHS[month - 1]} ${year}`;
}

/** "17 Oct", or "17 Oct 2026" with the year */
export function gregorianShort(n: DayNumber, withYear = false): string {
  const { year, month, day } = civilFromDay(n);
  return `${day} ${GREGORIAN_MONTHS[month - 1].slice(0, 3)}${withYear ? ` ${year}` : ''}`;
}

/** "17 October 2026" */
export function gregorianDate(n: DayNumber): string {
  const { year, month, day } = civilFromDay(n);
  return `${day} ${GREGORIAN_MONTHS[month - 1]} ${year}`;
}

export function monthName(pack: NamePack, month: number): string {
  return month === LEAP_WEEK ? pack.leapWeek.name : pack.months[month - 1].name;
}

export function monthGloss(pack: NamePack, month: number): string {
  return month === LEAP_WEEK ? pack.leapWeek.gloss : pack.months[month - 1].gloss;
}

/** "13 Winterfylleþ 2026", or "Leap week, day 3, 2028" */
export function solarLong(pack: NamePack, date: SolarDate): string {
  if (date.month === LEAP_WEEK) return `${pack.leapWeek.name}, day ${date.day}, ${date.year}`;
  return `${date.day} ${monthName(pack, date.month)} ${date.year}`;
}

/**
 * The class that gives an element its month's colour (--hue). The 13 hues and
 * the leap week's grey are defined in app.css, so no inline styles are needed.
 */
export function hueClass(month: number): string {
  return `hue-${month}`;
}

/** A sky event's time in the viewer's time zone: "21 December 2026 at 20:50 GMT" */
export function eventTime(instant: number, withDate = true): string {
  return new Intl.DateTimeFormat(LOCALE, {
    ...(withDate ? { day: 'numeric', month: 'long', year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(instant);
}

export function daysAway(from: DayNumber, to: DayNumber): string {
  const days = to - from;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
