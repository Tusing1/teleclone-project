import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync(new URL('../public/downloads/StudyGram.mobileconfig', import.meta.url), 'utf8');
test('iPhone profile contains only a Configuration container and one Web Clip', () => {
  const types = [...profile.matchAll(/<key>PayloadType<\/key>\s*<string>([^<]+)<\/string>/g)].map(match => match[1]).sort();
  assert.deepEqual(types, ['Configuration', 'com.apple.webClip.managed']);
  assert.doesNotMatch(profile, /<key>(ServerURL|CheckInURL|IdentityCertificateUUID|Password|ProxyServer|VPNType|PayloadCertificateFileName|AccessRights)<\/key>/);
  assert.match(profile, /<key>URL<\/key>\s*<string>https:\/\/studdybuddyapp\.com\/<\/string>/);
});
test('iPhone shortcut and profile are removable and use the approved icon', () => {
  assert.match(profile, /<key>IsRemovable<\/key>\s*<true\/>/);
  assert.match(profile, /<key>PayloadRemovalDisallowed<\/key>\s*<false\/>/);
  assert.match(profile, /<key>FullScreen<\/key>\s*<true\/>/);
  const icon = Buffer.from(profile.match(/<key>Icon<\/key>\s*<data>([\s\S]*?)<\/data>/)[1].replace(/\s/g, ''), 'base64');
  assert.deepEqual(icon, readFileSync(new URL('../public/brand/studygram-180.png', import.meta.url)));
});
test('profile download uses Apple MIME type and transparent unsigned-profile disclosure', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/downloads\/StudyGram\.mobileconfig\s+Content-Type: application\/x-apple-aspen-config/);
  const ui = readFileSync(new URL('../src/pages/Install.tsx', import.meta.url), 'utf8');
  assert.match(ui, /Unsigned configuration profile/); assert.match(ui, /Not yet tested on a physical iPhone/);
});
