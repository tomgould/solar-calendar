import { toSolar } from '../core/solar';
import { HOLIDAY_SETS } from '../holidays/registry';
import { type FestivalDay, festivalLabel } from '../names/festivals';
import type { NamePack } from '../names/schema';
import { escapeHtml, gregorianLong, gregorianShort, solarLong } from './format';

const capital = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/**
 * What kind of day an entry is: a day off, named as its country names it
 * ("Bank holiday", "Federal holiday", or "Public holiday" where countries
 * differ), another holiday (Easter Sunday), or a festival.
 */
export function festivalKind(entry: FestivalDay): string {
  if (entry.dayOff) {
    const names = new Set((entry.regions ?? [entry.source]).map((set) => set.dayOffName ?? 'public holiday'));
    return capital(names.size === 1 ? [...names][0] : 'public holiday');
  }
  return entry.source.kind === 'holidays' ? 'Holiday' : 'Festival';
}

/** Days off first, then other holidays, then festivals: the day panel's order */
export const kindOrder = (kind: string) => (kind === 'Festival' ? 2 : kind === 'Holiday' ? 1 : 0);

/**
 * Where an entry comes from: "Persian", "Scotland", or for a holiday kept in
 * several regions, "England, Wales and Scotland". A country whose sets all
 * keep it is named as a whole: "UK", or "UK, Ireland and US".
 */
export function sourceTitle(entry: FestivalDay): string {
  const regions = entry.regions ?? [entry.source];
  const countries = [...new Set(regions.map((set) => set.country))];
  const places = countries.flatMap((country) => {
    const here = regions.filter((set) => set.country === country);
    const all = HOLIDAY_SETS.filter((set) => set.country === country);
    return country && here.length === all.length ? [country] : here.flatMap((set) => set.title.split(' and '));
  });
  return places.length === 1 ? places[0] : `${places.slice(0, -1).join(', ')} and ${places.at(-1)}`;
}

/** Where an entry comes from, as a reader would say it: "Persian festival", "UK bank holiday", "US federal holiday" */
export function sourceName(entry: FestivalDay): string {
  return `${sourceTitle(entry)} ${festivalKind(entry).toLowerCase()}`;
}

/** The Festivals menu: which public holidays, and which other packs' festivals, to show. */
export function renderFestivalsMenu(container: HTMLElement, packs: NamePack[], current: NamePack, holidayIds: string[], extraIds: string[]): void {
  // "Scotland, UK bank holidays"; "Ireland, public holidays", where the set is the whole country
  const holidays = HOLIDAY_SETS.map((set) => `
    <label class="choice">
      <input type="checkbox" name="holidays" value="${escapeHtml(set.id)}"${holidayIds.includes(set.id) ? ' checked' : ''}>
      <span>${escapeHtml(set.title)} <span class="choice-sample">${escapeHtml(`${set.country === set.title ? '' : `${set.country} `}${set.dayOffName}s`)}</span></span>
    </label>`).join('');
  const others = packs.filter((pack) => pack.id !== current.id && pack.festivals?.length).sort((a, b) => a.title.localeCompare(b.title));
  const own = current.festivals?.length
    ? `<p class="choice-note">${escapeHtml(current.title)} festivals always show with ${escapeHtml(current.title)} month names.</p>` : '';
  const packChoices = others.map((pack) => `
    <label class="choice">
      <input type="checkbox" name="festival-pack" value="${escapeHtml(pack.id)}"${extraIds.includes(pack.id) ? ' checked' : ''}>
      <span>${escapeHtml(pack.title)} <span class="choice-sample" lang="${escapeHtml(pack.lang)}">${pack.festivals!.slice(0, 3).map((festival) => escapeHtml(festival.name)).join(', ')}${pack.festivals!.length > 3 ? ' …' : ''}</span></span>
    </label>`).join('');
  container.innerHTML = `
    <fieldset class="choice-group"><legend>Public holidays</legend><p class="choice-note">A holiday kept in more than one place shows once.</p>${holidays}</fieldset>
    <fieldset class="choice-group"><legend>Also show festivals from</legend>${own}${packChoices}</fieldset>`;
}

/** "17 to 23 Dec" for a festival lasting several days, or "Tuesday 17 March" */
function span(entry: FestivalDay): string {
  const days = entry.substitute ? 1 : entry.festival.days ?? 1;
  return days > 1 ? `${gregorianShort(entry.day)} to ${gregorianShort(entry.day + days - 1)}` : gregorianLong(entry.day).replace(/ \d{4}$/, '');
}

const nameHtml = (entry: FestivalDay) => `<span class="festival-name" lang="${escapeHtml(entry.source.lang)}">${escapeHtml(festivalLabel(entry))}</span>`;

/** The festivals and holidays that touch the shown month, under the grid. Each goes to its day. */
export function renderMonthFestivals(root: HTMLElement, entries: FestivalDay[]): void {
  root.hidden = entries.length === 0;
  root.querySelector('ul')!.innerHTML = entries.map((entry) => `
    <li><button type="button" class="festival-link" data-day="${entry.day}">
      <span class="festival-day" aria-hidden="true">${toSolar(entry.day).day}</span>
      <span>${nameHtml(entry)}<span class="festival-meta">${span(entry)}, ${escapeHtml(sourceName(entry))}</span></span>
    </button></li>`).join('');
}

/** Every festival and holiday in a solar year, as a table under the year view. */
export function renderYearFestivals(root: HTMLElement, entries: FestivalDay[], pack: NamePack, year: number): void {
  root.hidden = entries.length === 0;
  root.querySelector('caption')!.textContent = `Festivals and holidays in solar ${year}`;
  root.querySelector('tbody')!.innerHTML = entries.map((entry) => `
    <tr>
      <td lang="${escapeHtml(pack.lang)}">${escapeHtml(solarLong(pack, toSolar(entry.day)))}</td>
      <td>${span(entry)}</td>
      <td><button type="button" class="festival-link" data-day="${entry.day}">${nameHtml(entry)}</button></td>
      <td>${escapeHtml(sourceName(entry))}</td>
    </tr>`).join('');
}
