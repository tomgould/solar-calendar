import { describe, expect, it } from 'vitest';
import { dayFromCivil, toIsoDate, weekday } from '../../src/core/days';
import { festivalDays, festivalStarts, ruleProblem } from '../../src/core/festivals';
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
    expect(ruleProblem({ moon: 'full' })).toMatch(/needs/);
  });
});
