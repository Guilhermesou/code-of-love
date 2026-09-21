// Self-contained: also embedded in the downloaded gift.
export function parseMusic(value) {
  if (!value) return { type: 'none' };
  if (/^data:audio\/[a-z0-9.+-]+;base64,/i.test(value)) return { type: 'file', url: value };
  let u; try { u = new URL(value); } catch { return { type: 'invalid' }; }
  if (!['https:', 'http:'].includes(u.protocol)) return { type: 'invalid' };
  if (u.hostname === 'open.spotify.com') {
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([a-zA-Z0-9]{22})\/?$/);
    return m ? { type: 'spotify', url: `https://open.spotify.com/${m[1]}/${m[2]}`, embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}` } : { type: 'invalid' };
  }
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(u.hostname)) {
    const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)\/?$/)?.[1];
    return /^[\w-]{11}$/.test(id || '') ? { type: 'youtube', url: `https://www.youtube.com/watch?v=${id}` } : { type: 'invalid' };
  }
  if (['spotify.link', 'www.spotify.com', 'spotify.com'].includes(u.hostname)) return { type: 'invalid' };
  return { type: 'file', url: u.href };
}
