import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('multiple profile consumers and effect remounts do not reuse subscribed channels', () => {
  const effects = [], channels = new Map(), removed = [];
  let sequence = 0;
  const query = { select() { return this; }, neq() { return this; }, order: async () => ({ data: [], error: null }) };
  const supabase = {
    from: () => query,
    channel: name => {
      if (channels.has(name)) return channels.get(name);
      const channel = {
        subscribed: false,
        on() { assert.equal(this.subscribed, false, 'Cannot add callbacks after subscribe'); return this; },
        subscribe() { this.subscribed = true; return this; },
      };
      channels.set(name, channel);
      return channel;
    },
    // Keep the old channel present, simulating asynchronous unsubscribe.
    removeChannel: channel => { removed.push(channel); return Promise.resolve('ok'); },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/hooks/useUsers.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, {
    exports, crypto: { randomUUID: () => `subscription-${++sequence}` },
    require: name => {
      if (name === 'react') return { useState: value => [value, () => {}], useEffect: effect => effects.push(effect) };
      if (name.includes('/supabase/client')) return { supabase };
      if (name === './useAuth') return { useAuth: () => ({ user: { id: 'host' } }) };
      throw new Error(name);
    },
  });
  exports.useUsers(); exports.useUsers();
  const cleanupFirst = effects[0]();
  const cleanupSecond = effects[1]();
  cleanupFirst();
  const cleanupRemounted = effects[0]();
  assert.equal(channels.size, 3);
  cleanupSecond(); cleanupRemounted();
  assert.equal(removed.length, 3);
  assert.equal(new Set(removed).size, 3);
});
