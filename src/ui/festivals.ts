import { toSolar } from '../core/solar';
import { HOLIDAY_SETS } from '../holidays/registry';
import { type FestivalDay, festivalLabel } from '../names/festivals';
import type { NamePack } from '../names/schema';
import { escapeHtml, gregorianLong, gregorianShort, solarLong } from './format';

/** What kind of day an entry is: a day off, another holiday (Easter Sunday), or a festival */
export function festivalKind(entry: FestivalDay): 'Bank holiday' | 'Holiday' | 'Festival' {
  if (entry.dayOff) return 'Bank holiday';
  return entry.source.kind === 'holidays' ? 'Holiday' : 'Festival';
}

/**
 * Where an entry comes from: "Persian", "Scotland", or for a holiday kept in
 * several regions, "England, Wales and Scotland", or "UK" when it's kept in all.
 */
export function sourceTitle(entry: FestivalDay): string {
  const regions = entry.regions ?? [entry.source.title];
  if (regions.length === 1) return regions[0];
  if (regions.length === HOLIDAY_SETS.length) return 'UK';
  const places = regions.flatMap((title) => title.split(' and '));
  return `${places.slice(0, -1).join(', ')} and ${places.at(-1)}`;
}

/** Where an entry comes from, as a reader would say it: "Persian festival", "UK bank holiday" */
export function sourceName(entry: FestivalDay): string {
  return `${sourceTitle(entry)} ${festivalKind(entry).toLowerCase()}`;
}

/** The Festivals menu: which bank holidays, and which other packs' festivals, to show. */
export function renderFestivalsMenu(container: HTMLElement, packs: NamePack[], current: NamePack, holidayIds: string[], extraIds: string[]): void {
  const holidays = HOLIDAY_SETS.map((set) => `
    <label class="choice"><input type="checkbox" name="holidays" value="${escapeHtml(set.id)}"${holidayIds.includes(set.id) ? ' checked' : ''}> ${escapeHtml(set.title)}</label>`).join('');
  const others = packs.filter((pack) => pack.id !== current.id && pack.festivals?.length).sort((a, b) => a.title.localeCompare(b.title));
  const own = current.festivals?.length
    ? `<p class="choice-note">${escapeHtml(current.title)} festivals always show with ${escapeHtml(current.title)} month names.</p>` : '';
  const packChoices = others.map((pack) => `
    <label class="choice">
      <input type="checkbox" name="festival-pack" value="${escapeHtml(pack.id)}"${extraIds.includes(pack.id) ? ' checked' : ''}>
      <span>${escapeHtml(pack.title)} <span class="choice-sample" lang="${escapeHtml(pack.lang)}">${pack.festivals!.slice(0, 3).map((festival) => escapeHtml(festival.name)).join(', ')}${pack.festivals!.length > 3 ? ' …' : ''}</span></span>
    </label>`).join('');
  container.innerHTML = `
    <fieldset class="choice-group"><legend>UK bank holidays</legend><p class="choice-note">A holiday kept in more than one region shows once.</p>${holidays}</fieldset>
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
