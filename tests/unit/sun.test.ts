import { describe, expect, it } from 'vitest';
import { dayFromCivil } from '../../src/core/days';
import { isPlace, placeTimeZone, sunTimes, zonedMidnight } from '../../src/sky/sun';

const inLondonTime = async <T>(run: () => Promise<T>): Promise<T> => {
  const saved = process.env.TZ;
  process.env.TZ = 'Europe/London';
  try { return await run(); } finally { process.env.TZ = saved; }
};

const clock = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(ms);
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe('sunrise and sunset', () => {
  it('matches published London times on the June solstice, within 3 minutes', async () => {
    // Published: sunrise 04:43, sunset 21:21 BST on 21 June
    const times = await inLondonTime(() => sunTimes(dayFromCivil(2026, 6, 21), { lat: 51.5074, lon: -0.1278 }));
    expect(Math.abs(minutes(clock(times.rise!)) - minutes('04:43'))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutes(clock(times.set!)) - minutes('21:21'))).toBeLessThanOrEqual(3);
    expect(times.polar).toBeNull();
  });

  it('reports polar day and polar night', async () => {
    const tromso = { lat: 69.6496, lon: 18.956 };
    const summer = await inLondonTime(() => sunTimes(dayFromCivil(2026, 6, 21), tromso));
    const winter = await inLondonTime(() => sunTimes(dayFromCivil(2026, 12, 21), tromso));
    expect(summer).toMatchObject({ rise: null, set: null, polar: 'day' });
    expect(winter).toMatchObject({ rise: null, set: null, polar: 'night' });
  });

  it('gives a far-away place its own day and time zone', async () => {
    const sydney = { lat: -33.8688, lon: 151.2093 };
    const zone = await placeTimeZone(sydney);
    expect(zone).toBe('Australia/Sydney');
    // From a London device: published Sydney times on 21 June are 07:00 and 16:54 AEST
    const times = await inLondonTime(() => sunTimes(dayFromCivil(2026, 6, 21), sydney, zone));
    const local = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit' }).format(ms);
    expect(Math.abs(minutes(local(times.rise!)) - minutes('07:00'))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutes(local(times.set!)) - minutes('16:54'))).toBeLessThanOrEqual(3);
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(times.rise!)).toBe('2026-06-21');
  });

  it('finds midnight in a time zone, across daylight saving', () => {
    expect(new Date(zonedMidnight(2026, 6, 21, 'Australia/Sydney')).toISOString()).toBe('2026-06-20T14:00:00.000Z');
    expect(new Date(zonedMidnight(2026, 3, 29, 'Europe/London')).toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(new Date(zonedMidnight(2026, 3, 30, 'Europe/London')).toISOString()).toBe('2026-03-29T23:00:00.000Z');
    // Where the clocks skip midnight, the day starts at 01:00
    expect(new Date(zonedMidnight(2026, 9, 6, 'America/Santiago')).toISOString()).toBe('2026-09-06T04:00:00.000Z');
    expect(new Date(zonedMidnight(2026, 3, 8, 'America/Havana')).toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(new Date(zonedMidnight(2026, 3, 29, 'Asia/Beirut')).toISOString()).toBe('2026-03-28T22:00:00.000Z');
  });

  it('validates stored places', () => {
    expect(isPlace({ lat: 51.5, lon: -0.1 })).toBe(true);
    expect(isPlace({ lat: 91, lon: 0 })).toBe(false);
    expect(isPlace(null)).toBe(false);
  });
});
