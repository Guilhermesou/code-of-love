export function slugify(recipient, randomSuffix = () => Math.random().toString(36).slice(2, 8)) {
  const base = String(recipient || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'nossa-historia';
  return `${base}-${randomSuffix()}`;
}
export function isDataURL(value) {
  return typeof value === 'string' && /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(value);
}
export function collectMediaEntries(draft) {
  const entries = [];
  const add = (path, kind, value) => { if (typeof value === 'string' && value) entries.push({ path, kind, value }); };
  add('cover', 'image', draft.cover);
  add('music', 'audio', draft.music);
  add('voice', 'audio', draft.voice);
  add('video', 'video', draft.video);
  (draft.moments || []).forEach((m, i) => add(`moments.${i}.photo`, 'image', m.photo));
  (draft.places || []).forEach((p, i) => add(`places.${i}.photo`, 'image', p.photo));
  return entries;
}
export function setPath(draft, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  parts.reduce((obj, key) => obj[key], draft)[last] = value;
}
export function extensionFor(value) {
  const match = /^data:[a-z0-9.+-]+\/([a-z0-9.+-]+);base64,/i.exec(value);
  return match ? match[1].replace('jpeg', 'jpg') : 'bin';
}
