import { describe, expect, it } from 'vitest';
import { dayFromCivil, toIsoDate, weekday } from '../../src/core/days';
import { festivalDays, festivalStarts, ruleProblem } from '../../src/core/festivals';
import { dayFromCoptic, dayFromJulian, easterSunday, persianNewYear } from '../../src/core/calendars';
import { fromSolar } from '../../src/core/solar';

const year2026: [number, number] = [dayFromCivil(2026, 1, 1), dayFromCivil(2026, 12, 31)];
const inside = (days: number[]) => days.filter((day) => day >= year2026[0] && day <= year2026[1]).map(toIsoDate);

describe('festival rules', () => {
  it('follows an equinox or solstice', () => {
    process.env.TZ = 'Europe/London';
    expect(inside(festivalStarts({ event: 'december-solstice' }, ...year2026))).toEqual(['2026-12-21']);
    expect(inside(festivalStarts({ event: 'december-solstice', offset: -1 }, ...year2026))).toEqual(['2026-12-20']);
  });

  it('takes a Gregorian date, optionally the first given weekday on or after it', () => {
    expect(inside(festivalStarts({ gregorian: '11-01' }, ...year2026))).toEqual(['2026-11-01']);
    // Þorrablót: the first Friday on or after 19 January
    const thorri = inside(festivalStarts({ gregorian: '01-19', weekday: 'friday' }, ...year2026));
    expect(thorri).toEqual(['2026-01-23']);
    expect(weekday(dayFromCivil(2026, 1, 23))).toBe(4);
  });

  it('skips 29 February in years without it', () => {
    const leapDays = festivalStarts({ gregorian: '02-29' }, dayFromCivil(2025, 1, 1), dayFromCivil(2029, 1, 1)).map(toIsoDate);
    expect(leapDays).toContain('2028-02-29');
    expect(leapDays.some((day) => day.startsWith('2026') || day.startsWith('2027'))).toBe(false);
  });

  it('takes a date in the solar calendar', () => {
    expect(festivalStarts({ solar: { month: 8, day: 13 } }, ...year2026)).toContain(fromSolar(2026, 8, 13));
  });

  it('covers every day of a festival lasting several days', () => {
    const saturnalia = festivalDays({ gregorian: '12-17' }, 7, ...year2026).map(toIsoDate);
    expect(saturnalia).toEqual(['2026-12-17', '2026-12-18', '2026-12-19', '2026-12-20', '2026-12-21', '2026-12-22', '2026-12-23']);
  });

  it('explains invalid rules', () => {
    expect(ruleProblem({ event: 'march-equinox' })).toBeNull();
    expect(ruleProblem({ gregorian: '02-30' })).toMatch(/month and day/);
    expect(ruleProblem({ gregorian: '01-19', weekday: 'fri' })).toMatch(/weekday/);
    expect(ruleProblem({ solar: { month: 14, day: 1 } })).toMatch(/1 to 13/);
    expect(ruleProblem({ solar: { month: '3', day: 17 } })).toMatch(/1 to 13/);
    expect(ruleProblem({ solar: { month: 3, day: 17.5 } })).toMatch(/1 to 13/);
    expect(ruleProblem({ moon: 'full' })).toMatch(/needs/);
    expect(ruleProblem({ easter: true, offset: -2 })).toBeNull();
    expect(ruleProblem({ date: '2023-05-08' })).toBeNull();
    expect(ruleProblem({ date: '2023-02-29' })).toMatch(/date/);
    expect(ruleProblem({ coptic: { month: 13, day: 6 } })).toMatch(/coptic/);
    expect(ruleProblem({ persian: { month: 12, day: 30 } })).toMatch(/persian/);
    expect(ruleProblem({ persian: { month: 1, day: 1 }, before: 'wed' })).toMatch(/before/);
  });

  it('takes Easter, one-off dates, and the last given weekday before a date', () => {
    expect(inside(festivalStarts({ easter: true, offset: -2 }, ...year2026))).toEqual(['2026-04-03']);
    expect(inside(festivalStarts({ date: '2026-06-05' }, ...year2026))).toEqual(['2026-06-05']);
    expect(festivalStarts({ date: '2023-05-08' }, ...year2026)).toEqual([]);
    // Chaharshanbe Suri: the Tuesday evening before the last Wednesday of the Persian year
    const suri = { persian: { month: 1, day: 1 }, before: 'wednesday', offset: -1 } as const;
    expect(inside(festivalStarts(suri, ...year2026))).toEqual(['2026-03-17']);
    expect(festivalStarts(suri, dayFromCivil(2030, 1, 1), dayFromCivil(2030, 12, 31)).map(toIsoDate)).toContain('2030-03-19');
  });
});

describe('other calendars', () => {
  it('finds Western Easter, including its earliest and latest dates', () => {
    const easter = (year: number) => toIsoDate(easterSunday(year));
    expect([2019, 2024, 2025, 2026, 2027].map(easter)).toEqual(['2019-04-21', '2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28']);
    expect(easter(1818)).toBe('1818-03-22');
    expect(easter(2038)).toBe('2038-04-25');
    expect(easter(2285)).toBe('2285-03-22');
  });

  it('converts Julian dates, which drift a day further from Gregorian in 2100', () => {
    expect(toIsoDate(dayFromJulian(2026, 12, 25))).toBe('2027-01-07');
    expect(toIsoDate(dayFromJulian(2099, 12, 25))).toBe('2100-01-07');
    expect(toIsoDate(dayFromJulian(2100, 12, 25))).toBe('2101-01-08');
    expect(toIsoDate(dayFromJulian(1582, 10, 5))).toBe('1582-10-15');
  });

  it('converts Coptic dates: Nayrouz is 11 September, or 12 before a Gregorian leap year', () => {
    expect(toIsoDate(dayFromCoptic(1743, 1, 1))).toBe('2026-09-11');
    expect(toIsoDate(dayFromCoptic(1740, 1, 1))).toBe('2023-09-12');
    expect(toIsoDate(dayFromCoptic(1743, 4, 29))).toBe('2027-01-07');
  });

  it('puts Nowruz on the Tehran date of the equinox, or the next day if it comes after noon there', () => {
    const nowruz = (year: number) => toIsoDate(persianNewYear(year));
    // 2025: the equinox at 09:01 UTC is 12:31 in Tehran, after noon
    expect([2017, 2024, 2025, 2026, 2028].map(nowruz)).toEqual(['2017-03-21', '2024-03-20', '2025-03-21', '2026-03-21', '2028-03-20']);
  });

  it('takes Persian, Coptic and Julian dates as festival rules', () => {
    expect(inside(festivalStarts({ persian: { month: 7, day: 16 } }, ...year2026))).toEqual(['2026-10-08']);
    expect(inside(festivalStarts({ persian: { month: 4, day: 13 } }, ...year2026))).toEqual(['2026-07-04']);
    expect(inside(festivalStarts({ coptic: { month: 1, day: 1 } }, ...year2026))).toEqual(['2026-09-11']);
    expect(inside(festivalStarts({ julian: '12-25' }, ...year2026))).toEqual(['2026-01-07']);
  });
});
