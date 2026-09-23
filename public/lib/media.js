import { collectMediaEntries, isDataURL, setPath } from './slug.js';
import { normalizeDraft } from '../model.js';

export const PRIVATE_BUCKET = 'surprise-media';
export const PRIVATE_PREFIX = `storage://${PRIVATE_BUCKET}/`;

export function privateMediaPath(value) {
  if (typeof value !== 'string' || !value.startsWith(PRIVATE_PREFIX)) return null;
  const path = value.slice(PRIVATE_PREFIX.length);
  return /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9]{64}$/i.test(path) ? path : null;
}

export async function blobToDataURL(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(chunks.join(''))}`;
}

// A bounded cache avoids decoding/hashing unchanged large files on every save.
export function createMediaPacker() {
  let cache = new Map();
  return async draft => {
    const packed = normalizeDraft(draft);
    const next = new Map(), assets = new Map();
    for (const entry of collectMediaEntries(packed)) {
      if (!isDataURL(entry.value)) continue;
      let asset = cache.get(entry.value) || next.get(entry.value);
      if (!asset) {
        const blob = await (await fetch(entry.value)).blob();
        const hashInput = new Blob([blob.type, '\0', blob]);
        const hash = await crypto.subtle.digest('SHA-256', await hashInput.arrayBuffer());
        const id = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
        asset = { id, blob };
      }
      next.set(entry.value, asset);
      assets.set(asset.id, asset.blob);
      setPath(packed, entry.path, `asset:${asset.id}`);
    }
    cache = next;
    return { draft: packed, assets };
  };
}
