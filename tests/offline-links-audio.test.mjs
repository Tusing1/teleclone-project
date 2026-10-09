import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, { module, exports: module.exports, require: name => imports[name], ...globals });
  return module.exports;
}
const preferences = new Map();
const budget = compile('../src/lib/storageBudget.ts', {}, { localStorage: { getItem: key => preferences.get(key), setItem: (key, value) => preferences.set(key, value) }, window: { dispatchEvent() {} }, Event });
test('offline budget is account-specific, defaults to 1 GB and supports 5 GB', () => {
  assert.equal(budget.storageBudget('a'), budget.GIB);
  budget.setStorageBudget('a', 5);
  assert.equal(budget.storageBudget('a'), 5 * budget.GIB);
  assert.equal(budget.storageBudget('b'), budget.GIB);
});
test('cache cleanup preserves downloads, evicts oldest automatic files and counts replacements once', () => {
  const rows = [{ key: 'saved', size: 40, savedOffline: true, cachedAt: 0 }, { key: 'old', size: 30, cachedAt: 1 }, { key: 'newer', size: 20, cachedAt: 2 }];
  assert.deepEqual(Array.from(budget.planCacheWrite(rows, 'next', 40, 100)), ['old']);
  assert.deepEqual(Array.from(budget.planCacheWrite(rows, 'old', 30, 100)), []);
  assert.throws(() => budget.planCacheWrite(rows, 'next', 61, 100), /storage limit/);
});
test('simultaneous saves cannot overspend storage and account caches stay isolated', async () => {
  const values = new Map(); let account = 'cache-a';
  const idb = { get: async key => values.get(key), set: async (key, value) => { values.set(key, value); }, del: async key => { values.delete(key); }, keys: async () => Array.from(values.keys()) };
  const { useFileCache } = compile('../src/hooks/useFileCache.tsx', { react: { useCallback: fn => fn }, './useAuth': { useAuth: () => ({ user: { id: account } }) }, 'idb-keyval': idb, '@/lib/storageBudget': budget }, { window: { dispatchEvent() {} }, Event, navigator: {} });
  const cache = useFileCache(); const blob = { size: .7 * budget.GIB, type: 'audio/webm' };
  const results = await Promise.allSettled([cache.cacheFile('one', blob, 'One', true), cache.cacheFile('two', blob, 'Two', true)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await cache.getDownloadedFiles()).length, 1);
  account = 'cache-b'; assert.equal((await useFileCache().getDownloadedFiles()).length, 0);
  const saved = await cache.getCachedFile('one'); saved.cachedAt = 0;
  assert.ok(await cache.getCachedFile('one'), 'explicit downloads have no expiry');
});
const links = compile('../src/lib/messageLinks.ts', {}, { URL });
test('multiple blue links preserve trailing punctuation and never accept credential or script URLs', () => {
  const text = 'Read https://example.org/a, then https://example.net/b).';
  const parts = links.splitMessageLinks(text);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(parts.filter(part => part.url).map(part => part.url).join(','), 'https://example.org/a,https://example.net/b');
  assert.equal(links.safeWebUrl('javascript:alert(1)'), null);
  assert.equal(links.safeWebUrl('https://name:secret@example.org'), null);
});
function audioHarness({ cache = async () => null, rejectPlay = false } = {}) {
  let cursor = 0, api, props; const slots = []; const effects = []; const errors = []; const revoked = [];
  const element = { currentTime: 0, duration: 100, pause() {}, play: async () => { if (rejectPlay) throw new Error('autoplay'); }, removeAttribute() {}, src: '' };
  const react = { createContext: () => ({ Provider: 'provider' }), useContext() {}, useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useRef: initial => { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; }, useCallback: fn => fn, useEffect: fn => { effects.push(fn); }, createElement: (type, properties, ...children) => { if (type === 'audio') { props = properties; properties.ref.current = element; } if (type === 'provider') api = properties.value; return { type, properties, children }; } };
  const { GlobalAudioProvider } = compile('../src/hooks/useGlobalAudio.tsx', { react, './useAuth': { useAuth: () => ({ user: { id: 'me' } }) }, './useFileCache': { useFileCache: () => ({ getCachedFile: cache }) }, sonner: { toast: { error: message => errors.push(message) } } }, { localStorage: { getItem: () => null, setItem() {} }, window: { addEventListener() {}, removeEventListener() {} }, URL: { createObjectURL: () => 'blob:cached', revokeObjectURL: url => revoked.push(url) }, setInterval: () => 1, clearInterval() {} });
  const render = () => { cursor = 0; GlobalAudioProvider({ children: null }); return api; }; render();
  return { render, element, errors, revoked, event: name => props[name]() };
}
test('autoplay rejection does not claim playing; playback waits for actual media events', async () => {
  const h = audioHarness({ rejectPlay: true }); const api = h.render();
  await api.play('https://example.org/a.webm', 'Notes', 'Nurses', 12, { conversationId: 'channel', messageId: 'post' });
  const state = h.render().audioState;
  assert.equal(state.isPlaying, false); assert.equal(state.source.conversationId, 'channel'); assert.equal(h.errors.length, 1);
  h.event('onPlay'); assert.equal(h.render().audioState.isPlaying, true);
});
test('late cache completion cannot resurrect audio after stop; canonical URL owns cached playback', async () => {
  let resolve; const h = audioHarness({ cache: () => new Promise(done => { resolve = done; }) });
  const api = h.render(); const pending = api.play('https://example.org/a.webm'); api.stop(); resolve({ blob: {} }); await pending;
  assert.equal(h.render().audioState, null); assert.equal(h.element.src, '');
  const cached = audioHarness({ cache: async () => ({ blob: {} }) });
  await cached.render().play('https://example.org/a.webm');
  assert.equal(cached.element.src, 'blob:cached'); assert.equal(cached.render().audioState.url, 'https://example.org/a.webm');
  cached.render().stop(); assert.deepEqual(cached.revoked, ['blob:cached']);
});
test('channel pins enforce administrator role and reject posts from other channels on insert and update', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261008200000_channel_pins.sql', import.meta.url), 'utf8');
  assert.match(sql, /role IN \('owner','admin'\)/);
  assert.match(sql, /id = NEW.pinned_message_id AND conversation_id = NEW.id/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF pinned_message_id/);
});
test('opening Saved Messages does not merge or delete existing duplicate chats', () => {
  const source = readFileSync(new URL('../supabase/functions/create-conversation/index.ts', import.meta.url), 'utf8');
  const existing = source.slice(source.indexOf('if (type === \'saved\''), source.indexOf('// Create new self-chat conversation'));
  assert.doesNotMatch(existing, /\.delete\(/);
  assert.doesNotMatch(existing, /\.update\(/);
});
test('voice-note upload preserves the recorder MIME type and file extension', async () => {
  const writes = []; const uploads = [];
  const db = { storage: { from: () => ({ upload: async (path, blob, options) => { uploads.push({ path, options }); return { error: null }; }, getPublicUrl: path => ({ data: { publicUrl: `https://example.org/${path}` } }) }) }, from: table => ({ insert: async value => { writes.push(value); return { error: null }; }, update: () => ({ eq: async () => ({ error: null }) }) }) };
  const { useVoiceMessage } = compile('../src/hooks/useVoiceMessage.tsx', { react: { useState: value => [value, () => {}], useCallback: fn => fn }, '@/integrations/supabase/client': { supabase: db }, './useAuth': { useAuth: () => ({ user: { id: 'me' } }) } });
  await useVoiceMessage({ conversationId: 'room' }).sendVoiceMessage({ type: 'audio/mp4', size: 128 }, 10);
  assert.match(uploads[0].path, /\.m4a$/); assert.equal(uploads[0].options.contentType, 'audio/mp4');
  assert.match(writes[0].file_name, /\.m4a$/);
});
