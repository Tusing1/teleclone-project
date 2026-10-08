import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/lib/media.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { mediaKind } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
test('supported media stay inside their viewer', () => {
  for (const [name, kind] of [['PHOTO.JPG','image'], ['notes.pdf','pdf'], ['audio.m4a','audio'], ['voice.webm','audio'], ['lecture.mp4','video'], ['notes.txt','text'], ['table.csv','text']]) assert.equal(mediaKind(name), kind);
});
test('signed URLs and missing filenames', () => {
  assert.equal(mediaKind('Shared file', 'https://example.test/file.pdf?token=123'), 'pdf');
  assert.equal(mediaKind('File', 'https://example.test/photo.webp'), 'image');
});
test('unsupported formats use an explicit fallback', () => {
  assert.equal(mediaKind('document.docx'), 'file');
  assert.equal(mediaKind('unsafe.html'), 'file');
  assert.equal(mediaKind('image.svg'), 'file');
});
