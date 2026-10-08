import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(path, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, ...globals }); return module.exports;
}
const { filterBuddyProfiles, sharedBuddyInterests, buddyRecentlyActive } = compile('../src/lib/buddyDiscovery.ts');
const people = [
  { user_id: 'a', username: 'ada', full_name: 'Ada', bio: 'Revision partner', interests: ['Biology'], is_online: false, avatar_url: null },
  { user_id: 'b', username: 'sam', full_name: 'Sam', bio: 'Past papers', interests: ['Maths'], is_online: true, avatar_url: null, last_seen: new Date().toISOString() },
];
test('buddy discovery searches existing names, interests and bios without requiring photos', () => {
  assert.equal(filterBuddyProfiles(people, 'biology revision', false, false).length, 1);
  assert.equal(filterBuddyProfiles(people, 'sam', false, false)[0].user_id, 'b');
  assert.equal(filterBuddyProfiles(people, 'unknown', false, false).length, 0);
});
test('shared and online filters use actual profile data, never fabricated compatibility', () => {
  assert.equal(filterBuddyProfiles(people, '', true, false, ['biology'])[0].user_id, 'a');
  assert.equal(filterBuddyProfiles(people, '', true, true, ['biology']).length, 0);
  assert.equal(filterBuddyProfiles(people, '', false, true)[0].user_id, 'b');
  assert.equal(sharedBuddyInterests({ interests: null }, ['biology']).length, 0);
});
test('shared interests rank first without mutating the source list', () => {
  const reversed = [...people].reverse();
  assert.equal(filterBuddyProfiles(reversed, '', false, false, ['biology'])[0].user_id, 'a');
  assert.equal(reversed[0].user_id, 'b');
});
test('stale online flags do not pretend that abandoned sessions are active now', () => {
  assert.equal(buddyRecentlyActive({ last_seen: null }), false);
  assert.equal(buddyRecentlyActive({ last_seen: '2020-01-01' }), false);
  assert.equal(buddyRecentlyActive({ last_seen: new Date().toISOString() }), true);
});

function harness({ reciprocal = false, fail = '' } = {}) {
  const incoming = { user_id: 'incoming', username: 'lee', full_name: 'Lee', interests: null, bio: null };
  const states = [[...people], [], [{ id: 'request', swiper_id: incoming.user_id, profile: incoming }], 1, true, false, null];
  let index = 0; const writes = []; const notices = [];
  class Query {
    constructor(table) { this.table = table; this.filters = {}; this.mode = 'select'; }
    select() { return this; } eq(key, value) { this.filters[key] = value; return this; }
    neq() { return this; } not() { return this; } in() { return this; } or() { return this; }
    order() { return this; } limit() { return this; } maybeSingle() { this.one = true; return this; } single() { this.one = true; return this; }
    insert(value) { this.mode = 'insert'; this.value = value; return this; } update(value) { this.mode = 'update'; this.value = value; return this; }
    then(resolve, reject) {
      let data = this.one ? null : [];
      let error = null;
      if (this.mode !== 'select') { writes.push({ table: this.table, ...this.value }); if (this.table === fail) error = new Error('Save failed'); }
      if (reciprocal && this.table === 'user_swipes' && this.filters.swiped_id === 'me' && this.filters.direction === 'right' && this.one) data = { id: 'reciprocal' };
      return Promise.resolve({ data, error }).then(resolve, reject);
    }
  }
  const imports = {
    react: { useState(value) { const i = index++; return [states[i] ?? value, next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; }, useRef: value => ({ current: value }), useEffect() {}, useCallback: fn => fn },
    '@/integrations/supabase/client': { supabase: { from: table => new Query(table), functions: { invoke: async (_name, options) => { writes.push({ table: 'create-conversation', member: options.body.memberIds[0] }); return { data: { id: 'chat' }, error: null }; } } } },
    './useAuth': { useAuth: () => ({ user: { id: 'me' } }) },
    sonner: { toast: { success: message => notices.push(message), error: message => notices.push(message) } },
  };
  const { useFindFriends } = compile('../src/hooks/useFindFriends.tsx', { require: name => { if (!(name in imports)) throw new Error(name); return imports[name]; }, console: { log() {}, error() {} } });
  const hook = useFindFriends(); return { hook, writes, states, notices };
}
test('Connect targets the selected list profile, not the old first swipe card', async () => {
  const { hook, writes, states } = harness();
  await hook.swipe('right', 'b');
  assert.equal(writes[0].swiped_id, 'b'); assert.equal(writes[0].direction, 'right');
  assert.equal(states[0].length, 1); assert.equal(states[0][0].user_id, 'a');
});
test('Connect back accepts an incoming request even if absent from discovery results', async () => {
  const { hook, writes } = harness({ reciprocal: true });
  const result = await hook.swipe('right', 'incoming');
  assert.equal(result.matched, true); assert.equal(result.conversationId, 'chat');
  assert.ok(writes.some(write => write.table === 'create-conversation' && write.member === 'incoming'));
});
test('failed connection save keeps the candidate available and does not claim a match', async () => {
  const { hook, states, notices } = harness({ reciprocal: true, fail: 'user_matches' });
  assert.equal(await hook.swipe('right', 'b'), null);
  assert.equal(states[0].length, 2); assert.ok(notices.some(message => message.includes('could not be saved')));
});
test('unknown discovery target cannot create a request or conversation', async () => {
  const { hook, writes } = harness(); assert.equal(await hook.swipe('right', 'unknown'), null); assert.equal(writes.length, 0);
});
