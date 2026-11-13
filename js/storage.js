import { MAX_HISTORY_ENTRIES, MAX_STORED_SCORES, MODES } from './config.js';

const SCORES_KEY = 'typing-test-scores-v2';
const SETTINGS_KEY = 'typing-test-settings-v2';
const HISTORY_KEY = 'typing-test-history-v2';
const DEFAULT_SETTINGS = { name: 'Player', mode: 'common', duration: 30, theme: 'light' };

const byBestFirst = (a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy || b.at - a.at;

export function loadSettings() {
  try {
    const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
    if (!MODES.some(({ id }) => id === settings.mode)) settings.mode = DEFAULT_SETTINGS.mode;
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadScores() {
  try {
    const saved = JSON.parse(localStorage.getItem(SCORES_KEY));
    return Array.isArray(saved) ? saved.sort(byBestFirst) : [];
  } catch {
    return [];
  }
}

export function saveScore(score) {
  const scores = [...loadScores(), score].sort(byBestFirst).slice(0, MAX_STORED_SCORES);
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  return scores;
}

export function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function appendHistory(entry) {
  const history = [...loadHistory(), entry].slice(-MAX_HISTORY_ENTRIES);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function clearScores() {
  localStorage.removeItem(SCORES_KEY);
  localStorage.removeItem(HISTORY_KEY);
}