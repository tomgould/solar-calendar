import { LEAP_WEEK } from '../core/solar';
import { DEFAULT_PACK_ID } from '../names/registry';
import { SKY_EVENT_NAMES } from '../core/sky';
import { type Festival, type NamePack, type PackKind, RESPELLING_KEY } from '../names/schema';
import { escapeHtml, forDisplayFont, hueClass } from './format';

const certaintyText = { established: 'Meaning well established', likely: 'Meaning likely', uncertain: 'Meaning uncertain' };

/** "Say WIN-ter-fil-leth /ˈwintərˌfylːeθ/", or nothing for names without one */
const sayLine = (say?: string, ipa?: string) => (say
  ? `<p class="about-say"><span class="say-label">Say</span> <strong>${escapeHtml(say)}</strong>${ipa ? ` <span class="ipa">/${escapeHtml(ipa)}/</span>` : ''}</p>`
  : '');

const GROUPS: [PackKind, string][] = [['historical', 'From history'], ['modern', 'Modern inventions']];

const GREGORIAN_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A festival's date rule in plain words: "The first Friday on or after 19 January, for 2 days" */
export function describeWhen({ when, days = 1 }: Festival, pack: NamePack): string {
  const offset = when.offset ?? 0;
  const shift = (base: string) => {
    if (offset === 0) return base;
    if (offset === -1) return `The day before ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
    if (offset === 1) return `The day after ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
    return `${Math.abs(offset)} days ${offset < 0 ? 'before' : 'after'} ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  };
  let text: string;
  if ('event' in when) {
    text = shift(`The ${SKY_EVENT_NAMES[when.event]}`);
  } else if ('gregorian' in when) {
    const [month, day] = when.gregorian.split('-').map(Number);
    const date = `${day} ${GREGORIAN_MONTH_NAMES[month - 1]}`;
    text = shift(when.weekday ? `The first ${when.weekday.charAt(0).toUpperCase()}${when.weekday.slice(1)} on or after ${date}` : date);
  } else {
    text = shift(`${when.solar.day} ${pack.months[when.solar.month - 1].name}`);
  }
  return days > 1 ? `${text}, for ${days} days` : text;
}

/** The packs inside the "Month names" popover, grouped by kind, the default first. */
export function renderNamesMenu(container: HTMLElement, packs: NamePack[], currentId: string): void {
  const order = (a: NamePack, b: NamePack) =>
    Number(b.id === DEFAULT_PACK_ID) - Number(a.id === DEFAULT_PACK_ID) || a.title.localeCompare(b.title);
  container.innerHTML = GROUPS.map(([kind, legend]) => {
    const group = packs.filter((pack) => pack.kind === kind).sort(order);
    return group.length === 0 ? '' : `<fieldset class="pack-group"><legend>${legend}</legend>${group.map((pack) => packOption(pack, currentId)).join('')}</fieldset>`;
  }).join('');
}

function packOption(pack: NamePack, currentId: string): string {
  return `
    <label class="pack-option">
      <input type="radio" name="name-pack" value="${pack.id}"${pack.id === currentId ? ' checked' : ''}>
      <span class="pack-title">${escapeHtml(pack.title)}</span>
      <span class="pack-desc">${escapeHtml(pack.description)}</span>
      <span class="pack-sample" lang="${escapeHtml(pack.lang)}">${pack.months.slice(0, 3).map((month) => escapeHtml(forDisplayFont(month.name))).join(', ')} …</span>
    </label>`;
}

/** The "About this name" dialog: every month of the pack, with the current one marked. */
export function renderAboutDialog(dialog: HTMLDialogElement, pack: NamePack, currentMonth: number): void {
  const lang = `lang="${escapeHtml(pack.lang)}"`;
  const originalLang = `lang="${escapeHtml(pack.originalLang ?? pack.lang)}"${pack.originalDir ? ` dir="${pack.originalDir}"` : ''}`;
  const months = pack.months.map((month, i) => `
    <li class="${hueClass(i + 1)}"${i + 1 === currentMonth ? ' aria-current="true"' : ''}>
      <span class="about-num" aria-hidden="true">${i + 1}</span>
      <div>
        <h3 class="about-name" ${lang}>${escapeHtml(forDisplayFont(month.name))}</h3>
        <p class="about-gloss">${escapeHtml(month.gloss)}${month.original ? `. Also written <span ${originalLang}>${escapeHtml(month.original)}</span>` : ''}</p>
        ${sayLine(month.say, month.ipa)}
        <p>${escapeHtml(month.meaning)}</p>
        ${month.notes ? `<p class="about-note">${escapeHtml(month.notes)}</p>` : ''}
        <p class="certainty">${certaintyText[month.certainty]}</p>
      </div>
    </li>`).join('');

  dialog.innerHTML = `
    <div class="about-head">
      <div>
        <h2 id="about-title">${escapeHtml(pack.title)}</h2>
        <p class="about-era">${escapeHtml(pack.culture)}, ${escapeHtml(pack.era)}</p>
      </div>
      <button type="button" class="button" data-close>Close</button>
    </div>
    <div class="about-body">
      <p class="about-origin">${escapeHtml(pack.origin)}</p>
      ${pack.pronunciation ? `
      <details class="say-key">
        <summary>How to say these names</summary>
        <p>${escapeHtml(pack.pronunciation)}</p>
        <p>The respellings use English sounds:</p>
        <dl>${RESPELLING_KEY.map(([spelling, sound]) => `<div><dt>${spelling}</dt><dd>as in ${sound}</dd></div>`).join('')}</dl>
        <p>The IPA, in slashes, gives the exact sounds for readers who know the phonetic alphabet.</p>
      </details>` : ''}
      <ol class="about-months">${months}
        <li class="${hueClass(LEAP_WEEK)}"${currentMonth === LEAP_WEEK ? ' aria-current="true"' : ''}>
          <span class="about-num" aria-hidden="true">+</span>
          <div>
            <h3 class="about-name" ${lang}>${escapeHtml(forDisplayFont(pack.leapWeek.name))}</h3>
            <p class="about-gloss">${escapeHtml(pack.leapWeek.gloss)}</p>
            ${sayLine(pack.leapWeek.say, pack.leapWeek.ipa)}
            <p>${escapeHtml(pack.leapWeek.meaning)}</p>
          </div>
        </li>
      </ol>
      ${pack.festivals?.length ? `
      <h3 class="sources-title">Festivals</h3>
      <ul class="about-festivals">${pack.festivals.map((festival) => `
        <li>
          <h4 class="about-festival-name" ${lang}>${escapeHtml(forDisplayFont(festival.name))}</h4>
          <p class="about-gloss">${escapeHtml(festival.gloss)}</p>
          ${sayLine(festival.say, festival.ipa)}
          <p class="about-when">${escapeHtml(describeWhen(festival, pack))}</p>
          <p>${escapeHtml(festival.meaning)}</p>
          ${festival.certainty ? `<p class="certainty">${certaintyText[festival.certainty].replace('Meaning', 'Date and meaning')}</p>` : ''}
        </li>`).join('')}
      </ul>` : ''}
      <h3 class="sources-title">Sources</h3>
      <ul class="sources">${pack.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="noopener">${escapeHtml(source.title)}</a></li>`).join('')}</ul>
    </div>`;
}
