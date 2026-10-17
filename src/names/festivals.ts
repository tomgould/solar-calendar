import { type DayNumber, civilFromDay, dayFromCivil, weekday } from '../core/days';
import { festivalStarts } from '../core/festivals';
import type { Festival } from './schema';

/** Anything with festivals to show: a name pack or a holiday set. */
export interface FestivalSource {
  id: string;
  title: string;
  lang: string;
  festivals?: Festival[];
}

export interface FestivalDay {
  day: DayNumber;
  festival: Festival;
  source: FestivalSource;
  /** A weekday off in place of a holiday that fell at the weekend */
  substitute?: boolean;
  /** A day off: a bank holiday on a weekday, or a substitute day */
  dayOff?: boolean;
}

const isWeekend = (day: DayNumber) => weekday(day) >= 5;

/**
 * Each occurrence of a source's festivals that starts between first and
 * last, including substitute days off. Years a festival isn't kept are left
 * out, and moved years use the moved date.
 */
export function festivalOccurrences(source: FestivalSource, first: DayNumber, last: DayNumber): FestivalDay[] {
  const occurrences: FestivalDay[] = (source.festivals ?? []).flatMap((festival) =>
    festivalStarts(festival.when, first, last).flatMap((start): FestivalDay[] => {
      const { year } = civilFromDay(start);
      if ((festival.from !== undefined && year < festival.from) || (festival.until !== undefined && year > festival.until)) return [];
      const moved = festival.moves?.[year];
      const day = moved ? dayFromCivil(year, Number(moved.slice(0, 2)), Number(moved.slice(3))) : start;
      return [{ day, festival, source, dayOff: festival.bankHoliday === true && !isWeekend(day) }];
    }));

  // A day off at the weekend gets the next weekday that isn't already one,
  // in date order: Christmas on a Saturday moves to Monday, Boxing Day to Tuesday
  const taken = new Set(occurrences.filter((entry) => entry.dayOff).map((entry) => entry.day));
  const substitutes: FestivalDay[] = [];
  for (const entry of [...occurrences].sort((a, b) => a.day - b.day)) {
    const { substituteFrom } = entry.festival;
    if (!entry.festival.bankHoliday || substituteFrom === undefined || !isWeekend(entry.day) || civilFromDay(entry.day).year < substituteFrom) continue;
    let day = entry.day + 1;
    while (isWeekend(day) || taken.has(day)) day++;
    taken.add(day);
    substitutes.push({ ...entry, day, substitute: true, dayOff: true });
  }
  return [...occurrences, ...substitutes].filter((entry) => entry.day >= first && entry.day <= last);
}

/** Every day from first to last that a source's festivals cover, one entry per festival per day. */
export function festivalsBetween(source: FestivalSource, first: DayNumber, last: DayNumber): FestivalDay[] {
  // Festivals last at most 31 days, so look back that far for ones already under way
  return festivalOccurrences(source, first - 31, last).flatMap((entry) =>
    Array.from({ length: entry.substitute ? 1 : entry.festival.days ?? 1 }, (_, i) => ({ ...entry, day: entry.day + i })))
    .filter((entry) => entry.day >= first && entry.day <= last);
}

/** The festivals of several sources together, in date order. */
export function festivalsFrom(sources: FestivalSource[], first: DayNumber, last: DayNumber, occurrences = false): FestivalDay[] {
  return sources.flatMap((source) => (occurrences ? festivalOccurrences : festivalsBetween)(source, first, last))
    .sort((a, b) => a.day - b.day);
}

/** A festival's name as shown on a given day, marking substitute days. */
export const festivalLabel = ({ festival, substitute }: FestivalDay) => (substitute ? `${festival.name} (substitute day)` : festival.name);
