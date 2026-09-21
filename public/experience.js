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
  const letters = d.letters.filter(l => l.title && l.text);
  const places = d.places.filter(p => p.name && String(p.lat).trim() && String(p.lng).trim() && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180);
  const timeline = [
    ...Object.entries({ encontro: 'Primeiro encontro', namoro: 'Pedido de namoro', casamento: 'Casamento', especial: d.specialLabel || 'Uma data especial' }).filter(([key]) => d.dates[key]).map(([key, title]) => ({ date: d.dates[key], title, text: '', photo: '' })),
    ...moments.filter(m => m.date).map(m => ({ date: m.date, title: m.title || 'Uma lembrança', text: m.text, photo: m.photo })),
    ...places.filter(p => p.date).map(p => ({ date: p.date, title: p.name, text: p.memory, photo: p.photo })),
  ].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const boothPhotos = [d.cover, ...moments.map(m => m.photo)].map(p => photo(p, 'Uma lembrança nossa', 'booth-photo')).filter(Boolean).slice(0, 4);
  const detailLines = (d.details || '').split('\n').map(x => x.trim()).filter(Boolean);
  const albumPages = [];
  if (boothPhotos.length >= 2) albumPages.push({ label: 'Cabine de fotos', html: `<div class="album-card booth">${boothPhotos.join('')}<span class="booth-caption">${esc(d.recipient || 'nós')} <em>&</em> ${esc(d.sender || 'eu')}</span></div>` });
  if (detailLines.length) albumPages.push({ label: 'Dicionário do amor', html: `<div class="album-card dictionary"><span class="word">amor</span><span class="pronunciation">substantivo · o que ${esc(d.sender || 'eu')} sente por ${esc(d.recipient || 'você')}</span><ol>${detailLines.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` });
  if (letters.length) albumPages.push({ label: 'Cartas lacradas', html: `<div class="album-card sealed-page"><p class="helper">Um carinho guardado para cada momento.</p><div class="sealed-letters">${letters.map((l, i) => `<details class="sealed"><summary><span class="seal" aria-hidden="true">♡</span><span><small>CARTA ${String(i + 1).padStart(2, '0')}</small>${esc(l.title)}</span><span class="letter-plus" aria-hidden="true">+</span></summary><p class="prose">${esc(l.text)}</p></details>`).join('')}</div></div>` });
  root.innerHTML = `<div class="experience" style="--accent:${/^#[a-f0-9]{6}$/i.test(d.accent) ? d.accent : '#c4685f'}">
    <div class="gift-gate"><span class="eyebrow">para ${esc(d.recipient || 'você')}</span><h1>${esc(opening)}</h1><button class="heart-button" aria-label="Toque 1 de 3 para abrir a surpresa"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 88C20 65 4 45 4 30A22 22 0 0 1 50 22A22 22 0 0 1 96 30C96 45 80 65 50 88Z" fill="currentColor"/></svg></button><p class="heart-hint" aria-live="polite">Toque no coração</p><div class="heart-progress" aria-hidden="true"><span></span><span></span><span></span></div><label class="sound-choice"><input id="with-sound" type="checkbox" checked> ${music ? 'Batidas e música' : 'Som das batidas'}</label><button class="text-button skip" hidden>Rever nossa história</button><span class="gate-signature">feito com amor, por ${esc(d.sender || 'quem te ama')}</span></div>
    <div class="story-stage awaiting" inert aria-hidden="true"><article class="gift-story">
      <header class="gift-hero"><p class="eyebrow">a nossa história</p><h1>${esc(d.recipient || 'Você')} <em>&</em> ${esc(d.sender || 'eu')}</h1>${photo(d.cover, 'Uma lembrança de nós dois', 'cover-photo')}<p class="scroll-hint">Uma lembrança de cada vez <span>↓</span></p></header>
      ${musicInfo.type === 'spotify' ? section('a nossa música', `<h2>Tem um pouco de nós nessa canção.</h2><button type="button" class="outline" id="load-spotify">Abrir player do Spotify</button><div id="spotify-slot"></div><p class="helper">A reprodução disponível é definida pelo Spotify.</p><a class="map-link" href="${esc(musicInfo.url)}" target="_blank" rel="noopener noreferrer">Ouvir no Spotify ↗</a>`) : ''}
      ${musicInfo.type === 'youtube' ? section('a nossa música', `<h2>Tem um pouco de nós nessa canção.</h2><button type="button" class="outline" id="load-youtube">Tocar vídeo</button><div id="youtube-slot"></div><p class="helper">A reprodução disponível é definida pelo YouTube.</p><a class="map-link" href="${esc(musicInfo.url)}" target="_blank" rel="noopener noreferrer">Ouvir no YouTube ↗</a>`) : ''}
      ${d.firstMemory ? section('aquele dia', `<h2>O começo de nós.</h2><p class="prose">${esc(d.firstMemory)}</p>`) : ''}
      ${Number.isFinite(days) && days >= 0 ? section('desde então', `<div class="days-number">${days.toLocaleString('pt-BR')}</div><h2>dias de história.</h2><div class="counter-breakdown" id="counter-breakdown"></div><p>${esc(labels[d.occasion])}</p><span class="date-caption">${esc(dateText(date))}</span>`, 'counter-section') : ''}
      ${timeline.length > 1 ? section('nossa linha do tempo', `<h2>Cada capítulo, no seu tempo.</h2><div class="timeline">${timeline.map(e => `<div class="timeline-item"><span class="timeline-dot" aria-hidden="true"></span><div class="timeline-content"><span class="date-caption">${esc(dateText(e.date))}</span><h3>${esc(e.title)}</h3>${e.text ? `<p class="prose">${esc(e.text)}</p>` : ''}${photo(e.photo, e.title, 'timeline-photo')}</div></div>`).join('')}</div>`) : ''}
      ${albumPages.length ? section('nosso álbum', `<h2>Um livrinho só nosso.</h2><div class="album"><div class="album-track" id="album-track">${albumPages.map(p => `<div class="album-page">${p.html}<span class="album-caption">${esc(p.label)}</span></div>`).join('')}</div></div>${albumPages.length > 1 ? `<div class="album-controls"><button class="text-button" id="album-prev" aria-label="Página anterior">←</button><div class="album-dots">${albumPages.map((_, i) => `<button class="album-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Ir para página ${i + 1}"></button>`).join('')}</div><button class="text-button" id="album-next" aria-label="Próxima página">→</button></div>` : ''}`, 'album-section') : ''}
      ${moments.length ? section('nossa história', `<h2>O caminho até aqui.</h2><div class="memory-list">${moments.map((m, i) => `<div class="memory"><span class="memory-number">${String(i + 1).padStart(2, '0')}</span><div><span class="date-caption">${esc(dateText(m.date))}</span><h3>${esc(m.title)}</h3><p class="prose">${esc(m.text)}</p>${photo(m.photo, m.title || 'Uma lembrança nossa')}</div></div>`).join('')}</div>`) : ''}
      ${places.length ? section('os nossos lugares', `<h2>Onde a vida nos encontrou.</h2><div class="place-tabs" role="group" aria-label="Escolha uma lembrança">${places.map((p, i) => `<button class="chip ${i === 0 ? 'selected' : ''}" data-place="${i}" aria-pressed="${i === 0}">${esc(p.name)}</button>`).join('')}</div><div id="place-view"></div>`) : ''}
      ${video ? section('um pedacinho de nós', `<h2>Para dar play na lembrança.</h2><video id="gift-video" controls playsinline preload="metadata" src="${esc(video)}"></video><p class="media-error" id="video-error" hidden>Não foi possível abrir este vídeo.</p>`) : ''}
      ${d.details ? section('o que eu continuo amando em você', `<div class="love-details">${d.details.split('\n').filter(x => x.trim()).map(x => `<p>${esc(x)}</p>`).join('')}</div>`) : ''}
      ${d.letter || voice ? section('de mim, para você', `${d.letter ? `<p class="prose declaration">${esc(d.letter)}</p><p class="signature">Com amor, ${esc(d.sender)}</p>` : ''}${voice ? `<div class="voice-note"><span>Na minha voz</span><audio id="gift-voice" controls preload="metadata" src="${esc(voice)}"></audio></div>` : ''}`) : ''}
      <section class="gift-ending"><p class="prose">${esc(ending)}</p><div id="before-answer"><h2>${esc(d.question || 'Vamos continuar escrevendo a nossa história?')}</h2><button class="primary" id="answer">${esc(d.answer || 'Sempre, meu amor')}</button></div><div id="after-answer" hidden><span class="ending-heart" aria-hidden="true">♡</span><h2>${esc(d.after || 'Ainda temos tanta coisa linda para viver.')}</h2></div></section>
      <footer class="gift-footer">&lt; Código do amor /&gt;</footer>
    </article></div>${music ? `<audio id="gift-music" loop preload="auto" src="${esc(music)}"></audio><button class="music-toggle chip" hidden>Tocar música</button>` : ''}<p id="gift-status" class="gift-status" role="status"></p></div>`;
  const gate = root.querySelector('.gift-gate'), story = root.querySelector('.gift-story');
  const musicEl = root.querySelector('#gift-music'), voiceEl = root.querySelector('#gift-voice'), videoEl = root.querySelector('#gift-video');
  const musicButton = root.querySelector('.music-toggle');
  const vibrate = pattern => { try { navigator.vibrate?.(pattern); } catch {} };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const animateCount = (el, target, duration = 1300) => {
    const start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(target * (1 - (1 - p) ** 3)).toLocaleString('pt-BR');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  let counterAnimated = false;
  const revealCounter = () => {
    if (counterAnimated || reducedMotion) return;
    counterAnimated = true;
    [root.querySelector('.days-number'), ...root.querySelectorAll('.counter-breakdown strong')].forEach(el => {
      if (!el) return;
      const target = parseInt(el.textContent.replace(/\D/g, ''), 10);
      if (!Number.isFinite(target)) return;
      el.textContent = '0'; animateCount(el, target);
    });
  };
  const revealTargets = [...root.querySelectorAll('.gift-section')];
  let sectionObserver = null;
  if (revealTargets.length && 'IntersectionObserver' in window && !reducedMotion) {
    sectionObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        if (entry.target.classList.contains('counter-section')) revealCounter();
        obs.unobserve(entry.target);
      });
    }, { threshold: .2, rootMargin: '0px 0px -10% 0px' });
    revealTargets.forEach(el => sectionObserver.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('in-view'));
  }
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
    vibrate(16);
    root.querySelector('#before-answer').hidden = true; const after = root.querySelector('#after-answer'); after.hidden = false; after.tabIndex = -1; after.focus();
  };
  root.querySelectorAll('.sealed').forEach(el => el.addEventListener('toggle', () => { if (el.open) vibrate(10); }));
  const albumTrack = root.querySelector('#album-track');
  if (albumTrack) {
    const pages = [...albumTrack.children];
    const dots = [...root.querySelectorAll('.album-dot')];
    const prevBtn = root.querySelector('#album-prev'), nextBtn = root.querySelector('#album-next');
    let current = 0;
    const setActive = i => { current = i; dots.forEach((btn, bi) => btn.classList.toggle('active', bi === i)); };
    const goTo = i => { const idx = Math.max(0, Math.min(pages.length - 1, i)); setActive(idx); pages[idx].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' }); };
    prevBtn?.addEventListener('click', () => { vibrate(8); goTo(current - 1); });
    nextBtn?.addEventListener('click', () => { vibrate(8); goTo(current + 1); });
    dots.forEach(btn => btn.addEventListener('click', () => { vibrate(8); goTo(Number(btn.dataset.index)); }));
    let scrollTimer;
    albumTrack.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const i = Math.round(albumTrack.scrollLeft / albumTrack.clientWidth);
        if (i !== current && i >= 0 && i < pages.length) setActive(i);
      }, 120);
    });
  }
  const showPlace = i => {
    const p = places[i], lat = Number(p.lat), lng = Number(p.lng);
    const bbox = [Math.max(-180, lng - .015), Math.max(-90, lat - .01), Math.min(180, lng + .015), Math.min(90, lat + .01)].join(',');
    const src = 'https://www.openstreetmap.org/export/embed.html?' + new URLSearchParams({ bbox, layer: 'mapnik', marker: `${lat},${lng}` });
    root.querySelector('#place-view').innerHTML = `<iframe title="Mapa: ${esc(p.name)}" src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer"></iframe><h3>${esc(p.name)}</h3><span class="date-caption">${esc(dateText(p.date))}</span><p class="prose">${esc(p.memory)}</p>${photo(p.photo, p.name)}<a class="map-link" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}" target="_blank" rel="noopener noreferrer">Abrir mapa ↗</a>`;
    root.querySelectorAll('[data-place]').forEach(b => { b.classList.toggle('selected', Number(b.dataset.place) === i); b.setAttribute('aria-pressed', String(Number(b.dataset.place) === i)); });
  };
  if (places.length) { showPlace(0); root.querySelectorAll('[data-place]').forEach(b => b.onclick = () => { vibrate(8); showPlace(Number(b.dataset.place)); }); }
  return () => { if (disposed) return; disposed = true; stopOpening(); if (counterInterval) clearInterval(counterInterval); sectionObserver?.disconnect(); root.querySelector('#spotify-slot')?.replaceChildren(); root.querySelector('#youtube-slot')?.replaceChildren(); allMedia.forEach(el => { el.pause(); el.removeAttribute('src'); el.load(); }); };
}
