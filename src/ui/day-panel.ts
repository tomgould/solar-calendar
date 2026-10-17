import type { DayNumber } from '../core/days';
import { SKY_EVENT_NAMES, type SkyEvent } from '../core/sky';
import { toSolar, yearLength } from '../core/solar';
import type { NamePack } from '../names/schema';
import { daysAway, escapeHtml, eventTime, gregorianLong, solarLong } from './format';

export interface DayPanelState {
  selected: DayNumber;
  today: DayNumber;
  pack: NamePack;
  /** Sky events on the selected day */
  events: SkyEvent[];
  /** The next equinox or solstice after the selected day */
  next: SkyEvent;
}

export function renderDayPanel(root: HTMLElement, { selected, today, pack, events, next }: DayPanelState): void {
  const date = toSolar(selected);
  const nextWhen = selected === today ? daysAway(today, next.day) : `${next.day - selected} days later`;
  root.innerHTML = `
    <h2 class="day-title" lang="${pack.lang}">${escapeHtml(solarLong(pack, date))}</h2>
    <p class="day-greg">${gregorianLong(selected)}${selected === today ? '<span class="badge">Today</span>' : ''}</p>
    <dl class="facts">
      <div><dt>Day of the year</dt><dd>${date.dayOfYear} of ${yearLength(date.year)}</dd></div>
      <div><dt>Moon</dt><dd data-moon>&nbsp;</dd></div>
      ${events.length > 0 ? `<div><dt>On this day</dt><dd>${events.map((event) => `${SKY_EVENT_NAMES[event.kind]} at ${eventTime(event.instant, false)}`).join('<br>')}</dd></div>` : ''}
      <div><dt>Next equinox or solstice</dt><dd>${SKY_EVENT_NAMES[next.kind]}, ${eventTime(next.instant)}, ${nextWhen}</dd></div>
    </dl>
    <div class="actions">
      <button type="button" class="button" data-copy-link>Copy link to this day</button>
      <span class="status" role="status" data-copy-status></span>
    </div>`;
}
