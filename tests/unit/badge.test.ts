import { describe, expect, it } from 'vitest';
import { dayFromCivil } from '../../src/core/days';
import { badgeSvg, todayIn } from '../../src/feed/badge';
import type { NamePack } from '../../src/names/schema';
import { badgeResponse } from '../../src/worker';
import anglo from '../../src/names/packs/anglo-saxon.json';

const pack = anglo as NamePack;

describe('/today.svg badge', () => {
  it('shows today’s solar date in UTC, on its month’s colour', async () => {
    const response = badgeResponse(new URL('https://example.org/today.svg?names=anglo-saxon'), Date.UTC(2026, 9, 17, 12));
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    // Cached until the day ends, at most an hour
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    const svg = await response.text();
    expect(svg).toContain('aria-label="Solar calendar: 13 Winterfylleþ 2026"');
    expect(svg).toContain('>13 Winterfylleþ 2026</text>');
    // Month 8's hue, under the design kit's ink
    expect(svg).toContain('fill="#bf8ce0"');
    expect(svg).toContain('fill="#14110d"');
    expect(svg.match(/<text/g)).toHaveLength(2);
    expect(svg.match(/<\/text>/g)).toHaveLength(2);
  });

  it('uses the date in a time zone when asked, and UTC for an unknown one', async () => {
    const now = Date.UTC(2026, 9, 17, 23, 30);
    const kiritimati = await badgeResponse(new URL('https://example.org/today.svg?names=anglo-saxon&tz=Pacific/Kiritimati'), now).text();
    expect(kiritimati).toContain('>14 Winterfylleþ 2026<');
    const unknown = badgeResponse(new URL('https://example.org/today.svg?names=anglo-saxon&tz=Nowhere/At_all'), now);
    expect(await unknown.text()).toContain('>13 Winterfylleþ 2026<');
    expect(unknown.headers.get('Cache-Control')).toBe('public, max-age=1800');
    expect(todayIn('Pacific/Kiritimati', now)).toEqual({ day: dayFromCivil(2026, 10, 18), secondsLeft: 86_400 - 13.5 * 3600 });
  });

  it('falls back to the Gregorian names, and names the leap week', () => {
    const svg = badgeResponse(new URL('https://example.org/today.svg?names=nope'), Date.UTC(2026, 9, 17, 12));
    expect(svg.headers.get('Content-Type')).toContain('svg');
    // 19 March 2029 is day 1 of solar 2028's leap week, drawn in grey
    const leap = badgeSvg(pack, dayFromCivil(2029, 3, 19));
    expect(leap).toContain(`>${pack.leapWeek.name}, day 1, 2028<`);
    expect(leap).toContain('fill="#a4a4a4"');
  });

  it('escapes names', () => {
    const odd = { ...pack, months: pack.months.map((month) => ({ ...month, name: 'A & <B>' })) };
    const svg = badgeSvg(odd, dayFromCivil(2026, 10, 17));
    expect(svg).toContain('13 A &#38; &#60;B&#62; 2026');
    expect(svg).not.toContain('<B>');
  });
});
