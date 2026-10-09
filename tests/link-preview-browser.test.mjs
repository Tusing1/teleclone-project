import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

function compile(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const source = readFileSync(new URL(file, import.meta.url), 'utf8').replaceAll('import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY', '"public-test-key"');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: name => imports[name], URL, Request, Response, AbortSignal, TextDecoder, TextEncoder, crypto: webcrypto, ...globals });
  return module.exports;
}
const links = compile('../src/lib/messageLinks.ts');
const policy = compile('../src/lib/linkPolicy.ts', { './messageLinks': links });

test('owned links use known internal routes without accepting lookalikes or downloads', () => {
  assert.equal(policy.internalAppPath('https://studdybuddyapp.com/', 'http://localhost:8080'), '/');
  assert.equal(policy.internalAppPath('https://www.studdybuddyapp.com/invite/hello?x=1', 'https://studdybuddyapp.com'), '/invite/hello?x=1');
  assert.equal(policy.internalAppPath('https://studdybuddyapp.com.evil.org/', 'https://studdybuddyapp.com'), null);
  assert.equal(policy.internalAppPath('https://studdybuddyapp.com/downloads/StudyGram.mobileconfig', 'https://studdybuddyapp.com'), null);
  assert.equal(policy.internalAppPath('https://studdybuddyapp.com:9999/', 'https://studdybuddyapp.com'), null);
});

test('preview fetches reject unsafe protocols, IPs, ports, local names and credential URLs', () => {
  for (const value of ['http://github.com/', 'https://127.0.0.1', 'https://2130706433', 'https://[::1]', 'https://server.local', 'https://intranet', 'https://github.com:8080', 'https://user:secret@github.com', 'https://github.com/?access_token=secret', 'https://github.com/?X-Amz-Signature=secret', 'javascript:alert(1)']) {
    assert.equal(policy.publicPreviewUrl(value), null, value);
  }
  assert.equal(policy.publicPreviewUrl('https://github.com/ionic-team#readme'), 'https://github.com/ionic-team');
});

test('private, reserved and ambiguous DNS addresses fail closed', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.1.1', '198.18.0.1', '192.0.2.1', '203.0.113.5', '224.0.0.1', '999.1.1.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', '2002:7f00:1::']) assert.equal(policy.isPublicAddress(ip), false, ip);
  for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700::1111', '2001:4860:4860::8888']) assert.equal(policy.isPublicAddress(ip), true, ip);
});

function worker(fetcher) { return compile('../worker/index.ts', { '../src/lib/linkPolicy': policy }, { fetch: fetcher }); }
const dnsReply = data => Response.json({ Status: 0, Answer: [{ type: 1, data }] });
test('a mixed public/private DNS response is refused before requesting the page', async () => {
  let pages = 0;
  const fetcher = async url => {
    if (url.startsWith('https://cloudflare-dns.com')) return url.endsWith('type=A') ? dnsReply('1.1.1.1') : dnsReply('10.0.0.1');
    pages++; return new Response('bad');
  };
  await assert.rejects(worker(fetcher).validateDestination('https://github.com', AbortSignal.timeout(1000), fetcher), /Private destination/);
  assert.equal(pages, 0);
});

test('redirects are revalidated and never carry authorization or cookies', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    if (url.startsWith('https://cloudflare-dns.com')) return dnsReply('1.1.1.1');
    calls.push({ url, options });
    return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } });
  };
  await assert.rejects(worker(fetcher).fetchPage('https://github.com', AbortSignal.timeout(1000), fetcher), /Unsupported destination/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.headers.Authorization, undefined);
});

