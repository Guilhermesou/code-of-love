import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, isDataURL, collectMediaEntries, setPath, extensionFor } from '../public/lib/slug.js';

test('slugify removes accents and unsafe characters, keeping it URL-friendly', () => {
  assert.equal(slugify('João & Maria!', () => 'ab12'), 'joao-maria-ab12');
  assert.equal(slugify('', () => 'ab12'), 'nossa-historia-ab12');
  assert.equal(slugify('   ', () => 'ab12'), 'nossa-historia-ab12');
});

test('slugify uses a random suffix by default so two calls do not collide', () => {
  const a = slugify('Ana'), b = slugify('Ana');
  assert.notEqual(a, b);
});

test('isDataURL only matches base64 data URLs', () => {
  assert.equal(isDataURL('data:image/png;base64,abc123'), true);
  assert.equal(isDataURL('https://example.com/photo.png'), false);
  assert.equal(isDataURL(''), false);
  assert.equal(isDataURL(undefined), false);
});

test('collectMediaEntries walks single fields and arrays, skipping empty values', () => {
  const draft = {
    cover: 'data:image/png;base64,abc', music: '', voice: 'https://x.test/a.mp3', video: '',
    moments: [{ photo: 'data:image/jpeg;base64,def' }, { photo: '' }],
    places: [{ photo: 'https://x.test/p.jpg' }],
  };
  const entries = collectMediaEntries(draft);
  assert.deepEqual(entries.map(e => e.path), ['cover', 'voice', 'moments.0.photo', 'places.0.photo']);
});

test('setPath writes into nested array paths', () => {
  const draft = { moments: [{ photo: '' }] };
  setPath(draft, 'moments.0.photo', 'https://x.test/new.jpg');
  assert.equal(draft.moments[0].photo, 'https://x.test/new.jpg');
});

test('extensionFor reads the mime subtype and normalizes jpeg to jpg', () => {
  assert.equal(extensionFor('data:image/jpeg;base64,abc'), 'jpg');
  assert.equal(extensionFor('data:audio/mpeg;base64,abc'), 'mpeg');
  assert.equal(extensionFor('not-a-data-url'), 'bin');
});
