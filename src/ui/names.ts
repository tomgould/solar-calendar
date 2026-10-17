import { LEAP_WEEK } from '../core/solar';
import type { NamePack } from '../names/schema';
import { escapeHtml, monthHue } from './format';

const certaintyText = { established: 'Meaning well established', likely: 'Meaning likely', uncertain: 'Meaning uncertain' };

/** The list of packs inside the "Month names" popover. */
export function renderNamesMenu(container: HTMLElement, packs: NamePack[], currentId: string): void {
  container.innerHTML = packs.map((pack) => `
    <label class="pack-option">
      <input type="radio" name="name-pack" value="${pack.id}"${pack.id === currentId ? ' checked' : ''}>
      <span class="pack-title">${escapeHtml(pack.title)}</span>
      <span class="pack-desc">${escapeHtml(pack.description)}</span>
      <span class="pack-sample" lang="${pack.lang}">${pack.months.slice(0, 3).map((month) => escapeHtml(month.name)).join(', ')} …</span>
    </label>`).join('');
}

/** The "About this name" dialog: every month of the pack, with the current one marked. */
export function renderAboutDialog(dialog: HTMLDialogElement, pack: NamePack, currentMonth: number): void {
  const lang = `lang="${pack.lang}"`;
  const months = pack.months.map((month, i) => `
    <li style="--hue:${monthHue(i + 1)}"${i + 1 === currentMonth ? ' aria-current="true"' : ''}>
      <span class="about-num" aria-hidden="true">${i + 1}</span>
      <div>
        <h3 class="about-name" ${lang}>${escapeHtml(month.name)}</h3>
        <p class="about-gloss">${escapeHtml(month.gloss)}${month.original ? `. Also written <span ${lang}>${escapeHtml(month.original)}</span>` : ''}</p>
        <p>${escapeHtml(month.meaning)}</p>
        ${month.notes ? `<p class="about-note">${escapeHtml(month.notes)}</p>` : ''}
        <p class="certainty">${certaintyText[month.certainty]}</p>
      </div>
    </li>`).join('');

  dialog.innerHTML = `
    <div class="about-head">
      <div>
        <h2 id="about-title">${escapeHtml(pack.title)} month names</h2>
        <p class="about-era">${escapeHtml(pack.culture)}, ${escapeHtml(pack.era)}</p>
      </div>
      <button type="button" class="button" data-close>Close</button>
    </div>
    <div class="about-body">
      <p class="about-origin">${escapeHtml(pack.origin)}</p>
      <ol class="about-months">${months}
        <li style="--hue:${monthHue(LEAP_WEEK)}"${currentMonth === LEAP_WEEK ? ' aria-current="true"' : ''}>
          <span class="about-num" aria-hidden="true">+</span>
          <div>
            <h3 class="about-name" ${lang}>${escapeHtml(pack.leapWeek.name)}</h3>
            <p class="about-gloss">${escapeHtml(pack.leapWeek.gloss)}</p>
            <p>${escapeHtml(pack.leapWeek.meaning)}</p>
          </div>
        </li>
      </ol>
      <h3 class="sources-title">Sources</h3>
      <ul class="sources">${pack.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="noopener">${escapeHtml(source.title)}</a></li>`).join('')}</ul>
    </div>`;
}
