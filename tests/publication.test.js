import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft } from '../public/model.js';
import { createCloudRepository } from '../public/lib/cloud-repository.js';
import { createShareHandler } from '../supabase/functions/shared-surprise/handler.js';
import { PRIVATE_PREFIX } from '../public/lib/media.js';

// Stateful adapter tests the persistence contract without a real user's account.
function backend() {
  const owner = crypto.randomUUID();
  const rows = new Map(), files = new Map(), signed = [];
  let failure = null, authenticated = true;
  const client = {
    auth: { getSession: async () => ({ data: { session: authenticated ? { user: { id: owner } } : null } }) },
    storage: { from: bucket => ({
      async list(folder) { return { data: [...files.keys()].filter(path => path.startsWith(folder + '/')).map(path => ({ name: path.split('/').at(-1) })) }; },
      async upload(path, blob, options) {
        assert.equal(bucket, 'surprise-media'); assert.equal(options.upsert, false);
        if (files.has(path)) return { error: { error: 'Duplicate', message: 'The resource already exists' } };
        files.set(path, blob); return { error: null };
      },
      async download(path) { return files.has(path) ? { data: files.get(path) } : { error: new Error('not-found') }; },
      async createSignedUrl(path, ttl) { signed.push({ path, ttl }); return { data: { signedUrl: `https://test.invalid/signed/${path}` } }; },
    }) },
    from(table) {
      assert.equal(table, 'surprises');
      let operation = 'select', payload, filters = [];
      const query = {
        select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
        order() { return query; }, limit() { return query; },
        update(value) { operation = 'update'; payload = structuredClone(value); return query; },
        insert(value) { operation = 'insert'; payload = structuredClone(value); return query; },
        async maybeSingle() { return run(); }, async single() { return run(); },
      };
      function run() {
        if (failure) return { error: failure };
        let row = [...rows.values()].find(row => filters.every(([key, value]) => row[key] === value));
        if (operation === 'insert') { row = { public: false, published_draft: null, published_at: null, ...payload }; rows.set(row.id, row); }
        if (operation === 'update' && row) Object.assign(row, payload);
        return { data: row ? structuredClone(row) : null };
      }
      return query;
    },
  };
  return { owner, rows, files, signed, client, fail: value => { failure = value; }, auth: value => { authenticated = value; } };
}
function completeDraft() {
  const draft = newDraft();
  Object.assign(draft, { sender: 'A', recipient: 'B', letter: 'Original', cover: 'data:image/png;base64,AQID' });
  draft.dates.namoro = '2020-01-01';
  return draft;
}
const request = slug => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ slug }) });

test('saving after publication preserves the live text, media and link until explicit republish', async () => {
  const b = backend(), repo = createCloudRepository(b.client), draft = completeDraft();
  const first = await repo.save(draft, { makePublic: true });
  const liveMedia = b.rows.get(draft.id).published_draft.cover;
  draft.letter = 'An unfinished edit'; draft.cover = 'data:image/png;base64,BAUG';
  await repo.save(draft);
  const row = b.rows.get(draft.id);
  assert.equal(row.public, true); assert.equal(row.slug, first.slug);
  assert.equal(row.published_draft.letter, 'Original');
  assert.equal(row.published_draft.cover, liveMedia);
  assert.notEqual(row.draft.cover, liveMedia);
  assert.equal(b.files.size, 2);
  await repo.save(draft, { makePublic: true });
  assert.equal(row.published_draft.letter, 'An unfinished edit');
  assert.equal(row.slug, first.slug);
});

