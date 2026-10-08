import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, ...globals });
  return module.exports;
}
function harness(standalone = false) {
  const win = new EventTarget();
  const display = new EventTarget(); display.matches = standalone;
  win.matchMedia = () => display; win.navigator = {};
  const { createInstallStore } = load('../src/lib/appInstall.ts', { window: win });
  return { win, display, store: createInstallStore(win) };
}
test('install prompt fired before visiting the install page remains available', async () => {
  const { win, store } = harness();
  const event = new Event('beforeinstallprompt', { cancelable: true });
  let prompts = 0; event.prompt = async () => { prompts++; }; event.userChoice = Promise.resolve({ outcome: 'accepted' });
  win.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(store.getSnapshot().available, true);
  assert.equal(await store.install(), 'accepted');
  assert.equal(prompts, 1);
  assert.equal(store.getSnapshot().installed, false, 'Acceptance alone is not installation');
  assert.equal(await store.install(), 'unavailable', 'Prompt is single use');
  win.dispatchEvent(new Event('appinstalled'));
  assert.equal(store.getSnapshot().installed, true);
  store.destroy();
});
test('dismissed or rejected installer does not claim an installed app', async () => {
  for (const fail of [false, true]) {
    const { win, store } = harness(); const event = new Event('beforeinstallprompt');
    event.prompt = async () => { if (fail) throw new Error('Blocked'); }; event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    win.dispatchEvent(event);
    if (fail) await assert.rejects(store.install(), /Blocked/); else assert.equal(await store.install(), 'dismissed');
    assert.equal(store.getSnapshot().installed, false); assert.equal(store.getSnapshot().available, false); store.destroy();
  }
});
test('standalone state tracks actual display-mode changes', () => {
  const { display, store } = harness(true); let changed = 0;
  const unsubscribe = store.subscribe(() => changed++);
  assert.equal(store.getSnapshot().installed, true);
  display.matches = false; display.dispatchEvent(new Event('change'));
  assert.equal(store.getSnapshot().installed, false); assert.equal(changed, 1);
  unsubscribe(); store.destroy();
});
test('microphone check stops every track immediately and does not start a call', async () => {
  const { checkMicrophoneAccess } = load('../src/lib/microphoneCheck.ts'); let stopped = 0;
  await checkMicrophoneAccess({ getUserMedia: async options => {
    assert.equal(options.audio, true); assert.equal(options.video, false);
    return { getTracks: () => [{ stop() { stopped++; } }, { stop() { stopped++; } }] };
  } }); assert.equal(stopped, 2);
});
test('blocked and unsupported microphones remain errors, not successful checks', async () => {
  const { checkMicrophoneAccess } = load('../src/lib/microphoneCheck.ts');
  await assert.rejects(checkMicrophoneAccess(undefined), /HTTPS/);
  await assert.rejects(checkMicrophoneAccess({ getUserMedia: async () => { throw new Error('Permission denied'); } }), /Permission denied/);
});
test('an unanswered permission prompt times out but still stops late-granted tracks', async () => {
  const { checkMicrophoneAccess } = load('../src/lib/microphoneCheck.ts');
  let grant; let stopped = 0;
  const pending = new Promise(resolve => { grant = resolve; });
  await assert.rejects(checkMicrophoneAccess({ getUserMedia: () => pending }, 1), /No microphone decision/);
  grant({ getTracks: () => [{ stop() { stopped++; } }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, 1);
});
test('application updates stay blocked until every active audio surface releases', () => {
  const { holdCallActivity, hasActiveCall, subscribeCallActivity } = load('../src/lib/callActivity.ts');
  let changes = 0; const unsubscribe = subscribeCallActivity(() => changes++);
  const releaseFirst = holdCallActivity(); const releaseSecond = holdCallActivity();
  assert.equal(hasActiveCall(), true); releaseFirst(); assert.equal(hasActiveCall(), true);
  releaseSecond(); assert.equal(hasActiveCall(), false); assert.equal(changes, 4); unsubscribe();
});
test('manifest exports real sized install icons with a separate maskable icon', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.id, '/'); assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const url = new URL(`../public${icon.src}`, import.meta.url); assert.ok(existsSync(url));
    const png = readFileSync(url); const size = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});
