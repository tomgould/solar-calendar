import { describe, expect, it } from 'vitest';
import { dayFromCivil, toIsoDate } from '../../src/core/days';
import { HOLIDAY_SETS, defaultHolidaySetIds, holidaySet, holidaySets } from '../../src/holidays/registry';
import { festivalLabel, festivalMeaning, festivalOccurrences, festivalsFrom } from '../../src/names/festivals';
import { validateHolidaySet } from '../../src/names/schema';
import { festivalKind, sourceName } from '../../src/ui/festivals';
import govUk from '../fixtures/gov-uk-bank-holidays.json';
import nagerIreland from '../fixtures/nager-ireland-public-holidays.json';
import opm from '../fixtures/opm-federal-holidays.json';

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

  it('are all on by default, the UK first', () => {
    expect(HOLIDAY_SETS.map((set) => set.title)).toEqual(['England and Wales', 'Northern Ireland', 'Scotland', 'Ireland', 'United States']);
    expect(defaultHolidaySetIds()).toBe('uk-england-and-wales,uk-northern-ireland,uk-scotland,ireland,us-federal');
  });

  it('show a holiday kept in several regions once, naming them all', () => {
    const shown = (ids: string, from: [number, number, number], to: [number, number, number]) =>
      festivalsFrom(holidaySets(ids), dayFromCivil(...from), dayFromCivil(...to), true)
        .map((entry) => [toIsoDate(entry.day), festivalLabel(entry), entry.regions?.map((set) => set.title)]);
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

/** Days off in a year from a set's rules, with names: "2026-07-03 Independence Day" */
const namedDaysOff = (id: string, year: number) =>
  festivalOccurrences(holidaySet(id)!, dayFromCivil(year, 1, 1), dayFromCivil(year, 12, 31))
    .filter((entry) => entry.dayOff).map((entry) => `${toIsoDate(entry.day)} ${entry.festival.name}`).sort();
const sameApostrophes = (text: string) => text.replace(/'/g, '’');

describe('US federal holidays', () => {
  // OPM's list (holidays.ics, saved in tests/fixtures) gives the days off, already moved off weekends.
  // Inauguration Day is only for federal staff around Washington, DC, so the set leaves it out
  it('match OPM’s list, every year it covers', () => {
    const years = [...new Set(opm.map((holiday) => Number(holiday.date.slice(0, 4))))];
    expect(years.length).toBeGreaterThan(5);
    for (const year of years) {
      const expected = opm.filter((holiday) => holiday.date.startsWith(`${year}-`) && holiday.name !== 'Inauguration Day')
        .map((holiday) => `${holiday.date} ${sameApostrophes(holiday.name)}`).sort();
      expect(namedDaysOff('us-federal', year), String(year)).toEqual(expected);
    }
  });

  it('move a weekend holiday to the nearest weekday, as "observed"', () => {
    const set = holidaySet('us-federal')!;
    const shown = (from: [number, number, number], to: [number, number, number]) => festivalOccurrences(set, dayFromCivil(...from), dayFromCivil(...to))
      .sort((a, b) => a.day - b.day).map((entry) => [toIsoDate(entry.day), festivalLabel(entry), entry.dayOff]);
    // Saturday 4 July 2026: Friday off
    expect(shown([2026, 7, 3], [2026, 7, 4])).toEqual([['2026-07-03', 'Independence Day (observed)', true], ['2026-07-04', 'Independence Day', false]]);
    // Saturday 1 January 2022: Friday 31 December 2021 off
    expect(shown([2021, 12, 31], [2022, 1, 1])).toEqual([['2021-12-31', 'New Year’s Day (observed)', true], ['2022-01-01', 'New Year’s Day', false]]);
    // Sunday: Monday off
    expect(shown([2022, 12, 25], [2022, 12, 26])).toEqual([['2022-12-25', 'Christmas Day', false], ['2022-12-26', 'Christmas Day (observed)', true]]);
  });

  it('follow the changes since 1971', () => {
    // Veterans Day was the fourth Monday in October from 1971 to 1977; Martin Luther King Day began in 1986
    expect(namedDaysOff('us-federal', 1975)).toContain('1975-10-27 Veterans Day');
    expect(namedDaysOff('us-federal', 1978)).toContain('1978-11-10 Veterans Day');
    expect(namedDaysOff('us-federal', 1985).some((day) => day.includes('King'))).toBe(false);
    expect(namedDaysOff('us-federal', 1986)).toContain('1986-01-20 Birthday of Martin Luther King, Jr.');
    expect(namedDaysOff('us-federal', 2020).some((day) => day.includes('Juneteenth'))).toBe(false);
    expect(namedDaysOff('us-federal', 1970)).toEqual([]);
  });
});

describe('Ireland’s public holidays', () => {
  // Ireland publishes no list a program can read, so the reference is Nager.Date's,
  // which leaves out the one-off holiday on 18 March 2022
  const MISSING_FROM_NAGER = ['2022-03-18'];

  it('match Nager.Date’s list, every year it covers', () => {
    const years = [...new Set(nagerIreland.map((holiday) => Number(holiday.date.slice(0, 4))))];
    expect(years.length).toBeGreaterThan(5);
    for (const year of years) {
      const expected = nagerIreland.filter((holiday) => holiday.date.startsWith(`${year}-`)).map((holiday) => holiday.date);
      const ours = festivalOccurrences(holidaySet('ireland')!, dayFromCivil(year, 1, 1), dayFromCivil(year, 12, 31))
        .map((entry) => toIsoDate(entry.day)).filter((date) => !MISSING_FROM_NAGER.includes(date));
      expect(ours.sort(), String(year)).toEqual(expected.sort());
    }
  });

  it('don’t move off weekends, and keep St Brigid’s Day on a Friday 1 February', () => {
    // Christmas 2022 was a Sunday: no substitute day in Ireland
    expect(festivalOccurrences(holidaySet('ireland')!, dayFromCivil(2022, 12, 24), dayFromCivil(2022, 12, 31)).map((entry) => toIsoDate(entry.day)).sort())
      .toEqual(['2022-12-25', '2022-12-26']);
    const brigid = (year: number) => namedDaysOff('ireland', year).find((day) => day.includes('Brigid'));
    expect(brigid(2022)).toBeUndefined();
    expect(brigid(2023)).toBe('2023-02-06 St Brigid’s Day');
    expect(brigid(2026)).toBe('2026-02-02 St Brigid’s Day');
    expect(brigid(2030)).toBe('2030-02-01 St Brigid’s Day');
  });
});

describe('holidays from several countries', () => {
  const all = defaultHolidaySetIds();
  const on = (date: [number, number, number]) => festivalsFrom(holidaySets(all), dayFromCivil(...date), dayFromCivil(...date), true);

  it('show once, named by country when all its sets keep it', () => {
    // Christmas 2026 is a Friday, a day off everywhere
    expect(on([2026, 12, 25]).map((entry) => [festivalLabel(entry), sourceName(entry)])).toEqual([['Christmas Day', 'UK, Ireland and US public holiday']]);
    // Each set's meaning explains its own country's rules, so a holiday shared across countries has none
    expect(on([2026, 12, 25]).map(festivalMeaning)).toEqual(['']);
    expect(on([2026, 11, 26]).map(festivalMeaning)[0]).toMatch(/fourth Thursday/);
    expect(on([2026, 3, 17]).map(sourceName)).toEqual(['Northern Ireland and Ireland public holiday']);
    expect(on([2026, 11, 26]).map(sourceName)).toEqual(['US federal holiday']);
    expect(on([2026, 5, 4]).map((entry) => `${festivalLabel(entry)}: ${sourceName(entry)}`)).toEqual(['Early May bank holiday: UK bank holiday', 'May Day: Ireland public holiday']);
    expect(on([2026, 4, 5]).map((entry) => [festivalKind(entry), sourceName(entry)])).toEqual([['Holiday', 'UK holiday']]);
  });
});
