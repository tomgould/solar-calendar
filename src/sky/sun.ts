import { type DayNumber, civilFromDay } from '../core/days';

// astronomy-engine loads on demand, as for the moon
const engine = () => import('astronomy-engine');

export interface Place {
  lat: number;
  lon: number;
}

export interface SunTimes {
  /** ms since the epoch, or null if the sun doesn't rise or set that day */
  rise: number | null;
  set: number | null;
  /** Set when there's neither: the sun stays up (polar day) or down (polar night) */
  polar: 'day' | 'night' | null;
}

/** The time zone at a place, such as "Australia/Sydney", from an offline lookup; null if unknown. */
export async function placeTimeZone({ lat, lon }: Place): Promise<string | null> {
  try {
    const module = await import('@photostructure/tz-lookup');
    const find = ((module as { default?: unknown }).default ?? module) as (lat: number, lon: number) => string;
    return find(lat, lon);
  } catch {
    return null;
  }
}

/** The UTC instant at which a calendar date begins in a time zone. */
export function zonedMidnight(year: number, month: number, day: number, timeZone: string): number {
  const wall = Date.UTC(year, month - 1, day);
  // Offset of the zone from UTC at an instant, read back from Intl
  const offset = (instant: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(instant).map((part) => [part.type, Number(part.value)]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant;
  };
  // Two passes settle the offset, even across a daylight-saving change
  let guess = wall - offset(wall);
  guess = wall - offset(guess);
  return guess;
}

/**
 * Sunrise and sunset on a calendar day at a place: the day as it is in the
 * place's own time zone if known, otherwise in this device's.
 */
export async function sunTimes(day: DayNumber, { lat, lon }: Place, timeZone: string | null = null): Promise<SunTimes> {
  const Astronomy = await engine();
  const { year, month, day: date } = civilFromDay(day);
  const next = civilFromDay(day + 1);
  const start = new Date(timeZone ? zonedMidnight(year, month, date, timeZone) : new Date(year, month - 1, date).getTime());
  const end = new Date(timeZone ? zonedMidnight(next.year, next.month, next.day, timeZone) : new Date(year, month - 1, date + 1).getTime());
  const observer = new Astronomy.Observer(lat, lon, 0);
  const find = (direction: 1 | -1) => {
    const time = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, start, 1);
    return time && time.date < end ? time.date.getTime() : null;
  };
  const [rise, set] = [find(1), find(-1)];
  let polar: SunTimes['polar'] = null;
  if (rise === null && set === null) {
    const noon = new Date((start.getTime() + end.getTime()) / 2);
    const { ra, dec } = Astronomy.Equator(Astronomy.Body.Sun, noon, observer, true, true);
    polar = Astronomy.Horizon(noon, observer, ra, dec, 'normal').altitude > 0 ? 'day' : 'night';
  }
  return { rise, set, polar };
}

export function isPlace(value: unknown): value is Place {
  const place = value as Place;
  return typeof place?.lat === 'number' && typeof place?.lon === 'number'
    && Math.abs(place.lat) <= 90 && Math.abs(place.lon) <= 180;
}
