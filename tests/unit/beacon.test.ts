import { describe, expect, it } from 'vitest';
import { beaconSnippet, beaconToken, cloudflareBeacon } from '../../scripts/beacon.mjs';

const page = '<html><body><main></main></body></html>';
const run = (env: Record<string, string>) => {
  const hook = cloudflareBeacon(env).transformIndexHtml as { handler: (html: string) => string };
  return hook.handler(page);
};

describe('Cloudflare Web Analytics beacon', () => {
  it('is left out of ordinary builds, tests and previews', () => {
    expect(beaconToken({})).toBe('');
    expect(beaconToken({ CI: 'true' })).toBe('');
    expect(run({})).toBe(page);
  });

  it('is left out of Workers Builds previews of other branches', () => {
    expect(beaconToken({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'some-branch' })).toBe('');
  });

  it('is added before </body> when CF_BEACON_TOKEN is set', () => {
    const html = run({ CF_BEACON_TOKEN: 'abc123' });
    expect(html).toContain(beaconSnippet('abc123'));
    expect(html.indexOf('beacon.min.js')).toBeLessThan(html.indexOf('</body>'));
    expect(html.endsWith('</body></html>')).toBe(true);
  });

  it('is added when Workers Builds deploys main', () => {
    expect(run({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' })).toContain('static.cloudflareinsights.com/beacon.min.js');
  });
});
