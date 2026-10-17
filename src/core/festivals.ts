import { SEASONS, type Season } from './astro';
import { COPTIC_MONTH_DAYS, PERSIAN_MONTH_DAYS, dayFromCoptic, dayFromJulian, dayFromPersian, easterSunday } from './calendars';
import { type DayNumber, civilFromDay, daysInGregorianMonth, dayFromCivil, weekday } from './days';
import { seasonEvents } from './sky';
import { fromSolar, isValidSolarDate, solarYearOf } from './solar';

/**
 * When a festival falls, as name packs and holiday sets describe it:
 * - { event: 'december-solstice' }: the local date of an equinox or solstice
 * - { gregorian: '11-01' }: a Gregorian month and day every year
 * - { gregorian: '01-19', weekday: 'friday' }: the first Friday on or after it
 * - { solar: { month: 3, day: 1 } }: a date in this solar calendar
 * - { easter: true }: Western Easter Sunday
 * - { date: '2023-05-08' }: one day only, such as a coronation
 * - { julian: '12-25' }: a Julian month and day, as Orthodox and Coptic Christmas
 * - { coptic: { month: 1, day: 1 } }: a date in the Coptic calendar
 * - { persian: { month: 1, day: 1 } }: a date in the Persian calendar (Nowruz)
 * Any rule can then step back to the last given weekday before that date
 * (`before`), and add an offset in days.
 */
export type FestivalRule = { offset?: number; before?: WeekdayName } & (
  | { event: Season }
  | { gregorian: string; weekday?: WeekdayName }
  | { solar: { month: number; day: number } }
  | { easter: true }
  | { date: string }
  | { julian: string }
  | { coptic: { month: number; day: number } }
  | { persian: { month: number; day: number } }
);

export const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

const isMonthDay = (text: unknown) => {
  const match = typeof text === 'string' ? /^(\d{2})-(\d{2})$/.exec(text) : null;
  return !!match && Number(match[1]) >= 1 && Number(match[1]) <= 12 && Number(match[2]) >= 1 && Number(match[2]) <= daysInGregorianMonth(2000, Number(match[1]));
};

/** A { month, day } of whole numbers, with the month up to `months` and the day within `daysIn(month)` */
const isMonthAndDay = (value: unknown, months: number, daysIn: (month: number) => number) => {
  const { month, day } = (value ?? {}) as { month?: unknown; day?: unknown };
  // Whole numbers only: "3" or 3.5 would throw later and stop the calendar loading
  return Number.isInteger(month) && Number.isInteger(day) && (month as number) >= 1 && (month as number) <= months
    && (day as number) >= 1 && (day as number) <= daysIn(month as number);
};

/** Explains a rule's problem, or returns null if it's valid. */
export function ruleProblem(rule: unknown): string | null {
  if (typeof rule !== 'object' || rule === null) return 'must be an object';
  const r = rule as Record<string, unknown>;
  if (r.offset !== undefined && !Number.isInteger(r.offset)) return '"offset" must be a whole number of days';
  if (r.before !== undefined && !WEEKDAY_NAMES.includes(r.before as WeekdayName)) return `"before" must be one of ${WEEKDAY_NAMES.join(', ')}`;
  if ('event' in r) return SEASONS.includes(r.event as Season) ? null : `"event" must be one of ${SEASONS.join(', ')}`;
  if ('gregorian' in r) {
    if (!isMonthDay(r.gregorian)) return '"gregorian" must be a month and day such as "11-01"';
    if (r.weekday !== undefined && !WEEKDAY_NAMES.includes(r.weekday as WeekdayName)) return `"weekday" must be one of ${WEEKDAY_NAMES.join(', ')}`;
    return null;
  }
  if ('solar' in r) {
    return isMonthAndDay(r.solar, 13, () => 28) && isValidSolarDate(2026, (r.solar as { month: number }).month, (r.solar as { day: number }).day)
      ? null : '"solar" needs a month from 1 to 13 and a day from 1 to 28';
  }
  if ('easter' in r) return r.easter === true ? null : '"easter" must be true';
  if ('date' in r) {
    const match = typeof r.date === 'string' ? /^(\d{4})-(\d{2}-\d{2})$/.exec(r.date) : null;
    return match && isMonthDay(match[2]) && Number(match[2].slice(3)) <= daysInGregorianMonth(Number(match[1]), Number(match[2].slice(0, 2)))
      ? null : '"date" must be a date such as "2023-05-08"';
  }
  if ('julian' in r) return isMonthDay(r.julian) ? null : '"julian" must be a month and day such as "12-25"';
  if ('coptic' in r) return isMonthAndDay(r.coptic, 13, COPTIC_MONTH_DAYS) ? null : '"coptic" needs a month from 1 to 13 and a day in it';
  if ('persian' in r) return isMonthAndDay(r.persian, 12, PERSIAN_MONTH_DAYS) ? null : '"persian" needs a month from 1 to 12 and a day in it';
  return 'needs "event", "gregorian", "solar", "easter", "date", "julian", "coptic" or "persian"';
}

