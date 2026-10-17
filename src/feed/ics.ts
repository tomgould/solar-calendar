import { type DayNumber, civilFromDay } from '../core/days';
import { SKY_EVENT_NAMES, seasonEvents } from '../core/sky';
import { LEAP_WEEK, toSolar, yearLength } from '../core/solar';
import type { NamePack } from '../names/schema';
import { monthGloss, monthName, solarLong } from '../ui/format';

/**
 * iCalendar (RFC 5545) text for a range of days: one all-day event per day
 * titled with its solar date, plus the equinoxes and solstices at their exact
 * times. Used by the download button and by the /feed.ics Worker.
 */

export interface IcsOptions {
  pack: NamePack;
  /** First and last day, inclusive */
  from: DayNumber;
  to: DayNumber;
  /** ms since the epoch, for DTSTAMP */
  now: number;
}

const encoder = new TextEncoder();

/** Escape a TEXT value: backslash, semicolon, comma and newlines. */
export function escapeText(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
}

/** Fold a content line to at most 75 octets, never splitting a character. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    // Continuation lines start with a space, which counts towards their 75
    if (bytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += character;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function dateValue(n: DayNumber): string {
  const { year, month, day } = civilFromDay(n);
  return `${pad(year, 4)}${pad(month)}${pad(day)}`;
}

function utcValue(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function buildIcs({ pack, from, to, now }: IcsOptions): string {
  const stamp = utcValue(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Solar calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`Solar calendar (${pack.title})`)}`,
    `X-WR-CALDESC:${escapeText('Each day\'s date in the 13-month solar calendar, with the equinoxes and solstices.')}`,
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
  ];

  for (let day = from; day <= to; day++) {
    const date = toSolar(day);
    const description = date.month === LEAP_WEEK
      ? `${monthName(pack, date.month)}: ${monthGloss(pack, date.month)}. Day ${date.dayOfYear} of ${yearLength(date.year)}.`
      : `Month ${date.month} of 13, ${monthName(pack, date.month)}: ${monthGloss(pack, date.month)}. Day ${date.dayOfYear} of ${yearLength(date.year)}.`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${dateValue(day)}-${pack.id}@solar-calendar`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateValue(day)}`,
      `DTEND;VALUE=DATE:${dateValue(day + 1)}`,
      `SUMMARY:${escapeText(solarLong(pack, date))}`,
      `DESCRIPTION:${escapeText(description)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  for (const event of seasonEvents(from, to)) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.kind}-${utcValue(event.instant)}@solar-calendar`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcValue(event.instant)}`,
      'DURATION:PT1M',
      `SUMMARY:${escapeText(SKY_EVENT_NAMES[event.kind])}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
