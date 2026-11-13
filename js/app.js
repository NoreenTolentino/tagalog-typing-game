import { $, generateId } from './utils.js';
import { MIN_ELAPSED_MS, TICK_INTERVAL_MS } from './config.js';
import {
  calculateAccuracy,
  calculateWpm,
  countMatchingPrefix,
  generateWords,
  getRank,
  getWeakKeys,
} from './engine.js';
import {
  appendHistory,
  clearScores,
  loadHistory,
  loadScores,
  loadSettings,
  saveScore,
  saveSettings,
} from './storage.js';
import {
  applyTheme,
  markWord,
  moveCaret,
  renderControls,
  renderLeaderboard,
  renderLiveStats,
  renderPassage,
  renderPlayer,
  renderProgress,
  renderResults,
  renderWeakKeys,
  updateWord,
} from './render.js';

const DEFAULT_PLAYER_NAME = 'Player';

const settings = loadSettings();
let game = createGame();

function createGame() {
  return {
    words: generateWords(settings.mode),
    index: 0,
    typed: '',
    status: 'idle',
    startedAt: 0,
    correctChars: 0,
    rawChars: 0,
    keystrokes: 0,
    mistakes: 0,
    missedKeys: {},
    samples: [],
    lastSample: 0,
    timerId: null,
  };
}

const getBestWpm = () => loadScores().reduce((best, score) => Math.max(best, score.wpm), 0);

function setState(state, view = 'test') {
  document.body.dataset.state = state;
  document.body.dataset.view = view;
}

function getCurrentCharacters() {
  return game.correctChars + countMatchingPrefix(game.words[game.index], game.typed);
}

function restart() {
  clearInterval(game.timerId);
  game = createGame();

  const input = $('#input');
  input.value = '';

  setState('idle');
  renderPassage(game.words);
  renderLiveStats({ timeLeft: settings.duration, wpm: 0, accuracy: 100, progress: 0 });
  moveCaret(0, 0);
  input.focus();
}

function startTest() {
  game.status = 'running';
  game.startedAt = Date.now();
  game.timerId = setInterval(tick, TICK_INTERVAL_MS);
  setState('running');
}

function tick() {
  const elapsed = Date.now() - game.startedAt;
  const totalMs = settings.duration * 1000;
  const wpm = calculateWpm(getCurrentCharacters(), Math.max(elapsed, MIN_ELAPSED_MS));

  const second = Math.floor(elapsed / 1000);
  if (second > game.lastSample) {
    game.lastSample = second;
    game.samples.push(Math.round(wpm));
  }

  renderLiveStats({
    timeLeft: Math.max(Math.ceil((totalMs - elapsed) / 1000), 0),
    wpm,
    accuracy: calculateAccuracy(game.keystrokes, game.mistakes),
    progress: Math.min((elapsed / totalMs) * 100, 100),
  });

  if (elapsed >= totalMs) finish();
}

function finish() {
  clearInterval(game.timerId);
  game.status = 'finished';

  const elapsed = Math.min(Date.now() - game.startedAt, settings.duration * 1000);
  const wpm = Math.round(calculateWpm(getCurrentCharacters(), elapsed));
  const raw = Math.round(calculateWpm(game.rawChars + game.typed.length, elapsed));
  const accuracy = Math.round(calculateAccuracy(game.keystrokes, game.mistakes) * 10) / 10;

  const previousBest = getBestWpm();
  const hadScores = loadScores().length > 0;
  const score = {
    id: generateId(),
    name: settings.name,
    wpm,
    accuracy,
    mode: settings.mode,
    duration: settings.duration,
    at: Date.now(),
  };

  const scores = wpm > 0 ? saveScore(score) : loadScores();
  const history = game.keystrokes > 0
    ? appendHistory({ at: score.at, wpm, accuracy, seconds: Math.round(elapsed / 1000) })
    : loadHistory();

  renderResults({
    wpm,
    raw,
    accuracy,
    mistakes: game.mistakes,
    rank: getRank(wpm),
    mode: settings.mode,
    duration: settings.duration,
    samples: game.samples.length ? game.samples : [wpm],
    isPersonalBest: hadScores && wpm > previousBest,
  });

  renderWeakKeys(getWeakKeys(game.missedKeys));
  renderProgress(history);
  renderLeaderboard(scores, wpm > 0 ? score.id : null);
  renderPlayer(settings, getBestWpm());
  setState('finished', 'results');
  $('#input').blur();
}

