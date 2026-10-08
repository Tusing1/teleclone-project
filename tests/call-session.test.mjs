import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real hook with fake media/signaling; no accounts or shared calls are touched.
function harness({ signalingFails = false, microphoneFails = false, remote = false } = {}) {
  const log = { microphones: 0, stopped: 0, closed: 0, removed: 0, signals: [], ice: [] };
  const track = { enabled: true, stop() { log.stopped++; }, applyConstraints: async () => {} };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const call = { id: 'call', conversation_id: 'room', started_by: 'me', is_active: true, is_recording: false };
  const members = remote ? [{ id: 'remote-row', user_id: 'them', call_id: 'call', left_at: null }] : [];
  let signalListener;
  class Query {
    constructor(table) { this.table = table; this.filters = {}; this.mode = 'select'; }
    select() { return this; } eq(key, value) { this.filters[key] = value; return this; }
    is(key, value) { this.filters[key] = value; return this; }
    order() { return this; } limit() { return this; } gte() { return this; } in() { return this; }
    single() { this.one = true; return this; } maybeSingle() { this.one = true; return this; }
    update(value) { this.mode = 'update'; this.value = value; return this; }
    insert(value) { this.mode = 'insert'; this.value = value; return this; }
    then(resolve, reject) {
      let data = null;
      if (this.table === 'calls') {
        if (this.mode === 'update') Object.assign(call, this.value);
        data = call;
      } else if (this.table === 'conversation_participants') data = { role: 'owner' };
      else if (this.table === 'call_participants') {
        if (this.mode === 'insert') members.push({ id: 'mine', ...this.value });
        const found = members.filter(row => Object.entries(this.filters).every(([key, value]) => row[key] === value));
        if (this.mode === 'update') found.forEach(row => Object.assign(row, this.value));
        data = this.one ? found[0] || null : found;
      } else if (this.table === 'call_signals') {
        if (this.mode === 'insert') log.signals.push(this.value);
        data = [];
      } else if (this.table === 'profiles') data = [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    }
  }
  const db = {
    from: table => new Query(table),
    channel: () => {
      const channel = {
        on: (_event, options, listener) => { if (options.table === 'call_signals') signalListener = listener; return channel; },
        subscribe: listener => { listener?.(signalingFails ? 'CHANNEL_ERROR' : 'SUBSCRIBED'); return channel; },
      };
      return channel;
    },
    removeChannel: () => { log.removed++; },
  };
  class Peer {
    signalingState = 'stable';
    remoteDescription = null;
    connectionState = 'new';
    addTrack() {} setConfiguration() {}
    async createOffer() { return { type: 'offer', sdp: 'test-offer' }; }
    async createAnswer() { return { type: 'answer', sdp: 'test-answer' }; }
    async setLocalDescription(description) { this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable'; }
    async setRemoteDescription(description) { this.remoteDescription = description; this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'; }
    async addIceCandidate(candidate) { assert.ok(this.remoteDescription, 'ICE must wait for remote SDP'); log.ice.push(candidate); }
    close() { log.closed++; this.signalingState = 'closed'; }
  }
  const react = { useState: value => [typeof value === 'function' ? value() : value, () => {}], useRef: value => ({ current: value }), useEffect: () => {}, useCallback: fn => fn };
  const imports = {
    react, '@/integrations/supabase/client': { supabase: db },
    './useAuth': { useAuth: () => ({ user: { id: 'me' } }) },
    './useCallPreferences': { getCallPreferences: () => ({ noiseSuppression: true }), updateCallPreference() {} },
    '@/lib/recordingMixer': { createRecordingMixer: async () => {} },
    '@/lib/webrtc': { getTurnCredentials: async () => ({ iceServers: [{ urls: 'turn:relay.test' }] }) },
    sonner: { toast: { error() {}, info() {}, warning() {}, success() {} } },
  };
  const compiled = ts.transpileModule(readFileSync(new URL('../src/hooks/useLiveStream.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require: name => { if (!(name in imports)) throw new Error(name); return imports[name]; },
    console: { log() {}, warn() {}, error() {} }, RTCPeerConnection: Peer,
    window: { setTimeout, clearTimeout }, clearTimeout,
    navigator: { mediaDevices: { getUserMedia: async () => { log.microphones++; if (microphoneFails) throw new Error('Microphone denied'); return stream; } } },
    setTimeout, Map, Set, Date, Promise,
  });
  return { room: module.exports.useLiveStream('room'), log, members, signal: data => signalListener({ new: data }) };
}
test('joining twice opens one microphone; leaving stops media and signaling', async () => {
  const { room, log, members } = harness({ remote: true });
  await room.joinStream('call', false);
  await room.joinStream('call', false);
  assert.equal(log.microphones, 1);
  assert.equal(log.signals.filter(row => row.signal_type === 'offer').length, 1);
  await room.leaveStream();
  assert.equal(log.stopped, 1);
  assert.equal(log.closed, 1);
  assert.equal(log.removed, 1);
  assert.ok(members.find(row => row.user_id === 'me').left_at);
});
test('a failed signaling subscription releases the microphone and marks departure', async () => {
  const { room, log, members } = harness({ signalingFails: true });
  await assert.rejects(room.joinStream('call'), /signaling unavailable/i);
  assert.equal(log.stopped, 1);
  assert.equal(log.removed, 1);
  assert.ok(members.find(row => row.user_id === 'me').left_at);
});
test('denied microphone permission does not create a participant', async () => {
  const { room, log, members } = harness({ microphoneFails: true });
  await assert.rejects(room.joinStream('call'), /Microphone denied/);
  assert.equal(members.length, 0);
  assert.equal(log.signals.length, 0);
});
test('early ICE is queued until its offer arrives', async () => {
  const { room, log, signal } = harness();
  await room.joinStream('call');
  signal({ id: 'ice', from_user: 'them', to_user: 'me', signal_type: 'ice-candidate', signal_data: { candidate: 'test' } });
  signal({ id: 'offer', from_user: 'them', to_user: 'me', signal_type: 'offer', signal_data: { type: 'offer', sdp: 'incoming' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(log.ice.length, 1);
  assert.equal(log.signals.filter(row => row.signal_type === 'answer').length, 1);
  await room.leaveStream();
});
