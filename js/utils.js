export const $ = (selector) => document.querySelector(selector);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const formatShortDate = (timestamp) =>
  new Date(timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

export function formatTotalTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export const formatDuration = (seconds) => (seconds >= 60 ? `${seconds / 60} min` : `${seconds}s`);