import { type DayNumber, civilFromDay } from '../core/days';
import { SKY_EVENT_NAMES, type SkyEvent } from '../core/sky';
import { LEAP_WEEK, daysInMonth, fromSolar, monthsInYear, toSolar } from '../core/solar';
import type { NamePack } from '../names/schema';
import { WEEKDAYS, escapeHtml, forDisplayFont, gregorianLong, gregorianShort, hueClass, monthGloss, monthName, solarLong } from './format';
import type { FestivalDay } from '../names/festivals';
import { EVENT_ICONS, FESTIVAL_ICON } from './icons';

export interface MonthViewState {
  selected: DayNumber;
  today: DayNumber;
  pack: NamePack;
  events: SkyEvent[];
  festivals: FestivalDay[];
}

export interface MonthViewHandlers {
  select(day: DayNumber, options?: { focus?: boolean }): void;
  goToMonth(year: number, month: number): void;
  shiftMonth(delta: number, options?: { focus?: boolean }): void;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * The perennial grid. Its 28 cells and their numerals are built once; moving
 * between months only changes the Gregorian labels, marks and colour.
 */
export class MonthView {
  private readonly cells: HTMLButtonElement[] = [];
  private readonly rows: HTMLTableRowElement[] = [];
  private shown: { year: number; month: number } | null = null;

