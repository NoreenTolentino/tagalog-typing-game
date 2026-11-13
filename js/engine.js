import { RANKS, WEAK_KEYS_LIMIT, WORD_POOL_SIZE } from './config.js';
import { PROVERBS, WORD_LISTS } from './words.js';

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function generateProverbWords() {
  const words = [];
  while (words.length < WORD_POOL_SIZE) {
    shuffle(PROVERBS).forEach((proverb) => words.push(...proverb.split(' ')));
  }
  return words;
}

export function generateWords(mode) {
  if (mode === 'proverbs') return generateProverbWords();

  const pool = WORD_LISTS[mode];
  const words = [];
  while (words.length < WORD_POOL_SIZE) {
    const next = pool[Math.floor(Math.random() * pool.length)];
    if (next !== words[words.length - 1]) words.push(next);
  }
  return words;
}

export const calculateWpm = (characters, elapsedMs) =>
  elapsedMs > 0 ? characters / 5 / (elapsedMs / 60000) : 0;

export const calculateAccuracy = (keystrokes, mistakes) =>
  keystrokes ? ((keystrokes - mistakes) / keystrokes) * 100 : 100;

export const getRank = (wpm) => RANKS.find((rank) => wpm >= rank.min).title;

export const getWeakKeys = (missedKeys) =>
  Object.entries(missedKeys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, WEAK_KEYS_LIMIT)
    .map(([key, count]) => ({ key, count }));

export function countMatchingPrefix(word, typed) {
  let count = 0;
  while (count < typed.length && count < word.length && typed[count] === word[count]) count += 1;
  return count;
}