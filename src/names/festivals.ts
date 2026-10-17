import type { DayNumber } from '../core/days';
import { festivalDays, festivalStarts } from '../core/festivals';
import type { Festival, NamePack } from './schema';

export interface FestivalDay {
  day: DayNumber;
  festival: Festival;
}

/** Every day from first to last that a pack's festivals cover, one entry per festival per day. */
export function festivalsBetween(pack: NamePack, first: DayNumber, last: DayNumber): FestivalDay[] {
  return (pack.festivals ?? []).flatMap((festival) =>
    festivalDays(festival.when, festival.days ?? 1, first, last).map((day) => ({ day, festival })));
}

/** Each occurrence of a pack's festivals that starts between first and last. */
export function festivalOccurrences(pack: NamePack, first: DayNumber, last: DayNumber): FestivalDay[] {
  return (pack.festivals ?? []).flatMap((festival) =>
    festivalStarts(festival.when, first, last).filter((day) => day >= first && day <= last).map((day) => ({ day, festival })));
}