  constructor(private readonly root: HTMLElement, private readonly handlers: MonthViewHandlers) {
    this.build();
    this.root.querySelector('#grid-body')!.addEventListener('keydown', (event) => this.onKey(event as KeyboardEvent));
    this.root.querySelector('#month-strip')!.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-month]');
      if (button && this.shown) this.handlers.goToMonth(this.shown.year, Number(button.dataset.month));
    });
  }

  private build(): void {
    this.root.querySelector('#grid-head')!.innerHTML = WEEKDAYS.map((day) => `<th scope="col"><abbr title="${day}">${day.slice(0, 3)}</abbr></th>`).join('');
    const body = this.root.querySelector<HTMLTableSectionElement>('#grid-body')!;
    for (let row = 0; row < 4; row++) {
      const tr = body.insertRow();
      this.rows.push(tr);
      for (let column = 0; column < 7; column++) {
        const index = row * 7 + column;
        const td = tr.insertCell();
        td.setAttribute('role', 'gridcell');
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.tabIndex = -1;
        // The visible parts are hidden from screen readers; the hidden name reads
        // in full and starts with the visible numeral, for voice control users
        cell.innerHTML = `<span class="num" aria-hidden="true">${index + 1}</span><span class="greg" aria-hidden="true"></span>`
          + '<span class="marks" aria-hidden="true"></span><span class="visually-hidden name"></span>';
        cell.addEventListener('click', () => {
          const day = this.dayAt(index);
          if (day !== null) this.handlers.select(day, { focus: true });
        });
        td.append(cell);
        this.cells.push(cell);
      }
    }
  }

  render({ selected, today, pack, events, festivals }: MonthViewState, focusSelected = false): void {
    const date = toSolar(selected);
    const changedMonth = this.shown !== null && (this.shown.year !== date.year || this.shown.month !== date.month);
    this.shown = { year: date.year, month: date.month };
    const first = fromSolar(date.year, date.month, 1);
    const length = daysInMonth(date.month);

    this.root.classList.remove(...[...this.root.classList].filter((name) => name.startsWith('hue-')));
    this.root.classList.add(hueClass(date.month));
    const name = this.root.querySelector<HTMLElement>('#month-name')!;
    name.textContent = forDisplayFont(monthName(pack, date.month));
    name.lang = pack.lang;
    this.root.querySelector('#month-year')!.textContent = String(date.year);
    this.root.querySelector('#month-gloss')!.textContent = monthGloss(pack, date.month);
    const say = date.month === LEAP_WEEK ? pack.leapWeek.say : pack.months[date.month - 1].say;
    const sayElement = this.root.querySelector<HTMLElement>('#month-say')!;
    sayElement.hidden = !say;
    sayElement.innerHTML = say ? `<span class="say-label">Say</span> ${escapeHtml(say)}` : '';
    // Printed under the grid
    const meaning = date.month === LEAP_WEEK ? pack.leapWeek.meaning : pack.months[date.month - 1].meaning;
    this.root.querySelector('#month-meaning')!.textContent = `${monthName(pack, date.month)}: ${meaning}`;
    this.root.querySelector('#month-place')!.textContent = date.month === LEAP_WEEK
      ? `The leap week, ${gregorianShort(first)} to ${gregorianShort(first + 6, true)}`
      : `Month ${date.month} of 13, ${gregorianShort(first)} to ${gregorianShort(first + 27, true)}`;
    this.renderStrip(date.year, date.month, today, pack);

    const eventsByDay = new Map<DayNumber, SkyEvent[]>();
    for (const event of events) eventsByDay.set(event.day, [...(eventsByDay.get(event.day) ?? []), event]);
    const festivalsByDay = new Map<DayNumber, string[]>();
    for (const { day, festival } of festivals) festivalsByDay.set(day, [...(festivalsByDay.get(day) ?? []), festival.name]);

    this.rows.forEach((row, index) => { row.hidden = index * 7 >= length; });
    this.cells.forEach((cell, index) => {
      if (index >= length) return;
      const day = first + index;
      const gregorianDay = civilFromDay(day).day;
      const startsMonth = index === 0 || gregorianDay === 1;
      const label = cell.querySelector<HTMLElement>('.greg')!;
      label.textContent = startsMonth ? gregorianShort(day) : String(gregorianDay);
      label.classList.toggle('is-new-month', startsMonth);

      const dayEvents = eventsByDay.get(day) ?? [];
      const dayFestivals = festivalsByDay.get(day) ?? [];
      cell.querySelector('.marks')!.innerHTML = (dayFestivals.length > 0 ? FESTIVAL_ICON : '')
        + dayEvents.map((event) => EVENT_ICONS[event.kind] ?? '').join('');
      if (day === today) cell.setAttribute('aria-current', 'date');
      else cell.removeAttribute('aria-current');
      cell.parentElement!.setAttribute('aria-selected', String(day === selected));
      cell.tabIndex = day === selected ? 0 : -1;
      cell.querySelector('.name')!.textContent = [
        solarLong(pack, toSolar(day)),
        gregorianLong(day),
        day === today ? 'today' : '',
        ...dayFestivals,
        ...dayEvents.map((event) => SKY_EVENT_NAMES[event.kind]),
      ].filter(Boolean).join(', ');
    });

    // The one motion moment: numerals stay put while the Gregorian layer fades in
    if (changedMonth && !reduceMotion.matches) {
      for (const label of this.root.querySelectorAll('.greg, .marks')) {
        label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      }
    }
    if (focusSelected) this.cells[selected - first]?.focus();
  }

  private renderStrip(year: number, active: number, today: DayNumber, pack: NamePack): void {
    const now = toSolar(today);
    this.root.querySelector('#month-strip')!.innerHTML = Array.from({ length: monthsInYear(year) }, (_, i) => {
      const month = i + 1;
      const name = escapeHtml(monthName(pack, month));
      const isTodaysMonth = now.year === year && now.month === month;
      return `<li><button type="button" data-month="${month}" class="${hueClass(month)}${isTodaysMonth ? ' is-today' : ''}"`
        + `${month === active ? ' aria-current="true"' : ''}`
        + ` title="${name}"><span class="bar"></span><span class="label" aria-hidden="true">${month === LEAP_WEEK ? '+' : month}</span>`
        + `<span class="visually-hidden">${month === LEAP_WEEK ? '' : `${month} `}${name}${isTodaysMonth ? ', this month' : ''}</span></button></li>`;
    }).join('');
  }

  private dayAt(index: number): DayNumber | null {
    return this.shown ? fromSolar(this.shown.year, this.shown.month, 1) + index : null;
  }

  private onKey(event: KeyboardEvent): void {
    const index = this.cells.indexOf(document.activeElement as HTMLButtonElement);
    const day = this.dayAt(index);
    if (index < 0 || day === null) return;
    const moves: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -(index % 7), End: 6 - (index % 7),
    };
    if (event.key in moves) {
      event.preventDefault();
      this.handlers.select(day + moves[event.key], { focus: true });
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      this.handlers.shiftMonth(event.key === 'PageUp' ? -1 : 1, { focus: true });
    }
  }
}
