import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { newDraft, normalizeDraft, validate, reviewDraft } from '../public/model.js';
import { newGames, getGameContent, normalizeGames } from '../public/game-model.js';
import { installGames } from '../public/games.js';
import { gamesPanel, bindGamesEditor } from '../public/games-editor.js';
import { buildGiftHTML } from '../public/export.js';

function fixture() {
  const draft = newDraft();
  Object.assign(draft, { recipient: 'A', sender: 'B', letter: 'Uma declaração.', cover: 'data:image/png;base64,AQID' });
  draft.dates.namoro = '2020-01-01';
  draft.moments.push({ title: 'O café', text: '', date: '', photo: 'data:image/png;base64,BAUG' });
  draft.games = {
    quiz: { enabled: true, questions: [
      { prompt: 'Onde nos vimos?', answers: ['No café', 'Na praia', ''], correct: 0, reveal: 'Seu sorriso ficou comigo.' },
      { prompt: 'O que pedimos?', answers: ['Chá', 'Café', 'Água'], correct: 1, reveal: '' },
    ] },
    memory: { enabled: true, message: 'Encontramos nosso par.' },
    date: { enabled: true, options: [{ title: 'Piquenique', detail: 'Eu levo a música.' }, { title: 'Cinema', detail: 'Você escolhe o filme.' }] },
  };
  return draft;
}
function setup(t, draft = fixture()) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test' });
  const root = dom.window.document.querySelector('#root');
  const cleanup = installGames(draft, root);
  t.after(() => { cleanup(); dom.window.close(); });
  return { dom, root, cleanup };
}

test('legacy drafts receive disabled games; malformed game data is rejected', () => {
  const old = newDraft(); delete old.games;
  assert.deepEqual(normalizeDraft(old).games, newGames());
  assert.equal(getGameContent(old).quiz.length, 0);
  const draft = fixture(), normalized = normalizeDraft(draft);
  assert.deepEqual(normalized.games, draft.games);
  normalized.games.quiz.questions[0].answers[0] = 'Changed';
  assert.equal(draft.games.quiz.questions[0].answers[0], 'No café');
  for (const mutate of [
    games => { games.quiz.enabled = 'yes'; },
    games => { games.quiz.questions[0].correct = 9; },
    games => { games.quiz.questions[0].answers = ['A']; },
    games => { games.quiz.questions[0].reveal = 'x'.repeat(2001); },
    games => { games.quiz.questions = Array(6).fill(games.quiz.questions[0]); },
    games => { games.date.options = [null]; },
  ]) {
    const games = structuredClone(draft.games); mutate(games);
    assert.throws(() => normalizeGames(games), /invalid-draft/);
  }
});

test('enabled incomplete games block delivery; disabling preserves their drafts and unblocks it', () => {
  const draft = fixture();
  assert.deepEqual(validate(draft), []);
  draft.games.quiz.questions[0].answers = ['Café', ' café ', ''];
  draft.games.date.options[1].title = '';
  draft.moments[0].photo = draft.cover;
  const issues = reviewDraft(draft).filter(item => item.step === 5);
  assert.equal(issues.length, 3); assert.ok(issues.every(item => item.required));
  for (const game of Object.values(draft.games)) game.enabled = false;
  assert.deepEqual(validate(draft), []);
  assert.equal(normalizeDraft(draft).games.quiz.questions.length, 2);
});

test('memory reuses distinct photos, caps at six pairs, and excludes unsafe sources', () => {
  const draft = fixture();
  draft.moments.push(...Array.from({ length: 10 }, (_, i) => ({ photo: `https://example.test/${i}.png`, title: `Photo ${i}` })));
  const content = getGameContent(draft);
  assert.equal(content.memory.length, 6);
  draft.cover = 'javascript:alert(1)'; draft.moments = [{ photo: 'data:text/html;base64,AAAA' }];
  assert.equal(getGameContent(draft).memory.length, 0);
});

test('quiz reveals affection on wrong answers, resists double answers and supports replay', t => {
  const { root } = setup(t), quiz = root.querySelector('[data-game="quiz"]');
  quiz.querySelector('[data-answer="1"]').click();
  assert.match(quiz.querySelector('.game-feedback').textContent, /No café/);
  assert.match(quiz.querySelector('.game-feedback').textContent, /Seu sorriso/);
  quiz.querySelector('[data-answer="0"]').click();
  assert.doesNotMatch(quiz.querySelector('.game-feedback').textContent, /Você lembrou/);
  quiz.querySelector('.quiz-next').click();
  assert.match(quiz.querySelector('.game-progress').textContent, /2 de 2/);
  quiz.querySelector('[data-answer="1"]').click();
  assert.match(quiz.querySelector('.game-feedback').textContent, /Você lembrou/);
  quiz.querySelector('.quiz-next').click();
  assert.match(quiz.textContent, /O melhor é lembrar com você/);
  quiz.querySelector('.game-replay').click();
  assert.match(quiz.querySelector('.game-progress').textContent, /1 de 2/);
});

