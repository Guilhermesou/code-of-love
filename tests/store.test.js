import 'fake-indexeddb/auto';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { newDraft } from '../public/model.js';
import { readDraft, saveDraft } from '../public/store.js';

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });
const result = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
async function inspect() {
  const db = await result(indexedDB.open('codigo-do-amor', 2));
  try {
    const tx = db.transaction(['drafts', 'media']);
    return await Promise.all([result(tx.objectStore('drafts').get('current')), result(tx.objectStore('media').getAll())]);
  } finally { db.close(); }
}

test('v1 drafts migrate without losing text or embedded media', async () => {
  const draft = newDraft(); draft.letter = 'Preserve me'; draft.cover = 'data:image/png;base64,AQID';
  const request = indexedDB.open('codigo-do-amor', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('drafts');
  const db = await result(request);
  await new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(draft, 'current');
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  }); db.close();
  assert.deepEqual(await readDraft(), draft);
  await saveDraft(draft);
  const [stored, media] = await inspect();
  assert.equal(stored.format, 2); assert.match(stored.draft.cover, /^asset:/);
  assert.equal(media.length, 1); assert.ok(media[0] instanceof Blob);
  assert.deepEqual(await readDraft(), draft);
});

test('text-only edits do not rewrite blobs and removed files are collected', async () => {
  const draft = newDraft(); draft.cover = 'data:image/png;base64,AQID';
  draft.moments.push({ title: 'Photo', date: '', text: '', photo: draft.cover });
  await saveDraft(draft);
  const originalPut = IDBObjectStore.prototype.put;
  let mediaWrites = 0;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === 'media') mediaWrites++;
    return originalPut.apply(this, args);
  };
  try { draft.letter = 'Changed text'; await saveDraft(draft); }
  finally { IDBObjectStore.prototype.put = originalPut; }
  assert.equal(mediaWrites, 0);
  assert.deepEqual(await readDraft(), draft);
  draft.cover = ''; draft.moments = []; await saveDraft(draft);
  assert.equal((await inspect())[1].length, 0);
});

test('a failed transaction retains the previous draft and its media', async () => {
  const draft = newDraft(); draft.cover = 'data:image/png;base64,AQID';
  await saveDraft(draft);
  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === 'drafts') { this.transaction.abort(); throw new Error('simulated quota failure'); }
    return originalPut.apply(this, args);
  };
  try { await assert.rejects(saveDraft({ ...draft, cover: 'data:image/png;base64,BAUG' }), /quota/); }
  finally { IDBObjectStore.prototype.put = originalPut; }
  assert.deepEqual(await readDraft(), draft);
  assert.equal((await inspect())[1].length, 1);
});

test('game configuration survives blob packing and browser storage restoration', async () => {
  const draft = newDraft();
  draft.cover = 'data:image/png;base64,AQID';
  draft.games.quiz = { enabled: true, questions: [{ prompt: 'Onde?', answers: ['Aqui', 'Ali', ''], correct: 1, reveal: 'Uma memória.' }] };
  draft.games.date = { enabled: true, options: [{ title: 'Cinema', detail: '' }, { title: 'Café', detail: 'À tarde.' }] };
  await saveDraft(draft);
  assert.deepEqual(await readDraft(), draft);
});
