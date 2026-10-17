import type { NamePack } from '../names/schema';
import { escapeHtml } from './format';

/**
 * "Hear it", through the browser's own speech synthesis. A voice for the
 * name's language is used where the device has one (Icelandic or Persian, for
 * example); otherwise an English voice reads the respelling, syllable by
 * syllable. Quality depends on the device, so this is a convenience: the
 * respelling and IPA stay the reference.
 */

export interface Spoken {
  /** The name in its own language and script */
  text: string;
  lang: string;
  /** The English respelling, such as "WIN-ter-fil-leth" */
  say: string;
}

export function canSpeak(): boolean {
  return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
}

// Chrome lists its voices only after "voiceschanged", so they're loaded ahead of the first press
let voices: SpeechSynthesisVoice[] = [];

export function speak({ text, lang, say }: Spoken): void {
  const synth = window.speechSynthesis;
  synth.cancel();
  if (voices.length === 0) voices = synth.getVoices();
  const language = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];
  // A romanised name ("fa-Latn") would be read badly by a voice for the language's own script
  const native = /-latn\b/i.test(lang) ? undefined : voices.find((voice) => language(voice.lang) === language(lang));
  const utterance = new SpeechSynthesisUtterance(native ? text : say.toLowerCase().replace(/-/g, ' '));
  if (native) {
    utterance.voice = native;
    utterance.lang = native.lang;
  } else {
    const english = voices.find((voice) => voice.lang.startsWith('en-GB')) ?? voices.find((voice) => voice.lang.startsWith('en'));
    if (english) utterance.voice = english;
    utterance.lang = english?.lang ?? 'en-GB';
  }
  utterance.rate = 0.8;
  synth.speak(utterance);
}

const speakerIcon = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

/**
 * A "Hear it" button for a month or festival name, or nothing if the name has
 * no respelling or this browser can't speak. Names with an original script
 * (Persian) are spoken from it.
 */
export function hearButton(pack: Pick<NamePack, 'lang' | 'originalLang'>, entry: { name: string; original?: string; say?: string }): string {
  if (!entry.say || !canSpeak()) return '';
  const [text, lang] = entry.original && pack.originalLang ? [entry.original, pack.originalLang] : [entry.name, pack.lang];
  return `<button type="button" class="hear" data-hear-text="${escapeHtml(text)}" data-hear-lang="${escapeHtml(lang)}"`
    + ` data-hear-say="${escapeHtml(entry.say)}" aria-label="Hear ${escapeHtml(entry.name)}">${speakerIcon}</button>`;
}

/** One listener for every "Hear it" button on the page. */
export function listenForHear(): void {
  if (!canSpeak()) return;
  const loadVoices = () => { voices = window.speechSynthesis.getVoices(); };
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  document.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-hear-text]');
    if (!button) return;
    const { hearText = '', hearLang = 'en', hearSay = '' } = button.dataset;
    speak({ text: hearText, lang: hearLang, say: hearSay });
  });
}
