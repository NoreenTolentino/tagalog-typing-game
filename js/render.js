import { $, escapeHtml, formatDuration, formatShortDate, formatTotalTime } from './utils.js';
import { DURATIONS, LEADERBOARD_SIZE, MODES, PROGRESS_BARS } from './config.js';

const MODE_LABELS = Object.fromEntries(MODES.map(({ id, label }) => [id, label]));

let wordNodes = [];

export const getModeLabel = (mode) => MODE_LABELS[mode];

function renderRadios(name, options, selected) {
  return options.map(({ value, label }) => `
    <input type="radio" name="${name}" id="${name}-${value}" value="${value}" ${String(value) === String(selected) ? 'checked' : ''}>
    <label for="${name}-${value}">${label}</label>`).join('');
}

export function renderControls({ mode, duration }) {
  $('#modeControl').innerHTML = renderRadios(
    'mode',
    MODES.map(({ id, label }) => ({ value: id, label })),
    mode,
  );
  $('#durationControl').innerHTML = renderRadios(
    'duration',
    DURATIONS.map((seconds) => ({ value: seconds, label: formatDuration(seconds) })),
    duration,
  );
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#themeToggle').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

export function renderWeakKeys(weakKeys) {
  $('#insights').hidden = weakKeys.length === 0;
  $('#weakKeys').innerHTML = weakKeys
    .map(({ key, count }) => `<li><kbd>${escapeHtml(key)}</kbd><span>${count} missed</span></li>`)
    .join('');
}

export function renderProgress(history) {
  const recent = history.slice(-PROGRESS_BARS);
  const lastTen = history.slice(-10);
  const average = lastTen.length ? Math.round(lastTen.reduce((sum, entry) => sum + entry.wpm, 0) / lastTen.length) : 0;
  const best = history.reduce((top, entry) => Math.max(top, entry.wpm), 0);
  const seconds = history.reduce((total, entry) => total + entry.seconds, 0);
  const peak = Math.max(...recent.map((entry) => entry.wpm), 1);

  $('#progEmpty').hidden = history.length > 0;
  $('#progBody').hidden = history.length === 0;
  $('#progTests').textContent = history.length;
  $('#progAverage').textContent = average;
  $('#progBest').textContent = best;
  $('#progTime').textContent = formatTotalTime(seconds);
  $('#progBars').innerHTML = recent
    .map((entry) => `<span class="pbar" style="height:${Math.max((entry.wpm / peak) * 100, 4)}%" title="${entry.wpm} WPM, ${entry.accuracy}%"></span>`)
    .join('');
}

export function renderPlayer({ name }, bestWpm) {
  $('#playerName').value = name;
  $('#bestWpm').textContent = bestWpm;
}

export function renderPassage(words) {
  $('#words').innerHTML = words.map((word, index) => {
    const characters = [...word].map((char) => `<span class="ch">${escapeHtml(char)}</span>`).join('');
    return `<span class="word" data-index="${index}">${characters}</span>`;
  }).join(' ');

  wordNodes = [...document.querySelectorAll('.word')];
  $('#track').style.transform = 'translateY(0)';
}

export function updateWord(index, word, typed) {
  const node = wordNodes[index];
  node.querySelectorAll('.extra').forEach((extra) => extra.remove());

  node.querySelectorAll('.ch').forEach((char, position) => {
    const state = position < typed.length ? (typed[position] === word[position] ? ' ok' : ' bad') : '';
    char.className = `ch${state}`;
  });

  if (typed.length > word.length) {
    const extras = [...typed.slice(word.length)]
      .map((char) => `<span class="extra">${escapeHtml(char)}</span>`)
      .join('');
    node.insertAdjacentHTML('beforeend', extras);
  }
}

export function markWord(index, isCorrect) {
  wordNodes[index].classList.add(isCorrect ? 'done' : 'missed');
}

export function moveCaret(index, typedLength) {
  document.querySelector('.word.active')?.classList.remove('active');
  wordNodes[index].classList.add('active');
  const parts = wordNodes[index].children;
  const atEnd = typedLength >= parts.length;
  const anchor = atEnd ? parts[parts.length - 1] : parts[typedLength];
  const left = anchor.offsetLeft + (atEnd ? anchor.offsetWidth : 0);
  const caret = $('#caret');

  caret.style.height = `${anchor.offsetHeight}px`;
  caret.style.transform = `translate(${left}px, ${anchor.offsetTop}px)`;

  const lineHeight = parseFloat(getComputedStyle($('#words')).lineHeight);
  const line = Math.round(anchor.offsetTop / lineHeight);
  $('#track').style.transform = `translateY(-${Math.max(line - 1, 0) * lineHeight}px)`;
}

export function renderLiveStats({ timeLeft, wpm, accuracy, progress }) {
  $('#liveTime').textContent = timeLeft;
  $('#liveWpm').textContent = Math.round(wpm);
  $('#liveAccuracy').textContent = `${Math.round(accuracy)}%`;
  $('#progressBar').style.width = `${progress}%`;
}

function renderChart(samples) {
  const width = 600;
  const height = 160;
  const padding = 12;
  const values = samples.length > 1 ? samples : [samples[0] ?? 0, samples[0] ?? 0];
  const peak = Math.max(...values, 1);
  const step = width / (values.length - 1);

  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - padding - (value / peak) * (height - padding * 2)).toFixed(1)}`)
    .join(' ');

  const guides = [0.25, 0.5, 0.75]
    .map((ratio) => `<line class="chart-grid" x1="0" x2="${width}" y1="${height * ratio}" y2="${height * ratio}"/>`)
    .join('');

  $('#chart').innerHTML = `${guides}<polygon class="chart-area" points="0,${height} ${points} ${width},${height}"/><polyline class="chart-line" points="${points}"/>`;
  $('#chartPeak').textContent = `Peak ${Math.round(Math.max(...samples, 0))} WPM`;
}

export function renderResults(result) {
  $('#resWpm').textContent = result.wpm;
  $('#resRank').textContent = result.rank;
  $('#resBest').hidden = !result.isPersonalBest;
  $('#resAccuracy').textContent = `${result.accuracy}%`;
  $('#resRaw').textContent = result.raw;
  $('#resMistakes').textContent = result.mistakes;
  $('#resTest').textContent = `${getModeLabel(result.mode)}, ${formatDuration(result.duration)}`;
  renderChart(result.samples);
}

export function renderLeaderboard(scores, latestId = null) {
  const top = scores.slice(0, LEADERBOARD_SIZE);

  $('#board').innerHTML = top.map((score, index) => `
    <li class="board-row ${score.id === latestId ? 'latest' : ''}">
      <span class="pos">${index + 1}</span>
      <span class="who">${escapeHtml(score.name)}<small>${getModeLabel(score.mode)}, ${formatDuration(score.duration)}</small></span>
      <span class="acc">${score.accuracy}%</span>
      <strong class="score">${score.wpm}<small>WPM</small></strong>
      <span class="when">${formatShortDate(score.at)}</span>
    </li>`).join('');

  $('#boardEmpty').hidden = top.length > 0;
}