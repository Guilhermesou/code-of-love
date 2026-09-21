import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { buildGiftHTML } from '../public/export.js';
import { newDraft } from '../public/model.js';
test('export embeds a valid standalone script and does not allow user text to close its script', () => {
  const d = newDraft();
  d.recipient = '</title><script>alert(1)</script>';
  d.letter = '</script><script>alert("injection")</script>';
  const html = buildGiftHTML(d, 'body{margin:0}');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Script(scripts[0][1]));
  assert.ok(scripts[0][1].includes('\\u003c/script>'));
  assert.ok(html.includes('&lt;/title&gt;'));
  assert.ok(!html.includes('src="/app.js"'));
  assert.ok(scripts[0][1].includes('const installOpening ='));
  assert.ok(scripts[0][1].includes('const parseMusic ='));
});
