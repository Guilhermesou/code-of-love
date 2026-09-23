import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, normalizeDraft, validate, reviewDraft } from '../public/model.js';
import { createMediaPacker, blobToDataURL } from '../public/lib/media.js';
import { createAutosave } from '../public/lib/autosave.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('normalization accepts v1 backups, copies data and strips untrusted cloud identity', () => {
  const draft = newDraft();
  draft.cloudSlug = 'someone-elses-link';
  draft.moments.push({ title: 'A', date: '', text: 'B', photo: '', untrusted: true });
  const normalized = normalizeDraft(draft);
  assert.equal(normalized.cloudSlug, undefined);
  assert.equal(normalized.moments[0].untrusted, undefined);
  normalized.moments[0].title = 'Changed';
  assert.equal(draft.moments[0].title, 'A');
  for (const invalid of [null, {}, { ...draft, accent: 'red" onclick="bad' }, { ...draft, moments: [null] },
    { ...draft, dates: {} }, { ...draft, relationship: 'invalid' }, { ...draft, id: '../other' },
    { ...draft, cover: 'asset:missing' }, { ...draft, cover: 'blob:expired' }]) {
    assert.throws(() => normalizeDraft(invalid), /invalid-draft/);
  }
  assert.deepEqual(validate(draft), reviewDraft(draft).filter(item => item.required).map(item => item.message));
});

test('packing keeps media separate, deduplicates it, and preserves immutable asset identities', async () => {
  const pack = createMediaPacker();
  const draft = newDraft();
  draft.cover = 'data:image/png;base64,AQID';
  draft.moments.push({ title: 'Foto', date: '', text: '', photo: draft.cover });
  const first = await pack(draft);
  assert.equal(first.assets.size, 1);
  assert.equal(first.draft.cover, first.draft.moments[0].photo);
  assert.equal(draft.cover, 'data:image/png;base64,AQID');
  assert.equal(await blobToDataURL([...first.assets.values()][0]), draft.cover);
  draft.letter = 'Só o texto mudou';
  const second = await pack(draft);
  assert.equal(second.draft.cover, first.draft.cover);
  assert.equal([...second.assets.values()][0], [...first.assets.values()][0]);
  draft.cover = 'data:image/png;base64,BAUG';
  const third = await pack(draft);
  assert.notEqual(third.draft.cover, first.draft.cover);
  assert.equal(third.draft.moments[0].photo, first.draft.cover);
});

test('autosave coalesces typing, serializes changes during writes and flushes latest content', async () => {
  let value = 'A', active = 0, maxActive = 0;
  const writes = [], states = [], gate = deferred();
  const saver = createAutosave({ delay: 1000, read: () => value, onState: s => states.push(s),
    write: async snapshot => { active++; maxActive = Math.max(maxActive, active); writes.push(snapshot); if (writes.length === 1) await gate.promise; active--; } });
  saver.schedule(); value = 'AB'; saver.schedule();
  const flushing = saver.flush();
  value = 'ABC'; saver.schedule();
  const again = saver.flush();
  gate.resolve(); await Promise.all([flushing, again]);
  assert.deepEqual(writes, ['AB', 'ABC']);
  assert.equal(maxActive, 1);
  assert.equal(states.at(-1), 'saved');
});

test('failed saves report failure and later edits can recover', async () => {
  let fails = true;
  const states = [];
  const saver = createAutosave({ delay: 1000, read: () => 'value', onState: s => states.push(s),
    write: async () => { if (fails) throw new Error('quota'); } });
  saver.schedule(); await saver.flush();
  assert.equal(states.at(-1), 'error');
  fails = false; saver.schedule(); await saver.flush();
  assert.equal(states.at(-1), 'saved');
});
