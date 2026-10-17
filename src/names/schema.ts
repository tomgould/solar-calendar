/**
 * The name pack format. A pack is one JSON file in src/names/packs/; the file
 * name (without .json) must equal the pack's id. See docs/redesign.md.
 */

export type Certainty = 'established' | 'likely' | 'uncertain';

export const CERTAINTIES: readonly Certainty[] = ['established', 'likely', 'uncertain'];

export interface PackMonth {
  /** Shown in the calendar; must be covered by the display font */
  name: string;
  /** The original or scholarly form, where it differs from name */
  original?: string;
  /** Two to four words, such as "holy month" */
  gloss: string;
  meaning: string;
  /** How sure scholars are of the meaning */
  certainty: Certainty;
  notes?: string;
  /** Respelling for English speakers, stressed syllable in capitals: "WIN-ter-fil-leth" */
  say?: string;
  /** The same in the International Phonetic Alphabet, without slashes */
  ipa?: string;
}

/** The respelling key shown with pronunciations; docs/name-packs.md has the same table. */
export const RESPELLING_KEY: readonly [string, string][] = [
  ['CAPITALS', 'the stressed syllable'],
  ['a', 'cat'], ['ah', 'father'], ['air', 'hair'], ['ay', 'day'], ['e', 'bed'], ['eh', 'bed, ending a syllable'], ['ee', 'see'],
  ['i', 'sit'], ['eye', 'eye'], ['o', 'hot'], ['aw', 'law'], ['oh', 'go'], ['oo', 'food'], ['uu', 'foot'],
  ['ow', 'now'], ['oy', 'boy'], ['u', 'cup'], ['ur', 'fur'], ['uh', 'the a in about'],
  ['th', 'thin'], ['dh', 'this'], ['kh', 'Scottish loch'], ['gh', 'a softer kh, as in Dutch g'],
  ['zh', 'vision'], ['ng', 'sing'], ['y', 'yes'],
];

export interface NamePack {
  id: string;
  title: string;
  description: string;
  culture: string;
  era: string;
  /** BCP 47 language tag of the names, such as "ang" or "is" */
  lang: string;
  dir?: 'ltr' | 'rtl';
  /** Language and direction of the months' "original" forms, when they differ (such as Persian script) */
  originalLang?: string;
  originalDir?: 'ltr' | 'rtl';
  origin: string;
  /** How the names are pronounced and how sure that is; required if any month has "say" */
  pronunciation?: string;
  leapWeek: { name: string; gloss: string; meaning: string; say?: string; ipa?: string };
  months: PackMonth[];
  sources: { title: string; url: string }[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Checks a parsed pack file and returns it typed, or throws listing every problem. */
export function validatePack(data: unknown, source: string): NamePack {
  if (!isObject(data)) throw new Error(`${source}: a pack must be a JSON object`);
  const problems: string[] = [];

  for (const key of ['id', 'title', 'description', 'culture', 'era', 'lang', 'origin']) {
    if (!isText(data[key])) problems.push(`"${key}" must be a non-empty string`);
  }
  if (isText(data.id) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.id)) problems.push('"id" must be lowercase words joined by hyphens');
  for (const key of ['dir', 'originalDir']) {
    if (data[key] !== undefined && data[key] !== 'ltr' && data[key] !== 'rtl') problems.push(`"${key}" must be "ltr" or "rtl"`);
  }
  // Language tags go into lang="" attributes, so only allow the BCP 47 shape
  const languageTag = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;
  if (isText(data.lang) && !languageTag.test(data.lang)) problems.push('"lang" must be a language tag such as "la" or "fa-Latn"');
  if (data.originalLang !== undefined && !(isText(data.originalLang) && languageTag.test(data.originalLang))) {
    problems.push('"originalLang" must be a language tag such as "fa" if present');
  }

  const leapWeek = data.leapWeek;
  if (!isObject(leapWeek) || !['name', 'gloss', 'meaning'].every((key) => isText(leapWeek[key]))) {
    problems.push('"leapWeek" needs a name, gloss and meaning');
  }

  if (!Array.isArray(data.months) || data.months.length !== 13) {
    problems.push('"months" must list exactly 13 months');
  } else {
    data.months.forEach((month: unknown, i) => {
      const where = `month ${i + 1}`;
      if (!isObject(month)) return problems.push(`${where} must be an object`);
      for (const key of ['name', 'gloss', 'meaning']) if (!isText(month[key])) problems.push(`${where} needs a "${key}"`);
      if (!CERTAINTIES.includes(month.certainty as Certainty)) problems.push(`${where} "certainty" must be one of ${CERTAINTIES.join(', ')}`);
      for (const key of ['original', 'notes', 'say', 'ipa']) if (month[key] !== undefined && !isText(month[key])) problems.push(`${where} "${key}" must be text if present`);
    });
    // Pronunciations come as a set: a note on the pack and a respelling for every month
    const said = data.months.filter((month: unknown) => isObject(month) && isText(month.say)).length;
    if (said > 0 && said < 13) problems.push('give "say" for all 13 months, or for none');
    if (said > 0 && !isText(data.pronunciation)) problems.push('"pronunciation" must explain the pronunciations when months have "say"');
  }
  if (data.pronunciation !== undefined && !isText(data.pronunciation)) problems.push('"pronunciation" must be text if present');
  if (isObject(leapWeek)) {
    for (const key of ['say', 'ipa']) if (leapWeek[key] !== undefined && !isText(leapWeek[key])) problems.push(`leapWeek "${key}" must be text if present`);
  }

  if (!Array.isArray(data.sources) || data.sources.length === 0) {
    problems.push('"sources" must list at least one source');
  } else if (!data.sources.every((s: unknown) => isObject(s) && isText(s.title) && isText(s.url) && s.url.startsWith('https://'))) {
    problems.push('each source needs a "title" and an https "url"');
  }

  if (problems.length > 0) throw new Error(`${source}:\n  - ${problems.join('\n  - ')}`);
  return data as unknown as NamePack;
}
