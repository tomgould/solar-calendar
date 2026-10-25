import { type DayNumber, parseIsoDate, toIsoDate } from '../core/days';
import { LEAP_WEEK, MAX_YEAR, MIN_YEAR, daysInMonth, fromSolar, hasLeapWeek, isValidSolarDate, monthsInYear, toSolar } from '../core/solar';
import type { NamePack } from '../names/schema';
import { escapeHtml, gregorianDate, monthName } from './format';

export interface GoToDateState {
  selected: DayNumber;
  pack: NamePack;
}

/**
 * "Go to a date": a Gregorian form and a solar form, both filled in with the
 * selected day, so submitting either one converts it into the other.
 */
export class GoToDate {
  private readonly gregorian: HTMLInputElement;
  private readonly day: HTMLInputElement;
  private readonly month: HTMLSelectElement;
  private readonly year: HTMLInputElement;
  private readonly error: HTMLElement;
  private pack: NamePack | null = null;
  /** The day the fields were last filled with */
  private shown: DayNumber | null = null;
  /** Fields changed since then, and not yet submitted */
  private readonly edited = new Set<HTMLElement>();
  /** The pack and number of months the month list was built for */
  private monthsFor = '';

  constructor(private readonly root: HTMLElement, range: [DayNumber, DayNumber], select: (day: DayNumber) => void) {
    this.gregorian = root.querySelector('#goto-gregorian-date')!;
    this.day = root.querySelector('#goto-solar-day')!;
    this.month = root.querySelector('#goto-solar-month')!;
    this.year = root.querySelector('#goto-solar-year')!;
    this.error = root.querySelector('#goto-error')!;
    [this.gregorian.min, this.gregorian.max] = range.map(toIsoDate);
    [this.year.min, this.year.max] = [String(MIN_YEAR), String(MAX_YEAR)];

    root.querySelector('#goto-gregorian')!.addEventListener('submit', (event) => {
      event.preventDefault();
      const day = parseIsoDate(this.gregorian.value);
      if (day === null || day < range[0] || day > range[1]) {
        this.showError(`Choose a date between ${gregorianDate(range[0])} and ${gregorianDate(range[1])}.`, this.gregorian);
      } else {
        this.showError('');
        select(day);
      }
    });

    root.querySelector('#goto-solar')!.addEventListener('submit', (event) => {
      event.preventDefault();
      const [year, month, day] = [Number(this.year.value), Number(this.month.value), Number(this.day.value)];
      const yearOk = Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
      if (!yearOk) {
        this.showError(`Choose a year from ${MIN_YEAR} to ${MAX_YEAR}.`, this.year);
      } else if (month === LEAP_WEEK && !hasLeapWeek(year)) {
        this.showError(`Solar ${year} has no leap week. Only 371-day years end with one.`, this.month);
      } else if (!isValidSolarDate(year, month, day)) {
        this.showError(`Choose a day from 1 to ${daysInMonth(month)}.`, this.day);
      } else {
        this.showError('');
        select(fromSolar(year, month, day));
      }
    });

    // The leap week is only offered in years that have one
    this.year.addEventListener('change', () => this.fillMonths(Number(this.year.value)));
    // The calendar draws again when packs or the moon arrive, so remember what
    // has been typed, and leave it alone until the selected day changes
    for (const field of [this.gregorian, this.day, this.month, this.year]) {
      field.addEventListener('input', () => this.edited.add(field));
    }
  }

  render({ selected, pack }: GoToDateState): void {
    this.pack = pack;
    // A newly selected day replaces whatever was typed; the same day drawn
    // again doesn't
    if (selected !== this.shown) this.edited.clear();
    this.shown = selected;
    const date = toSolar(selected);
    // Fill in every field except one being typed in or changed
    const keep = (field: HTMLElement) => field === document.activeElement || this.edited.has(field);
    const set = (field: HTMLInputElement, value: string) => {
      if (!keep(field)) field.value = value;
    };
    set(this.gregorian, toIsoDate(selected));
    set(this.year, String(date.year));
    set(this.day, String(date.day));
    this.fillMonths(Number(this.year.value), keep(this.month) ? undefined : date.month);
  }

  private fillMonths(year: number, wanted = Number(this.month.value) || 1): void {
    if (!this.pack) return;
    const count = year >= MIN_YEAR && year <= MAX_YEAR ? monthsInYear(year) : 13;
    // A leap week chosen for a year without one becomes the last month, not silently month 1
    const chosen = Math.min(wanted, count);
    const pack = this.pack;
    // Rebuild the list only when its names or length change, so an open or
    // focused list isn't replaced under the reader
    const key = `${pack.id} ${count}`;
    if (key !== this.monthsFor) {
      this.monthsFor = key;
      this.month.innerHTML = Array.from({ length: count }, (_, i) => {
        const month = i + 1;
        return `<option value="${month}">${escapeHtml(monthName(pack, month))}</option>`;
      }).join('');
      this.month.lang = pack.lang;
    }
    this.month.value = String(chosen);
  }

  /** Shows or clears the error; marks and focuses the field at fault. */
  private showError(message: string, field?: HTMLElement): void {
    for (const input of [this.gregorian, this.day, this.month, this.year]) input.removeAttribute('aria-invalid');
    // Clear first and set on the next frame, so a repeated message is announced again
    this.error.textContent = '';
    if (!message) return;
    requestAnimationFrame(() => { this.error.textContent = message; });
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  }
}
