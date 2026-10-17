import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { SEASONS, seasonInstant } from '../../src/core/astro';
import { civilFromDay, dayFromCivil, parseIsoDate, toIsoDate, utcDayOfInstant, weekday } from '../../src/core/days';
import { seasonEvents } from '../../src/core/sky';
import { LEAP_WEEK, MAX_YEAR, MIN_YEAR, fromSolar, hasLeapWeek, toSolar, yearLength, yearStart } from '../../src/core/solar';

const FIRST = dayFromCivil(MIN_YEAR, 4, 1);
const LAST = dayFromCivil(MAX_YEAR, 12, 31);

describe('day numbers', () => {
  it('matches known dates and weekdays', () => {
    expect(dayFromCivil(1970, 1, 1)).toBe(0);
    expect(toIsoDate(dayFromCivil(2000, 2, 29))).toBe('2000-02-29');
    expect(weekday(dayFromCivil(2026, 10, 17))).toBe(5); // Saturday
    expect(parseIsoDate('2026-02-29')).toBeNull();
  });

  it('round-trips every day from 1600 to 2400', () => {
    for (let n = FIRST; n <= LAST; n++) {
      const { year, month, day } = civilFromDay(n);
      expect(dayFromCivil(year, month, day)).toBe(n);
    }
  });
});

describe('equinoxes and solstices', () => {
  const seasonKeys = ['mar_equinox', 'jun_solstice', 'sep_equinox', 'dec_solstice'] as const;

  it('agree with astronomy-engine to within 2 minutes, 1900 to 2100', () => {
    for (let year = 1900; year <= 2100; year++) {
      const reference = Astronomy.Seasons(year);
      SEASONS.forEach((season, i) => {
        const diffMinutes = Math.abs(seasonInstant(year, season) - reference[seasonKeys[i]].date.getTime()) / 60_000;
        expect(diffMinutes, `${season} ${year}`).toBeLessThan(2);
      });
    }
  });

  it('agree with astronomy-engine to within 10 minutes, 1600 to 2400', () => {
    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
      const reference = Astronomy.Seasons(year).mar_equinox.date.getTime();
      expect(Math.abs(seasonInstant(year, 'march-equinox') - reference) / 60_000, String(year)).toBeLessThan(10);
    }
  });

  it('put the March equinox on the same UTC date as astronomy-engine, 1600 to 2400', () => {
    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
      const reference = utcDayOfInstant(Astronomy.Seasons(year).mar_equinox.date.getTime());
      expect(utcDayOfInstant(seasonInstant(year, 'march-equinox')), String(year)).toBe(reference);
    }
  });

  it('never put a year start within 5 minutes of flipping, 1600 to 2400', () => {
    // A one-day error in the equinox date only moves New Year when it crosses the
    // midnight between Monday and Tuesday. The closest call is 2040: 00:11 UTC on
    // Tuesday 20 March, 11.5 minutes clear, against an accuracy of about a minute.
    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
      const instant = seasonInstant(year, 'march-equinox');
      const msIntoDay = ((instant % 86_400_000) + 86_400_000) % 86_400_000;
      const minutesFromMidnight = Math.min(msIntoDay, 86_400_000 - msIntoDay) / 60_000;
      const tuesdayMidnight = weekday(utcDayOfInstant(instant + 43_200_000)) === 1;
      if (tuesdayMidnight) expect(minutesFromMidnight, String(year)).toBeGreaterThan(5);
    }
  });
});

describe('time zones', () => {
  const inZone = <T>(zone: string, run: () => T): T => {
    const saved = process.env.TZ;
    process.env.TZ = zone;
    try { return run(); } finally { process.env.TZ = saved; }
  };

  it('gives the same solar calendar everywhere', () => {
    for (const zone of ['Europe/London', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
      inZone(zone, () => {
        expect(toIsoDate(yearStart(2027)), zone).toBe('2027-03-22');
        expect(toSolar(dayFromCivil(2026, 10, 17)).day, zone).toBe(13);
      });
    }
  });

  it('puts sky events on the viewer’s local date', () => {
    // The 2027 March equinox is at 20:24 UTC on 20 March: still the 20th in
    // New York, already the 21st in Tokyo
    const range: [number, number] = [dayFromCivil(2027, 3, 18), dayFromCivil(2027, 3, 23)];
    const equinoxDate = () => toIsoDate(seasonEvents(...range).find((event) => event.kind === 'march-equinox')!.day);
    expect(inZone('America/New_York', equinoxDate)).toBe('2027-03-20');
    expect(inZone('Asia/Tokyo', equinoxDate)).toBe('2027-03-21');
  });
});

describe('solar calendar', () => {
  it('starts solar 2026 on Monday 23 March 2026', () => {
    expect(toIsoDate(yearStart(2026))).toBe('2026-03-23');
    expect(toSolar(dayFromCivil(2026, 10, 17))).toEqual({ year: 2026, month: 8, day: 13, dayOfYear: 209 });
  });

  it('starts every year on a Monday and makes it 364 or 371 days long', () => {
    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
      expect(weekday(yearStart(year))).toBe(0);
      expect([364, 371]).toContain(yearLength(year));
    }
  });

  it('has 35 leap-week years from 1900 to 2099', () => {
    let count = 0;
    for (let year = 1900; year < 2100; year++) if (hasLeapWeek(year)) count++;
    expect(count).toBe(35);
  });

  it('rejects solar dates that don’t exist', () => {
    expect(hasLeapWeek(2026)).toBe(false);
    expect(() => fromSolar(2026, LEAP_WEEK, 1)).toThrow(RangeError);
    expect(() => fromSolar(2028, LEAP_WEEK, 8)).toThrow(RangeError);
    expect(() => fromSolar(2026, 1, 29)).toThrow(RangeError);
    expect(() => fromSolar(2026, 0, 1)).toThrow(RangeError);
    expect(toIsoDate(fromSolar(2028, LEAP_WEEK, 7))).toBe('2029-03-25');
  });

  it('gives every day a solar date that round-trips, with months starting on Mondays', () => {
    for (let n = FIRST; n <= LAST; n++) {
      const date = toSolar(n);
      expect(fromSolar(date.year, date.month, date.day)).toBe(n);
      expect(date.day).toBeGreaterThanOrEqual(1);
      expect(date.day).toBeLessThanOrEqual(date.month === LEAP_WEEK ? 7 : 28);
      if (date.month === LEAP_WEEK) expect(hasLeapWeek(date.year)).toBe(true);
      if (date.day === 1) expect(weekday(n)).toBe(0);
    }
  });
});
