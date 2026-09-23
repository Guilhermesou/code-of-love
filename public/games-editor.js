import { getGameContent, reviewGames } from './game-model.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function gamesPanel(draft) {
  const games = draft.games;
  const field = (path, label, value, max, placeholder = '') => `<label class="field">${label}<input data-field="${path}" value="${esc(value)}" maxlength="${max}" placeholder="${esc(placeholder)}"></label>`;
  const area = (path, label, value, max, placeholder = '') => `<label class="field">${label}<textarea data-field="${path}" rows="3" maxlength="${max}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
  const toggle = (key, title, description, icon) => `<label class="game-enable"><input type="checkbox" data-game-toggle="${key}" ${games[key].enabled ? 'checked' : ''}><span class="game-symbol" aria-hidden="true">${icon}</span><span><strong>${title}</strong><small>${description}</small></span></label>`;
  const photos = getGameContent(draft).photos;
  return `<span class="eyebrow">06 / brincar de lembrar</span><h1>Um sorriso.<br><em>Uma descoberta.</em></h1><p class="intro">Escolha as brincadeiras que combinam com vocês. Todas são opcionais, sem tempo para acabar e sem impedir a leitura da surpresa.</p>
    <div class="edit-card game-editor-card">${toggle('quiz', 'Quiz da nossa história', 'Uma pergunta, uma lembrança revelada.', '?')}
      ${games.quiz.enabled ? `<div class="game-settings"><p class="helper">De 1 a 5 perguntas. Preencha duas alternativas; a terceira é opcional. Cada resposta revela seu carinho, mesmo quando a pessoa não acerta.</p>
      ${games.quiz.questions.map((q, i) => `<div class="game-question-editor"><div class="card-top"><span>PERGUNTA ${i + 1}</span><button type="button" class="text-button danger" data-game-remove="quiz.${i}" aria-label="Remover pergunta ${i + 1}">Remover</button></div>
        ${field(`games.quiz.questions.${i}.prompt`, `Pergunta ${i + 1}`, q.prompt, 300, 'Onde foi o nosso primeiro encontro?')}
        ${q.answers.map((answer, j) => field(`games.quiz.questions.${i}.answers.${j}`, `Alternativa ${j + 1}${j === 2 ? ' · opcional' : ''}`, answer, 200)).join('')}
        <label class="field">Resposta certa da pergunta ${i + 1}<select data-game-correct="${i}">${q.answers.map((_, j) => `<option value="${j}" ${q.correct === j ? 'selected' : ''}>Alternativa ${j + 1}</option>`).join('')}</select></label>
        ${area(`games.quiz.questions.${i}.reveal`, 'Lembrança revelada · opcional', q.reveal, 2000, 'Eu ainda lembro do seu sorriso naquele dia…')}</div>`).join('')}
      <button type="button" class="outline" data-game-add="quiz" ${games.quiz.questions.length >= 5 ? 'disabled' : ''}>+ Adicionar pergunta</button></div>` : ''}
    </div>
    <div class="edit-card game-editor-card">${toggle('memory', 'Memória com nossas fotos', 'Encontre os pares dos momentos de vocês.', '♡')}
      ${games.memory.enabled ? `<div class="game-settings"><p class="helper">Usa as primeiras ${photos.length < 6 ? 'até 6' : '6'} fotos diferentes: capa, lembranças e lugares, nessa ordem. São necessários pelo menos 2 pares.</p><div class="memory-photo-preview">${photos.map(photo => `<img src="${esc(photo.src)}" alt="${esc(photo.label)}">`).join('')}</div><p class="helper">${photos.length} de 6 fotos disponíveis para o jogo.</p><button type="button" class="text-button" data-step="2">Adicionar fotos nas lembranças →</button>${area('games.memory.message', 'Mensagem ao encontrar todos os pares · opcional', games.memory.message, 500, 'Cada lembrança encontra seu par. E eu continuo escolhendo você.')}</div>` : ''}
    </div>
    <div class="edit-card game-editor-card">${toggle('date', 'Nosso próximo encontro', 'Dois ou três convites. A pessoa escolhe o favorito.', '↗')}
      ${games.date.enabled ? `<div class="game-settings"><p class="helper">Prepare de 2 a 3 opções. A escolha aparece na surpresa e pode ser copiada; ela não é enviada automaticamente para você.</p>${games.date.options.map((option, i) => `<div class="game-question-editor"><div class="card-top"><span>CONVITE ${i + 1}</span><button type="button" class="text-button danger" data-game-remove="date.${i}" aria-label="Remover convite ${i + 1}">Remover</button></div>${field(`games.date.options.${i}.title`, `Título do convite ${i + 1}`, option.title, 120, 'Um piquenique ao pôr do sol')}${area(`games.date.options.${i}.detail`, 'O convite que será revelado · opcional', option.detail, 1000, 'Eu levo a nossa música e preparo tudo para nós.')}</div>`).join('')}<button type="button" class="outline" data-game-add="date" ${games.date.options.length >= 3 ? 'disabled' : ''}>+ Adicionar convite</button></div>` : ''}
    </div><div id="game-review" aria-live="polite"></div><button type="button" class="outline" id="preview-games">Experimentar as brincadeiras ↗</button><p class="helper">A prévia mostra os jogos que já estiverem prontos. Você pode desativar um jogo e manter seu conteúdo para depois.</p>`;
}

export function bindGamesEditor(root, draft, { persist, render, removed }) {
  const refresh = () => {
    const el = root.querySelector('#game-review');
    if (!el) return;
    const issues = reviewGames(draft);
    el.innerHTML = issues.length ? `<div class="validation"><h3>Para deixar tudo pronto</h3><ul>${issues.map(message => `<li>${esc(message)}</li>`).join('')}</ul></div>` : `<p class="ready-text">${Object.values(draft.games).some(game => game.enabled) ? 'As brincadeiras selecionadas estão prontas para a prévia.' : 'Nenhuma brincadeira ativada. Sua surpresa pode seguir só com a história.'}</p>`;
  };
  root.querySelectorAll('[data-game-toggle]').forEach(el => el.onchange = () => {
    const key = el.dataset.gameToggle;
    draft.games[key].enabled = el.checked;
    if (el.checked && key === 'quiz' && !draft.games.quiz.questions.length) draft.games.quiz.questions.push({ prompt: '', answers: ['', '', ''], correct: 0, reveal: '' });
    if (el.checked && key === 'date' && !draft.games.date.options.length) draft.games.date.options.push({ title: '', detail: '' }, { title: '', detail: '' });
    persist(); render(); root.querySelector(`[data-game-toggle="${key}"]`)?.focus();
  });
  root.querySelectorAll('[data-game-correct]').forEach(el => el.onchange = () => { draft.games.quiz.questions[Number(el.dataset.gameCorrect)].correct = Number(el.value); persist(); refresh(); });
  root.querySelectorAll('[data-game-add]').forEach(el => el.onclick = () => {
    const key = el.dataset.gameAdd, list = key === 'quiz' ? draft.games.quiz.questions : draft.games.date.options;
    if (list.length >= (key === 'quiz' ? 5 : 3)) return;
    list.push(key === 'quiz' ? { prompt: '', answers: ['', '', ''], correct: 0, reveal: '' } : { title: '', detail: '' });
    removed(null); persist(); render();
    const path = key === 'quiz' ? `games.quiz.questions.${list.length - 1}.prompt` : `games.date.options.${list.length - 1}.title`;
    root.querySelector(`[data-field="${path}"]`)?.focus();
  });
  root.querySelectorAll('[data-game-remove]').forEach(el => el.onclick = () => {
    const [key, index] = el.dataset.gameRemove.split('.'), i = Number(index);
    const list = key === 'quiz' ? draft.games.quiz.questions : draft.games.date.options;
    const [item] = list.splice(i, 1);
    removed(() => list.splice(Math.min(i, list.length), 0, item)); persist(); render();
    root.querySelector(`[data-game-add="${key}"]`)?.focus();
  });
  root.querySelectorAll('[data-field^="games."]').forEach(el => el.addEventListener('input', refresh));
  refresh();
}
