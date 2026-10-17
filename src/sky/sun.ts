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

/** Sunrise and sunset on a local calendar day, at a place. */
export async function sunTimes(day: DayNumber, { lat, lon }: Place): Promise<SunTimes> {
  const Astronomy = await engine();
  const { year, month, day: date } = civilFromDay(day);
  const start = new Date(year, month - 1, date);
  const end = new Date(year, month - 1, date + 1);
  const observer = new Astronomy.Observer(lat, lon, 0);
  const find = (direction: 1 | -1) => {
    const time = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, start, 1);
    return time && time.date < end ? time.date.getTime() : null;
  };
  const [rise, set] = [find(1), find(-1)];
  let polar: SunTimes['polar'] = null;
  if (rise === null && set === null) {
    const noon = new Date(year, month - 1, date, 12);
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
