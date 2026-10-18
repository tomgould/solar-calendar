import '@fontsource-variable/big-shoulders/opsz.css';
import '@fontsource/andika/400.css';
import '@fontsource/andika/400-italic.css';
import '@fontsource/andika/700.css';
// Scripts Andika lacks, for packs' original forms; each downloads only when its letters appear
import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/noto-sans-coptic/coptic-400.css';
// Greek letters Andika lacks, such as the θ used in IPA pronunciations
import '@fontsource/noto-sans/greek-400.css';
import './styles/app.css';
import { type DayNumber, parseIsoDate, today as todayNumber, toIsoDate } from './core/days';
import { SKY_EVENT_NAMES, type SkyEvent, nextSeasonEvent, seasonEvents } from './core/sky';
import { LEAP_WEEK, MAX_YEAR, MIN_YEAR, MONTHS, daysInMonth, fromSolar, hasLeapWeek, monthSpan, toSolar, yearStart } from './core/solar';
import { defaultHolidaySetIds, holidaySets } from './holidays/registry';
import { type FestivalSource, festivalsFrom } from './names/festivals';
import { DEFAULT_PACK_ID, PACK_IDS, isPackId, loadAllPacks, loadPack } from './names/registry';
import type { HolidaySet, NamePack } from './names/schema';
import { buildIcs } from './feed/ics';
import { moonPhaseName, moonQuarters } from './sky/moon';
import { type Place, isPlace, placeTimeZone, sunTimes } from './sky/sun';
import { renderDayPanel, sunText } from './ui/day-panel';
import { GoToDate } from './ui/goto';
import { renderFestivalsMenu, renderMonthFestivals, renderYearFestivals } from './ui/festivals';
import { daysAway, escapeHtml, gregorianLong, solarLong } from './ui/format';
import { THEME_ICONS, chevron } from './ui/icons';
import { MonthView } from './ui/month-view';
import { renderAboutDialog, renderNamesMenu } from './ui/names';
import { listenForHear } from './ui/speech';
import { YearView } from './ui/year-view';

type View = 'month' | 'year';

const FIRST_DAY = yearStart(MIN_YEAR);
const LAST_DAY = yearStart(MAX_YEAR + 1) - 1;

const state = {
  today: todayNumber(),
  selected: 0 as DayNumber,
  view: 'month' as View,
  pack: null as unknown as NamePack,
  /** Bank holidays shown: any of the UK regions */
  holidays: [] as HolidaySet[],
  /** Other packs whose festivals are shown too */
  extraPacks: [] as NamePack[],
};

/** Everything whose festivals are shown: the chosen names, any other packs ticked, and the bank holidays. */
function festivalSources(): FestivalSource[] {
  return [state.pack, ...state.extraPacks.filter((pack) => pack.id !== state.pack.id), ...state.holidays];
}

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* private mode: the choice just isn't remembered */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(key); } catch { /* nothing stored */ }
  },
};

/** The viewer's place for sunrise and sunset, kept only in this browser. */
function readPlace(): Place | null {
  try {
    const place: unknown = JSON.parse(storage.get('location') ?? 'null');
    return isPlace(place) ? place : null;
  } catch {
    return null;
  }
}

let monthView: MonthView;
let yearView: YearView;
let goTo: GoToDate;

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
    }).catch(() => {
      // The moon library didn't load (offline, say); try again on the next render
      moonPending.delete(key);
    });
  }
  return [...seasonEvents(first, last), ...(moonCache.get(key) ?? [])];
}

/**
 * Rewriting the day panel, the "Say" line or a festival list drops focus from the control in it,
 * which happens when moon data arrives. This puts focus back on the control in
 * the same place, unless something else has taken it.
 */
function keepFocusInPlace(): () => void {
  const active = document.activeElement;
  const container = active?.closest<HTMLElement>('#day-panel, #month-say, #month-festivals, #year-festivals');
  if (!(active instanceof HTMLElement) || !container) return () => {};
  const controls = () => [...container.querySelectorAll<HTMLElement>('button, a[href], input, select')];
  const index = controls().indexOf(active);
  return () => {
    if (index >= 0 && (document.activeElement === null || document.activeElement === document.body)) controls()[index]?.focus();
  };
}

/** "The December solstice is in 64 days.", or "It’s the March equinox today." */
function seasonCountdown(today: DayNumber): string {
  const season = seasonEvents(today, today)[0] ?? nextSeasonEvent(today);
  const name = SKY_EVENT_NAMES[season.kind];
  return season.day === today ? `It’s the ${name} today.` : `The ${name} is ${daysAway(today, season.day)}.`;
}

