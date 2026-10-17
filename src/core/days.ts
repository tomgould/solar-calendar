/**
 * Calendar dates as integer day numbers: days since 1970-01-01 in the
 * proleptic Gregorian calendar. All date arithmetic in the app uses these,
 * never Date objects, so time zones and clock changes can't shift a day.
 */
export type DayNumber = number;

export interface CivilDate {
  year: number;
  /** 1 to 12 */
  month: number;
  day: number;
}

const MS_PER_DAY = 86_400_000;

// Howard Hinnant, "chrono-Compatible Low-Level Date Algorithms"
export function dayFromCivil(year: number, month: number, day: number): DayNumber {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12; // March = 0
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDay(n: DayNumber): CivilDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** 0 = Monday to 6 = Sunday. Day 0 (1970-01-01) was a Thursday. */
export function weekday(n: DayNumber): number {
  return (((n + 3) % 7) + 7) % 7;
}

export function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInGregorianMonth(year: number, month: number): number {
  if (month === 2) return isGregorianLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** The UTC calendar date on which an instant (ms since the epoch) falls. */
export function utcDayOfInstant(ms: number): DayNumber {
  return Math.floor(ms / MS_PER_DAY);
}

/** The viewer's local calendar date on which an instant falls. */
export function localDayOfInstant(ms: number): DayNumber {
  const d = new Date(ms);
  return dayFromCivil(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function today(now: Date = new Date()): DayNumber {
  return dayFromCivil(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseIsoDate(text: string): DayNumber | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInGregorianMonth(year, month)) return null;
  return dayFromCivil(year, month, day);
}

export function toIsoDate(n: DayNumber): string {
  const { year, month, day } = civilFromDay(n);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