function countKeystrokes(word, startPosition, characters) {
  [...characters].forEach((char, offset) => {
    const expected = word[startPosition + offset];
    game.keystrokes += 1;

    if (char === expected) return;
    game.mistakes += 1;
    if (expected) game.missedKeys[expected] = (game.missedKeys[expected] ?? 0) + 1;
  });
}

function commitWord(typedWord) {
  const word = game.words[game.index];
  const isCorrect = typedWord === word;

  game.rawChars += typedWord.length + 1;
  if (isCorrect) game.correctChars += word.length + 1;

  updateWord(game.index, word, typedWord);
  markWord(game.index, isCorrect);

  game.index += 1;
  game.typed = '';

  if (game.index >= game.words.length) return finish();
  moveCaret(game.index, 0);
}

function handleInput() {
  if (game.status === 'finished') return;

  const input = $('#input');
  const value = input.value;
  const word = game.words[game.index];

  if (value.trim() === '') {
    input.value = '';
    game.typed = '';
    updateWord(game.index, word, '');
    moveCaret(game.index, 0);
    return;
  }

  if (game.status === 'idle') startTest();

  const hasSpace = value.includes(' ');
  const typedWord = hasSpace ? value.split(' ')[0] : value;

  if (typedWord.length > game.typed.length) {
    countKeystrokes(word, game.typed.length, typedWord.slice(game.typed.length));
  }

  if (hasSpace) {
    commitWord(typedWord);
    input.value = '';
    return;
  }

  game.typed = typedWord;
  updateWord(game.index, word, typedWord);
  moveCaret(game.index, typedWord.length);
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    restart();
    return;
  }

  const onControl = event.target.closest('input:not(#input), button, label');

  if (game.status === 'finished') {
    if (event.key === 'Enter' && !onControl) restart();
    return;
  }

  const isCharacter = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
  if (isCharacter && !onControl) $('#input').focus();
}

function handleSettingChange(event) {
  const { name, value } = event.target;
  if (name === 'mode') settings.mode = value;
  if (name === 'duration') settings.duration = Number(value);

  saveSettings(settings);
  restart();
}

function handlePlayerChange() {
  settings.name = $('#playerName').value.trim() || DEFAULT_PLAYER_NAME;
  $('#playerName').value = settings.name;
  saveSettings(settings);
}

function handleThemeToggle() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  saveSettings(settings);
  applyTheme(settings.theme);
}

function handleClearScores() {
  if (!confirm('Clear all saved scores and progress?')) return;

  clearScores();
  renderLeaderboard([]);
  renderProgress([]);
  renderPlayer(settings, 0);
}

function init() {
  applyTheme(settings.theme);
  renderControls(settings);
  renderPlayer(settings, getBestWpm());
  renderLeaderboard(loadScores());
  renderProgress(loadHistory());
  restart();

  const input = $('#input');
  const passage = $('#passage');

  input.addEventListener('input', handleInput);
  input.addEventListener('focus', () => passage.classList.add('focused'));
  input.addEventListener('blur', () => passage.classList.remove('focused'));
  passage.addEventListener('click', () => input.focus());

  document.addEventListener('keydown', handleKeydown);
  $('#modeControl').addEventListener('change', handleSettingChange);
  $('#durationControl').addEventListener('change', handleSettingChange);
  $('#playerName').addEventListener('change', handlePlayerChange);
  $('#restart').addEventListener('click', restart);
  $('#again').addEventListener('click', restart);
  $('#clearScores').addEventListener('click', handleClearScores);
  $('#themeToggle').addEventListener('click', handleThemeToggle);
}

init();