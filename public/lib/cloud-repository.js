import { normalizeDraft, validate } from '../model.js';
import { collectMediaEntries, setPath, slugify } from './slug.js';
import { blobToDataURL, createMediaPacker, PRIVATE_BUCKET, PRIVATE_PREFIX, privateMediaPath } from './media.js';

export function createCloudRepository(client) {
  const packMedia = createMediaPacker();
  async function owner() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('not-authenticated');
    return data.session.user.id;
  }
  async function publication(id, userId) {
    const { data, error } = await client.from('surprises')
      .select('id, slug, public, published_at').eq('id', id).eq('owner', userId).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function uploadMedia(draft, userId) {
    const packed = await packMedia(draft);
    const folder = `${userId}/${draft.id}`;
    let existing = new Set();
    if (packed.assets.size) {
      const { data, error } = await client.storage.from(PRIVATE_BUCKET).list(folder, { limit: 1000 });
      if (error) throw error;
      existing = new Set((data || []).map(file => file.name));
    }
    for (const [id, blob] of packed.assets) {
      if (blob.size > 40 * 1024 * 1024 || !/^(image|audio|video)\//.test(blob.type) || blob.type === 'image/svg+xml') {
        throw new Error('invalid-media');
      }
      if (existing.has(id)) continue;
      const path = `${folder}/${id}`;
      // Content-addressed files are immutable: a draft edit cannot change live media.
      const { error } = await client.storage.from(PRIVATE_BUCKET).upload(path, blob, { upsert: false, contentType: blob.type });
      if (error && !['Duplicate', 'ResourceAlreadyExists'].includes(error.error || error.code) &&
          !/^(The resource already exists|Asset Already Exists)$/i.test(error.message || '')) throw error;
    }
    for (const entry of collectMediaEntries(packed.draft)) {
      if (entry.value.startsWith('asset:')) {
        setPath(packed.draft, entry.path, `${PRIVATE_PREFIX}${userId}/${draft.id}/${entry.value.slice(6)}`);
      } else if (entry.value.startsWith('storage:')) {
        const path = privateMediaPath(entry.value);
        if (!path?.startsWith(`${userId}/${draft.id}/`)) throw new Error('invalid-media');
      }
    }
    return packed.draft;
  }
  async function hydrate(draft, userId) {
    const hydrated = normalizeDraft(draft, { allowReferences: true });
    const values = new Map();
    for (const entry of collectMediaEntries(hydrated)) {
      if (!entry.value.startsWith('storage:')) continue;
      const path = privateMediaPath(entry.value);
      if (!path?.startsWith(`${userId}/${draft.id}/`)) throw new Error('invalid-media');
      if (!values.has(path)) {
        const { data, error } = await client.storage.from(PRIVATE_BUCKET).download(path);
        if (error) throw error;
        values.set(path, await blobToDataURL(data));
      }
      setPath(hydrated, entry.path, values.get(path));
    }
    return hydrated;
  }
  return {
    async getPublication(id) { return publication(id, await owner()); },
    async save(value, { makePublic = false } = {}) {
      const draft = normalizeDraft(value);
      if (makePublic && validate(draft).length) throw new Error('invalid-publication');
      const userId = await owner();
      // Also verifies that the migration is present before uploading anything.
      const existing = await publication(draft.id, userId);
      const uploaded = await uploadMedia(draft, userId);
      const row = { draft: uploaded, updated_at: new Date().toISOString() };
      if (makePublic) Object.assign(row, { published_draft: uploaded, public: true, published_at: new Date().toISOString() });
      const table = client.from('surprises');
      const query = existing
        ? table.update(row).eq('id', draft.id).eq('owner', userId)
        : table.insert({ ...row, id: draft.id, owner: userId, slug: slugify(draft.recipient) });
      const { data, error } = await query.select('id, slug, public, published_at').single();
      if (error) throw error;
      return data;
    },
    async revoke(id) {
      const userId = await owner();
      const { data, error } = await client.from('surprises')
        .update({ public: false, published_draft: null, published_at: null, slug: slugify('nossa-historia') })
        .eq('id', id).eq('owner', userId).select('id, slug, public, published_at').single();
      if (error) throw error;
      return data;
    },
    async latest() {
      const userId = await owner();
      const { data, error } = await client.from('surprises').select('id, draft, slug, public, published_at')
        .eq('owner', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, draft: await hydrate(data.draft, userId) };
    },
  };
}
