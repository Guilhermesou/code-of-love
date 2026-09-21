import { mountExperience } from './experience.js';
import { fetchBySlug, cloudEnabled } from './lib/cloud.js';

export async function mountShared(slug, root = document.getElementById('app')) {
  if (!cloudEnabled) { root.innerHTML = '<p class="empty-hint">Este link precisa da nuvem configurada, que ainda não está disponível aqui.</p>'; return; }
  try {
    const draft = await fetchBySlug(slug);
    if (!draft) { root.innerHTML = '<p class="empty-hint">Não encontramos essa surpresa. O link pode estar errado ou não ser mais público.</p>'; return; }
    mountExperience(draft, root);
  } catch { root.innerHTML = '<p class="empty-hint">Não foi possível abrir essa surpresa agora. Confira sua conexão e tente novamente.</p>'; }
}
