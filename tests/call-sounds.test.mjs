import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ blocked = false, unsupported = false } = {}) {
  const log = { starts: 0, stops: 0, disconnected: 0, closed: 0, resumes: 0 };
  const cleanups = []; const timers = [];
  class Context {
    state = blocked ? 'suspended' : 'running'; currentTime = 0; destination = {};
    async resume() { log.resumes++; if (blocked) throw new Error('Autoplay blocked'); this.state = 'running'; }
    async close() { this.state = 'closed'; log.closed++; }
    createOscillator() { return { frequency: {}, connect() {}, disconnect() { log.disconnected++; }, start() { log.starts++; }, stop() { log.stops++; } }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() { log.disconnected++; } }; }
  }
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL('../src/hooks/useCallSounds.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, window: unsupported ? {} : { AudioContext: Context }, setTimeout: fn => timers.push(fn), Set,
    require: name => { assert.equal(name, 'react'); return { useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => cleanups.push(fn()) }; },
  });
  return { sounds: module.exports.useCallSounds(), log, dispose: () => { cleanups.forEach(fn => fn?.()); timers.forEach(fn => fn()); } };
}
test('ringing stops and disconnects every scheduled audio node', () => {
  const { sounds, log, dispose } = harness();
  sounds.playRingtone(); assert.equal(log.starts, 4);
  sounds.stopRingtone(); assert.equal(log.disconnected, 8);
  const stops = log.stops; sounds.stopRingtone(); assert.equal(log.stops, stops);
  dispose(); assert.equal(log.closed, 1);
});
test('repeated ring cycles replace rather than stack previous nodes', () => {
  const { sounds, log, dispose } = harness();
  sounds.playRingtone(); sounds.playRingtone();
  assert.equal(log.disconnected, 8);
  dispose(); assert.equal(log.disconnected, 16);
});
test('unsupported audio never prevents call controls', () => {
  const { sounds } = harness({ unsupported: true });
  assert.doesNotThrow(() => { sounds.playRingtone(); sounds.playJoinTone(); sounds.playEndTone(); sounds.playControlTone(); });
});
test('autoplay denial is handled without scheduling inaudible loops', async () => {
  const { sounds, log, dispose } = harness({ blocked: true });
  sounds.playRingtone(); sounds.playJoinTone();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(log.starts, 0); assert.equal(log.resumes, 2);
  dispose(); assert.equal(log.closed, 1);
});
test('short feedback cues release their audio device after unmount', () => {
  const { sounds, log, dispose } = harness();
  sounds.playJoinTone(); sounds.playControlTone(); sounds.playEndTone();
  assert.equal(log.starts, 5);
  dispose(); assert.equal(log.closed, 1); assert.equal(log.disconnected, 10);
});
