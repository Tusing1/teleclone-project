import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadClient(result) {
  let state = 0;
  const requests = [];
  const source = ts.transpileModule(readFileSync(process.env.STUDYGRAM_PUSH_SOURCE || new URL('../src/hooks/usePushNotifications.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, console: { error() {} },
    require: name => {
      if (name === 'react') return {
        useState: initial => [state++ === 1 ? true : typeof initial === 'function' ? initial() : initial, () => {}],
        useEffect() {}, useCallback: callback => callback,
      };
      if (name === './useAuth') return { useAuth: () => ({ user: { id: 'signed-in-user' } }) };
      if (name === 'sonner') return { toast: {} };
      if (name.includes('/supabase/client')) return { supabase: { functions: { invoke: async (name, request) => {
        requests.push({ name, body: JSON.parse(JSON.stringify(request.body)) });
        return result;
      } } } };
      throw new Error(name);
    },
  });
  return { client: exports.usePushNotifications(), requests };
}

test('push self-test uses the verified-user contract and confirms delivery', async () => {
  const { client, requests } = loadClient({ data: { sent: 1 }, error: null });
  assert.equal(await client.sendTestNotification(), true);
  assert.deepEqual(requests, [{ name: 'send-push-notification', body: { user_id: 'signed-in-user' } }]);
});

for (const [name, result] of [
  ['zero deliveries', { data: { sent: 0 }, error: null }],
  ['missing delivery count', { data: {}, error: null }],
  ['backend rejection', { data: null, error: new Error('Unauthorized') }],
]) {
  test(`push self-test does not claim success for ${name}`, async () => {
    assert.equal(await loadClient(result).client.sendTestNotification(), false);
  });
}
