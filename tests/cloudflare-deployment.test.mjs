import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('Cloudflare preserves SPA navigation and routes API requests to the preview worker', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.name, 'studygram');
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.not_found_handling, 'single-page-application');
  assert.equal(config.main, 'worker/index.ts');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.deepEqual(config.assets.run_worker_first, ['/api/*']);
  assert.equal(config.ratelimits[0].name, 'PREVIEW_RATE');
  assert.deepEqual(config.routes, [
    { pattern: 'studdybuddyapp.com', custom_domain: true },
    { pattern: 'www.studdybuddyapp.com', custom_domain: true },
  ], 'Preserve only the two approved production domains on future deployments');
  assert.equal(config.vars, undefined, 'No backend private secrets in static hosting config');
});

test('Favicon and share preview use existing StudyGram assets', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const icon = html.match(/rel="icon"[^>]*href="([^"]+)"/)[1];
  assert.ok(existsSync(new URL(`../public${icon}`, import.meta.url)));
  assert.match(html, /property="og:image" content="https:\/\/studdybuddyapp\.com\/brand\/studygram-512\.png"/);
  assert.match(html, /apple-touch-icon" sizes="180x180" href="\/brand\/studygram-180\.png"/);
  assert.doesNotMatch(html, /lovable-badge|~flock|lovable\.dev/);
});

test('Service-worker updates are not pinned behind an immutable cache', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/assets\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /\/sw\.js\s+Cache-Control: no-cache/);
  assert.match(headers, /\/push-events\.js\s+Cache-Control: no-cache/);
});
