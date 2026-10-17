import type { DayNumber } from '../core/days';
import { SKY_EVENT_NAMES, type SkyEvent } from '../core/sky';
import { toSolar, yearLength } from '../core/solar';
import type { Festival, NamePack } from '../names/schema';
import type { SunTimes } from '../sky/sun';
import { LOCALE, daysAway, escapeHtml, eventTime, gregorianLong, solarLong } from './format';

export interface DayPanelState {
  selected: DayNumber;
  today: DayNumber;
  pack: NamePack;
  /** Sky events on the selected day */
  events: SkyEvent[];
  /** The next equinox or solstice after the selected day */
  next: SkyEvent;
  /** The pack's festivals on the selected day */
  festivals: Festival[];
}

/** "Sunrise 04:43, sunset 21:21 BST. 16 h 38 min of daylight", in the place's time zone if known */
export function sunText({ rise, set, polar }: SunTimes, timeZone?: string | null): string {
  if (polar) return polar === 'day' ? 'The sun stays up all day' : 'The sun stays down all day';
  const zoneOption = timeZone ? { timeZone } : {};
  const clock = (ms: number) => new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', ...zoneOption }).format(ms);
  const zone = new Intl.DateTimeFormat(LOCALE, { timeZoneName: 'short', ...zoneOption }).formatToParts(rise ?? set ?? 0)
    .find((part) => part.type === 'timeZoneName')?.value ?? '';
  const text = `${rise !== null ? `Sunrise ${clock(rise)}` : 'No sunrise'}, ${set !== null ? `sunset ${clock(set)}` : 'no sunset'} ${zone}`.trim();
  if (rise === null || set === null || set <= rise) return text;
  const minutes = Math.round((set - rise) / 60_000);
  return `${text}. ${Math.floor(minutes / 60)} h ${minutes % 60} min of daylight`;
}

export function renderDayPanel(root: HTMLElement, { selected, today, pack, events, next, festivals }: DayPanelState): void {
  const festivalRow = festivals.length === 0 ? '' : `<div><dt>${festivals.length > 1 ? 'Festivals' : 'Festival'}</dt><dd>${festivals.map((festival) => `
    <p class="festival"><strong lang="${escapeHtml(pack.lang)}">${escapeHtml(festival.name)}</strong>, ${escapeHtml(festival.gloss)}.${festival.say ? ` <span class="say"><span class="say-label">Say</span> ${escapeHtml(festival.say)}</span>.` : ''}
    ${escapeHtml(festival.meaning)}</p>`).join('')}</dd></div>`;
  const date = toSolar(selected);
  const nextWhen = selected === today ? daysAway(today, next.day) : `${next.day - selected} days later`;
  root.innerHTML = `
    <h2 class="day-title" lang="${pack.lang}">${escapeHtml(solarLong(pack, date))}</h2>
    <p class="day-greg">${gregorianLong(selected)}${selected === today ? '<span class="badge">Today</span>' : ''}</p>
    <dl class="facts">
      ${festivalRow}
      <div><dt>Day of the year</dt><dd>${date.dayOfYear} of ${yearLength(date.year)}</dd></div>
      <div><dt>Moon</dt><dd data-moon>&nbsp;</dd></div>
      <div><dt>Sunrise and sunset</dt><dd data-sun>&nbsp;</dd></div>
      ${events.length > 0 ? `<div><dt>On this day</dt><dd>${events.map((event) => `${SKY_EVENT_NAMES[event.kind]} at ${eventTime(event.instant, false)}`).join('<br>')}</dd></div>` : ''}
      <div><dt>Next equinox or solstice</dt><dd>${SKY_EVENT_NAMES[next.kind]}, ${eventTime(next.instant)}, ${nextWhen}</dd></div>
    </dl>
    <div class="actions">
      <button type="button" class="button" data-copy-link>Copy link to this day</button>
      <span class="status" role="status" data-copy-status></span>
    </div>`;
}
