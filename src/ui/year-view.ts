import { type DayNumber, civilFromDay } from '../core/days';
import { SKY_EVENT_NAMES, seasonEvents } from '../core/sky';
import { DAYS_PER_MONTH, LEAP_WEEK, MAX_YEAR, MIN_YEAR, fromSolar, monthsInYear, yearLength, yearStart } from '../core/solar';
import { festivalsBetween } from '../names/festivals';
import type { NamePack } from '../names/schema';
import { WEEKDAYS, escapeHtml, eventTime, forDisplayFont, gregorianDate, gregorianLong, gregorianShort, hueClass, monthGloss, monthName } from './format';

export interface YearViewState {
  year: number;
  today: DayNumber;
  pack: NamePack;
}

/**
 * The perennial table: one row per day of the month, one column per month.
 * It only works because every month is identical, so row 1 is always Monday.
 */
export class YearView {
  constructor(private readonly root: HTMLElement, onSelect: (day: DayNumber) => void) {
    this.root.querySelector('#almanac')!.addEventListener('click', (event) => {
      const cell = (event.target as Element).closest<HTMLElement>('td[data-day]');
      if (cell) onSelect(Number(cell.dataset.day));
    });
  }

  render({ year, today, pack }: YearViewState): void {
    const start = yearStart(year);
    const length = yearLength(year);
    const months = monthsInYear(year);
    const lang = `lang="${pack.lang}"`;

    this.root.querySelector('#year-title')!.textContent = `Solar year ${year}`;
    this.root.querySelector('#year-span')!.textContent =
      `${gregorianDate(start)} to ${gregorianDate(start + length - 1)}, ${length} days${months === LEAP_WEEK ? ', ending with a leap week' : ''}`;
    this.root.querySelector<HTMLButtonElement>('#prev-year')!.disabled = year <= MIN_YEAR;
    this.root.querySelector<HTMLButtonElement>('#next-year')!.disabled = year >= MAX_YEAR;

    const head = `<thead><tr><th scope="col"><span class="visually-hidden">Day</span></th>${Array.from({ length: months }, (_, i) =>
      `<th scope="col" class="${hueClass(i + 1)}" ${lang}>${escapeHtml(forDisplayFont(monthName(pack, i + 1)))}</th>`).join('')}</tr></thead>`;

    const festivalNames = new Map<DayNumber, string[]>();
    for (const { day, festival } of festivalsBetween(pack, start, start + length - 1)) {
      festivalNames.set(day, [...(festivalNames.get(day) ?? []), festival.name]);
    }
    const rows = Array.from({ length: DAYS_PER_MONTH }, (_, r) => {
      const dayOfMonth = r + 1;
      const cells = Array.from({ length: months }, (_, m) => {
        const month = m + 1;
        if (month === LEAP_WEEK && dayOfMonth > 7) return '<td class="empty"></td>';
        const day = fromSolar(year, month, dayOfMonth);
        const gregorianDay = civilFromDay(day).day;
        const startsMonth = dayOfMonth === 1 || gregorianDay === 1;
        const festivalsHere = festivalNames.get(day) ?? [];
        const classes = [startsMonth ? 'is-new-month' : '', day === today ? 'is-today' : '', festivalsHere.length ? 'has-festival' : ''].filter(Boolean).join(' ');
        const title = [gregorianLong(day), ...festivalsHere].map(escapeHtml).join(', ');
        return `<td data-day="${day}"${classes ? ` class="${classes}"` : ''} title="${title}">${startsMonth ? gregorianShort(day) : gregorianDay}</td>`;
      }).join('');
      const weekEnd = dayOfMonth % 7 === 0 && dayOfMonth < DAYS_PER_MONTH ? ' class="week-end"' : '';
      return `<tr${weekEnd}><th scope="row"><span class="n">${dayOfMonth}</span> ${WEEKDAYS[r % 7].slice(0, 3)}</th>${cells}</tr>`;
    }).join('');
    this.root.querySelector('#almanac')!.innerHTML = `${head}<tbody>${rows}</tbody>`;
    this.fitHeaders();
    // Widths change once the display font arrives, so measure again then
    void document.fonts.ready.then(() => this.fitHeaders());

    this.root.querySelector('#year-seasons')!.innerHTML = seasonEvents(start, start + length - 1)
      .map((event) => `<li><span class="event-name">${SKY_EVENT_NAMES[event.kind]}</span> ${eventTime(event.instant)}</li>`)
      .join('');

    this.root.querySelector('#year-legend')!.innerHTML = Array.from({ length: months }, (_, i) => {
      const month = i + 1;
      return `<li class="${hueClass(month)}"><span class="swatch"></span><span><span class="legend-name" ${lang}>${escapeHtml(monthName(pack, month))}</span> <span class="legend-gloss">${escapeHtml(monthGloss(pack, month))}</span></span></li>`;
    }).join('');
  }

  /** Shrink month names that don't fit their column, rather than breaking them mid-word. */
  private fitHeaders(): void {
    for (const header of this.root.querySelectorAll<HTMLElement>('.almanac thead th[lang]')) {
      header.style.fontSize = '';
      header.style.overflowWrap = '';
      for (let size = 16; header.scrollWidth > header.clientWidth && size > 11; size--) {
        header.style.fontSize = `${size - 1}px`;
      }
      if (header.scrollWidth > header.clientWidth) header.style.overflowWrap = 'anywhere';
    }
  }
}
