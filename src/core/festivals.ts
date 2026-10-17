import { SEASONS, type Season } from './astro';
import { type DayNumber, civilFromDay, daysInGregorianMonth, dayFromCivil, weekday } from './days';
import { seasonEvents } from './sky';
import { fromSolar, isValidSolarDate, solarYearOf } from './solar';

/**
 * When a festival falls, as name packs describe it:
 * - { event: 'december-solstice' }: the local date of an equinox or solstice
 * - { gregorian: '11-01' }: a Gregorian month and day every year
 * - { gregorian: '01-19', weekday: 'friday' }: the first Friday on or after it
 * - { solar: { month: 3, day: 1 } }: a date in this solar calendar
 * Any rule can add an offset in days.
 */
export type FestivalRule =
  | { event: Season; offset?: number }
  | { gregorian: string; weekday?: WeekdayName; offset?: number }
  | { solar: { month: number; day: number }; offset?: number };

export const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

/** Explains a rule's problem, or returns null if it's valid. */
export function ruleProblem(rule: unknown): string | null {
  if (typeof rule !== 'object' || rule === null) return 'must be an object';
  const r = rule as Record<string, unknown>;
  if (r.offset !== undefined && !Number.isInteger(r.offset)) return '"offset" must be a whole number of days';
  if ('event' in r) return SEASONS.includes(r.event as Season) ? null : `"event" must be one of ${SEASONS.join(', ')}`;
  if ('gregorian' in r) {
    const match = typeof r.gregorian === 'string' ? /^(\d{2})-(\d{2})$/.exec(r.gregorian) : null;
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2]) < 1 || Number(match[2]) > daysInGregorianMonth(2000, Number(match[1]))) {
      return '"gregorian" must be a month and day such as "11-01"';
    }
    if (r.weekday !== undefined && !WEEKDAY_NAMES.includes(r.weekday as WeekdayName)) return `"weekday" must be one of ${WEEKDAY_NAMES.join(', ')}`;
    return null;
  }
  if ('solar' in r) {
    const solar = r.solar as { month?: unknown; day?: unknown } | null;
    // Whole numbers only: fromSolar throws on "3" or 3.5, which would stop the calendar loading
    return solar && Number.isInteger(solar.month) && Number.isInteger(solar.day)
      && isValidSolarDate(2026, solar.month as number, solar.day as number) && (solar.month as number) <= 13
      ? null : '"solar" needs a month from 1 to 13 and a day from 1 to 28';
  }
  return 'needs "event", "gregorian" or "solar"';
}

/** Days on which a festival starts, for every occurrence that could touch first to last. */
export function festivalStarts(rule: FestivalRule, first: DayNumber, last: DayNumber): DayNumber[] {
  const offset = rule.offset ?? 0;
  const [from, to] = [first - 62, last + 62];
  let starts: DayNumber[] = [];
  if ('event' in rule) {
    starts = seasonEvents(from, to).filter((event) => event.kind === rule.event).map((event) => event.day);
  } else if ('gregorian' in rule) {
    const [month, day] = rule.gregorian.split('-').map(Number);
    for (let year = civilFromDay(from).year; year <= civilFromDay(to).year; year++) {
      if (day > daysInGregorianMonth(year, month)) continue; // 29 February outside leap years
      let start = dayFromCivil(year, month, day);
      if (rule.weekday) start += (WEEKDAY_NAMES.indexOf(rule.weekday) - weekday(start) + 7) % 7;
      starts.push(start);
    }
  } else {
    for (let year = solarYearOf(from); year <= solarYearOf(to); year++) {
      starts.push(fromSolar(year, rule.solar.month, rule.solar.day));
    }
  }
  return starts.map((start) => start + offset).filter((start) => start >= from && start <= to);
}

/** Every day from first to last covered by a festival lasting `length` days. */
export function festivalDays(rule: FestivalRule, length: number, first: DayNumber, last: DayNumber): DayNumber[] {
  const days: DayNumber[] = [];
  for (const start of festivalStarts(rule, first, last)) {
    for (let day = start; day < start + length; day++) if (day >= first && day <= last) days.push(day);
  }
  return days;
}
