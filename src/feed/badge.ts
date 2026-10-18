import { type DayNumber, dayFromCivil } from '../core/days';
import { toSolar } from '../core/solar';
import type { NamePack } from '../names/schema';
import { solarLong } from '../ui/format';

/**
 * The /today.svg badge: "Solar calendar | 14 October 2026", today's solar
 * date on its month's colour, for READMEs and other pages. Drawn in the
 * reader's own sans-serif, since a page's fonts don't reach an image.
 */

// The 13 month hues of app.css (oklch 0.72 0.13 h) and the leap week's grey, in sRGB
const HUES = ['#6dba70', '#9faf47', '#c5a032', '#de9046', '#ea846d', '#e88097', '#d983c0', '#bf8ce0', '#9a99f3', '#6ca7f5', '#2cb3e4', '#00bcc5', '#29bf9c', '#a4a4a4'];
const INK = '#1d2742';
const PAPER = '#f6f7f9';
const LABEL = 'Solar calendar';

const escapeXml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Roughly how wide text is in 11px Verdana; textLength then fits it exactly */
function textWidth(text: string): number {
  let width = 0;
  for (const c of text) width += /[0-9]/.test(c) ? 7 : /[A-ZÆ]/.test(c) ? 7.5 : c === ' ' ? 3.9 : /[ilj.,']/.test(c) ? 3.1 : 6.3;
  return Math.round(width);
}

export function badgeSvg(pack: NamePack, day: DayNumber): string {
  const date = toSolar(day);
  const value = solarLong(pack, date);
  const [labelText, valueText] = [textWidth(LABEL), textWidth(value)];
  const [labelWidth, valueWidth] = [labelText + 14, valueText + 14];
  const width = labelWidth + valueWidth;
  const title = escapeXml(`${LABEL}: ${value}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}">
<title>${title}</title>
<clipPath id="r"><rect width="${width}" height="20" rx="3"/></clipPath>
<g clip-path="url(#r)">
<rect width="${labelWidth}" height="20" fill="${INK}"/>
<rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${HUES[date.month - 1]}"/>
</g>
<g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-rendering="geometricPrecision">
<text x="7" y="14" textLength="${labelText}" lengthAdjust="spacingAndGlyphs" fill="${PAPER}">${LABEL}</text>
<text x="${labelWidth + 7}" y="14" textLength="${valueText}" lengthAdjust="spacingAndGlyphs" fill="${INK}" lang="${escapeXml(pack.lang)}">${escapeXml(value)}</text>
</g>
</svg>
`;
}

/** Today's day number in an IANA time zone, or in UTC if the zone is missing or unknown, and the seconds until it ends. */
export function todayIn(timeZone: string | null, now: number): { day: DayNumber; secondsLeft: number } {
  let parts: Record<string, number>;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || 'UTC', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
    }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  } catch {
    return todayIn('UTC', now);
  }
  return {
    day: dayFromCivil(parts.year, parts.month, parts.day),
    secondsLeft: 86_400 - (parts.hour * 3600 + parts.minute * 60 + parts.second),
  };
}
