export function newGames() {
  return {
    quiz: { enabled: false, questions: [] },
    memory: { enabled: false, message: '' },
    date: { enabled: false, options: [] },
  };
}

export function normalizeGames(value) {
  if (value === undefined) return newGames();
  const fail = () => { throw new Error('invalid-draft'); };
  if (!value || !['quiz', 'memory', 'date'].every(key => value[key] && typeof value[key].enabled === 'boolean')) fail();
  const string = (value, max) => { if (typeof value !== 'string' || value.length > max) fail(); return value; };
  if (!Array.isArray(value.quiz.questions) || value.quiz.questions.length > 5) fail();
  if (!Array.isArray(value.date.options) || value.date.options.length > 3) fail();
  return {
    quiz: { enabled: value.quiz.enabled, questions: value.quiz.questions.map(q => {
      if (!q || !Array.isArray(q.answers) || q.answers.length !== 3 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 2) fail();
      return { prompt: string(q.prompt, 300), answers: q.answers.map(answer => string(answer, 200)), correct: q.correct, reveal: string(q.reveal, 2000) };
    }) },
    memory: { enabled: value.memory.enabled, message: string(value.memory.message, 500) },
    date: { enabled: value.date.enabled, options: value.date.options.map(option => {
      if (!option) fail();
      return { title: string(option.title, 120), detail: string(option.detail, 1000) };
    }) },
  };
}

// Self-contained: the same content selection runs inside exported HTML.
export function getGameContent(draft) {
  const games = draft.games || {};
  const text = value => typeof value === 'string' ? value.trim() : '';
  const quiz = games.quiz?.enabled ? (games.quiz.questions || []).filter(q => {
    if (!text(q.prompt) || !Array.isArray(q.answers) || !Number.isInteger(q.correct) || !text(q.answers[q.correct])) return false;
    const answers = q.answers.map(text).filter(Boolean);
    return answers.length >= 2 && new Set(answers.map(answer => answer.toLocaleLowerCase('pt-BR'))).size === answers.length;
  }).slice(0, 5).map(q => ({
    prompt: text(q.prompt), reveal: text(q.reveal),
    answers: q.answers.map((answer, i) => ({ text: text(answer), correct: i === q.correct })).filter(answer => answer.text),
  })) : [];
  const seen = new Set();
  const photos = [
    { src: draft.cover, label: 'Nossa foto de capa' },
    ...(draft.moments || []).map((m, i) => ({ src: m.photo, label: text(m.title) || `Lembrança ${i + 1}` })),
    ...(draft.places || []).map((p, i) => ({ src: p.photo, label: text(p.name) || `Lugar ${i + 1}` })),
  ].filter(photo => {
    if (typeof photo.src !== 'string' || seen.has(photo.src)) return false;
    let valid = /^data:image\/[a-z0-9.+-]+;base64,/i.test(photo.src);
    try { valid ||= ['https:', 'http:'].includes(new URL(photo.src).protocol); } catch {}
    if (!valid) return false;
    seen.add(photo.src); return true;
  }).slice(0, 6);
  const date = games.date?.enabled ? (games.date.options || []).filter(option => text(option.title)).slice(0, 3)
    .map(option => ({ title: text(option.title), detail: text(option.detail) })) : [];
  return {
    quiz,
    photos,
    memory: games.memory?.enabled && photos.length >= 2 ? photos : [],
    memoryMessage: text(games.memory?.message) || 'Cada lembrança encontra seu par. E eu continuo escolhendo você.',
    date: date.length >= 2 && new Set(date.map(option => option.title.toLocaleLowerCase('pt-BR'))).size === date.length ? date : [],
  };
}

export function reviewGames(draft) {
  const games = draft.games || newGames(), content = getGameContent(draft), issues = [];
  if (games.quiz.enabled) {
    if (!games.quiz.questions.length) issues.push('Adicione pelo menos uma pergunta ao quiz ou desative o jogo.');
    games.quiz.questions.forEach((q, i) => {
      if (!getGameContent({ games: { quiz: { enabled: true, questions: [q] } } }).quiz.length)
        issues.push(`Na pergunta ${i + 1}, escreva a pergunta, pelo menos duas alternativas diferentes e marque uma resposta preenchida.`);
    });
  }
  if (games.memory.enabled && !content.memory.length) issues.push('O jogo da memória precisa de pelo menos duas fotos diferentes na capa, nas lembranças ou nos lugares.');
  if (games.date.enabled && (content.date.length !== games.date.options.length || !content.date.length))
    issues.push('Prepare duas ou três opções de encontro com títulos diferentes, ou desative essa interação.');
  return issues;
}
