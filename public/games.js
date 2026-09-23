import { getGameContent } from './game-model.js';

// Self-contained except for getGameContent, which is bundled alongside it in HTML exports.
export function installGames(draft, root) {
  if (!root) return () => {};
  const content = getGameContent(draft);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let disposed = false;
  const focus = element => { element?.focus({ preventScroll: true }); };
  const block = (key, title, subtitle, symbol) => `<section class="game-block" data-game="${key}" aria-labelledby="game-title-${key}"><div class="game-block-heading"><span class="game-symbol" aria-hidden="true">${symbol}</span><div><h3 id="game-title-${key}" tabindex="-1">${title}</h3><p class="helper">${subtitle}</p></div></div><div class="game-body"></div><button type="button" class="text-button game-skip" aria-expanded="true">Pular ${key === 'quiz' ? 'quiz' : key === 'memory' ? 'jogo da memória' : 'escolha do encontro'}</button></section>`;
  root.innerHTML = `${content.quiz.length ? block('quiz', 'Você lembra?', 'Pequenos detalhes da nossa história. Sem pontuação, só carinho.', '?') : ''}${content.memory.length ? block('memory', 'Lembranças que se encontram.', 'Vire duas cartas e encontre os pares. Jogue no seu tempo.', '♡') : ''}${content.date.length ? block('date', 'Nosso próximo encontro.', 'Qual destes convites tem mais a nossa cara?', '↗') : ''}`;
  if (!root.children.length) root.innerHTML = '<p class="empty-hint">Ative e complete uma brincadeira no editor para experimentar aqui.</p>';
  root.querySelectorAll('.game-block').forEach(section => {
    const body = section.querySelector('.game-body'), skip = section.querySelector('.game-skip');
    const label = skip.textContent;
    body.id = `game-body-${section.dataset.game}`;
    skip.setAttribute('aria-controls', body.id);
    skip.onclick = () => {
      body.hidden = !body.hidden;
      skip.textContent = body.hidden ? 'Retomar brincadeira' : label;
      skip.setAttribute('aria-expanded', String(!body.hidden));
      if (!body.hidden) focus(section.querySelector('h3'));
    };
  });

  const quiz = root.querySelector('[data-game="quiz"] .game-body');
  if (quiz) {
    let current = 0;
    const renderQuestion = (moveFocus = false) => {
      if (disposed) return;
      if (current === content.quiz.length) {
        quiz.innerHTML = '<div class="game-reveal" tabindex="-1"><span aria-hidden="true">♡</span><h4>O melhor é lembrar com você.</h4><p>Cada resposta é um pedacinho da nossa história.</p></div><button type="button" class="outline game-replay">Jogar o quiz novamente</button>';
        quiz.querySelector('.game-replay').onclick = () => { current = 0; renderQuestion(true); };
        focus(quiz.querySelector('.game-reveal')); return;
      }
      const question = content.quiz[current];
      let answered = false;
      quiz.innerHTML = `<p class="game-progress">Lembrança ${current + 1} de ${content.quiz.length}</p><h4 class="quiz-prompt" tabindex="-1">${esc(question.prompt)}</h4><div class="game-options" role="group" aria-label="Alternativas">${question.answers.map((answer, i) => `<button type="button" class="game-option" data-answer="${i}"><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${esc(answer.text)}</span></button>`).join('')}</div><div class="game-feedback" role="status" aria-live="polite" aria-atomic="true"></div><button type="button" class="outline quiz-next" hidden>${current + 1 === content.quiz.length ? 'Concluir quiz' : 'Próxima lembrança →'}</button>`;
      quiz.querySelectorAll('[data-answer]').forEach(button => button.onclick = () => {
        if (answered || disposed) return;
        answered = true;
        const chosen = Number(button.dataset.answer), correct = question.answers.find(answer => answer.correct);
        quiz.querySelectorAll('[data-answer]').forEach(option => {
          option.setAttribute('aria-disabled', 'true');
          option.classList.toggle('is-selected', option === button);
        });
        quiz.querySelector('.game-feedback').innerHTML = `<div class="game-reveal"><p class="game-feedback-title">${question.answers[chosen].correct ? 'Você lembrou! ♡' : `A lembrança que guardei foi: ${esc(correct.text)}.`}</p>${question.reveal ? `<p class="prose">${esc(question.reveal)}</p>` : '<p>O que importa é a história que vivemos juntos.</p>'}</div>`;
        quiz.querySelector('.quiz-next').hidden = false;
      });
      quiz.querySelector('.quiz-next').onclick = () => { if (!answered) return; current++; renderQuestion(true); };
      if (moveFocus) focus(quiz.querySelector('.quiz-prompt'));
    };
    renderQuestion();
  }

  const memory = root.querySelector('[data-game="memory"] .game-body');
  if (memory) {
    let deck, opened, matched;
    const start = (moveFocus = false) => {
      deck = content.memory.flatMap((photo, pair) => [{ ...photo, pair }, { ...photo, pair }]);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      opened = []; matched = new Set();
      memory.innerHTML = `<p class="game-progress memory-progress">0 de ${content.memory.length} pares encontrados</p><div class="memory-grid" data-pairs="${content.memory.length}" role="group" aria-label="Cartas do jogo da memória">${deck.map((photo, i) => `<button type="button" class="memory-card" data-card="${i}" aria-label="Carta ${i + 1}, virada para baixo" aria-pressed="false"><span class="memory-back" aria-hidden="true">♡</span><span class="memory-front" aria-hidden="true"><img src="${esc(photo.src)}" alt="" loading="lazy"><span class="memory-caption">Lembrança ${photo.pair + 1}</span></span></button>`).join('')}</div><p class="memory-status helper" role="status" aria-live="polite" aria-atomic="true">Escolha duas cartas.</p><div class="game-reveal memory-reward" tabindex="-1" hidden><p class="prose">${esc(content.memoryMessage)}</p></div><div class="game-actions"><button type="button" class="outline memory-again" hidden>Virar novamente</button><button type="button" class="text-button memory-restart">Recomeçar a memória</button></div>`;
      memory.querySelectorAll('img').forEach(img => img.onerror = () => { img.hidden = true; });
      const cards = [...memory.querySelectorAll('[data-card]')];
      const sync = () => {
        cards.forEach((card, i) => {
          const found = matched.has(deck[i].pair), revealed = found || opened.includes(i);
          card.classList.toggle('is-revealed', revealed); card.classList.toggle('is-matched', found);
          card.setAttribute('aria-pressed', String(revealed));
          card.setAttribute('aria-disabled', String(found || opened.includes(i) || opened.length === 2));
          card.setAttribute('aria-label', `Carta ${i + 1}, ${revealed ? `lembrança ${deck[i].pair + 1}: ${deck[i].label}${found ? ', par encontrado' : ''}` : 'virada para baixo'}`);
        });
        memory.querySelector('.memory-progress').textContent = `${matched.size} de ${content.memory.length} pares encontrados`;
      };
      cards.forEach((card, index) => card.onclick = () => {
        if (disposed || matched.has(deck[index].pair) || opened.includes(index) || opened.length === 2) return;
        opened.push(index);
        const status = memory.querySelector('.memory-status');
        if (opened.length === 1) status.textContent = `Lembrança ${deck[index].pair + 1}: ${deck[index].label}. Escolha outra carta.`;
        else if (deck[opened[0]].pair === deck[opened[1]].pair) {
          matched.add(deck[index].pair); opened = [];
          status.textContent = `Um par encontrado: ${deck[index].label}.`;
          if (matched.size === content.memory.length) {
            status.textContent = 'Todas as lembranças encontraram seu par!';
            const reward = memory.querySelector('.memory-reward'); reward.hidden = false; focus(reward);
          }
        } else {
          status.textContent = 'Estas lembranças ainda não formam um par. Observe as cartas e toque em “Virar novamente” quando quiser continuar.';
          memory.querySelector('.memory-again').hidden = false;
        }
        sync();
      });
      memory.querySelector('.memory-again').onclick = () => {
        const first = opened[0]; opened = []; sync();
        memory.querySelector('.memory-again').hidden = true;
        memory.querySelector('.memory-status').textContent = 'Sem pressa. Escolha outras duas cartas.';
        focus(cards[first]);
      };
      memory.querySelector('.memory-restart').onclick = () => start(true);
      if (moveFocus) focus(cards[0]);
    };
    start();
  }

  const date = root.querySelector('[data-game="date"] .game-body');
  if (date) {
    let selected = null;
    date.innerHTML = `<div class="game-options" role="group" aria-label="Convites para o próximo encontro">${content.date.map((option, i) => `<button type="button" class="game-option" data-date="${i}" aria-pressed="false"><span class="option-letter" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span>${esc(option.title)}</span></button>`).join('')}</div><div class="date-reveal" role="status" aria-live="polite" aria-atomic="true"></div><button type="button" class="outline copy-date" hidden>Copiar escolha</button><p class="helper">A escolha fica nesta página. Copie e envie para quem preparou a surpresa; nada é enviado automaticamente.</p><p class="copy-status helper" role="status"></p>`;
    date.querySelectorAll('[data-date]').forEach(button => button.onclick = () => {
      if (disposed) return;
      selected = content.date[Number(button.dataset.date)];
      date.querySelectorAll('[data-date]').forEach(option => { option.classList.toggle('is-selected', option === button); option.setAttribute('aria-pressed', String(option === button)); });
      date.querySelector('.date-reveal').innerHTML = `<div class="game-reveal"><h4>${esc(selected.title)}</h4><p class="prose">${esc(selected.detail || 'Já quero viver mais essa lembrança com você.')}</p></div>`;
      date.querySelector('.copy-date').hidden = false;
      date.querySelector('.copy-status').textContent = '';
    });
    date.querySelector('.copy-date').onclick = async () => {
      if (!selected || disposed) return;
      const choice = selected;
      const text = `Meu próximo encontro com você: ${choice.title}${choice.detail ? '\n' + choice.detail : ''}`;
      try {
        await navigator.clipboard.writeText(text);
        if (!disposed && selected === choice) date.querySelector('.copy-status').textContent = 'Escolha copiada. Agora você pode enviar a mensagem.';
      } catch {
        if (disposed || selected !== choice) return;
        date.querySelector('.copy-status').innerHTML = `<label class="field">Copie sua escolha<textarea readonly rows="4">${esc(text)}</textarea></label>`;
        const field = date.querySelector('.copy-status textarea'); field.focus(); field.select();
      }
    };
  }
  return () => { disposed = true; root.replaceChildren(); };
}
