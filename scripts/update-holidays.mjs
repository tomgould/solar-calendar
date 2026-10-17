// Saves GOV.UK's list of bank holidays as a test fixture, with sorted keys so
// that only real changes show in a diff. tests/unit/holidays.test.ts then
// checks that the rules in src/holidays/ give exactly those dates.
import { writeFile } from 'node:fs/promises';

const response = await fetch('https://www.gov.uk/bank-holidays.json');
if (!response.ok) throw new Error(`GOV.UK answered ${response.status} ${response.statusText}`);

const sorted = (value) => (Array.isArray(value) ? value.map(sorted)
  : value !== null && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
    : value);

await writeFile(new URL('../tests/fixtures/gov-uk-bank-holidays.json', import.meta.url), `${JSON.stringify(sorted(await response.json()), null, 2)}\n`);
console.log('Saved tests/fixtures/gov-uk-bank-holidays.json');