/** The day each year that a rule names, before `before` and `offset` apply, for every year that could touch from to to. */
function baseDays(rule: FestivalRule, from: DayNumber, to: DayNumber): DayNumber[] {
  const years = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const gregorianYears = years(civilFromDay(from).year - 1, civilFromDay(to).year + 1);
  const monthDay = (text: string) => text.split('-').map(Number) as [number, number];
  if ('event' in rule) {
    return seasonEvents(from, to).filter((event) => event.kind === rule.event).map((event) => event.day);
  }
  if ('gregorian' in rule) {
    const [month, day] = monthDay(rule.gregorian);
    // 29 February is skipped outside leap years
    return gregorianYears.filter((year) => day <= daysInGregorianMonth(year, month)).map((year) => {
      const start = dayFromCivil(year, month, day);
      return rule.weekday ? start + ((WEEKDAY_NAMES.indexOf(rule.weekday) - weekday(start) + 7) % 7) : start;
    });
  }
  if ('solar' in rule) return years(solarYearOf(from), solarYearOf(to)).map((year) => fromSolar(year, rule.solar.month, rule.solar.day));
  if ('easter' in rule) return gregorianYears.map(easterSunday);
  if ('date' in rule) {
    const [year, month, day] = rule.date.split('-').map(Number);
    return [dayFromCivil(year, month, day)];
  }
  if ('julian' in rule) {
    const [month, day] = monthDay(rule.julian);
    return gregorianYears.map((year) => dayFromJulian(year, month, day));
  }
  // Coptic year 1 began in AD 284, so Coptic year y starts in Gregorian year y + 283
  if ('coptic' in rule) return gregorianYears.map((year) => dayFromCoptic(year - 283, rule.coptic.month, rule.coptic.day));
  return gregorianYears.map((year) => dayFromPersian(year, rule.persian.month, rule.persian.day));
}

/** Days on which a festival starts, for every occurrence that could touch first to last. */
export function festivalStarts(rule: FestivalRule, first: DayNumber, last: DayNumber): DayNumber[] {
  const offset = rule.offset ?? 0;
  const [from, to] = [first - 62, last + 62];
  return baseDays(rule, from, to)
    .map((day) => {
      // The last such weekday strictly before the day: the Wednesday before Nowruz, say
      if (rule.before) day -= 1 + ((weekday(day - 1) - WEEKDAY_NAMES.indexOf(rule.before) + 7) % 7);
      return day + offset;
    })
    .filter((start) => start >= from && start <= to);
}

/** Every day from first to last covered by a festival lasting `length` days. */
export function festivalDays(rule: FestivalRule, length: number, first: DayNumber, last: DayNumber): DayNumber[] {
  const days: DayNumber[] = [];
  for (const start of festivalStarts(rule, first, last)) {
    for (let day = start; day < start + length; day++) if (day >= first && day <= last) days.push(day);
  }
  return days;
}
