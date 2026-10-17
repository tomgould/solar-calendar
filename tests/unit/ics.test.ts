import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { yearStart } from '../../src/core/solar';
import { buildIcs, escapeText, foldLine } from '../../src/feed/ics';
import type { NamePack } from '../../src/names/schema';
import { feedResponse } from '../../src/worker';
import anglo from '../../src/names/packs/anglo-saxon.json';

const pack = anglo as NamePack;
const now = Date.UTC(2026, 9, 17, 12);

const parseEvents = (text: string) =>
  new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent').map((vevent) => new ICAL.Event(vevent));

describe('ICS text', () => {
  it('escapes text values', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long lines at 75 bytes without splitting characters', () => {
    const line = `SUMMARY:${'þ'.repeat(60)}`;
    const folded = foldLine(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.map((part, i) => (i === 0 ? part : part.slice(1))).join('')).toBe(line);
  });

  it('builds a calendar that a real parser reads, one event per day plus sky events', () => {
    const text = buildIcs({ pack, from: yearStart(2026), to: yearStart(2027) - 1, now });
    expect(text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);

    const events = parseEvents(text);
    // Day events have IDs like 20261017-anglo-saxon@solar-calendar; festivals add their name
    const days = events.filter((event) => /^\d{8}-anglo-saxon@/.test(event.uid));
    expect(days).toHaveLength(364);
    const festivals = events.filter((event) => /^\d{8}-anglo-saxon-.+@/.test(event.uid)).map((event) => event.summary);
    expect(festivals.length).toBeGreaterThan(0);
    const today = days.find((event) => event.startDate.toString() === '2026-10-17')!;
    expect(today.summary).toBe('13 Winterfylleþ 2026');
    expect(today.description).toContain('winter full moon');

    const sky = events.filter((event) => !event.startDate.isDate).map((event) => event.summary);
    expect(sky).toEqual(['June solstice', 'September equinox', 'December solstice', 'March equinox']);
  });
});

describe('/feed.ics Worker', () => {
  it('serves last solar year to next, as a calendar', async () => {
    const response = feedResponse(new URL('https://example.org/feed.ics?names=anglo-saxon'), now);
    expect(response.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    const days = parseEvents(await response.text()).filter((event) => /^\d{8}-anglo-saxon@/.test(event.uid));
    expect(days[0].startDate.toString()).toBe('2025-03-24');
    expect(days.at(-1)!.startDate.toString()).toBe('2028-03-19');
    expect(days.some((event) => event.summary === '13 Winterfylleþ 2026')).toBe(true);
  });

  it('falls back to the default pack for an unknown one', async () => {
    const text = await feedResponse(new URL('https://example.org/feed.ics?names=nope'), now).text();
    expect(text).toContain('SUMMARY:13 October 2026');
  });
});
