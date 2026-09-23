import { gamesPanel, bindGamesEditor } from './games-editor.js';
import { installGames } from './games.js';
import { parseMusic } from './music.js';
import { parsePlace, mapEmbed, coordinates } from './places.js';
import { newDraft, occasions, calendarDays, closing, counterLabel, validate, mediaURL, reviewDraft, normalizeDraft } from './model.js';
import { readDraft, saveDraft } from './store.js';
import { createAutosave } from './lib/autosave.js';
import { mountExperience } from './experience.js';
import { buildGiftHTML } from './export.js';
import { cloudEnabled, getSession, onAuthStateChange, signInWithEmail, signOut, publishSurprise, fetchMyLatest, getPublication, revokeSurprise } from './lib/cloud.js';

const app = document.getElementById('app');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let draft = newDraft(), step = 0, timer, cleanup;
let storageError = false, saveState = 'saved';
let undoRemoval = null;
let session = null, cloudState = null, cloudKnown = false, cloudBusy = false, previewing = false, cloudRevision = 0;
try { const saved = await readDraft(); if (saved?.version === 1) draft = saved; } catch { storageError = true; }
function shareURL(slug) { return location.origin + location.pathname + '?s=' + slug; }
function accountWidget() {
  if (!cloudEnabled) return '';
  if (session) return `<span class="save-state">${esc(session.user.email)}</span><button class="text-button" id="sign-out" ${cloudBusy ? 'disabled' : ''}>Sair</button>`;
  return `<form id="signin-form" class="account-form"><input type="email" id="signin-email" aria-label="Seu e-mail para entrar" autocomplete="email" placeholder="seu@email.com" required><button class="text-button" type="submit" ${cloudBusy ? 'disabled' : ''}>Entrar</button></form>`;
}
function cloudSection() {
  if (!cloudEnabled) return '';
  if (!session) return `<div class="edit-card"><h2>Guardar e compartilhar na nuvem</h2><p class="helper">Entre com seu e-mail no topo da página para salvar um backup na nuvem ou gerar um link para compartilhar.</p></div>`;
  const published = cloudState?.public;
  const link = published ? `<div class="share-link"><label class="field">Link da versão publicada<input readonly id="published-link" value="${esc(shareURL(cloudState.slug))}"></label><button type="button" class="outline" id="copy-link">Copiar link</button><a class="text-button" href="${esc(shareURL(cloudState.slug))}" target="_blank" rel="noopener noreferrer">Abrir surpresa ↗</a><button type="button" class="text-button danger" id="cloud-revoke" ${cloudBusy ? 'disabled' : ''}>Desativar link</button></div>` : '';
  return `<div class="edit-card cloud-section"><h2>Guardar e compartilhar na nuvem</h2><p class="publication-state">${published ? 'Uma versão está disponível pelo link' : cloudKnown ? 'Nenhum link ativo para esta surpresa' : 'O estado do link será confirmado ao salvar ou publicar'}</p><p class="helper">Salvar guarda seu rascunho na conta ${esc(session.user.email)}. A pessoa só recebe suas alterações quando você publica uma atualização.</p><div class="backup-actions"><button type="button" class="outline" id="cloud-save" ${cloudBusy ? 'disabled' : ''}>Salvar rascunho na nuvem</button><button type="button" class="primary" id="cloud-publish" ${cloudBusy || validate(draft).length ? 'disabled' : ''}>${published ? 'Publicar atualização' : cloudKnown ? 'Publicar e gerar link' : 'Publicar versão'}</button><button type="button" class="text-button" id="cloud-restore" ${cloudBusy ? 'disabled' : ''}>Restaurar da nuvem</button></div>${cloudBusy ? '<p class="helper" role="status">Guardando sua surpresa… Aguarde a confirmação.</p>' : ''}${link}<p class="helper">Quem receber o link poderá abrir a versão publicada. Desativar impede novas aberturas; arquivos já carregados ou baixados podem continuar disponíveis.</p></div>`;
}
function cloudError(error) {
  if (error?.message === 'not-authenticated') return 'Entre com seu e-mail para usar a nuvem.';
  if (error?.message === 'invalid-publication') return 'Revise os campos necessários antes de publicar.';
  if (['42703', 'PGRST204', '42P01'].includes(error?.code)) return 'A nuvem precisa ser atualizada antes de salvar. Seu rascunho continua neste navegador.';
  return 'Não foi possível concluir na nuvem. Seu rascunho continua neste navegador. Tente novamente.';
}
async function runCloudAction(action, successMessage) {
  if (cloudBusy) return;
  const revision = ++cloudRevision;
  const id = draft.id;
  const userId = session?.user.id;
  cloudBusy = true; render();
  try {
    const state = await action();
    if (revision === cloudRevision && draft.id === id && session?.user.id === userId) { cloudState = state; cloudKnown = true; }
    notify(successMessage);
  } catch (error) { notify(cloudError(error)); }
  finally { cloudBusy = false; if (!previewing) render(); }
}
async function refreshCloudState() {
  const revision = ++cloudRevision;
  const id = draft.id, userId = session?.user.id;
  cloudState = null; cloudKnown = false;
  if (!userId) return;
  try {
    const state = await getPublication(id);
    if (revision === cloudRevision && draft.id === id && session?.user.id === userId) { cloudState = state; cloudKnown = true; }
  } catch { /* The explicit save action presents actionable errors. */ }
  if (!previewing) render();
}
async function restoreFromCloud() {
  if (cloudBusy) return;
  ++cloudRevision;
  cloudBusy = true; render();
  try {
    const row = await fetchMyLatest();
    if (!row) { notify('Nenhum rascunho salvo na nuvem ainda.'); return; }
    if (!confirm('Restaurar o rascunho da nuvem vai substituir o rascunho atual neste navegador. Deseja continuar?')) return;
    draft = normalizeDraft(row.draft); cloudState = row; cloudKnown = true; undoRemoval = null; persist(); notify('Rascunho restaurado da nuvem.');
  } catch { notify('Não foi possível restaurar da nuvem agora.'); }
  finally { cloudBusy = false; if (!previewing) render(); }
}
const steps = ['Vocês', 'As datas', 'Lembranças', 'Voz & lugares', 'Cartas & final', 'Brincadeiras', 'Entregar'];
const get = path => path.split('.').reduce((obj, key) => obj?.[key], draft);
function set(path, value) { const parts = path.split('.'); const last = parts.pop(); parts.reduce((obj, key) => obj[key], draft)[last] = value; }
function notify(message) { const el = document.getElementById('notice'); el.textContent = message; el.classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => el.classList.remove('visible'), 6500); }
function saveLabel() {
  return storageError ? 'Não foi possível salvar' : saveState === 'saving' ? 'Salvando…' : 'Rascunho salvo neste navegador';
}
const autosave = createAutosave({
  read: () => normalizeDraft(draft),
  write: saveDraft,
  onState(state) {
    saveState = state;
    storageError = state === 'error';
    const el = document.getElementById('save-state');
    if (el) el.textContent = saveLabel();
    if (storageError) notify('Não foi possível salvar neste navegador. Baixe uma cópia do rascunho para guardar seu trabalho.');
  },
});
function persist() { autosave.schedule(); }
// Flush when switching apps; warn if the page is closed during an unfinished save.
document.addEventListener('visibilitychange', () => { if (document.hidden) void autosave.flush(); });
window.addEventListener('pagehide', () => { void autosave.flush(); });
window.addEventListener('beforeunload', event => {
  if (saveState === 'saving' || storageError) { void autosave.flush(); event.preventDefault(); event.returnValue = ''; }
});
function input(path, label, placeholder = '', type = 'text') { const value = get(path); return `<label class="field">${label}<input data-field="${path}" type="${type}" value="${esc(type === 'url' && value?.startsWith('data:') ? '' : value)}" placeholder="${esc(placeholder)}" ${type === 'date' ? 'max="' + localToday() + '"' : ''}></label>`; }
function textarea(path, label, placeholder = '', rows = 4) { return `<label class="field">${label}<textarea rows="${rows}" data-field="${path}" placeholder="${esc(placeholder)}">${esc(get(path))}</textarea></label>`; }
function select(path, label, options) { return `<label class="field">${label}<select data-field="${path}">${Object.entries(options).map(([v, l]) => `<option value="${v}" ${get(path) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`; }
function localToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function upload(path, label, kind = 'image') {
  const value = get(path), src = path === 'music' && parseMusic(value).type !== 'file' ? '' : mediaURL(value, kind);
  return `<div class="upload-wrap">${kind === 'image' && src ? `<img class="upload-thumb" src="${esc(src)}" alt="${esc(label)}">` : ''}${src && kind !== 'image' ? `<div class="editor-media"><${kind} controls preload="metadata" ${kind === 'video' ? 'playsinline' : ''} src="${esc(src)}" aria-label="Conferir ${esc(label)}"></${kind}><p class="helper" data-media-error hidden>Não foi possível abrir este arquivo. Experimente outro formato ou endereço.</p></div>` : ''}<label class="upload"><span class="upload-symbol" aria-hidden="true">${kind === 'image' ? '+' : '♫'}</span><span>${label}<small>${src ? 'Arquivo adicionado · toque para trocar' : kind === 'image' ? 'Escolher uma foto' : 'Escolher um arquivo de ' + (kind === 'audio' ? 'áudio' : 'vídeo')}</small></span><input type="file" accept="${kind}/*" data-upload="${path}" data-kind="${kind}"></label>${src ? `<button class="text-button danger" data-clear="${path}">Remover arquivo</button>` : ''}</div>`;
}
function placePreview(p) {
  const src = mapEmbed(p);
  return src ? `<iframe class="editor-map" title="Conferir ponto no mapa" src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer"></iframe><p class="helper">Confira se este é o lugar certo. O mapa precisa de internet.</p>` : '<p class="helper">O ponto aparecerá aqui antes de entrar na surpresa.</p>';
}
function panel() {
  if (step === 0) return `<span class="eyebrow">01 / os protagonistas</span><h1>Uma história.<br><em>Vocês dois.</em></h1><p class="intro">Comece pelos nomes. O resto a gente prepara, uma lembrança de cada vez.</p><div class="two-fields">${input('recipient', 'Para quem é a surpresa?', 'Nome ou apelido da pessoa')}${input('sender', 'E o seu nome?', 'Como você assina seus bilhetes')}</div>${select('relationship', 'Hoje, vocês estão…', { casados: 'Casados', namorando: 'Namorando', noivos: 'Noivos', juntos: 'Construindo nossa história' })}<div class="editor-note"><span>♡</span><p>O jeito de vocês importa. Os textos vão respeitar a fase atual do casal, mesmo ao celebrar uma data do começo.</p></div><fieldset class="palette"><legend>O tom da surpresa</legend>${['#c4685f', '#b0524f', '#c98a6b', '#a85c6b', '#9caf88'].map((c, i) => `<label style="--swatch:${c}"><input type="radio" name="accent" value="${c}" ${draft.accent === c ? 'checked' : ''}><span class="swatch"></span><span class="sr-only">${['Rosa queimado', 'Vinho', 'Cobre', 'Malva', 'Verde sálvia'][i]}</span></label>`).join('')}<span class="palette-name">Romance cinematográfico</span></fieldset>`;
  if (step === 1) return `<span class="eyebrow">02 / um dia para lembrar</span><h1>Cada começo<br><em>tem uma data.</em></h1><p class="intro">Hoje podemos celebrar o namoro, mesmo depois do casamento. Escolha qual capítulo merece essa surpresa.</p><fieldset class="occasion-picker"><legend>O que vamos celebrar?</legend>${Object.entries(occasions).map(([key, title]) => `<label class="occasion-option"><input type="radio" name="occasion" value="${key}" ${draft.occasion === key ? 'checked' : ''}><span><strong>${title}</strong><small>${{namoro:'O dia em que vocês disseram sim ao namoro.',encontro:'Quando os caminhos de vocês se cruzaram.',casamento:'O começo de uma vida compartilhada.',especial:'Um dia que tem um significado só de vocês.'}[key]}</small></span></label>`).join('')}</fieldset>${draft.occasion === 'especial' ? input('specialLabel', 'Como vocês chamam esse dia?', 'O dia em que…') : ''}<div class="celebration-date">${input('dates.' + draft.occasion, 'Em que dia isso aconteceu?', '', 'date')}<p class="helper">Use a data original, incluindo o ano. Por exemplo: o dia do pedido de namoro, e não o aniversário deste ano.</p><p class="date-feedback" id="date-feedback" aria-live="polite"></p></div><details class="optional-dates"><summary>Outras datas da nossa história <span>opcional</span></summary><p class="helper">Cada uma vira um marco na surpresa. O contador continua usando a ocasião escolhida acima.</p>${Object.entries(occasions).filter(([key]) => key !== draft.occasion && key !== 'especial').map(([key, title]) => input('dates.' + key, title, '', 'date')).join('')}</details>${textarea('opening', 'Uma frase para abrir a surpresa · opcional', 'Deixe em branco para usar a abertura sugerida.', 2)}`;
  if (step === 2) return `<span class="eyebrow">03 / o que ficou na memória</span><h1>Tem coisas que<br><em>a gente guarda.</em></h1><p class="intro">Uma foto, um detalhe, aquele frio na barriga. Conte do seu jeito.</p>${upload('cover', 'A foto de vocês')}${textarea('firstMemory', 'Como foi aquele dia?', 'Onde vocês estavam? O que você sentiu antes de perguntar?')}<div class="section-heading"><h2>O caminho até aqui</h2><button class="text-button" data-add="moments">+ Adicionar momento</button></div>${draft.moments.map((m, i) => `<div class="edit-card"><div class="card-top"><span>LEMBRANÇA ${String(i + 1).padStart(2, '0')}</span><button class="text-button danger" data-remove="moments.${i}" aria-label="Remover lembrança ${i + 1}">Remover</button></div>${input(`moments.${i}.title`, 'Título', 'O nosso primeiro encontro')}${input(`moments.${i}.date`, 'Data · opcional', '', 'date')}${textarea(`moments.${i}.text`, 'A lembrança', 'O detalhe que só vocês dois conhecem.', 3)}${upload(`moments.${i}.photo`, 'Foto desse momento')}</div>`).join('')}${!draft.moments.length ? '<p class="empty-hint">Adicione os momentos que fazem sentido para vocês. Não existe uma quantidade certa.</p>' : ''}`;
  if (step === 3) return `<span class="eyebrow">04 / para sentir de novo</span><h1>Uma música.<br><em>Um lugar. Sua voz.</em></h1><p class="intro">Tudo aqui é opcional. Escolha o que ajuda a contar a história.</p><div class="edit-card"><h2>A trilha de vocês</h2>${upload('music', 'Música de fundo', 'audio')}${input('music', 'Ou cole um link de Spotify, YouTube ou áudio', 'https://open.spotify.com/track/…', 'url')}<button type="button" class="outline" id="check-music">Conferir música</button><div id="music-check"></div><p class="helper">Para tocar dentro da surpresa sem vídeo, envie um arquivo de áudio. Spotify usa seu player oficial. YouTube usa seu player de vídeo na surpresa.</p></div><div class="edit-card"><h2>Uma declaração na sua voz</h2>${upload('voice', 'Seu áudio', 'audio')}</div><div class="edit-card"><h2>Um vídeo especial</h2>${upload('video', 'Vídeo de vocês', 'video')}${input('video', 'Ou um endereço direto de vídeo', 'https://…/video.mp4', 'url')}<p class="helper">Áudio e vídeo até 40 MB por arquivo. A música pausa quando outra mídia começa.</p></div><div class="section-heading"><h2>Os nossos lugares</h2><button class="text-button" data-add="places">+ Adicionar lugar</button></div>${draft.places.map((p, i) => `<div class="edit-card"><div class="card-top"><span>LUGAR ${i + 1}</span><button class="text-button danger" data-remove="places.${i}">Remover</button></div>${input(`places.${i}.name`, 'Nome do lugar', 'O café do nosso primeiro encontro')}<div class="place-picker"><label class="field">Cole o link do lugar ou as coordenadas<input type="text" data-place-link="${i}" placeholder="Link completo do mapa ou -2.8235, -60.6758"></label><button type="button" class="outline" data-locate="${i}">Encontrar no mapa</button><p class="helper" data-place-status="${i}" role="status">No Google Maps, abra o lugar e copie o endereço completo do navegador. Links curtos precisam ser abertos primeiro.</p><a class="text-button" href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">Abrir Google Maps ↗</a><div data-map-preview="${i}">${placePreview(p)}</div><details class="optional-dates"><summary>Ajustar coordenadas manualmente</summary><div class="two-fields">${input(`places.${i}.lat`, 'Latitude', 'Ex.: -2.8235')}${input(`places.${i}.lng`, 'Longitude', 'Ex.: -60.6758')}</div><button type="button" class="outline" data-map-refresh="${i}">Conferir ponto</button></details></div>${input(`places.${i}.date`, 'Data · opcional', '', 'date')}${textarea(`places.${i}.memory`, 'O que aconteceu ali?', '', 2)}${upload(`places.${i}.photo`, 'Foto desse lugar')}</div>`).join('')}`;
  if (step === 4) return `<span class="eyebrow">05 / as palavras que ficam</span><h1>Do seu jeito.<br><em>De coração.</em></h1><p class="intro">Pode ser simples. O que torna especial é ser seu.</p>${textarea('details', 'Pequenas coisas que você ama · uma por linha', 'O jeito que você canta no carro.\nO café que você faz aos domingos.', 3)}${textarea('letter', 'Sua declaração', 'O que você quer dizer hoje?', 6)}<div class="section-heading"><h2>Cartas seladas</h2><button class="text-button" data-add="letters">+ Adicionar carta</button></div>${draft.letters.map((l, i) => `<div class="edit-card"><div class="card-top"><span>CARTA ${i + 1}</span><button class="text-button danger" data-remove="letters.${i}">Remover</button></div>${input(`letters.${i}.title`, 'Abra quando…', 'Sentir saudade')}${textarea(`letters.${i}.text`, 'O carinho guardado aqui', '', 4)}</div>`).join('')}<h2 class="subheading">O nosso próximo capítulo</h2><blockquote>${esc(closing(draft)).replaceAll('\n', '<br>')}</blockquote>${input('question', 'Pergunta final', 'Vamos continuar escrevendo a nossa história?')}${input('answer', 'Texto do botão', 'Sempre, meu amor')}${textarea('after', 'Depois do toque', '', 2)}`;
  if (step === 5) return gamesPanel(draft);
  const review = reviewDraft(draft);
  const issues = review.filter(item => item.required);
  return `<span class="eyebrow">07 / o momento de entregar</span><h1>Feito por você.<br><em>Só para vocês.</em></h1><p class="intro">Veja a experiência completa antes de guardar a surpresa.</p><div class="delivery-card"><span class="delivery-heart">♡</span><h2>${esc(draft.recipient || 'Seu amor')} & ${esc(draft.sender || 'você')}</h2><p>${esc(occasions[draft.occasion])}</p><button class="primary" id="preview-final">Abrir a prévia completa</button></div>${review.length ? `<div class="validation"><h3>${issues.length ? 'Falta só um carinho…' : 'Antes de entregar'}</h3><ul class="review-list">${review.map(item => `<li><span>${item.required ? 'Necessário' : 'Confira'} · ${esc(item.message)}</span><button type="button" class="text-button" data-step="${item.step}">Ajustar →</button></li>`).join('')}</ul></div>` : '<p class="ready-text">Tudo pronto para baixar a sua surpresa.</p>'}<button class="primary wide" id="download-gift" ${issues.length ? 'disabled' : ''}>Baixar surpresa em HTML <span>↓</span></button><p class="helper">O arquivo leva seus textos e arquivos enviados. Links externos e mapas precisam de internet.${cloudEnabled ? '' : ' Não há um link publicado nesta versão.'}</p>${cloudSection()}<div class="backup-actions"><button class="text-button" id="backup">Salvar cópia do rascunho</button><label class="text-button import-label">Restaurar cópia<input type="file" id="restore" accept="application/json,.json"></label></div><p class="helper">A cópia permite continuar editando em outro navegador. Guarde-a com cuidado: ela contém as fotos e mensagens adicionadas.</p>`;
}
function preview() {
  const el = document.getElementById('mini-preview'); if (!el) return;
  const days = calendarDays(draft.dates[draft.occasion]);
  el.style.setProperty('--accent', draft.accent);
  el.innerHTML = `<div class="phone-top"><span>uma surpresa para</span><span>♡</span></div><div class="mini-content"><p class="eyebrow">${esc(draft.recipient || 'seu amor')}</p><h2>${esc(draft.recipient || 'Você')}<em>&</em>${esc(draft.sender || 'seu amor')}</h2>${mediaURL(draft.cover) ? `<img class="mini-photo" src="${esc(mediaURL(draft.cover))}" alt="Foto de capa da surpresa">` : '<div class="mini-placeholder"><span>♡</span><p>A foto de vocês<br>ganha este lugar.</p></div>'}<p class="mini-quote">${esc(draft.firstMemory || 'Algumas histórias merecem ser guardadas com carinho.')}</p>${days !== null ? `<div class="mini-counter"><strong>${days.toLocaleString('pt-BR')}</strong><span>dias ${esc(counterLabel(draft))}</span></div>` : '<div class="mini-rule"></div>'}<p class="mini-signature">com amor, ${esc(draft.sender || 'você')}</p></div>`;
}
function render() {
  app.innerHTML = `<div class="creator" style="--accent:${draft.accent}"><header class="topbar"><a class="brand" href="./" aria-label="Código do Amor, início"><span>&lt;</span> Código do amor <span>/&gt;</span></a><span class="save-state" id="save-state">${saveLabel()}</span>${accountWidget()}<button class="outline" id="preview-top">Ver surpresa <span>↗</span></button></header><div class="workspace"><aside class="sidebar"><p class="eyebrow">prepare sua surpresa</p><nav aria-label="Etapas da criação">${steps.map((title, i) => `<button data-step="${i}" class="step ${i === step ? 'active' : ''}" ${i === step ? 'aria-current="step"' : ''}><span class="step-index">${String(i + 1).padStart(2, '0')}</span>${title}${i === step ? '<span class="step-dot">•</span>' : ''}</button>`).join('')}</nav><div class="sidebar-footer"><span>feito para sentir.</span><p>O amor está nos detalhes.</p></div></aside><main class="editor"><form id="editor-form" novalidate><fieldset class="editor-fields" ${cloudBusy ? 'disabled' : ''}>${panel()}</fieldset></form>${undoRemoval ? '<div class="undo-removal" role="status"><span>Conteúdo removido.</span><button type="button" class="text-button" id="undo-removal">Desfazer</button></div>' : ''}<footer class="editor-navigation"><button class="text-button" id="back" ${step === 0 ? 'disabled' : ''}>← Voltar</button><span>${step + 1} de ${steps.length}</span>${step < steps.length - 1 ? '<button class="primary" id="next">Continuar <span>→</span></button>' : '<button class="outline" id="review">Revisar do começo</button>'}</footer></main><aside class="preview-panel"><div class="preview-heading"><span class="eyebrow">um pedacinho da surpresa</span><span class="live-badge">PRÉVIA</span></div><div class="phone" id="mini-preview"></div><button class="text-button" id="preview-side">Abrir a experiência completa ↗</button><p class="preview-footnote">Cada detalhe vai ganhando a cara de vocês.</p></aside></div></div>`;
  preview();
  dateFeedback();
  document.getElementById('editor-form').onsubmit = e => e.preventDefault();
  app.querySelectorAll('[data-field]').forEach(el => el.addEventListener('input', () => { set(el.dataset.field, el.value); persist(); preview(); dateFeedback(); if (['occasion', 'relationship'].includes(el.dataset.field)) render(); }));
  if (step === 5) {
    bindGamesEditor(app, draft, { persist, render, removed: undo => { undoRemoval = undo; } });
    document.getElementById('preview-games').onclick = () => showPreview(true);
  }
  app.querySelectorAll('[data-locate]').forEach(button => button.onclick = () => {
    const i = Number(button.dataset.locate), field = app.querySelector(`[data-place-link="${i}"]`), status = app.querySelector(`[data-place-status="${i}"]`);
    const point = parsePlace(field.value);
    if (!point) { status.textContent = 'Não encontrei um ponto neste link. Abra o link curto no navegador e copie o endereço completo do lugar, ou cole as coordenadas juntas. O ponto anterior foi mantido.'; field.setAttribute('aria-invalid', 'true'); return; }
    Object.assign(draft.places[i], point); persist();
    field.removeAttribute('aria-invalid');
    for (const key of ['lat', 'lng']) app.querySelector(`[data-field="places.${i}.${key}"]`).value = point[key];
    app.querySelector(`[data-map-preview="${i}"]`).innerHTML = placePreview(draft.places[i]);
    status.textContent = 'Ponto encontrado e salvo. Confira o mapa abaixo.';
  });
  app.querySelectorAll('[data-map-refresh]').forEach(button => button.onclick = () => {
    const i = Number(button.dataset.mapRefresh);
    app.querySelector(`[data-map-preview="${i}"]`).innerHTML = placePreview(draft.places[i]);
    app.querySelector(`[data-place-status="${i}"]`).textContent = coordinates(draft.places[i].lat, draft.places[i].lng) ? 'Ponto atualizado. Confira o mapa.' : 'Confira as coordenadas: latitude de -90 a 90 e longitude de -180 a 180.';
  });
  app.querySelectorAll('[name="occasion"]').forEach(el => el.onchange = () => { draft.occasion = el.value; persist(); render(); app.querySelector('[name="occasion"]:checked')?.focus(); });
  app.querySelectorAll('[name="accent"]').forEach(el => el.onchange = () => { draft.accent = el.value; persist(); render(); });
  app.querySelectorAll('[data-step]').forEach(el => el.onclick = () => navigate(Number(el.dataset.step)));
  app.querySelectorAll('[data-add]').forEach(el => el.onclick = e => { e.preventDefault(); const key = el.dataset.add; draft[key].push(key === 'moments' ? { title: '', date: '', text: '', photo: '' } : key === 'places' ? { name: '', lat: '', lng: '', date: '', memory: '', photo: '' } : { title: '', text: '' }); persist(); render(); const cards = app.querySelectorAll('.edit-card'); cards[cards.length - 1]?.querySelector('input')?.focus(); });
  app.querySelectorAll('[data-remove]').forEach(el => el.onclick = e => { e.preventDefault(); const [key, i] = el.dataset.remove.split('.'); const index = Number(i); const [item] = draft[key].splice(index, 1); undoRemoval = () => draft[key].splice(Math.min(index, draft[key].length), 0, item); persist(); render(); });
  app.querySelectorAll('[data-clear]').forEach(el => el.onclick = e => { e.preventDefault(); const path = el.dataset.clear, value = get(path); set(path, ''); undoRemoval = () => set(path, value); persist(); render(); });
  app.querySelectorAll('[data-upload]').forEach(el => el.onchange = async () => {
    const file = el.files[0]; if (!file) return;
    if (!file.type.startsWith(el.dataset.kind + '/') || file.type === 'image/svg+xml') { notify('Escolha um arquivo compatível. Para fotos, use JPG, PNG ou WebP.'); return; }
    if (file.size > 40 * 1024 * 1024) { notify('Este arquivo é muito grande. Escolha um arquivo de até 40 MB.'); return; }
    try { const value = el.dataset.kind === 'image' ? await resizePhoto(file) : await dataURL(file); set(el.dataset.upload, value); persist(); render(); notify('Arquivo adicionado.'); } catch { notify('Não foi possível abrir o arquivo. Tente outro formato.'); }
  });
  const checkMusic = document.getElementById('check-music');
  if (checkMusic) checkMusic.onclick = () => {
    app.querySelectorAll('audio,video').forEach(media => media.pause());
    const info = parseMusic(draft.music), container = document.getElementById('music-check');
    container.innerHTML = info.type === 'spotify' ? `<iframe class="spotify-player" title="Conferir música no Spotify" src="${esc(info.embed)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe><p class="helper">A reprodução disponível é definida pelo Spotify.</p><a class="text-button" href="${esc(info.url)}" target="_blank" rel="noopener noreferrer">Ouvir no Spotify ↗</a>` : info.type === 'youtube' ? `<iframe class="youtube-player" title="Conferir música no YouTube" src="${esc(info.embed)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe><p class="helper">Na surpresa, o vídeo só toca quando a pessoa escolher abrir.</p><a class="text-button" href="${esc(info.url)}" target="_blank" rel="noopener noreferrer">Ouvir no YouTube ↗</a>` : info.type === 'file' ? `<audio controls src="${esc(info.url)}" aria-label="Conferir música"></audio>` : '<p class="helper" role="status">Adicione um arquivo de áudio ou um link completo válido.</p>';
    container.querySelector('audio')?.addEventListener('play', () => app.querySelectorAll('.editor-media audio,.editor-media video').forEach(media => media.pause()));
  };
  const undo = document.getElementById('undo-removal'); if (undo) undo.onclick = () => { undoRemoval(); undoRemoval = null; persist(); render(); };
  const editorMedia = [...app.querySelectorAll('.editor-media audio, .editor-media video')];
  editorMedia.forEach(media => { media.onplay = () => { editorMedia.forEach(other => { if (other !== media) other.pause(); }); document.getElementById('music-check')?.replaceChildren(); }; media.onerror = () => { media.parentElement.querySelector('[data-media-error]').hidden = false; }; });
  ['preview-top', 'preview-side', 'preview-final'].forEach(id => { const el = document.getElementById(id); if (el) el.onclick = e => { e.preventDefault(); showPreview(); }; });
  document.getElementById('back').onclick = () => navigate(step - 1);
  const next = document.getElementById('next'); if (next) next.onclick = () => navigate(step + 1);
  const review = document.getElementById('review'); if (review) review.onclick = () => navigate(0);
  const download = document.getElementById('download-gift'); if (download) download.onclick = exportGift;
  const backup = document.getElementById('backup'); if (backup) backup.onclick = () => downloadFile(JSON.stringify(draft), 'codigo-do-amor-rascunho.json', 'application/json');
  const restore = document.getElementById('restore'); if (restore) restore.onchange = restoreDraft;
  const signinForm = document.getElementById('signin-form');
  if (signinForm) signinForm.onsubmit = async e => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim(); if (!email) return;
    cloudBusy = true; render();
    try { await signInWithEmail(email); notify('Enviamos um link de acesso para ' + email + '. Confira seu e-mail.'); }
    catch { notify('Não foi possível enviar o link agora. Tente de novo.'); }
    finally { cloudBusy = false; if (!previewing) render(); }
  };
  const signOutBtn = document.getElementById('sign-out'); if (signOutBtn) signOutBtn.onclick = () => signOut().then(() => notify('Você saiu da conta.')).catch(error => notify(cloudError(error)));
  const cloudSave = document.getElementById('cloud-save'); if (cloudSave) cloudSave.onclick = () => runCloudAction(() => publishSurprise(draft), 'Rascunho salvo na nuvem.');
  const cloudPublish = document.getElementById('cloud-publish'); if (cloudPublish) cloudPublish.onclick = () => { if (validate(draft).length) { notify(validate(draft)[0]); return; } return runCloudAction(() => publishSurprise(draft, { makePublic: true }), 'Versão publicada. Copie o link abaixo para entregar.'); };
  const cloudRestore = document.getElementById('cloud-restore'); if (cloudRestore) cloudRestore.onclick = restoreFromCloud;
  const copyLink = document.getElementById('copy-link');
  if (copyLink) copyLink.onclick = async () => {
    const field = document.getElementById('published-link');
    try { await navigator.clipboard.writeText(field.value); notify('Link copiado. Pronto para entregar.'); }
    catch { field.focus(); field.select(); notify('Selecione e copie o link destacado.'); }
  };
  const revoke = document.getElementById('cloud-revoke');
  if (revoke) revoke.onclick = () => {
    if (confirm('Desativar este link? Você poderá publicar novamente com um novo endereço.'))
      void runCloudAction(() => revokeSurprise(draft.id), 'Link desativado. Uma nova publicação terá outro endereço.');
  };
}
function dateFeedback() {
  const feedback = document.getElementById('date-feedback'); if (!feedback) return;
  const value = draft.dates[draft.occasion], days = calendarDays(value);
  feedback.textContent = !value ? 'Essa é a data que dá vida ao contador.' : days === null ? 'Confira a data: ela precisa ser válida e não pode estar no futuro.' : `${days.toLocaleString('pt-BR')} dias ${counterLabel(draft)}.`;
  feedback.classList.toggle('invalid', !!value && days === null);
}
function navigate(index) { void autosave.flush(); step = Math.max(0, Math.min(steps.length - 1, index)); render(); window.scrollTo(0, 0); app.querySelector('main h1').tabIndex = -1; app.querySelector('main h1').focus(); }
function showPreview(gamesOnly = false) {
  void autosave.flush();
  const scroll = window.scrollY;
  previewing = true;
  app.innerHTML = '<div class="preview-toolbar"><button class="outline" id="close-preview">← Voltar à edição</button><span>Prévia da surpresa</span></div><div id="experience-root"></div>';
  const root = document.getElementById('experience-root');
  if (gamesOnly) {
    root.innerHTML = `<div class="experience" style="--accent:${draft.accent}"><article class="gift-story"><section class="gift-section in-view"><p class="eyebrow">prévia das brincadeiras</p><h2>Uma pausa para sorrir.</h2><div id="games-root"></div></section></article></div>`;
    cleanup = installGames(draft, root.querySelector('#games-root'));
  } else cleanup = mountExperience(draft, root);
  window.scrollTo(0, 0);
  document.getElementById('close-preview').onclick = () => { previewing = false; cleanup(); render(); window.scrollTo(0, scroll); };
}
function dataURL(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
let webpSupport;
function supportsWebP() {
  if (webpSupport === undefined) { const c = document.createElement('canvas'); c.width = c.height = 1; webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp'); }
  return webpSupport;
}
async function resizePhoto(file) {
  const image = await createImageBitmap(file); const ratio = Math.min(1, 1800 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
  const format = supportsWebP() ? 'image/webp' : 'image/jpeg';
  let quality = .86, url = canvas.toDataURL(format, quality);
  while (url.length * .75 > 700 * 1024 && quality > .55) { quality -= .08; url = canvas.toDataURL(format, quality); }
  return url;
}
function downloadFile(content, name, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function exportGift() {
  const issues = validate(draft); if (issues.length) { notify(issues[0]); return; }
  try {
    const response = await fetch('style.css'); if (!response.ok) throw Error(); const css = await response.text();
    const html = buildGiftHTML(draft, css);
    downloadFile(html, 'nossa-historia.html', 'text/html'); notify('Surpresa baixada. Abra o arquivo no navegador para conferir.');
  } catch { notify('Não foi possível preparar o arquivo. Tente novamente.'); }
}
async function restoreDraft(e) {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 180 * 1024 * 1024) throw Error();
    const value = normalizeDraft(JSON.parse(await file.text()));
    if (!confirm('Restaurar esta cópia vai substituir o rascunho atual neste navegador. Deseja continuar?')) return;
    draft = value; cloudState = null; cloudKnown = false; undoRemoval = null; persist(); render(); if (session) void refreshCloudState(); notify('Rascunho restaurado.');
  } catch { notify('Não foi possível restaurar. Escolha uma cópia válida do Código do Amor.'); }
}
if (cloudEnabled) {
  let knownUser;
  const onSession = value => {
    session = value;
    const userId = value?.user.id;
    if (knownUser !== userId) { knownUser = userId; void refreshCloudState(); }
    if (!previewing) render();
  };
  getSession().then(onSession).catch(() => {});
  onAuthStateChange(onSession).catch(() => {});
}
render();
if (storageError) notify('O salvamento neste navegador está indisponível. Use a cópia do rascunho na etapa Entregar.');
