const number = '[-+]?\\d+(?:\\.\\d+)?';
const pair = new RegExp(`^\\s*(${number})\\s*[,;]\\s*(${number})\\s*$`);
export function coordinates(lat, lng) {
  if (!String(lat ?? '').trim() || !String(lng ?? '').trim()) return null;
  lat = Number(lat); lng = Number(lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: String(lat), lng: String(lng) } : null;
}
export function parsePlace(text) {
  const raw = text.trim().match(pair);
  if (raw) return coordinates(raw[1], raw[2]);
  let u; try { u = new URL(text.trim()); } catch { return null; }
  if (!['https:', 'http:'].includes(u.protocol)) return null;
  if (['openstreetmap.org', 'www.openstreetmap.org'].includes(u.hostname)) return coordinates(u.searchParams.get('mlat'), u.searchParams.get('mlon'));
  if (!/^(www\.|maps\.)?google\.(com|com\.br)$/.test(u.hostname)) return null;
  // A camera center (@lat,lng) is deliberately not treated as a place marker.
  let decoded; try { decoded = decodeURIComponent(u.pathname + u.search); } catch { return null; }
  const point = decoded.match(new RegExp(`!3d(${number})!4d(${number})`));
  if (point) return coordinates(point[1], point[2]);
  for (const key of ['query', 'q']) {
    const match = (u.searchParams.get(key) || '').match(pair);
    if (match) return coordinates(match[1], match[2]);
  }
  return null;
}
export function mapEmbed(p) {
  const point = coordinates(p.lat, p.lng); if (!point) return '';
  const lat = Number(point.lat), lng = Number(point.lng);
  return 'https://www.openstreetmap.org/export/embed.html?' + new URLSearchParams({ bbox: [Math.max(-180, lng - .015), Math.max(-90, lat - .01), Math.min(180, lng + .015), Math.min(90, lat + .01)].join(','), layer: 'mapnik', marker: `${lat},${lng}` });
}
