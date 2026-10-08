import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadFunction(name, { env = {}, user = { id: 'me' }, db, fetch, push } = {}) {
  let handler;
  const source = ts.transpileModule(readFileSync(new URL('../supabase/functions/' + name + '/index.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
  });
  assert.equal(source.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0);
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }) }, ...db };
  vm.runInNewContext(source.outputText, {
    exports: {}, require: path => {
      if (path.includes('/http/server.ts')) return { serve: fn => { handler = fn; } };
      if (path.includes('supabase-js')) return { createClient: () => client };
      if (path === 'npm:web-push@3.6.7') return { default: { sendNotification: push } };
      throw new Error(path);
    },
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://backend.test', SUPABASE_ANON_KEY: 'test', ...env })[key] } },
    Request, Response, URL, AbortSignal, fetch, Date, Set, Promise,
  });
  return (body = {}, headers = { Authorization: 'Bearer test' }) => handler(new Request('https://edge.test', { method: 'POST', headers, body: JSON.stringify(body) }));
}
test('TURN credentials require a verified signed-in user', async () => {
  let requests = 0;
  const run = loadFunction('get-turn-credentials', { user: null, fetch: () => { requests++; } });
  assert.equal((await run()).status, 401);
  assert.equal(requests, 0);
});
test('TURN rejects missing configuration and malformed provider responses', async () => {
  assert.equal((await loadFunction('get-turn-credentials')()).status, 503);
  const run = loadFunction('get-turn-credentials', { env: { METERED_API_KEY: 'fake' }, fetch: async () => Response.json([{ urls: 'stun:only.test' }]) });
  assert.equal((await run()).status, 503);
});
test('TURN falls back to a second configured key and returns relay configuration', async () => {
  let requests = 0;
  const run = loadFunction('get-turn-credentials', {
    env: { METERED_API_KEY: 'first', METERED_API_KEY2: 'backup' },
    fetch: async () => ++requests === 1 ? new Response(null, { status: 401 }) : Response.json([{ urls: 'turn:relay.test', username: 'temp', credential: 'temp' }]),
  });
  const response = await run();
  assert.equal(response.status, 200);
  assert.equal(requests, 2);
  assert.equal((await response.json()).iceServers[0].urls, 'turn:relay.test');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('TURN rejects an untrusted configured domain without sending any API key', async () => {
  let requests = 0;
  const run = loadFunction('get-turn-credentials', { env: { METERED_API_KEY: 'fake', METERED_DOMAIN: 'untrusted.test' }, fetch: () => { requests++; } });
  assert.equal((await run()).status, 503);
  assert.equal(requests, 0);
});
function pushHarness({ failures = {}, endpoints = ['https://fcm.googleapis.com/send/device'] } = {}) {
  const deleted = [], sent = [];
  const subscriptions = endpoints.map((endpoint, id) => ({ id, endpoint, p256dh: 'test', auth: 'test' }));
  const db = { from: table => {
    assert.equal(table, 'push_subscriptions');
    const query = {
      select: () => query, in: () => query, delete: () => { query.deleting = true; return query; },
      eq: (_key, id) => { if (query.deleting) deleted.push(id); return query; },
      then: fn => Promise.resolve({ data: subscriptions, error: null }).then(fn),
    };
    return query;
  } };
  const run = loadFunction('send-push-notification', { env: { VAPID_PUBLIC_KEY: 'test', VAPID_PRIVATE_KEY: 'test' }, db,
    push: async (subscription, payload, options) => {
      sent.push({ subscription, payload: JSON.parse(payload), options });
      if (failures[subscription.endpoint]) throw { statusCode: failures[subscription.endpoint] };
    } });
  return { run, sent, deleted };
}
test('push delivery really invokes its sender and reports sent counts', async () => {
  const { run, sent } = pushHarness();
  const response = await run({ user_id: 'me' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.vapidDetails.publicKey, 'test');
});
test('push rejects arbitrary notification recipients', async () => {
  const { run, sent } = pushHarness();
  assert.equal((await run({ user_id: 'someone-else' })).status, 403);
  assert.equal(sent.length, 0);
});
test('temporary push failures preserve subscriptions; expired endpoints are removed', async () => {
  const endpoint = 'https://fcm.googleapis.com/send/device';
  const temporary = pushHarness({ failures: { [endpoint]: 503 } });
  assert.equal((await (await temporary.run({ user_id: 'me' })).json()).failed, 1);
  assert.equal(temporary.deleted.length, 0);
  const expired = pushHarness({ failures: { [endpoint]: 410 } });
  await expired.run({ user_id: 'me' });
  assert.deepEqual(expired.deleted, [0]);
});
test('push never sends a request to arbitrary endpoints', async () => {
  const { run, sent } = pushHarness({ endpoints: ['https://untrusted.test'] });
  assert.equal((await (await run({ user_id: 'me' })).json()).failed, 1);
  assert.equal(sent.length, 0);
});
