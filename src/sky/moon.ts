import { type DayNumber, civilFromDay, localDayOfInstant } from '../core/days';
import type { MoonQuarter, SkyEvent } from '../core/sky';

// astronomy-engine is only needed for the moon, so it loads on demand, and
// not before `waitFor` settles
let gate: Promise<unknown> = Promise.resolve();
export function loadMoonAfter(waitFor: Promise<unknown>): void {
  gate = waitFor;
}
const engine = () => gate.then(() => import('astronomy-engine'));

const QUARTERS: readonly MoonQuarter[] = ['new-moon', 'first-quarter', 'full-moon', 'last-quarter'];

/** Moon quarters whose local date falls between first and last, inclusive. */
export async function moonQuarters(first: DayNumber, last: DayNumber): Promise<SkyEvent[]> {
  const Astronomy = await engine();
  const events: SkyEvent[] = [];
  let quarter = Astronomy.SearchMoonQuarter(new Date((first - 2) * 86_400_000));
  for (;;) {
    const instant = quarter.time.date.getTime();
    const day = localDayOfInstant(instant);
    if (day > last) break;
    if (day >= first) events.push({ kind: QUARTERS[quarter.quarter], instant, day });
    quarter = Astronomy.NextMoonQuarter(quarter);
  }
  return events;
}

/**
 * The moon's phase on a local day, as a plain description. A quarter's name
 * is only used on the day the quarter actually happens, matching the marks
 * in the calendar; other days get the phase in between.
 */
export async function moonPhaseName(n: DayNumber): Promise<string> {
  const Astronomy = await engine();
  const { year, month, day } = civilFromDay(n);
  const start = Astronomy.MoonPhase(new Date(year, month - 1, day));
  let end = Astronomy.MoonPhase(new Date(year, month - 1, day + 1));
  if (end < start) end += 360;
  const quarters = ['New moon', 'First quarter', 'Full moon', 'Last quarter', 'New moon'];
  const crossed = [0, 90, 180, 270, 360].findIndex((angle) => start <= angle && angle < end);
  if (crossed >= 0) return quarters[crossed];
  return ['Waxing crescent', 'Waxing gibbous', 'Waning gibbous', 'Waning crescent'][Math.floor(start / 90)];
}
