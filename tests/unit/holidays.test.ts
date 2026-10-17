import { describe, expect, it } from 'vitest';
import { dayFromCivil, toIsoDate } from '../../src/core/days';
import { HOLIDAY_SETS, defaultHolidaySetIds, holidaySet, holidaySets } from '../../src/holidays/registry';
import { festivalLabel, festivalOccurrences, festivalsFrom } from '../../src/names/festivals';
import { validateHolidaySet } from '../../src/names/schema';
import govUk from '../fixtures/gov-uk-bank-holidays.json';

/**
 * GOV.UK's own list (https://www.gov.uk/bank-holidays.json, saved in
 * tests/fixtures) is the reference. When the government announces a one-off,
 * the weekly holidays workflow updates the saved copy and this test fails
 * until the region's file in src/holidays/ has it too.
 */
const daysOff = (id: string, year: number) =>
  festivalOccurrences(holidaySet(id)!, dayFromCivil(year, 1, 1), dayFromCivil(year, 12, 31))
    .filter((entry) => entry.dayOff).map((entry) => toIsoDate(entry.day)).sort();

describe('UK bank holidays', () => {
  for (const [region, { events }] of Object.entries(govUk)) {
    it(`match GOV.UK's list for ${region}, every year it covers`, () => {
      const years = [...new Set(events.map((event) => Number(event.date.slice(0, 4))))];
      for (const year of years) {
        const expected = events.filter((event) => event.date.startsWith(`${year}-`)).map((event) => event.date).sort();
        expect(daysOff(`uk-${region}`, year), `${region} ${year}`).toEqual(expected);
      }
    });
  }

  it('give a weekday in place of a holiday at the weekend, as "substitute day"', () => {
    // Christmas 2021 was a Saturday: Christmas moves to Monday 27, Boxing Day to Tuesday 28
    const set = holidaySet('uk-england-and-wales')!;
    const december = festivalOccurrences(set, dayFromCivil(2021, 12, 24), dayFromCivil(2021, 12, 31))
      .sort((a, b) => a.day - b.day);
    expect(december.map((entry) => [toIsoDate(entry.day), festivalLabel(entry), entry.dayOff ?? false])).toEqual([
      ['2021-12-25', 'Christmas Day', false],
      ['2021-12-26', 'Boxing Day', false],
      ['2021-12-27', 'Christmas Day (substitute day)', true],
      ['2021-12-28', 'Boxing Day (substitute day)', true],
    ]);
  });

  it('include Easter Sunday, which isn’t a day off', () => {
    const easter = festivalOccurrences(holidaySet('uk-scotland')!, dayFromCivil(2026, 4, 5), dayFromCivil(2026, 4, 5));
    expect(easter.map((entry) => [entry.festival.name, entry.dayOff])).toEqual([['Easter Sunday', false]]);
  });

  it('leave out holidays before they began', () => {
    expect(daysOff('uk-england-and-wales', 1969)).toEqual(['1969-04-04', '1969-04-07', '1969-12-25', '1969-12-26']);
    expect(daysOff('uk-scotland', 2006)).not.toContain('2006-11-30');
  });

  it('reject a holiday file with a malformed move', () => {
    const set = structuredClone(holidaySet('uk-england-and-wales')!);
    set.festivals[0].moves = { 2020: ['05-08'] } as unknown as Record<string, string>;
    expect(() => validateHolidaySet(set, 'test.json')).toThrow(/"moves"/);
  });

  it('are on by default only on UK time', () => {
    expect(HOLIDAY_SETS.map((set) => set.title)).toEqual(['England and Wales', 'Northern Ireland', 'Scotland']);
    expect(defaultHolidaySetIds('Europe/London')).toBe('uk-england-and-wales');
    expect(defaultHolidaySetIds('America/New_York')).toBe('');
  });

  it('show a holiday kept in several regions once, naming them all', () => {
    const shown = (ids: string, from: [number, number, number], to: [number, number, number]) =>
      festivalsFrom(holidaySets(ids), dayFromCivil(...from), dayFromCivil(...to), true)
        .map((entry) => [toIsoDate(entry.day), festivalLabel(entry), entry.regions]);
    const all = 'uk-england-and-wales,uk-northern-ireland,uk-scotland';
    expect(shown(all, [2026, 12, 25], [2026, 12, 25])).toEqual([['2026-12-25', 'Christmas Day', ['England and Wales', 'Northern Ireland', 'Scotland']]]);
    // Easter Monday isn't a Scottish holiday, and St Andrew's Day is only Scottish
    expect(shown(all, [2026, 4, 6], [2026, 4, 6])).toEqual([['2026-04-06', 'Easter Monday', ['England and Wales', 'Northern Ireland']]]);
    expect(shown(all, [2026, 11, 30], [2026, 11, 30])).toEqual([['2026-11-30', 'St Andrew’s Day', ['Scotland']]]);
    // Same name, different days: Scotland's summer holiday is early in August
    expect(shown('uk-england-and-wales,uk-scotland', [2026, 8, 1], [2026, 8, 31]).map(([date, name]) => `${date} ${name}`))
      .toEqual(['2026-08-03 Summer bank holiday', '2026-08-31 Summer bank holiday']);
    expect(holidaySets('uk-scotland,nope,uk-england-and-wales').map((set) => set.id)).toEqual(['uk-england-and-wales', 'uk-scotland']);
  });
});
