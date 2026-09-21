// Self-contained to preserve the same experience in the exported HTML.
export function installOpening(root, { onReveal, musicEl }) {
  const gate = root.querySelector('.gift-gate');
  const stage = root.querySelector('.story-stage');
  const heart = root.querySelector('.heart-button');
  const hint = root.querySelector('.heart-hint');
  const shape = root.querySelector('.reveal-shape');
  const sound = root.querySelector('#with-sound');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let taps = 0, opening = false, finished = false, disposed = false, audioContext, raf, finishTimer;
  const timeouts = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); if (!disposed) fn(); }, ms); timeouts.add(id); return id; };
  const vibrate = pattern => { try { navigator.vibrate?.(pattern); } catch {} };
  const unlockAudio = () => {
    if (!sound.checked) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!audioContext && Audio) audioContext = new Audio();
      if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
    } catch {}
  };
  const beat = index => {
    unlockAudio();
    const pulse = [18, 28, 40][index - 1];
    if (!reduced.matches) vibrate([pulse, 115, Math.round(pulse * .65)]);
    const c = audioContext;
    if (sound.checked && c && c.state !== 'closed') {
      for (const [delay, strength] of [[0, 1], [.14, .65]]) {
        const t = c.currentTime + delay, o = c.createOscillator(), gain = c.createGain();
        o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + .18);
        gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.12 * strength * (1 + index * .15), t + .015); gain.gain.exponentialRampToValueAtTime(.0001, t + .24);
        o.connect(gain); gain.connect(c.destination); o.start(t); o.stop(t + .26);
        o.onended = () => { o.disconnect(); gain.disconnect(); };
      }
    }
    heart.style.setProperty('--beat-duration', [1.9, 1.25, .8, .5][index] + 's');
    if (!reduced.matches) heart.animate?.([{ transform: 'scale(1)' }, { transform: `scale(${1.08 + index * .025})`, offset: .2 }, { transform: 'scale(1)', offset: .5 }, { transform: 'scale(1.06)', offset: .7 }, { transform: 'scale(1)' }], { duration: 380 });
  };

  // Start decoding the cover and nearby memories while the gate is visible.
  const images = [...stage.querySelectorAll('img')];
  const decodeImage = img => {
    img.loading = 'eager';
    if (img.classList.contains('cover-photo')) img.fetchPriority = 'high';
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  };
  const fontWork = document.fonts ? Promise.allSettled([document.fonts.load('400 48px "Cormorant Garamond"'), document.fonts.load('400 16px Jost')]) : Promise.resolve();
  const ready = Promise.allSettled([fontWork, ...images.slice(0, 3).map(decodeImage)]);
  let idle;
  const rest = () => { if (!disposed) images.slice(3).forEach(decodeImage); };
  if ('requestIdleCallback' in window) idle = requestIdleCallback(rest, { timeout: 2500 }); else later(rest, 1200);
  if (musicEl) { musicEl.preload = navigator.connection?.saveData ? 'metadata' : 'auto'; musicEl.load(); }

  const finalize = () => {
    if (disposed || finished) return;
    finished = true; clearTimeout(finishTimer); cancelAnimationFrame(raf);
    gate.hidden = true; stage.classList.remove('awaiting', 'revealing'); stage.style.clipPath = ''; stage.style.webkitClipPath = '';
    stage.inert = false; stage.removeAttribute('aria-hidden');
    const title = stage.querySelector('h1'); title.tabIndex = -1; title.focus({ preventScroll: true });
    root.querySelector('.experience').classList.remove('opening-active');
    onReveal();
  };
  const reveal = instant => {
    if (disposed) return;
    if (instant || reduced.matches) { finalize(); return; }
    const rect = heart.getBoundingClientRect(), parent = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - parent.left, cy = rect.top + rect.height / 2 - parent.top;
    stage.classList.add('revealing');
    const clip = `url(#${shape.parentElement.id})`;
    stage.style.clipPath = clip; stage.style.webkitClipPath = clip;
    root.querySelector('.experience').classList.add('opening-active');
    const duration = 1800, start = performance.now();
    const maxScale = Math.max(parent.width, window.innerHeight) * 4 / 100;
    const frame = now => {
      if (disposed) return;
      const progress = Math.min(1, (now - start) / duration);
      const ease = progress * progress * (3 - 2 * progress);
      const scale = 1.1 + (maxScale - 1.1) * ease;
      shape.setAttribute('transform', `translate(${cx} ${cy}) scale(${scale}) translate(-50 -46)`);
      if (progress < 1) raf = requestAnimationFrame(frame); else finalize();
    };
    frame(start);
    // A backgrounded tab or interrupted animation must never trap the recipient.
    finishTimer = later(finalize, duration + 300);
  };
  const open = instant => {
    if (opening || disposed) return;
    opening = true; heart.disabled = true;
    if (musicEl && sound.checked) {
      // Begin in the user's gesture to retain browser playback permission.
      musicEl.volume = .45; musicEl.play().catch(() => {});
    }
    if (instant || reduced.matches) { reveal(true); return; }
    hint.textContent = 'Respira…';
    Promise.race([ready, new Promise(resolve => later(resolve, 900))]).then(() => { if (!disposed) later(() => reveal(false), 280); });
  };
  heart.onclick = () => {
    if (opening) return;
    taps++; beat(taps);
    hint.textContent = ['Toque no coração', 'Mais um toque…', 'Só mais um.', 'Respira…'][taps];
    heart.setAttribute('aria-label', taps < 3 ? `Toque ${taps + 1} de 3 para abrir a surpresa` : 'Abrindo a surpresa');
    root.querySelectorAll('.heart-progress span').forEach((el, i) => el.classList.toggle('filled', i < taps));
    if (taps === 3) open(false);
  };
  const skip = root.querySelector('.skip');
  skip.onclick = () => open(true);
  sound.onchange = () => { if (!sound.checked) { audioContext?.suspend().catch(() => {}); musicEl?.pause(); } };
  const motionChange = () => { if (reduced.matches) { vibrate(0); if (opening) finalize(); } };
  const visibility = () => { if (document.hidden) { vibrate(0); audioContext?.suspend().catch(() => {}); if (opening) finalize(); } };
  reduced.addEventListener('change', motionChange); document.addEventListener('visibilitychange', visibility);
  return () => {
    disposed = true; timeouts.forEach(clearTimeout); cancelAnimationFrame(raf); if (idle !== undefined) cancelIdleCallback(idle);
    vibrate(0); audioContext?.close().catch(() => {});
    reduced.removeEventListener('change', motionChange); document.removeEventListener('visibilitychange', visibility);
  };
}
