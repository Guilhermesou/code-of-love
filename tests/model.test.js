import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDays, closing, counterLabel, newDraft, validate, mediaURL, reviewDraft } from '../public/model.js';
test('counter uses calendar dates, accepts the same day and rejects future/invalid dates', () => {
  const now = new Date(2026, 8, 21, 15);
  assert.equal(calendarDays('2026-09-21', now), 0);
  assert.equal(calendarDays('2026-09-20', now), 1);
  assert.equal(calendarDays('2026-09-22', now), null);
  assert.equal(calendarDays('2026-02-30', now), null);
  assert.equal(calendarDays('', now), null);
  assert.equal(calendarDays('2024-02-28', new Date(2024, 2, 1)), 2);
});
test('married couple celebrating dating gets a married closing and dating counter', () => {
  const d = newDraft();
  assert.match(closing(d), /dividir a vida comigo/);
  assert.match(counterLabel(d), /namoro/);
  d.occasion = 'casamento';
  assert.match(counterLabel(d), /casamento/);
  assert.doesNotMatch(closing(d), /te pedi em namoro/);
});
test('gift export requires real names, selected date and a personal text', () => {
  const d = newDraft(); assert.equal(validate(d).length, 3);
  Object.assign(d, { recipient: 'Teste A', sender: 'Teste B', letter: 'Uma lembrança de teste.' });
  d.dates.casamento = '2020-01-01';
  assert.equal(validate(d).length, 1);
  d.dates.namoro = '2018-01-01'; assert.deepEqual(validate(d), []);
});
test('media fields reject script protocols and mismatched embedded types', () => {
  assert.equal(mediaURL('javascript:alert(1)'), '');
  assert.equal(mediaURL('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.equal(mediaURL('data:audio/mp3;base64,AAAA', 'image'), '');
  assert.equal(mediaURL('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
  assert.equal(mediaURL('data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA');
});
test('delivery review identifies incomplete optional content without requiring unused sections', () => {
  const d = newDraft();
  Object.assign(d, { recipient: 'A', sender: 'B', letter: 'Uma mensagem.' });
  d.dates.namoro = '2020-01-01';
  assert.deepEqual(reviewDraft(d), []);
  d.letters.push({ title: 'Saudade', text: '' });
  d.places.push({ name: 'Um lugar', lat: '91', lng: '0', date: '', memory: '', photo: '' });
  d.music = 'https://open.spotify.com/track/example';
  const items = reviewDraft(d);
  assert.deepEqual(items.map(i => i.step), [4, 3, 3]);
  assert.ok(items.every(i => !i.required));
  d.letters[0].text = 'Um carinho.';
  d.places[0].lat = '0';
  d.music = 'https://example.com/music.mp3';
  assert.deepEqual(reviewDraft(d), []);
});
