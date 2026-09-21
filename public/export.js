import { parseMusic } from './music.js';
import { installOpening } from './opening.js';
import { mountExperience } from './experience.js';
export function buildGiftHTML(draft, css) {
  const title = String(draft.recipient).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const data = JSON.stringify(draft).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Uma surpresa para ${title}</title><style>${css}</style></head><body><div id="app"></div><script>const parseMusic = ${parseMusic.toString()}; const installOpening = ${installOpening.toString()}; (${mountExperience.toString()})(${data});<\/script></body></html>`;
}
