import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlace, mapEmbed } from '../public/places.js';
test('coordinates and explicit map markers identify the same point', () => {
  const expected = { lat: '-2.8', lng: '-60.6' };
  for (const text of ['-2.8, -60.6', '-2.8; -60.6', 'https://www.google.com/maps/search/?api=1&query=-2.8%2C-60.6', 'https://www.google.com/maps/place/test/data=!3d-2.8!4d-60.6', 'https://www.openstreetmap.org/?mlat=-2.8&mlon=-60.6']) assert.deepEqual(parsePlace(text), expected);
});
test('do not guess a pin from camera centers, short links, or untrusted sites', () => {
  for (const text of ['91,0', '0,-181', 'https://maps.app.goo.gl/abc', 'https://www.google.com/maps/@-2.8,-60.6,15z', 'https://evil.com/?q=1,2', 'https://www.openstreetmap.org/?mlat=&mlon=2', 'https://www.google.com/maps/%zz']) assert.equal(parsePlaceSafe(text), null);
});
function parsePlaceSafe(text) { return parsePlace(text); }
test('map bounds remain valid at world edges', () => {
  const u = new URL(mapEmbed({ lat: '90', lng: '180' }));
  assert.equal(u.searchParams.get('marker'), '90,180');
  assert.equal(u.searchParams.get('bbox'), '179.985,89.99,180,90');
  assert.equal(mapEmbed({lat:'',lng:''}), '');
});
