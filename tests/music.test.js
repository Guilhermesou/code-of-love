import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMusic } from '../public/music.js';
import { newDraft, reviewDraft } from '../public/model.js';
test('Spotify links produce only official embed URLs and strip tracking parameters', () => {
  const info = parseMusic('https://open.spotify.com/intl-pt/track/0123456789ABCDEFGHIJKL?si=tracking');
  assert.equal(info.type, 'spotify');
  assert.equal(info.embed, 'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
  assert.equal(parseMusic('https://spotify.link/short').type, 'invalid');
});
test('YouTube variants yield a privacy-friendly embed and an external listening link', () => {
  for (const link of ['https://youtu.be/abcdefghijk?t=3', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://music.youtube.com/watch?v=abcdefghijk', 'https://youtube.com/shorts/abcdefghijk']) {
    assert.deepEqual(parseMusic(link), { type: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefghijk', embed: 'https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0' });
  }
  assert.equal(parseMusic('https://youtube.com/watch?v=bad').type, 'invalid');
  assert.equal(parseMusic('javascript:alert(1)').type, 'invalid');
});
test('saved audio remains compatible and valid streaming links no longer generate file warnings', () => {
  assert.equal(parseMusic('data:audio/mp3;base64,AAAA').type, 'file');
  const d = newDraft();
  d.music = 'https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
  assert.ok(!reviewDraft(d).some(item => item.step === 3));
});
