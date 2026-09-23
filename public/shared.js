import { mountExperience } from './experience.js';
import { fetchBySlug, cloudEnabled } from './lib/cloud.js';

export async function mountShared(slug, root = document.getElementById('app')) {
  if (!cloudEnabled) { root.innerHTML = '<p class="empty-hint">Este link precisa da nuvem configurada, que ainda não está disponível aqui.</p>'; return; }
  root.innerHTML = '<p class="empty-hint" role="status">Preparando uma surpresa para você…</p>';
  try {
    const draft = await fetchBySlug(slug);
    if (!draft) { root.innerHTML = '<p class="empty-hint">Não encontramos essa surpresa. O link pode estar errado ou não ser mais público.</p>'; return; }
    mountExperience(draft, root);
  } catch {
    root.innerHTML = '<div class="shared-error"><p class="empty-hint" role="status">Não foi possível abrir essa surpresa agora. Confira sua conexão e tente novamente.</p><button type="button" class="outline">Tentar novamente</button></div>';
    root.querySelector('button').onclick = () => mountShared(slug, root);
  }
}
