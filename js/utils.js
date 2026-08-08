/**
 * utils.js — Shared Pure Utilities
 * EDGAR TEE
 *
 * Owns: small, dependency-free string/date/text helpers reused across
 * posts.js, editor.js, dashboard.js, and app.js. These functions take no
 * DOM or Supabase dependency on purpose, so they can be unit-tested
 * directly with Node's built-in test runner (see tests/unit.test.js) —
 * no bundler, no jsdom, no network. Extracted in Module 11 (Testing)
 * after the same handful of helpers had drifted into near-duplicate
 * copies in three different files.
 */

/** Escapes a string for safe insertion into innerHTML. */
export function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Lowercases, strips non-alphanumerics to hyphens, trims edge hyphens. */
export function slugify(input = '') {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Short date, e.g. "Aug 5, 2026" — used on cards and admin lists. */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** Long date, e.g. "August 5, 2026" — used on the single post page. */
export function formatLongDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/** ~200 words/minute estimate, rounded up, minimum 1 minute. */
export function estimateReadingTime(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Converts an ISO timestamp to the value a <input type="datetime-local"> expects. */
export function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Up to two uppercase initials from a display name, for avatar badges. */
export function initials(name = 'Edgar Tee') {
  return name.split(' ').map((p) => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
}

/**
 * Converts plain-text post content into paragraph HTML (splits on blank
 * lines, escapes each paragraph, preserves single line breaks). Real
 * Markdown rendering remains a documented Future Feature — this is the
 * safe plain-text baseline used by post.html and the editor's preview.
 */
export function renderContentHtml(content = '') {
  return content
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}
