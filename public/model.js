import { parseMusic } from './music.js';
import { newGames, normalizeGames, reviewGames } from './game-model.js';
export const occasions = { namoro: 'Pedido de namoro', encontro: 'Primeiro encontro', casamento: 'Casamento', especial: 'Uma data especial' };
export function newDraft() {
  return { version: 1, id: crypto.randomUUID(), recipient: '', sender: '', occasion: 'namoro', relationship: 'casados', dates: { namoro: '', encontro: '', casamento: '', especial: '' }, specialLabel: '', accent: '#c4685f', opening: '', firstMemory: '', cover: '', moments: [], details: '', letter: '', music: '', voice: '', video: '', places: [], letters: [], question: '', answer: 'Sempre, meu amor', after: 'Ainda temos tanta coisa linda para viver.', games: newGames() };
}
export function calendarDays(date, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  if (start.getUTCFullYear() !== y || start.getUTCMonth() !== m - 1 || start.getUTCDate() !== d) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((today - start.getTime()) / 86400000);
  return days >= 0 ? days : null;
}
export function closing(d) {
  if (d.occasion === 'namoro' && d.relationship === 'casados') return 'Naquele dia, te pedi em namoro.\nDepois, te pedi para dividir a vida comigo.\nE todos os dias, continuo escolhendo você.';
  if (d.occasion === 'casamento') return 'Naquele dia, escolhemos dividir a vida.\nE todos os dias, continuo escolhendo você.';
  return 'Desde que nossos caminhos se encontraram,\na nossa história continua sendo a minha favorita.';
}
export function counterLabel(d) {
  return { namoro: 'desde o nosso pedido de namoro', encontro: 'desde o nosso primeiro encontro', casamento: 'desde o nosso casamento', especial: d.specialLabel || 'desde aquele dia especial' }[d.occasion];
}
export function mediaURL(value, kind = 'image') {
  if (typeof value !== 'string') return '';
  if (new RegExp('^data:' + kind + '/[a-z0-9.+-]+;base64,', 'i').test(value)) return value;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export function validate(d) {
  return reviewDraft(d).filter(item => item.required).map(item => item.message);
}

// One boundary for browser storage, backups and cloud data. Keep v1 backups valid.
export function normalizeDraft(value, { allowReferences = false } = {}) {
  const fail = () => { throw new Error('invalid-draft'); };
  if (!value || value.version !== 1 || !value.dates) fail();
  const base = newDraft();
  const result = { version: 1 };
  for (const key of Object.keys(base)) {
    if (typeof base[key] !== 'string') continue;
    if (typeof value[key] !== 'string') fail();
    result[key] = value[key];
  }
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(result.id)) fail();
  if (!Object.hasOwn(occasions, result.occasion) || !/^#[a-f0-9]{6}$/i.test(result.accent)) fail();
  if (!['casados', 'namorando', 'noivos', 'juntos'].includes(result.relationship)) fail();
  result.dates = {};
  for (const key of Object.keys(base.dates)) {
    if (typeof value.dates[key] !== 'string') fail();
    result.dates[key] = value.dates[key];
  }
  for (const [key, fields] of Object.entries({
    moments: ['title', 'date', 'text', 'photo'],
    letters: ['title', 'text'],
    places: ['name', 'lat', 'lng', 'date', 'memory', 'photo'],
  })) {
    if (!Array.isArray(value[key]) || value[key].length > 100) fail();
    result[key] = value[key].map(item => {
      if (!item || !fields.every(field => typeof item[field] === 'string')) fail();
      return Object.fromEntries(fields.map(field => [field, item[field]]));
    });
  }
  const media = [result.cover, result.music, result.voice, result.video,
    ...result.moments.map(item => item.photo), ...result.places.map(item => item.photo)];
  if (!allowReferences && media.some(value => /^(asset:|storage:|blob:)/i.test(value))) fail();
  result.games = normalizeGames(value.games);
  // Cloud identity is returned by the server, never trusted from a backup.
  return result;
}

export function reviewDraft(d) {
  const items = [];
  const add = (step, message, required = false) => items.push({ step, message, required });
  if (!d.recipient.trim() || !d.sender.trim()) add(0, 'Preencha os nomes de vocês.', true);
  if (calendarDays(d.dates[d.occasion]) === null) add(1, 'Informe a data original da ocasião, até hoje.', true);
  if (!d.firstMemory.trim() && !d.letter.trim()) add(2, 'Escreva uma lembrança ou uma declaração.', true);
  reviewGames(d).forEach(message => add(5, message, true));
  d.letters.forEach((l, i) => { if ((l.title.trim() || l.text.trim()) && (!l.title.trim() || !l.text.trim())) add(4, `A carta ${i + 1} precisa de título e mensagem para aparecer.`); });
  d.places.forEach((p, i) => {
    if (!Object.values(p).some(v => String(v).trim())) return;
    if (!p.name.trim() || !String(p.lat).trim() || !String(p.lng).trim() || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng)) || Math.abs(Number(p.lat)) > 90 || Math.abs(Number(p.lng)) > 180) add(3, `Confira o nome e as coordenadas do lugar ${i + 1}; ele ainda não aparecerá no mapa.`);
  });
  for (const [key, kind, label] of [['music', 'audio', 'música'], ['voice', 'audio', 'declaração em áudio'], ['video', 'video', 'vídeo']]) {
    if (!d[key]) continue;
    if (key === 'music') { if (parseMusic(d.music).type === 'invalid') add(3, 'Confira o link da música. Use um link completo de Spotify ou YouTube, ou um arquivo de áudio.'); continue; }
    let streaming = false;
    try { streaming = /(^|\.)(youtube\.com|youtu\.be|spotify\.com)$/.test(new URL(d[key]).hostname); } catch {}
    if (!mediaURL(d[key], kind) || streaming) add(3, `O endereço de ${label} precisa apontar para um arquivo direto.`);
  }
  return items;
}