test('private drafts have no published content and restoration embeds durable media', async () => {
  const b = backend(), repo = createCloudRepository(b.client), draft = completeDraft();
  draft.cloudSlug = 'untrusted-link';
  const saved = await repo.save(draft);
  assert.equal(saved.public, false); assert.equal(saved.published_draft, null);
  assert.notEqual(saved.slug, 'untrusted-link');
  assert.match(saved.slug, /-[a-f0-9]{32}$/);
  const restored = await repo.latest();
  assert.equal(restored.draft.cover, draft.cover);
  assert.equal(restored.draft.letter, draft.letter);
  const response = await createShareHandler(b.client)(request(saved.slug));
  assert.deepEqual(await response.json(), { draft: null });
  assert.equal(b.signed.length, 0);
});

test('invalid publishing, missing auth and migration errors fail before any upload', async () => {
  const b = backend(), repo = createCloudRepository(b.client);
  await assert.rejects(repo.save(newDraft(), { makePublic: true }), /invalid-publication/);
  b.auth(false); await assert.rejects(repo.save(completeDraft()), /not-authenticated/);
  b.auth(true); b.fail(new Error('migration missing'));
  await assert.rejects(repo.save(completeDraft()), /migration missing/);
  assert.equal(b.files.size, 0); assert.equal(b.rows.size, 0);
});

test('share endpoint exposes only published content and signs only its own media', async () => {
  const b = backend(), repo = createCloudRepository(b.client), draft = completeDraft();
  const state = await repo.save(draft, { makePublic: true });
  draft.letter = 'Private edit'; await repo.save(draft);
  const handler = createShareHandler(b.client);
  const response = await handler(request(state.slug));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.draft.letter, 'Original'); assert.match(body.draft.cover, /^https:/);
  assert.equal(body.owner, undefined); assert.equal(b.signed[0].ttl, 3600);
  const row = b.rows.get(draft.id);
  row.published_draft.cover = `${PRIVATE_PREFIX}${crypto.randomUUID()}/${draft.id}/${'a'.repeat(64)}`;
  assert.equal((await handler(request(state.slug))).status, 503);
  assert.equal(b.signed.length, 1);
});

test('revocation invalidates the old token permanently, even after publishing again', async () => {
  const b = backend(), repo = createCloudRepository(b.client), draft = completeDraft();
  const published = await repo.save(draft, { makePublic: true });
  const revoked = await repo.revoke(draft.id);
  assert.equal(revoked.public, false); assert.notEqual(revoked.slug, published.slug);
  const handler = createShareHandler(b.client);
  assert.deepEqual(await (await handler(request(published.slug))).json(), { draft: null });
  const next = await repo.save(draft, { makePublic: true });
  assert.equal(next.slug, revoked.slug);
  assert.deepEqual(await (await handler(request(published.slug))).json(), { draft: null });
  assert.ok((await (await handler(request(next.slug))).json()).draft);
});

test('share endpoint rejects malformed input and unsupported methods without signing', async () => {
  const b = backend(), handler = createShareHandler(b.client);
  assert.equal((await handler(request('../other'))).status, 400);
  assert.equal((await handler(request('a'.repeat(513)))).status, 400);
  assert.equal((await handler(new Request('https://test.invalid'))).status, 405);
  assert.equal((await handler(new Request('https://test.invalid', { method: 'OPTIONS' }))).status, 204);
  assert.equal(b.signed.length, 0);
});

test('published game settings survive sharing and remain isolated from draft edits', async () => {
  const b = backend(), repo = createCloudRepository(b.client), draft = completeDraft();
  draft.games.quiz = { enabled: true, questions: [{ prompt: 'Onde?', answers: ['Café', 'Praia', ''], correct: 0, reveal: 'Uma tarde.' }] };
  const published = await repo.save(draft, { makePublic: true });
  draft.games.quiz.questions[0].prompt = 'Pergunta ainda em edição';
  await repo.save(draft);
  const response = await createShareHandler(b.client)(request(published.slug));
  assert.equal((await response.json()).draft.games.quiz.questions[0].prompt, 'Onde?');
  assert.equal((await repo.latest()).draft.games.quiz.questions[0].prompt, 'Pergunta ainda em edição');
});
