import { describe, expect, it } from 'vitest';
import { dayFromCivil, toIsoDate } from '../../src/core/days';
import { HOLIDAY_SETS, defaultHolidaySetId, holidaySet } from '../../src/holidays/registry';
import { festivalLabel, festivalOccurrences } from '../../src/names/festivals';
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

  it('are on by default only on UK time', () => {
    expect(HOLIDAY_SETS.map((set) => set.title)).toEqual(['England and Wales', 'Northern Ireland', 'Scotland']);
    expect(defaultHolidaySetId('Europe/London')).toBe('uk-england-and-wales');
    expect(defaultHolidaySetId('America/New_York')).toBeNull();
  });
});