function render(focus = false): void {
  const { selected, today, pack, view } = state;
  const date = toSolar(selected);
  const restoreFocus = keepFocusInPlace();

  $('#today-line').innerHTML = `Today is <strong lang="${pack.lang}">${escapeHtml(solarLong(pack, toSolar(today)))}</strong>. In the Gregorian calendar it’s ${gregorianLong(today)}. ${seasonCountdown(today)}`;
  $('#names-current').textContent = pack.title;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  $('#month-view').hidden = view !== 'month';
  $('#year-view').hidden = view !== 'year';

  if (view === 'month') {
    const events = monthEvents(date.year, date.month);
    const [first, last] = monthSpan(date.year, date.month);
    const festivals = festivalsFrom(festivalSources(), first, last);
    monthView.render({ selected, today, pack, events, festivals }, focus);
    // The list under the grid: every festival or holiday that touches the month
    renderMonthFestivals($('#month-festivals'), festivalsFrom(festivalSources(), first - 31, last, true)
      .filter((entry) => entry.day + (entry.substitute ? 1 : entry.festival.days ?? 1) > first && entry.day <= last));
    renderDayPanel($('#day-panel'), {
      selected, today, pack,
      events: events.filter((event) => event.day === selected),
      next: nextSeasonEvent(selected),
      festivals: festivals.filter((entry) => entry.day === selected),
    });
    goTo.render({ selected, pack });
    const moon = $('#day-panel [data-moon]');
    moonPhaseName(selected).then((phase) => {
      if (state.selected === selected && moon.isConnected) moon.textContent = phase;
    }).catch(() => {
      if (moon.isConnected) moon.textContent = 'Couldn’t load moon data. Check your connection.';
    });
    const place = readPlace();
    const sun = $('#day-panel [data-sun]');
    if (place) {
      // The button is there straight away, so focus can return to it after the dialog
      sun.innerHTML = '<span data-sun-text>Calculating…</span> <button type="button" class="text-button" data-set-location>Change place</button>';
      const text = sun.querySelector('[data-sun-text]')!;
      placeTimeZone(place).then(async (timeZone) => {
        const times = await sunTimes(selected, place, timeZone);
        if (state.selected === selected && sun.isConnected) text.textContent = sunText(times, timeZone);
      }).catch(() => {
        if (sun.isConnected) text.textContent = 'Couldn’t load sunrise and sunset. Check your connection.';
      });
    } else {
      sun.innerHTML = '<button type="button" class="text-button" data-set-location>Add your location</button>';
    }
    $<HTMLButtonElement>('#prev-month').disabled = selected - date.day < FIRST_DAY;
    $<HTMLButtonElement>('#next-month').disabled = selected - date.day + daysInMonth(date.month) > LAST_DAY;
  } else {
    const [first, last] = [yearStart(date.year), yearStart(date.year + 1) - 1];
    yearView.render({ year: date.year, today, pack, festivals: festivalsFrom(festivalSources(), first, last) });
    renderYearFestivals($('#year-festivals'), festivalsFrom(festivalSources(), first, last, true), pack, date.year);
  }
  restoreFocus();

  document.title = `${solarLong(pack, date)}, solar calendar`;
  syncUrl(view === 'year' ? `year ${date.year}` : `month ${date.year}-${date.month}`);
}

// Changing view, year or month adds a history entry so Back works; moving
// between days in the same month only updates the address.
let shownPlace = '';
let restoringFromHistory = false;

function syncUrl(place: string): void {
  const params = new URLSearchParams({ date: toIsoDate(state.selected), names: state.pack.id });
  if (state.view === 'year') params.set('view', 'year');
  const push = shownPlace !== '' && place !== shownPlace && !restoringFromHistory;
  shownPlace = place;
  try {
    history[push ? 'pushState' : 'replaceState'](null, '', `${location.pathname}?${params}`);
  } catch {
    // Some embedded previews refuse URL changes; the calendar works without them
  }
}

async function readUrl(): Promise<void> {
  const params = new URLSearchParams(location.search);
  state.selected = Math.min(LAST_DAY, Math.max(FIRST_DAY, parseIsoDate(params.get('date') ?? '') ?? state.today));
  state.view = params.get('view') === 'year' ? 'year' : 'month';
  const requested = params.get('names') ?? storage.get('names');
  try {
    state.pack = await loadPack(isPackId(requested) ? requested : DEFAULT_PACK_ID);
  } catch {
    // That pack didn't load (offline, say); the default is always in the bundle
    state.pack = await loadPack(DEFAULT_PACK_ID);
    $('#names-status').textContent = 'Couldn’t load your chosen names, so the Gregorian names are shown. Check your connection.';
  }
  // A list of regions; unset means all of them, and none stores ""
  state.holidays = holidaySets(storage.get('holidays') ?? defaultHolidaySetIds());
}

