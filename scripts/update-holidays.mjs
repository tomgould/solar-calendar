// Saves the official lists of public holidays as test fixtures, with sorted
// keys so that only real changes show in a diff. tests/unit/holidays.test.ts
// then checks that the rules in src/holidays/ give exactly those dates.
// - GOV.UK's bank holidays for the three UK regions
// - OPM's US federal holidays (an iCalendar file, saved as a list of dates)
// - Ireland's public holidays from Nager.Date, as Ireland publishes no list a
//   program can read; the years from 2020 to three years ahead
import { writeFile } from 'node:fs/promises';

const sorted = (value) => (Array.isArray(value) ? value.map(sorted)
  : value !== null && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
    : value);

async function get(url, as) {
  const response = await fetch(url, { headers: { 'User-Agent': 'solar-calendar holiday check (https://github.com/tomgould/solar-calendar)' } });
  if (!response.ok) throw new Error(`${url} answered ${response.status} ${response.statusText}`);
  return as === 'json' ? response.json() : response.text();
}

async function save(name, data) {
  await writeFile(new URL(`../tests/fixtures/${name}`, import.meta.url), `${JSON.stringify(sorted(data), null, 2)}\n`);
  console.log(`Saved tests/fixtures/${name}`);
}

await save('gov-uk-bank-holidays.json', await get('https://www.gov.uk/bank-holidays.json', 'json'));

// Unfold the iCalendar lines, then take each event's date and title
const ics = (await get('https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/holidays.ics')).replace(/\r?\n[ \t]/g, '');
const opm = ics.split('BEGIN:VEVENT').slice(1).map((event) => {
  const date = /^DTSTART[^:\r\n]*:(\d{4})(\d{2})(\d{2})/m.exec(event);
  const summary = /^SUMMARY[^:\r\n]*:(.*)$/m.exec(event);
  if (!date || !summary) throw new Error(`An OPM event without a date or title: ${event.slice(0, 200)}`);
  return { date: `${date[1]}-${date[2]}-${date[3]}`, name: summary[1].trim().replace(/\\([,;\\])/g, '$1') };
}).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
await save('opm-federal-holidays.json', opm);

const years = Array.from({ length: new Date().getUTCFullYear() + 4 - 2020 }, (_, i) => 2020 + i);
const ireland = [];
for (const year of years) {
  for (const holiday of await get(`https://date.nager.at/api/v3/PublicHolidays/${year}/IE`, 'json')) {
    if (holiday.global && holiday.types.includes('Public')) ireland.push({ date: holiday.date, name: holiday.name });
  }
}
await save('nager-ireland-public-holidays.json', ireland.sort((a, b) => a.date.localeCompare(b.date)));