test('memory prevents self-matching and third flips, then completes and resets', t => {
  const { root } = setup(t), memory = root.querySelector('[data-game="memory"]');
  const cards = [...memory.querySelectorAll('[data-card]')];
  const caption = card => card.querySelector('.memory-caption').textContent;
  const first = cards[0], mismatch = cards.find(card => caption(card) !== caption(first));
  first.click(); first.click();
  assert.equal(memory.querySelectorAll('.is-revealed').length, 1);
  mismatch.click();
  const third = cards.find(card => card !== first && card !== mismatch); third.click();
  assert.equal(memory.querySelectorAll('.is-revealed').length, 2);
  assert.equal(memory.querySelector('.memory-again').hidden, false);
  memory.querySelector('.memory-again').click();
  assert.equal(memory.querySelectorAll('.is-revealed').length, 0);
  const pairs = new Map();
  for (const card of cards) { const key = caption(card); if (!pairs.has(key)) pairs.set(key, []); pairs.get(key).push(card); }
  for (const pair of pairs.values()) { pair[0].click(); pair[1].click(); }
  assert.equal(memory.querySelectorAll('.is-matched').length, 4);
  assert.equal(memory.querySelector('.memory-reward').hidden, false);
  assert.match(memory.querySelector('.memory-reward').textContent, /Encontramos nosso par/);
  cards[0].click(); assert.match(memory.querySelector('.memory-progress').textContent, /2 de 2/);
  memory.querySelector('.memory-restart').click();
  assert.equal(memory.querySelectorAll('.is-revealed').length, 0);
  assert.equal(memory.querySelector('.memory-reward').hidden, true);
});

test('date choice changes locally, escapes content, and offers a manual copy fallback', async t => {
  const draft = fixture(); draft.games.date.options[0].detail = '<img src=x onerror=alert(1)>';
  const { root } = setup(t, draft), date = root.querySelector('[data-game="date"]');
  date.querySelector('[data-date="0"]').click();
  assert.equal(date.querySelector('.date-reveal img'), null);
  assert.match(date.querySelector('.date-reveal').textContent, /<img/);
  date.querySelector('[data-date="1"]').click();
  assert.equal(date.querySelector('[data-date="0"]').getAttribute('aria-pressed'), 'false');
  assert.equal(date.querySelector('[data-date="1"]').getAttribute('aria-pressed'), 'true');
  await date.querySelector('.copy-date').onclick();
  assert.match(date.querySelector('.copy-status textarea').value, /Cinema/);
});

test('all games can be skipped and resumed without resetting their current state', t => {
  const { root, cleanup } = setup(t);
  root.querySelector('[data-answer="0"]').click();
  root.querySelectorAll('.game-block').forEach(block => {
    const skip = block.querySelector('.game-skip');
    skip.click(); assert.equal(block.querySelector('.game-body').hidden, true);
    assert.equal(skip.getAttribute('aria-expanded'), 'false');
    skip.click(); assert.equal(block.querySelector('.game-body').hidden, false);
  });
  assert.match(root.querySelector('.game-feedback').textContent, /Você lembrou/);
  cleanup(); assert.equal(root.children.length, 0);
});

test('editor initializes optional games and supports adding, removing and undoing questions', t => {
  const draft = newDraft(), dom = new JSDOM('<div id="root"></div>'), root = dom.window.document.querySelector('#root');
  t.after(() => dom.window.close());
  let undo, saves = 0;
  const render = () => { root.innerHTML = gamesPanel(draft); bindGamesEditor(root, draft, { persist: () => saves++, render, removed: value => { undo = value; } }); };
  render();
  const quiz = root.querySelector('[data-game-toggle="quiz"]'); quiz.checked = true; quiz.dispatchEvent(new dom.window.Event('change'));
  assert.equal(draft.games.quiz.questions.length, 1);
  root.querySelector('[data-game-add="quiz"]').click();
  assert.equal(draft.games.quiz.questions.length, 2);
  root.querySelector('[data-game-remove="quiz.0"]').click();
  assert.equal(draft.games.quiz.questions.length, 1); undo();
  assert.equal(draft.games.quiz.questions.length, 2); assert.ok(saves >= 3);
});

test('exported HTML runs all games without module imports and keeps the ending accessible', async t => {
  const draft = fixture(); draft.games.quiz.questions[0].reveal = '</script><script>throw Error("injected")</script>';
  const errors = [], console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(buildGiftHTML(draft, ''), {
    runScripts: 'dangerously', url: 'https://example.test/gift.html', virtualConsole: console,
    beforeParse(window) { window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }); },
  });
  t.after(() => dom.window.close());
  const root = dom.window.document;
  root.querySelector('#with-sound').checked = false;
  for (let i = 0; i < 3; i++) root.querySelector('.heart-button').click();
  assert.equal(root.querySelector('.gift-gate').hidden, true);
  assert.equal(root.querySelectorAll('.game-block').length, 3);
  root.querySelector('[data-answer="0"]').click();
  assert.match(root.querySelector('.game-feedback').textContent, /<script>/);
  assert.equal(root.querySelector('.game-feedback script'), null);
  root.querySelector('[data-date="1"]').click();
  assert.match(root.querySelector('.date-reveal').textContent, /Cinema/);
  root.querySelector('#answer').click();
  assert.equal(root.querySelector('#after-answer').hidden, false);
  assert.deepEqual(errors, []);
});
