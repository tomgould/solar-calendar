import { describe, expect, it } from 'vitest';
import { validatePack } from '../../src/names/schema';

// The same discovery the app uses: every JSON file in packs/ except templates
const packFiles = Object.entries(import.meta.glob<unknown>('../../src/names/packs/*.json', { eager: true, import: 'default' }))
  .map(([path, data]) => [path.slice(path.lastIndexOf('/') + 1), data] as [string, unknown])
  .filter(([file]) => !file.startsWith('_'));

describe('name packs', () => {
  it('finds at least one pack', () => {
    expect(packFiles.length).toBeGreaterThan(0);
  });

  it.each(packFiles)('%s is a valid pack whose id matches its file name', (file, data) => {
    expect(validatePack(data, file).id).toBe(file.replace(/\.json$/, ''));
  });

  it('reports every problem in a broken pack', () => {
    expect(() => validatePack({ id: 'Bad Id', months: [{}] }, 'broken.json')).toThrowError(/"id" must be lowercase[\s\S]*exactly 13 months[\s\S]*at least one source/);
  });
});
