import './styles/app.css';
import { type DayNumber, parseIsoDate, today as todayNumber, toIsoDate } from './core/days';
import { type SkyEvent, nextSeasonEvent, seasonEvents } from './core/sky';
import { LEAP_WEEK, MAX_YEAR, MIN_YEAR, MONTHS, daysInMonth, fromSolar, hasLeapWeek, monthSpan, toSolar, yearStart } from './core/solar';
import { DEFAULT_PACK_ID, isPackId, loadAllPacks, loadPack } from './names/registry';
import type { NamePack } from './names/schema';
import { moonPhaseName, moonQuarters } from './sky/moon';
import { renderDayPanel } from './ui/day-panel';
import { escapeHtml, gregorianLong, solarLong } from './ui/format';
import { chevron } from './ui/icons';
import { MonthView } from './ui/month-view';
import { renderAboutDialog, renderNamesMenu } from './ui/names';
import { YearView } from './ui/year-view';

type View = 'month' | 'year';

const FIRST_DAY = yearStart(MIN_YEAR);
const LAST_DAY = yearStart(MAX_YEAR + 1) - 1;

const state = {
  today: todayNumber(),
  selected: 0 as DayNumber,
  view: 'month' as View,
  pack: null as unknown as NamePack,
};

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* private mode: the choice just isn't remembered */ }
  },
};

let monthView: MonthView;
let yearView: YearView;

// Moon quarters arrive asynchronously, cached per solar month
const moonCache = new Map<string, SkyEvent[]>();
const moonPending = new Set<string>();

function monthEvents(year: number, month: number): SkyEvent[] {
  const [first, last] = monthSpan(year, month);
  const key = `${year}-${month}`;
  if (!moonCache.has(key) && !moonPending.has(key)) {
    moonPending.add(key);
    moonQuarters(first, last).then((events) => {
      moonCache.set(key, events);
      moonPending.delete(key);
      const shown = toSolar(state.selected);
      if (state.view === 'month' && shown.year === year && shown.month === month) render();
    });
  }
  return [...seasonEvents(first, last), ...(moonCache.get(key) ?? [])];
}

function render(focus = false): void {
  const { selected, today, pack, view } = state;
  const date = toSolar(selected);

  $('#today-line').innerHTML = `Today is <strong lang="${pack.lang}">${escapeHtml(solarLong(pack, toSolar(today)))}</strong>. In the Gregorian calendar it’s ${gregorianLong(today)}.`;
  $('#names-current').textContent = pack.title;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  $('#month-view').hidden = view !== 'month';
  $('#year-view').hidden = view !== 'year';

  if (view === 'month') {
    const events = monthEvents(date.year, date.month);
    monthView.render({ selected, today, pack, events }, focus);
    renderDayPanel($('#day-panel'), {
      selected, today, pack,
      events: events.filter((event) => event.day === selected),
      next: nextSeasonEvent(selected),
    });
    moonPhaseName(selected).then((phase) => {
      const target = document.querySelector('#day-panel [data-moon]');
      if (target && state.selected === selected) target.textContent = phase;
    });
    $<HTMLButtonElement>('#prev-month').disabled = selected - date.day < FIRST_DAY;
    $<HTMLButtonElement>('#next-month').disabled = selected - date.day + daysInMonth(date.month) > LAST_DAY;
  } else {
    yearView.render({ year: date.year, today, pack });
  }

  document.title = `${solarLong(pack, date)}, solar calendar`;
  const params = new URLSearchParams({ date: toIsoDate(selected), names: pack.id });
  if (view === 'year') params.set('view', 'year');
  try {
    history.replaceState(null, '', `${location.pathname}?${params}`);
  } catch {
    // Some embedded previews refuse URL changes; the calendar works without them
  }
}

function select(day: DayNumber, { focus = false } = {}): void {
  state.selected = Math.min(LAST_DAY, Math.max(FIRST_DAY, day));
  render(focus);
}

function goToMonth(year: number, month: number): void {
  select(fromSolar(year, month, Math.min(toSolar(state.selected).day, daysInMonth(month))));
}

