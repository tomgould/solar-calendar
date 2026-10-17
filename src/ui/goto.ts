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
        this.showError(`Choose a date between ${gregorianDate(range[0])} and ${gregorianDate(range[1])}.`);
      } else {
        this.showError('');
        select(day);
      }
    });

    root.querySelector('#goto-solar')!.addEventListener('submit', (event) => {
      event.preventDefault();
      const [year, month, day] = [Number(this.year.value), Number(this.month.value), Number(this.day.value)];
      if (month === LEAP_WEEK && !hasLeapWeek(year)) {
        this.showError(`Solar ${year} has no leap week. Only 371-day years end with one.`);
      } else if (!isValidSolarDate(year, month, day) || year < MIN_YEAR || year > MAX_YEAR) {
        this.showError(`Choose a day from 1 to ${daysInMonth(month)} and a year from ${MIN_YEAR} to ${MAX_YEAR}.`);
      } else {
        this.showError('');
        select(fromSolar(year, month, day));
      }
    });

    // The leap week is only offered in years that have one
    this.year.addEventListener('change', () => this.fillMonths(Number(this.year.value)));
  }

  render({ selected, pack }: GoToDateState): void {
    this.pack = pack;
    const date = toSolar(selected);
    // Fill in every field except the one being typed in
    const set = (field: HTMLInputElement, value: string) => {
      if (field !== document.activeElement) field.value = value;
    };
    set(this.gregorian, toIsoDate(selected));
    set(this.year, String(date.year));
    set(this.day, String(date.day));
    this.fillMonths(Number(this.year.value), this.month === document.activeElement ? undefined : date.month);
  }

  private fillMonths(year: number, chosen = Number(this.month.value) || 1): void {
    if (!this.pack) return;
    const count = year >= MIN_YEAR && year <= MAX_YEAR ? monthsInYear(year) : 13;
    const pack = this.pack;
    this.month.innerHTML = Array.from({ length: count }, (_, i) => {
      const month = i + 1;
      return `<option value="${month}"${month === chosen ? ' selected' : ''}>${escapeHtml(monthName(pack, month))}</option>`;
    }).join('');
    this.month.lang = pack.lang;
  }

  private showError(message: string): void {
    this.error.textContent = message;
  }
}
