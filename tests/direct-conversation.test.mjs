import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadHook(name, response) {
  const requests = [];
  let state = 0;
  const query = {
    select() { return this; }, eq() { return this; }, order() { return this; },
    update() { return this; }, in() { return this; },
    insert() { assert.fail('Clients must not create raw membership rows'); },
    then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
  };
  const supabase = { from: () => query, functions: { invoke: async (endpoint, request) => {
    requests.push({ endpoint, body: JSON.parse(JSON.stringify(request.body)) });
    return response;
  } } };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../src/hooks/${name}.tsx`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, console: { error() {} },
    require: path => {
      if (path === 'react') return {
        useState: initial => [name === 'useFriendRequests' && state++ === 0 ? [{ id: 'request', sender_id: 'friend' }] : initial, () => {}],
        useCallback: fn => fn, useEffect() {}, useMemo: fn => fn(),
      };
      if (path.includes('/supabase/client')) return { supabase };
      if (path.endsWith('/useAuth') || path === './useAuth') return { useAuth: () => ({ user: { id: 'host' } }) };
      if (path === '@tanstack/react-query') return { useQuery: () => ({ data: [], isLoading: false }), useQueryClient: () => ({ invalidateQueries: async () => {} }) };
      if (path === 'sonner') return { toast: { success() {}, error() {} } };
      if (path === '@/lib/savedMessages') return { getSavedMessages: async () => 'saved-test-chat' };
      throw new Error(path);
    },
  });
  return { hook: exports[name](), requests };
}

test('new direct chats use server-authorized membership creation', async () => {
  const { hook, requests } = loadHook('useConversations', { data: { id: 'server-chat' }, error: null });
  assert.equal(await hook.createConversation('friend'), 'server-chat');
  assert.deepEqual(requests, [{ endpoint: 'create-conversation', body: { participantId: 'friend' } }]);
});

test('direct chat creation does not claim success when the server fails', async () => {
  const { hook } = loadHook('useConversations', { data: null, error: new Error('Rejected') });
  assert.equal(await hook.createConversation('friend'), null);
});

test('accepted friend requests create their DM through the server', async () => {
  const { hook, requests } = loadHook('useFriendRequests', { data: { id: 'server-chat' }, error: null });
  assert.equal(await hook.acceptRequest('request'), 'server-chat');
  assert.deepEqual(requests, [{ endpoint: 'create-conversation', body: { participantId: 'friend' } }]);
});
