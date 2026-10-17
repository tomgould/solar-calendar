import { type HolidaySet, validateHolidaySet } from '../names/schema';

// Every JSON file here is a holiday set. They're small, so they're bundled
// with the app rather than loaded on demand.
export const HOLIDAY_SETS: readonly HolidaySet[] = Object.entries(import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' }))
  .map(([path, data]) => {
    const set = validateHolidaySet(data, path);
    if (path !== `./${set.id}.json`) throw new Error(`${path}: "id" must match the file name`);
    return set;
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export function holidaySet(id: string | null | undefined): HolidaySet | null {
  return HOLIDAY_SETS.find((set) => set.id === id) ?? null;
}

/** The sets named in a list of ids, such as "uk-scotland,uk-northern-ireland", in menu order. Unknown ids are skipped. */
export function holidaySets(ids: string | null | undefined): HolidaySet[] {
  const wanted = new Set((ids ?? '').split(','));
  return HOLIDAY_SETS.filter((set) => wanted.has(set.id));
}

/** Every region's bank holidays are on until the viewer chooses otherwise. */
export function defaultHolidaySetIds(): string {
  return HOLIDAY_SETS.map((set) => set.id).join(',');
}
