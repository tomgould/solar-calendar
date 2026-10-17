import defaultPack from './packs/gregorian.json';
import { type NamePack, validatePack } from './schema';

// Every JSON file in packs/ is a pack. Files starting with "_" (such as a
// template) are skipped. Each pack becomes its own chunk, loaded when picked.
const loaders = Object.fromEntries(
  Object.entries(import.meta.glob<unknown>('./packs/*.json', { import: 'default' }))
    .map(([path, load]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), { path, load }] as const)
    .filter(([id]) => !id.startsWith('_')),
);

export const DEFAULT_PACK_ID = 'gregorian';
export const PACK_IDS: readonly string[] = Object.keys(loaders).sort();

export function isPackId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id in loaders;
}

// The default pack is in the main bundle, so the app can always start, even
// offline with no other pack cached. Keep this import in step with DEFAULT_PACK_ID.
const cache = new Map<string, Promise<NamePack>>([[DEFAULT_PACK_ID, Promise.resolve(validatePack(defaultPack, 'gregorian.json'))]]);

export function loadPack(id: string): Promise<NamePack> {
  const packId = isPackId(id) ? id : DEFAULT_PACK_ID;
  let pending = cache.get(packId);
  if (!pending) {
    const { path, load } = loaders[packId];
    pending = load().then((data) => {
      const pack = validatePack(data, path);
      if (pack.id !== packId) throw new Error(`${path}: "id" must match the file name "${packId}"`);
      return pack;
    }).catch((error: unknown) => {
      // Don't remember a failed load (offline, say), so a later attempt can succeed
      cache.delete(packId);
      throw error;
    });
    cache.set(packId, pending);
  }
  return pending;
}

export function loadAllPacks(): Promise<NamePack[]> {
  return Promise.all(PACK_IDS.map(loadPack));
}