let extraPacksWanted = '';

/** Loads the other packs whose festivals are shown, skipping any that fail (offline, say). */
async function loadExtraPacks(ids: string[]): Promise<void> {
  const wanted = (extraPacksWanted = ids.join(','));
  const loaded = await Promise.allSettled(ids.filter(isPackId).map(loadPack));
  // A later choice in the Festivals menu replaced this one while it loaded
  if (wanted !== extraPacksWanted) return;
  state.extraPacks = loaded.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

/** The festivals and holidays shown, as feed parameters: "&festivals=persian&holidays=uk-scotland" */
function festivalParams(): string {
  const extras = state.extraPacks.filter((pack) => pack.id !== state.pack.id && pack.festivals?.length).map((pack) => pack.id).join(',');
  const holidays = state.holidays.map((set) => set.id).join(',');
  return `${extras ? `&festivals=${extras}` : ''}${holidays ? `&holidays=${holidays}` : ''}`;
}

// "Add to your calendar": the subscription feed for Google, Apple and other
// calendar apps, and a one-year download
function renderCalendarApps(year: number, pack: NamePack): void {
  const feed = new URL(`/feed.ics?names=${pack.id}${festivalParams()}`, location.origin).href;
  const webcal = feed.replace(/^https?:/, 'webcal:');
  $('#download-ics').textContent = `Download solar ${year} (.ics)`;
  $<HTMLInputElement>('#feed-url').value = feed;
  $<HTMLAnchorElement>('#open-feed').href = webcal;
  // Google's own "add calendar" page, with the feed filled in
  $<HTMLAnchorElement>('#add-google').href = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
}

function downloadYear(): void {
  const { year } = toSolar(state.selected);
  const text = buildIcs({ pack: state.pack, extra: festivalSources().slice(1), from: yearStart(year), to: yearStart(year + 1) - 1, now: Date.now() });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  link.download = `solar-calendar-${year}-${state.pack.id}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
  try {
    state.pack = await loadPack(id);
  } catch {
    $('#names-status').textContent = 'Couldn’t load those names. Check your connection and try again.';
    return;
  }
  $('#names-status').textContent = '';
  storage.set('names', id);
  render();
}

function setUpTheme(): void {
  const button = $<HTMLButtonElement>('#theme-button');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => document.documentElement.dataset.theme ?? (systemDark.matches ? 'dark' : 'light');
  // The button offers the other mode: moon and "Dark mode" in light, sun and "Light mode" in dark
  const update = () => {
    const offer = current() === 'dark' ? 'light' : 'dark';
    const label = offer === 'dark' ? 'Dark mode' : 'Light mode';
    button.setAttribute('aria-label', label);
    button.querySelector('.theme-label')!.textContent = label;
    button.querySelector('.theme-icon')!.innerHTML = THEME_ICONS[offer];
  };
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    storage.set('theme', next);
    update();
  });
  systemDark.addEventListener('change', update);
  update();
}

function setUpLocation(): void {
  const dialog = $<HTMLDialogElement>('#location-dialog');
  const lat = $<HTMLInputElement>('#location-lat');
  const lon = $<HTMLInputElement>('#location-lon');
  const status = $('#location-status');

  $('#day-panel').addEventListener('click', (event) => {
    if (!(event.target as Element).closest('[data-set-location]')) return;
    const place = readPlace();
    [lat.value, lon.value] = place ? [String(place.lat), String(place.lon)] : ['', ''];
    status.textContent = '';
    dialog.showModal();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || (event.target as Element).closest('[data-close]')) dialog.close();
  });

  $('#use-my-location').addEventListener('click', () => {
    if (!navigator.geolocation) {
      status.textContent = 'This browser can’t share your location. Enter it below instead.';
      return;
    }
    status.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // About a kilometre is plenty for sunrise and sunset
        [lat.value, lon.value] = [coords.latitude.toFixed(2), coords.longitude.toFixed(2)];
        status.textContent = 'Found. Press Save to use it.';
      },
      (error) => {
        status.textContent = error.code === error.PERMISSION_DENIED
          ? 'Location access is blocked. Enter your latitude and longitude below instead.'
          : 'Couldn’t find your location. Enter it below instead.';
      },
      { timeout: 10_000, maximumAge: 3_600_000 },
    );
  });

  $('#location-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const place = { lat: Number(lat.value), lon: Number(lon.value) };
    if (lat.value === '' || lon.value === '' || !isPlace(place)) {
      status.textContent = 'Enter a latitude from −90 to 90 and a longitude from −180 to 180.';
      return;
    }
    storage.set('location', JSON.stringify(place));
    dialog.close();
    render();
    document.querySelector<HTMLElement>('#day-panel [data-set-location]')?.focus();
  });
  $('#clear-location').addEventListener('click', () => {
    storage.remove('location');
    // Forgetting is a choice too, so the first-visit notice doesn't come back
    storage.set('locationPrompt', 'declined');
    dialog.close();
    render();
    document.querySelector<HTMLElement>('#day-panel [data-set-location]')?.focus();
  });
}

/**
 * On a first visit, a notice explains why the calendar would like the
 * viewer's location. The browser's permission prompt only appears when they
 * choose "Use my location"; "No thanks" is remembered.
 */
function setUpLocationNotice(): void {
  const notice = $('#location-notice');
  const status = $('#notice-status');
  notice.hidden = !('geolocation' in navigator) || readPlace() !== null || storage.get('locationPrompt') === 'declined';
  // Focus goes to the calendar's heading once the notice has gone
  const close = () => {
    notice.hidden = true;
    const heading = $(state.view === 'year' ? '#year-title' : '#month-title');
    heading.tabIndex = -1;
    heading.focus();
  };
  $('#notice-dismiss').addEventListener('click', () => {
    storage.set('locationPrompt', 'declined');
    close();
  });
  $('#notice-use-location').addEventListener('click', () => {
    status.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // About a kilometre is plenty for sunrise and sunset
        storage.set('location', JSON.stringify({ lat: Number(coords.latitude.toFixed(2)), lon: Number(coords.longitude.toFixed(2)) }));
        render();
        close();
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) storage.set('locationPrompt', 'declined');
        status.textContent = error.code === error.PERMISSION_DENIED
          ? 'Location access is blocked, so nothing was shared. You can type a latitude and longitude under Sunrise and sunset instead.'
          : 'Couldn’t find your location. Try again, or type a latitude and longitude under Sunrise and sunset.';
      },
      { timeout: 10_000, maximumAge: 3_600_000 },
    );
  });
}

function wire(): void {
  setUpLocation();
  setUpLocationNotice();
  listenForHear();
  monthView = new MonthView($('#month-view'), { select, goToMonth, shiftMonth });
  goTo = new GoToDate($('#goto'), [FIRST_DAY, LAST_DAY], (day) => select(day));
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
  // Printing shows whichever view is on screen
  $('#print-year').addEventListener('click', () => window.print());
  $('#print-month').addEventListener('click', () => window.print());
  const calendarDialog = $<HTMLDialogElement>('#calendar-dialog');
  for (const button of document.querySelectorAll('[data-add-to-calendar]')) {
    button.addEventListener('click', () => {
      renderCalendarApps(toSolar(state.selected).year, state.pack);
      $('#feed-status').textContent = '';
      calendarDialog.showModal();
    });
  }
  calendarDialog.addEventListener('click', (event) => {
    if (event.target === calendarDialog || (event.target as Element).closest('[data-close]')) calendarDialog.close();
  });
  $('#download-ics').addEventListener('click', downloadYear);
  $('#copy-feed').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($<HTMLInputElement>('#feed-url').value);
      $('#feed-status').textContent = 'Link copied';
    } catch {
      $<HTMLInputElement>('#feed-url').select();
      $('#feed-status').textContent = 'Press Ctrl+C or Cmd+C to copy the selected link';
    }
  });
  setUpTheme();

  // Anchor a menu under its button, kept inside the viewport
  const anchorMenu = (menu: HTMLElement, button: HTMLElement) => {
    const anchor = button.getBoundingClientRect();
    const width = Math.min(440, window.innerWidth - 32);
    menu.style.top = `${anchor.bottom + 8}px`;
    menu.style.right = `${Math.min(Math.max(16, window.innerWidth - anchor.right), window.innerWidth - width - 16)}px`;
  };

  const menu = $('#names-menu');
  menu.addEventListener('toggle', async (event) => {
    if ((event as ToggleEvent).newState !== 'open') return;
    anchorMenu(menu, $('#names-button'));
    try {
      renderNamesMenu($('#names-options'), await loadAllPacks(), state.pack.id);
    } catch {
      $('#names-status').textContent = 'Couldn’t load the list of names. Check your connection and try again.';
    }
  });
  menu.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.name === 'name-pack') void choosePack(input.value);
  });

  const festivalsMenu = $('#festivals-menu');
  festivalsMenu.addEventListener('toggle', async (event) => {
    if ((event as ToggleEvent).newState !== 'open') return;
    anchorMenu(festivalsMenu, $('#festivals-button'));
    try {
      renderFestivalsMenu($('#festivals-options'), await loadAllPacks(), state.pack, state.holidays.map((set) => set.id), state.extraPacks.map((pack) => pack.id));
    } catch {
      $('#festivals-status').textContent = 'Couldn’t load the list of festivals. Check your connection and try again.';
    }
  });
  festivalsMenu.addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    const ticked = () => [...festivalsMenu.querySelectorAll<HTMLInputElement>(`input[name="${input.name}"]:checked`)].map((box) => box.value).join(',');
    if (input.name === 'holidays') {
      storage.set('holidays', ticked());
      state.holidays = holidaySets(ticked());
    } else if (input.name === 'festival-pack') {
      // The chosen names' own pack isn't in the menu, so keep it if it was ticked before
      const kept = state.extraPacks.some((pack) => pack.id === state.pack.id) ? [state.pack.id] : [];
      const ids = [...kept, ...ticked().split(',').filter(Boolean)];
      storage.set('festivals', ids.join(','));
      await loadExtraPacks(ids);
    }
    render();
  });

  // The festival lists under the month and the year go to the day they name
  for (const id of ['#month-festivals', '#year-festivals']) {
    $(id).addEventListener('click', (event) => {
      const link = (event.target as Element).closest<HTMLElement>('[data-day]');
      if (!link) return;
      state.view = 'month';
      select(Number(link.dataset.day), { focus: true });
    });
  }

  const dialog = $<HTMLDialogElement>('#about-dialog');
  $('#about-name').addEventListener('click', () => {
    renderAboutDialog(dialog, state.pack, toSolar(state.selected).month, state.today);
    dialog.showModal();
    dialog.querySelector('[aria-current]')?.scrollIntoView({ block: 'center' });
  });
  dialog.addEventListener('click', (event) => {
    // Clicks on the backdrop land on the dialog element itself
    if (event.target === dialog || (event.target as Element).closest('[data-close]')) dialog.close();
  });

  // On phones the day panel is a sheet that opens upwards; Escape folds it away
  const dayPanel = $('#day-panel');
  const openSheet = (open: boolean) => {
    dayPanel.classList.toggle('is-open', open);
    dayPanel.querySelector('[data-sheet-toggle]')?.setAttribute('aria-expanded', String(open));
  };
  dayPanel.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-sheet-toggle]')) openSheet(!dayPanel.classList.contains('is-open'));
  });
  dayPanel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !dayPanel.classList.contains('is-open')) return;
    openSheet(false);
    dayPanel.querySelector<HTMLElement>('[data-sheet-toggle]')?.focus();
  });
  // Keyboard focus moving to the page behind folds it away, so it can't hide what
  // has focus. Tapping a day keeps it open: the tapped day is above it
  document.addEventListener('focusin', (event) => {
    const to = event.target as Element;
    if (!dayPanel.classList.contains('is-open') || dayPanel.contains(to) || to.closest('dialog')) return;
    if (to.closest('#grid-body') && !to.matches(':focus-visible')) return;
    openSheet(false);
  });

  dayPanel.addEventListener('click', async (event) => {
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
  // Every pack's festivals show until the viewer unticks some; none stores "".
  // They load alongside the chosen names, but the first view doesn't wait for them
  const extras = loadExtraPacks((storage.get('festivals') ?? PACK_IDS.join(',')).split(','));
  await readUrl();
  wire();
  render();
  // Hidden until the first render, so nothing jumps as the calendar fills in
  $('#main').classList.remove('is-loading');
  window.addEventListener('popstate', async () => {
    try {
      await readUrl();
    } catch (error) {
      console.error(error);
      return;
    }
    restoringFromHistory = true;
    render();
    restoringFromHistory = false;
  });
  await extras;
  render();
}

start().catch((error: unknown) => {
  console.error(error);
  $('#today-line').textContent = 'The calendar couldn’t load. Reload the page to try again.';
  $('#main').classList.remove('is-loading');
});