function shiftMonth(delta: number, options?: { focus?: boolean }): void {
  const { year, month, day } = toSolar(state.selected);
  const count = (y: number) => (hasLeapWeek(y) ? LEAP_WEEK : MONTHS);
  let [y, m] = [year, month + delta];
  if (m < 1) [y, m] = [year - 1, count(year - 1)];
  else if (m > count(year)) [y, m] = [year + 1, 1];
  if (y < MIN_YEAR || y > MAX_YEAR) return;
  select(fromSolar(y, m, Math.min(day, daysInMonth(m))), options);
}

function shiftYear(delta: number): void {
  const { year, month, day } = toSolar(state.selected);
  const y = year + delta;
  if (y < MIN_YEAR || y > MAX_YEAR) return;
  const losesLeapWeek = month === LEAP_WEEK && !hasLeapWeek(y);
  select(losesLeapWeek ? fromSolar(y, MONTHS, 28) : fromSolar(y, month, day));
}

async function choosePack(id: string): Promise<void> {
  state.pack = await loadPack(id);
  storage.set('names', id);
  render();
}

function setUpTheme(): void {
  const button = $<HTMLButtonElement>('#theme-button');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => document.documentElement.dataset.theme ?? (systemDark.matches ? 'dark' : 'light');
  const update = () => button.setAttribute('aria-pressed', String(current() === 'dark'));
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    storage.set('theme', next);
    update();
  });
  systemDark.addEventListener('change', update);
  update();
}

function wire(): void {
  monthView = new MonthView($('#month-view'), { select, goToMonth, shiftMonth });
  yearView = new YearView($('#year-view'), (day) => {
    state.view = 'month';
    select(day, { focus: true });
  });

  for (const [id, direction, action] of [
    ['#prev-month', 'left', () => shiftMonth(-1)],
    ['#next-month', 'right', () => shiftMonth(1)],
    ['#prev-year', 'left', () => shiftYear(-1)],
    ['#next-year', 'right', () => shiftYear(1)],
  ] as const) {
    const button = $(id);
    button.innerHTML = chevron(direction);
    button.addEventListener('click', action);
  }

  $('#today-button').addEventListener('click', () => select(state.today));
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.addEventListener('click', () => {
      state.view = button.dataset.view as View;
      render();
    });
  }
  $('#print-year').addEventListener('click', () => window.print());
  setUpTheme();

  const menu = $('#names-menu');
  menu.addEventListener('toggle', async (event) => {
    if ((event as ToggleEvent).newState !== 'open') return;
    // Anchor the menu under its button
    const anchor = $('#names-button').getBoundingClientRect();
    menu.style.top = `${anchor.bottom + 8}px`;
    menu.style.right = `${Math.max(16, window.innerWidth - anchor.right)}px`;
    renderNamesMenu($('#names-options'), await loadAllPacks(), state.pack.id);
  });
  menu.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.name === 'name-pack') void choosePack(input.value);
  });

  const dialog = $<HTMLDialogElement>('#about-dialog');
  $('#about-name').addEventListener('click', () => {
    renderAboutDialog(dialog, state.pack, toSolar(state.selected).month);
    dialog.showModal();
    dialog.querySelector('[aria-current]')?.scrollIntoView({ block: 'center' });
  });
  dialog.addEventListener('click', (event) => {
    // Clicks on the backdrop land on the dialog element itself
    if (event.target === dialog || (event.target as Element).closest('[data-close]')) dialog.close();
  });

  $('#day-panel').addEventListener('click', async (event) => {
    if (!(event.target as Element).closest('[data-copy-link]')) return;
    const status = $('#day-panel [data-copy-status]');
    try {
      await navigator.clipboard.writeText(location.href);
      status.textContent = 'Link copied';
    } catch {
      status.textContent = 'Copy the link from the address bar instead';
    }
  });
}

async function start(): Promise<void> {
  const params = new URLSearchParams(location.search);
  state.selected = Math.min(LAST_DAY, Math.max(FIRST_DAY, parseIsoDate(params.get('date') ?? '') ?? state.today));
  state.view = params.get('view') === 'year' ? 'year' : 'month';
  const requested = params.get('names') ?? storage.get('names');
  state.pack = await loadPack(isPackId(requested) ? requested : DEFAULT_PACK_ID);
  wire();
  render();
}

start().catch((error: unknown) => {
  console.error(error);
  $('#today-line').textContent = 'The calendar couldn’t load. Reload the page to try again.';
});