test('signed-out preview calls and untrusted CORS origins cannot fetch metadata', async () => {
  let requests = 0;
  const api = worker(async () => { requests++; throw new Error('Unexpected network'); }).default;
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  const ctx = { waitUntil() {} };
  assert.equal((await api.fetch(new Request('https://studdybuddyapp.com/api/link-preview', { method: 'POST', body: '{}' }), env, ctx)).status, 401);
  assert.equal((await api.fetch(new Request('https://studdybuddyapp.com/api/link-preview', { method: 'OPTIONS', headers: { Origin: 'https://evil.org' } }), env, ctx)).status, 403);
  const options = await api.fetch(new Request('https://studdybuddyapp.com/api/link-preview', { method: 'OPTIONS', headers: { Origin: 'capacitor://localhost' } }), env, ctx);
  assert.equal(options.status, 204); assert.equal(options.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
  const androidOptions = await api.fetch(new Request('https://studdybuddyapp.com/api/link-preview', { method: 'OPTIONS', headers: { Origin: 'https://localhost' } }), env, ctx);
  assert.equal(androidOptions.status, 204);
  assert.equal(requests, 0);
  assert.equal(await (await api.fetch(new Request('https://studdybuddyapp.com/install'), env, ctx)).text(), 'asset');
});

test('upstream pages are size-limited, HTML-only, and stop after the head', async () => {
  const w = worker();
  await assert.rejects(w.limitedHtml(new Response('binary', { headers: { 'content-type': 'image/png' } })), /No public HTML/);
  await assert.rejects(w.limitedHtml(new Response('a'.repeat(600000), { headers: { 'content-type': 'text/html' } })), /Page too large/);
  assert.equal(await w.limitedHtml(new Response('<head><title>Study</title></head>', { headers: { 'content-type': 'text/html' } })), '<head><title>Study</title></head>');
});

test('native browser only opens validated links on a native platform', async () => {
  let native = false; const calls = [];
  const module = compile('../src/lib/openNativeLink.ts', { '@capacitor/core': { Capacitor: { isNativePlatform: () => native } }, './messageLinks': links, '@capacitor/browser': { Browser: { open: async options => calls.push(options) } } });
  assert.equal(await module.openNativeLink('https://github.com'), false);
  native = true; assert.equal(await module.openNativeLink('javascript:alert(1)'), false);
  assert.equal(await module.openNativeLink('https://github.com'), true);
  assert.equal(calls.length, 1); assert.equal(calls[0].presentationStyle, 'fullscreen');
});

test('own previews have the real logo and favicon; YouTube paths validate video IDs', () => {
  const previews = compile('../src/lib/linkPreview.ts', { './messageLinks': links, './linkPolicy': policy });
  const own = previews.basicLinkPreview('https://studdybuddyapp.com/');
  assert.equal(own.siteName, 'StudyGram'); assert.equal(own.favicon, '/brand/studygram-32.png'); assert.equal(own.image, '/brand/studygram-512.png');
  assert.match(previews.basicLinkPreview('https://youtube.com/shorts/abcdefghijk').image, /abcdefghijk\/hqdefault.jpg$/);
  assert.equal(previews.basicLinkPreview('https://youtu.be/too-short').image, undefined);
  assert.equal(previews.basicLinkPreview('https://github.com/ionic-team').favicon, 'https://github.com/favicon.ico');
});

test('preview metadata is reused offline and never crosses account caches or persists credentials', async () => {
  const store = new Map(); let account = 'me'; let requests = 0;
  const navigator = { onLine: true };
  const previews = compile('../src/lib/linkPreview.ts', {
    './messageLinks': links, './linkPolicy': policy,
    'idb-keyval': { get: async key => store.get(key), set: async (key, value) => store.set(key, value) },
    '@/integrations/supabase/client': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: account }, access_token: 'private-test-token' } } }) } } },
  }, { navigator, window: { location: { hostname: 'studdybuddyapp.com' } }, fetch: async (url, options) => {
    requests++; assert.equal(url, '/api/link-preview'); assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    return Response.json({ title: 'Real page title', description: 'Description', image: 'javascript:alert(1)', favicon: 'https://127.0.0.1/icon.png' });
  } });
  const loaded = await previews.loadLinkPreview('https://github.com/ionic-team');
  assert.equal(loaded.title, 'Real page title'); assert.equal(loaded.image, undefined); assert.equal(loaded.favicon, 'https://github.com/favicon.ico');
  navigator.onLine = false;
  assert.equal((await previews.loadLinkPreview('https://github.com/ionic-team')).title, 'Real page title');
  account = 'other'; assert.notEqual((await previews.loadLinkPreview('https://github.com/ionic-team')).title, 'Real page title');
  assert.equal(requests, 1); assert.doesNotMatch(JSON.stringify(Array.from(store.values())), /private-test-token|public-test-key/);
});

test('authentication and rate failures never reach a destination website', async () => {
  let authStatus = 401; let limited = false; const requests = [];
  const api = worker(async url => { requests.push(url); return authStatus === 401 ? new Response('', { status: 401 }) : Response.json({ id: 'verified-user' }); }).default;
  const env = { PREVIEW_RATE: { limit: async () => ({ success: !limited }) } };
  const request = () => new Request('https://studdybuddyapp.com/api/link-preview', { method: 'POST', headers: { Authorization: 'Bearer token', apikey: 'public-test-key' }, body: JSON.stringify({ url: 'https://github.com' }) });
  assert.equal((await api.fetch(request(), env, { waitUntil() {} })).status, 401);
  authStatus = 200; limited = true;
  assert.equal((await api.fetch(request(), env, { waitUntil() {} })).status, 429);
  assert.ok(requests.every(url => url === 'https://plhzfgfrlxywxaccewyh.supabase.co/auth/v1/user'));
});
