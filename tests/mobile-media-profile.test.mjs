import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function compile(path, imports = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => imports[name], ...globals });
  return module.exports;
}
const studies = compile('../src/lib/studyDetails.ts');
test('year of study, semester and calendar year remain independent', () => {
  const value = { ...studies.emptyStudyDetails(), course: 'Nursing', qualification: 'Diploma', calendar_year: 2026, year_of_study: 1, semester: 2 };
  assert.equal(studies.studyDetailsError(value), null);
  assert.match(studies.studySummary(value), /Year 1, Semester 2 · 2026/);
  assert.ok(studies.studyDetailsError({ ...value, semester: 5 }));
  assert.ok(studies.studyDetailsError({ ...value, course: '' }));
  assert.ok(studies.studyDetailsError({ ...value, qualification: 'fake' }));
});
const presence = compile('../src/lib/presence.ts');
test('presence expires and stale login flags never produce online status', () => {
  const now = 1000000;
  assert.deepEqual(Array.from(presence.activePresenceIds({ active: [{ seen_at: now }], stale: [{ seen_at: now - 90001 }], flag: [{ is_online: true }], future: [{ seen_at: now + 60001 }] }, now)), ['active']);
});
test('another active device keeps presence after one session goes stale', () => {
  assert.deepEqual(Array.from(presence.activePresenceIds({ user: [{ seen_at: 0 }, { seen_at: 1000000 }] }, 1000000)), ['user']);
});
test('PDF pinch previews without rerendering on every touch move, then commits scale', () => {
  let setup; const listeners = {}; const content = { style: {} }; const committed = [];
  const container = { scrollTop: 100, scrollLeft: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }), querySelector: () => content, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {} };
  const { usePinchZoom } = compile('../src/hooks/usePinchZoom.ts', { react: { useEffect: fn => { setup = fn; } } }, { requestAnimationFrame: fn => fn() });
  usePinchZoom(container, 1, value => committed.push(value)); const cleanup = setup();
  const touch = distance => ({ touches: [{ clientX: 0, clientY: 0 }, { clientX: distance, clientY: 0 }], preventDefault() {} });
  listeners.touchstart(touch(100)); listeners.touchmove(touch(200));
  assert.equal(content.style.transform, 'scale(2)'); assert.equal(committed.length, 0);
  listeners.touchend(); assert.equal(committed[0], 2); assert.equal(container.scrollTop, 200); assert.equal(content.style.transform, ''); cleanup();
});
test('every supported media surface reacts to saved-offline state', () => {
  for (const name of ['PDFViewer', 'MediaViewer', 'ChannelAudioPlayer']) {
    const source = read(`../src/components/chat/${name}.tsx`);
    assert.match(source, /useOfflineStatus\(url\)/); assert.match(source, /!savedOffline &&/);
  }
  assert.match(read('../src/hooks/useOfflineStatus.ts'), /FILES_CHANGED/);
});
test('inbox and channel audio supply a conversation source to persistent playback', () => {
  for (const name of ['MessageBubble', 'ChannelMessageBubble']) assert.match(read(`../src/components/chat/${name}.tsx`), /source=\{\{ conversationId: (?:sourceConversationId \|\| )?message.conversation_id, messageId: message.id/);
  assert.match(read('../src/components/chat/AudioPlayer.tsx'), /ChannelAudioPlayer/);
  assert.match(read('../src/components/chat/NowPlayingBar.tsx'), /onOpenSource\(audioState.source\)/);
});
test('ended stream notices cannot offer a join action', () => {
  assert.match(read('../src/components/chat/SystemMessage.tsx'), /isStarted && !isEnded && hasActiveCall/);
  assert.match(read('../src/hooks/useLiveStream.tsx'), /noticeError/);
});
test('study-profile migration is additive and does not replace registration or permissions', () => {
  const sql = read('../supabase/migrations/20261008180000_study_details.sql');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS study_details/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|CREATE OR REPLACE FUNCTION public.handle_new_user|ALTER POLICY|DISABLE ROW LEVEL SECURITY/i);
});
