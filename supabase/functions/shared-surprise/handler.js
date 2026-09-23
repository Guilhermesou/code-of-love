import { normalizeDraft } from '../../../public/model.js';
import { collectMediaEntries, setPath } from '../../../public/lib/slug.js';
import { PRIVATE_BUCKET, privateMediaPath } from '../../../public/lib/media.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export function createShareHandler(client) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'method-not-allowed' }, 405);
    let slug;
    try {
      // Do not accept arbitrary object paths, queries or owner IDs from callers.
      const body = await request.text();
      if (body.length > 512) return reply({ error: 'invalid-request' }, 400);
      slug = JSON.parse(body).slug;
      if (typeof slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(slug)) return reply({ error: 'invalid-link' }, 400);
    } catch { return reply({ error: 'invalid-request' }, 400); }
    try {
      const { data, error } = await client.from('surprises').select('id, owner, published_draft')
        .eq('slug', slug).eq('public', true).maybeSingle();
      if (error) throw error;
      if (!data?.published_draft) return reply({ draft: null });
      const draft = normalizeDraft(data.published_draft, { allowReferences: true });
      if (draft.id !== data.id) throw new Error('invalid-publication');
      const signed = new Map();
      for (const entry of collectMediaEntries(draft)) {
        if (!entry.value.startsWith('storage:')) continue;
        const path = privateMediaPath(entry.value);
        if (!path?.startsWith(`${data.owner}/${data.id}/`)) throw new Error('invalid-media');
        if (!signed.has(path)) {
          const { data: asset, error: signingError } = await client.storage.from(PRIVATE_BUCKET).createSignedUrl(path, 3600);
          if (signingError || !asset?.signedUrl) throw signingError || new Error('missing-media');
          signed.set(path, asset.signedUrl);
        }
        setPath(draft, entry.path, signed.get(path));
      }
      return reply({ draft });
    } catch { return reply({ error: 'unavailable' }, 503); }
  };
}
