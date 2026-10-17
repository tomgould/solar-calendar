import { SEASONS, type Season, seasonInstant } from './astro';
import { type DayNumber, civilFromDay, localDayOfInstant } from './days';

export type MoonQuarter = 'new-moon' | 'first-quarter' | 'full-moon' | 'last-quarter';
export type SkyEventKind = Season | MoonQuarter;

export interface SkyEvent {
  kind: SkyEventKind;
  /** ms since 1970-01-01 UTC */
  instant: number;
  /** The viewer's local date of the instant */
  day: DayNumber;
}

export const SKY_EVENT_NAMES: Record<SkyEventKind, string> = {
  'march-equinox': 'March equinox',
  'june-solstice': 'June solstice',
  'september-equinox': 'September equinox',
  'december-solstice': 'December solstice',
  'new-moon': 'New moon',
  'first-quarter': 'First quarter moon',
  'full-moon': 'Full moon',
  'last-quarter': 'Last quarter moon',
};

/** Equinoxes and solstices whose local date falls between first and last, inclusive. */
export function seasonEvents(first: DayNumber, last: DayNumber): SkyEvent[] {
  const events: SkyEvent[] = [];
  for (let year = civilFromDay(first).year; year <= civilFromDay(last).year; year++) {
    for (const season of SEASONS) {
      const instant = seasonInstant(year, season);
      const day = localDayOfInstant(instant);
      if (day >= first && day <= last) events.push({ kind: season, instant, day });
    }
  }
  return events;
}

/** The first equinox or solstice after a given day. */
export function nextSeasonEvent(after: DayNumber): SkyEvent {
  return seasonEvents(after + 1, after + 120).sort((a, b) => a.instant - b.instant)[0];
}
