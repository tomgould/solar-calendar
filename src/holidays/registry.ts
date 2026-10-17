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

/** Bank holidays are on by default for devices on UK time. */
export function defaultHolidaySetId(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string | null {
  return timeZone === 'Europe/London' ? 'uk-england-and-wales' : null;
}
