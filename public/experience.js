import { parseMusic } from './music.js';
import { installOpening } from './opening.js';
// This function is self-contained so the downloaded gift works without the editor.
export function mountExperience(d, root = document.getElementById('app')) {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = (v, kind) => {
    if (typeof v !== 'string') return '';
    if (new RegExp('^data:' + kind + '/[a-z0-9.+-]+;base64,', 'i').test(v)) return v;
    try { const u = new URL(v); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
  };
  const photo = (src, alt, cls = '') => url(src, 'image') ? `<img class="${cls}" src="${esc(url(src, 'image'))}" alt="${esc(alt)}" loading="lazy">` : '';
  const section = (label, content, cls = '') => `<section class="gift-section ${cls}"><p class="eyebrow">${label}</p>${content}</section>`;
  const dateText = v => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const date = d.dates[d.occasion];
  const today = new Date();
  const days = date ? Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.parse(date + 'T00:00:00Z')) / 86400000) : null;
  const originLocal = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00') : null;
  const timeStats = () => {
    const now = new Date();
    if (!originLocal || originLocal > now) return null;
    const elapsedMs = now - originLocal;
    let months = (now.getFullYear() - originLocal.getFullYear()) * 12 + (now.getMonth() - originLocal.getMonth());
    if (now.getDate() < originLocal.getDate()) months--;
    return { weeks: Math.floor(elapsedMs / 604800000), months: Math.max(0, months), hours: Math.floor(elapsedMs / 3600000) };
  };
  const labels = { namoro: 'desde o nosso pedido de namoro', encontro: 'desde o nosso primeiro encontro', casamento: 'desde o nosso casamento', especial: d.specialLabel || 'desde aquele dia especial' };
  const opening = d.opening || ({ namoro: 'Naquele dia, eu te fiz uma pergunta…', encontro: 'Tudo começou quando nossos caminhos se encontraram…', casamento: 'Naquele dia, escolhemos uma vida juntos…', especial: 'Tem um dia que merece ser lembrado…' })[d.occasion];
  const ending = d.occasion === 'namoro' && d.relationship === 'casados' ? 'Naquele dia, te pedi em namoro.\nDepois, te pedi para dividir a vida comigo.\nE todos os dias, continuo escolhendo você.' : d.occasion === 'casamento' ? 'Naquele dia, escolhemos dividir a vida.\nE todos os dias, continuo escolhendo você.' : 'Desde que nossos caminhos se encontraram,\na nossa história continua sendo a minha favorita.';
  const musicInfo = parseMusic(d.music);
  const music = musicInfo.type === 'file' ? musicInfo.url : '', voice = url(d.voice, 'audio'), video = url(d.video, 'video');
  const moments = d.moments.filter(m => m.title || m.text || url(m.photo, 'image'));
  const milestones = Object.entries({ encontro: 'Nosso primeiro encontro', namoro: 'O pedido de namoro', casamento: 'Nosso casamento' }).filter(([key]) => d.dates[key]);
  const letters = d.letters.filter(l => l.title && l.text);
  const places = d.places.filter(p => p.name && String(p.lat).trim() && String(p.lng).trim() && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180);
  root.innerHTML = `<div class="experience" style="--accent:${/^#[a-f0-9]{6}$/i.test(d.accent) ? d.accent : '#c4685f'}">
    <div class="gift-gate"><span class="eyebrow">para ${esc(d.recipient || 'você')}</span><h1>${esc(opening)}</h1><button class="heart-button" aria-label="Toque 1 de 3 para abrir a surpresa"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 88C20 65 4 45 4 30A22 22 0 0 1 50 22A22 22 0 0 1 96 30C96 45 80 65 50 88Z" fill="currentColor"/></svg></button><p class="heart-hint" aria-live="polite">Toque no coração</p><div class="heart-progress" aria-hidden="true"><span></span><span></span><span></span></div><label class="sound-choice"><input id="with-sound" type="checkbox" checked> ${music ? 'Batidas e música' : 'Som das batidas'}</label><button class="text-button skip" hidden>Rever nossa história</button><span class="gate-signature">feito com amor, por ${esc(d.sender || 'quem te ama')}</span></div>
    <div class="story-stage awaiting" inert aria-hidden="true"><article class="gift-story">
      <header class="gift-hero"><p class="eyebrow">a nossa história</p><h1>${esc(d.recipient || 'Você')} <em>&</em> ${esc(d.sender || 'eu')}</h1>${photo(d.cover, 'Uma lembrança de nós dois', 'cover-photo')}<p class="scroll-hint">Uma lembrança de cada vez <span>↓</span></p></header>
      ${musicInfo.type === 'spotify' ? section('a nossa música', `<h2>Tem um pouco de nós nessa canção.</h2><button type="button" class="outline" id="load-spotify">Abrir player do Spotify</button><div id="spotify-slot"></div><p class="helper">A reprodução disponível é definida pelo Spotify.</p><a class="map-link" href="${esc(musicInfo.url)}" target="_blank" rel="noopener noreferrer">Ouvir no Spotify ↗</a>`) : ''}
      ${musicInfo.type === 'youtube' ? section('a nossa música', `<h2>Tem um pouco de nós nessa canção.</h2><button type="button" class="outline" id="load-youtube">Tocar vídeo</button><div id="youtube-slot"></div><p class="helper">A reprodução disponível é definida pelo YouTube.</p><a class="map-link" href="${esc(musicInfo.url)}" target="_blank" rel="noopener noreferrer">Ouvir no YouTube ↗</a>`) : ''}
      ${d.firstMemory ? section('aquele dia', `<h2>O começo de nós.</h2><p class="prose">${esc(d.firstMemory)}</p>`) : ''}
      ${Number.isFinite(days) && days >= 0 ? section('desde então', `<div class="days-number">${days.toLocaleString('pt-BR')}</div><h2>dias de história.</h2><div class="counter-breakdown" id="counter-breakdown"></div><p>${esc(labels[d.occasion])}</p><span class="date-caption">${esc(dateText(date))}</span>`, 'counter-section') : ''}
      ${milestones.length > 1 ? section('as datas que nos trouxeram até aqui', `<div class="milestones">${milestones.map(([key, title]) => `<div><span class="date-caption">${esc(dateText(d.dates[key]))}</span><h3>${title}</h3></div>`).join('')}</div>`) : ''}
      ${moments.length ? section('nossa história', `<h2>O caminho até aqui.</h2><div class="memory-list">${moments.map((m, i) => `<div class="memory"><span class="memory-number">${String(i + 1).padStart(2, '0')}</span><div><span class="date-caption">${esc(dateText(m.date))}</span><h3>${esc(m.title)}</h3><p class="prose">${esc(m.text)}</p>${photo(m.photo, m.title || 'Uma lembrança nossa')}</div></div>`).join('')}</div>`) : ''}
      ${places.length ? section('os nossos lugares', `<h2>Onde a vida nos encontrou.</h2><div class="place-tabs" role="group" aria-label="Escolha uma lembrança">${places.map((p, i) => `<button class="chip ${i === 0 ? 'selected' : ''}" data-place="${i}" aria-pressed="${i === 0}">${esc(p.name)}</button>`).join('')}</div><div id="place-view"></div>`) : ''}
      ${video ? section('um pedacinho de nós', `<h2>Para dar play na lembrança.</h2><video id="gift-video" controls playsinline preload="metadata" src="${esc(video)}"></video><p class="media-error" id="video-error" hidden>Não foi possível abrir este vídeo.</p>`) : ''}
      ${d.details ? section('o que eu continuo amando em você', `<div class="love-details">${d.details.split('\n').filter(x => x.trim()).map(x => `<p>${esc(x)}</p>`).join('')}</div>`) : ''}
      ${d.letter || voice ? section('de mim, para você', `${d.letter ? `<p class="prose declaration">${esc(d.letter)}</p><p class="signature">Com amor, ${esc(d.sender)}</p>` : ''}${voice ? `<div class="voice-note"><span>Na minha voz</span><audio id="gift-voice" controls preload="metadata" src="${esc(voice)}"></audio></div>` : ''}`) : ''}
      ${letters.length ? section('para abrir quando precisar', `<h2>Cartas seladas.</h2><p>Um carinho guardado para cada momento.</p><div class="sealed-letters">${letters.map((l, i) => `<details class="sealed"><summary><span class="seal" aria-hidden="true">♡</span><span><small>CARTA ${String(i + 1).padStart(2, '0')}</small>${esc(l.title)}</span><span class="letter-plus" aria-hidden="true">+</span></summary><p class="prose">${esc(l.text)}</p></details>`).join('')}</div>`) : ''}
      <section class="gift-ending"><p class="prose">${esc(ending)}</p><div id="before-answer"><h2>${esc(d.question || 'Vamos continuar escrevendo a nossa história?')}</h2><button class="primary" id="answer">${esc(d.answer || 'Sempre, meu amor')}</button></div><div id="after-answer" hidden><span class="ending-heart" aria-hidden="true">♡</span><h2>${esc(d.after || 'Ainda temos tanta coisa linda para viver.')}</h2></div></section>
      <footer class="gift-footer">&lt; Código do amor /&gt;</footer>
    </article></div>${music ? `<audio id="gift-music" loop preload="auto" src="${esc(music)}"></audio><button class="music-toggle chip" hidden>Tocar música</button>` : ''}<p id="gift-status" class="gift-status" role="status"></p></div>`;
  const gate = root.querySelector('.gift-gate'), story = root.querySelector('.gift-story');
  const musicEl = root.querySelector('#gift-music'), voiceEl = root.querySelector('#gift-voice'), videoEl = root.querySelector('#gift-video');
  const musicButton = root.querySelector('.music-toggle');
  let disposed = false;
  const status = msg => { root.querySelector('#gift-status').textContent = msg; };
  const play = async el => { try { await el.play(); } catch { status('O áudio não pôde iniciar. Confira o arquivo e toque para tentar novamente.'); } };
  const allMedia = [musicEl, voiceEl, videoEl].filter(Boolean);
  allMedia.forEach(el => {
    el.addEventListener('play', () => allMedia.forEach(other => { if (other !== el) other.pause(); }));
    el.addEventListener('error', () => status('Não foi possível carregar uma mídia. O restante da surpresa continua disponível.'));
  });
  const breakdownEl = root.querySelector('#counter-breakdown');
  const tickCounter = () => {
    if (!breakdownEl) return;
    const stats = timeStats();
    breakdownEl.innerHTML = stats ? [['semanas', stats.weeks], ['meses', stats.months], ['horas', stats.hours]].map(([label, n]) => `<div><strong>${n.toLocaleString('pt-BR')}</strong><span>${label}</span></div>`).join('') : '';
  };
  tickCounter();
  const counterInterval = breakdownEl ? setInterval(tickCounter, 60000) : null;
  const stopOpening = installOpening(root, { musicEl, onReveal: () => {
    if (musicButton) musicButton.hidden = false;
    try { localStorage.setItem('cda-visited-' + d.id, '1'); } catch {}
  } });
  const skip = root.querySelector('.skip');
  try { skip.hidden = localStorage.getItem('cda-visited-' + d.id) !== '1'; } catch {}
  const spotifyButton = root.querySelector('#load-spotify');
  if (spotifyButton) spotifyButton.onclick = () => {
    allMedia.forEach(media => media.pause());
    root.querySelector('#spotify-slot').innerHTML = `<iframe class="spotify-player" title="A nossa música no Spotify" src="${esc(musicInfo.embed)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager"></iframe>`;
    spotifyButton.hidden = true;
  };
  const youtubeButton = root.querySelector('#load-youtube');
  if (youtubeButton) youtubeButton.onclick = () => {
    allMedia.forEach(media => media.pause());
    root.querySelector('#youtube-slot').innerHTML = `<iframe class="youtube-player" title="A nossa música no YouTube" src="${esc(musicInfo.embed)}&autoplay=1" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" loading="eager"></iframe>`;
    youtubeButton.hidden = true;
  };
  allMedia.forEach(media => media.addEventListener('play', () => {
    const spotifySlot = root.querySelector('#spotify-slot');
    if (spotifySlot?.firstChild) { spotifySlot.replaceChildren(); spotifyButton.hidden = false; }
    const youtubeSlot = root.querySelector('#youtube-slot');
    if (youtubeSlot?.firstChild) { youtubeSlot.replaceChildren(); youtubeButton.hidden = false; }
  }));
  if (musicEl) {
    const sync = () => { musicButton.textContent = musicEl.paused ? '♫ Tocar música' : 'Ⅱ Pausar música'; musicButton.setAttribute('aria-pressed', String(!musicEl.paused)); };
    musicEl.onplay = sync; musicEl.onpause = sync;
    musicButton.onclick = () => musicEl.paused ? play(musicEl) : musicEl.pause();
  }
  root.querySelector('#answer').onclick = () => {
    root.querySelector('#before-answer').hidden = true; const after = root.querySelector('#after-answer'); after.hidden = false; after.tabIndex = -1; after.focus();
  };
  const showPlace = i => {
    const p = places[i], lat = Number(p.lat), lng = Number(p.lng);
    const bbox = [Math.max(-180, lng - .015), Math.max(-90, lat - .01), Math.min(180, lng + .015), Math.min(90, lat + .01)].join(',');
    const src = 'https://www.openstreetmap.org/export/embed.html?' + new URLSearchParams({ bbox, layer: 'mapnik', marker: `${lat},${lng}` });
    root.querySelector('#place-view').innerHTML = `<iframe title="Mapa: ${esc(p.name)}" src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer"></iframe><h3>${esc(p.name)}</h3><span class="date-caption">${esc(dateText(p.date))}</span><p class="prose">${esc(p.memory)}</p>${photo(p.photo, p.name)}<a class="map-link" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}" target="_blank" rel="noopener noreferrer">Abrir mapa ↗</a>`;
    root.querySelectorAll('[data-place]').forEach(b => { b.classList.toggle('selected', Number(b.dataset.place) === i); b.setAttribute('aria-pressed', String(Number(b.dataset.place) === i)); });
  };
  if (places.length) { showPlace(0); root.querySelectorAll('[data-place]').forEach(b => b.onclick = () => showPlace(Number(b.dataset.place))); }
  return () => { if (disposed) return; disposed = true; stopOpening(); if (counterInterval) clearInterval(counterInterval); root.querySelector('#spotify-slot')?.replaceChildren(); root.querySelector('#youtube-slot')?.replaceChildren(); allMedia.forEach(el => { el.pause(); el.removeAttribute('src'); el.load(); }); };
}
