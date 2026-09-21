import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-config.js';
import { slugify, isDataURL, collectMediaEntries, setPath, extensionFor } from './slug.js';

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise;
export function getClient() {
  if (!cloudEnabled) return null;
  if (!clientPromise) clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return clientPromise;
}

export async function signInWithEmail(email) {
  const client = await getClient();
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
export async function signOut() {
  const client = await getClient();
  await client.auth.signOut();
}
export async function getSession() {
  const client = await getClient();
  const { data } = await client.auth.getSession();
  return data.session;
}
export async function onAuthStateChange(callback) {
  const client = await getClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

async function dataURLToBlob(value) {
  const response = await fetch(value);
  return response.blob();
}

export async function uploadMediaFields(client, userId, draft) {
  const clone = structuredClone(draft);
  for (const entry of collectMediaEntries(clone)) {
    if (!isDataURL(entry.value)) continue;
    const blob = await dataURLToBlob(entry.value);
    const path = `${userId}/${draft.id}/${entry.path.replace(/\./g, '-')}.${extensionFor(entry.value)}`;
    const { error } = await client.storage.from('media').upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw error;
    const { data } = client.storage.from('media').getPublicUrl(path);
    setPath(clone, entry.path, data.publicUrl);
  }
  return clone;
}

export async function publishSurprise(draft, { makePublic = false } = {}) {
  const client = await getClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('not-authenticated');
  const uploaded = await uploadMediaFields(client, session.user.id, draft);
  const slug = draft.cloudSlug || slugify(draft.recipient);
  // A plain "save" must never un-publish a link that is already out in the world
  // (e.g. printed as a QR code), so it keeps whatever public/private state exists.
  let isPublic = makePublic;
  if (!isPublic) {
    const { data: existing } = await client.from('surprises').select('public').eq('id', draft.id).maybeSingle();
    isPublic = existing?.public ?? false;
  }
  const { error } = await client.from('surprises').upsert({
    id: draft.id, owner: session.user.id, slug, draft: uploaded, public: isPublic, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return slug;
}

export async function fetchBySlug(slug) {
  const client = await getClient();
  const { data, error } = await client.from('surprises').select('draft').eq('slug', slug).eq('public', true).maybeSingle();
  if (error) throw error;
  return data?.draft ?? null;
}

export async function fetchMyLatest() {
  const client = await getClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('not-authenticated');
  const { data, error } = await client.from('surprises').select('draft, slug').eq('owner', session.user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ?? null;
}
