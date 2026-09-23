import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-config.js';
import { createCloudRepository } from './cloud-repository.js';
import { normalizeDraft } from '../model.js';

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let clientPromise, repository;
export function getClient() {
  if (!cloudEnabled) return null;
  if (!clientPromise) clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return clientPromise;
}
async function repo() {
  if (!repository) repository = createCloudRepository(await getClient());
  return repository;
}
export async function signInWithEmail(email) {
  const client = await getClient();
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
export async function signOut() {
  const client = await getClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
export async function getSession() {
  const client = await getClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}
export async function onAuthStateChange(callback) {
  const client = await getClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
export async function publishSurprise(draft, options) { return (await repo()).save(draft, options); }
export async function getPublication(id) { return (await repo()).getPublication(id); }
export async function revokeSurprise(id) { return (await repo()).revoke(id); }
export async function fetchMyLatest() { return (await repo()).latest(); }
export async function fetchBySlug(slug) {
  const client = await getClient();
  const { data, error } = await client.functions.invoke('shared-surprise', { body: { slug } });
  if (error) throw error;
  return data?.draft ? normalizeDraft(data.draft) : null;
}
