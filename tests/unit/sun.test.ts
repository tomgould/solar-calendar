import { describe, expect, it } from 'vitest';
import { dayFromCivil } from '../../src/core/days';
import { isPlace, sunTimes } from '../../src/sky/sun';

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

  it('validates stored places', () => {
    expect(isPlace({ lat: 51.5, lon: -0.1 })).toBe(true);
    expect(isPlace({ lat: 91, lon: 0 })).toBe(false);
    expect(isPlace(null)).toBe(false);
  });
});
