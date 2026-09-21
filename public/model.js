import { parseMusic } from './music.js';
export const occasions = { namoro: 'Pedido de namoro', encontro: 'Primeiro encontro', casamento: 'Casamento', especial: 'Uma data especial' };
export function newDraft() {
  return { version: 1, id: crypto.randomUUID(), recipient: '', sender: '', occasion: 'namoro', relationship: 'casados', dates: { namoro: '', encontro: '', casamento: '', especial: '' }, specialLabel: '', accent: '#c4685f', opening: '', firstMemory: '', cover: '', moments: [], details: '', letter: '', music: '', voice: '', video: '', places: [], letters: [], question: '', answer: 'Sempre, meu amor', after: 'Ainda temos tanta coisa linda para viver.' };
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
  const issues = [];
  if (!d.recipient.trim() || !d.sender.trim()) issues.push('Preencha os nomes de vocês.');
  if (calendarDays(d.dates[d.occasion]) === null) issues.push('Informe uma data válida, até hoje, para a ocasião celebrada.');
  if (!d.firstMemory.trim() && !d.letter.trim()) issues.push('Escreva uma lembrança ou uma declaração para personalizar a surpresa.');
  return issues;
}

export function reviewDraft(d) {
  const items = [];
  const add = (step, message, required = false) => items.push({ step, message, required });
  if (!d.recipient.trim() || !d.sender.trim()) add(0, 'Preencha os nomes de vocês.', true);
  if (calendarDays(d.dates[d.occasion]) === null) add(1, 'Informe a data original da ocasião, até hoje.', true);
  if (!d.firstMemory.trim() && !d.letter.trim()) add(2, 'Escreva uma lembrança ou uma declaração.', true);
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
