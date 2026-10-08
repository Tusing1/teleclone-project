import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ resumeFails = false } = {}) {
  const log = { sources: [], stopped: 0, closed: 0 };
  class Stream {
    constructor(tracks) { this.tracks = tracks; }
    getAudioTracks() { return this.tracks; }
    getTracks() { return this.tracks; }
  }
  class Context {
    createMediaStreamDestination() { return { stream: new Stream([{ stop: () => log.stopped++ }]) }; }
    createMediaStreamSource(stream) {
      const source = { track: stream.tracks[0], connected: 0, disconnected: 0,
        connect() { this.connected++; }, disconnect() { this.disconnected++; } };
      log.sources.push(source);
      return source;
    }
    async resume() { if (resumeFails) throw new Error('Audio unavailable'); }
    async close() { log.closed++; }
  }
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/recordingMixer.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, { exports, AudioContext: Context, MediaStream: Stream });
  return { create: exports.createRecordingMixer, Stream, log };
}

test('recording mixes local and remote audio once and updates when members change', async () => {
  const { create, Stream, log } = harness();
  const local = { readyState: 'live' }, remote = { readyState: 'live' }, replacement = { readyState: 'live' };
  const mixer = await create(new Stream([local]), [new Stream([remote, local])]);
  assert.equal(log.sources.length, 2);
  mixer.update([new Stream([local, replacement])]);
  assert.equal(log.sources[1].disconnected, 1);
  assert.equal(log.sources.length, 3);
  mixer.dispose();
  mixer.dispose();
  mixer.update([new Stream([remote])]);
  assert.equal(log.stopped, 1);
  assert.equal(log.closed, 1);
  assert.equal(log.sources.length, 3);
  assert.equal(log.sources[0].disconnected, 1);
  assert.equal(log.sources[2].disconnected, 1);
});

test('recording initialization failure releases the mixer without stopping callers microphones', async () => {
  const { create, Stream, log } = harness({ resumeFails: true });
  const mic = { readyState: 'live', stop: () => assert.fail('Mixer must not stop the call microphone') };
  await assert.rejects(create(new Stream([mic]), []), /Audio unavailable/);
  assert.equal(log.sources[0].disconnected, 1);
  assert.equal(log.stopped, 1);
  assert.equal(log.closed, 1);
});
