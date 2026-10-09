import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
function compile(file, imports, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require: name => imports[name], crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, console, ...globals });
  return module.exports;
}
function harness() {
  const local = new Map(), remote = new Map(); let inserts = 0;
  const crypto = compile('../src/lib/encryption.ts', { 'idb-keyval': { get: async id => local.get(id), set: async (id, key) => local.set(id, key), del: async id => local.delete(id) } });
  const supabase = { from: () => ({ select: () => ({ eq: (_, id) => ({ maybeSingle: async () => ({ data: remote.has(id) ? { public_key: remote.get(id) } : null, error: null }) }) }), insert: async row => { inserts++; if (remote.has(row.user_id)) return { error: { code: '23505' } }; remote.set(row.user_id, row.public_key); return { error: null }; } }) };
  const session = compile('../src/lib/encryptionSession.ts', { '@/integrations/supabase/client': { supabase }, './encryption': crypto });
  return { crypto, session, local, remote, insertCount: () => inserts };
}
test('real WebCrypto hi decrypts for receiver and sender, with multiple independent senders', async () => {
  const h = harness(); const s = h.session;
  await Promise.all(['nurses', 'ward', 'asadi'].map(id => s.loadEncryption(id, true)));
  const first = await s.encryptForAccount('nurses', 'ward', 'hi');
  const second = await s.encryptForAccount('asadi', 'ward', 'different sender');
  assert.equal(await s.decryptForAccount('ward', first.encryptedContent, first.metadata), 'hi');
  assert.equal(await s.decryptForAccount('ward', second.encryptedContent, second.metadata), 'different sender');
  assert.equal(await s.decryptForAccount('ward', first.encryptedContent, first.metadata), 'hi');
  assert.equal(await s.decryptForAccount('nurses', first.encryptedContent, first.metadata, true, 'ward'), 'hi');
  const { recipientPublicKey, ...legacy } = first.metadata;
  assert.equal(await s.decryptForAccount('nurses', first.encryptedContent, legacy, true, 'ward'), 'hi');
  assert.equal(await s.decryptForAccount('asadi', first.encryptedContent, first.metadata), null);
});
test('new device cannot replace an existing published key or silently send plaintext', async () => {
  const h = harness(); await h.session.loadEncryption('ward', true);
  const published = h.remote.get('ward'); h.local.clear();
  assert.equal(await h.session.loadEncryption('ward', true), false);
  assert.equal(h.remote.get('ward'), published); assert.equal(h.insertCount(), 1);
  assert.match(h.session.encryptionSnapshot('ward').error, /original device key/);
  await assert.rejects(h.session.encryptForAccount('ward', 'nurses', 'hi'), /original device key/);
});
test('mismatched local key is preserved for history; setup cannot overwrite remote', async () => {
  const h = harness(); await h.session.loadEncryption('ward', true);
  const oldLocal = h.local.get('e2ee_private_key_ward');
  const pair = await h.crypto.generateKeyPair(); h.remote.set('ward', await h.crypto.exportPublicKey(pair.publicKey));
  assert.equal(await h.session.loadEncryption('ward', true), false);
  assert.equal(h.local.get('e2ee_private_key_ward'), oldLocal); assert.equal(h.insertCount(), 1);
  await assert.rejects(h.session.encryptForAccount('ward', 'nurses', 'hi'), /differs/);
});
test('hook consumers share initialization; concurrent setup creates only one pair', async () => {
  const h = harness(); let updates = 0;
  const unsubscribe = h.session.subscribeEncryption(() => updates++);
  assert.deepEqual(await Promise.all([h.session.loadEncryption('new', true), h.session.loadEncryption('new', true)]), [true, true]);
  assert.equal(h.insertCount(), 1); assert.equal(updates, 1); unsubscribe();
});
test('standalone encryptForRecipient includes the correct sender public half', async () => {
  const h = harness(); const sender = await h.crypto.generateKeyPair(), receiver = await h.crypto.generateKeyPair();
  const msg = await h.crypto.encryptForRecipient('hi', sender.privateKey, await h.crypto.exportPublicKey(receiver.publicKey));
  assert.equal(await h.crypto.decryptFromSender(msg.encryptedContent, msg.metadata, receiver.privateKey), 'hi');
});
test('a retained local key without a published key still completes first-time setup', async () => {
  const h = harness(); const pair = await h.crypto.generateKeyPair();
  await h.crypto.storePrivateKey('new', pair.privateKey);
  assert.equal(await h.session.loadEncryption('new'), false);
  assert.equal(h.session.encryptionSnapshot('new').initialized, false);
  assert.equal(await h.session.loadEncryption('new', true), true);
  assert.equal(h.session.encryptionSnapshot('new').initialized, true);
  assert.equal(h.crypto.publicKeyIdentity(h.remote.get('new')), h.crypto.publicKeyIdentity(await h.crypto.exportPublicKey(pair.publicKey)));
});
test('safe Saved creation is authenticated, serialized, transactional and non-destructive', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261009120000_safe_saved_messages.sql', import.meta.url), 'utf8');
  assert.match(sql, /actor uuid := auth.uid\(\)/); assert.match(sql, /actor IS NULL/);
  assert.match(sql, /pg_advisory_xact_lock/); assert.match(sql, /count\(\*\).* = 1/);
  assert.match(sql, /ORDER BY c.created_at, c.id/); assert.doesNotMatch(sql, /\bDELETE\b|\bUPDATE\b/i);
  for (const file of ['../src/hooks/useConversations.tsx', '../src/hooks/useLiveStream.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /getSavedMessages\(user.id\)/); assert.doesNotMatch(source, /body: \{ type: 'saved' \}/);
  }
});
test('Saved helper fails closed when the RPC is missing and never invokes the cleanup function', async () => {
  let called = false;
  const supabase = { rpc: async () => ({ error: { code: 'PGRST202' } }), from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }), functions: { invoke: () => { called = true; } } };
  const { getSavedMessages } = compile('../src/lib/savedMessages.ts', { '@/integrations/supabase/client': { supabase } });
  await assert.rejects(getSavedMessages('ward'), /safe backend update/); assert.equal(called, false);
});
