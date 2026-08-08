/**
 * tests/unit.test.js — Automated Unit Tests
 * EDGAR TEE
 *
 * Covers the pure, dependency-free functions in js/utils.js using Node's
 * built-in test runner (Node 18+, `node --test`). No bundler, no test
 * framework dependency — consistent with the project's "vanilla only"
 * constraint. Functions that touch the DOM or Supabase (posts.js,
 * editor.js, dashboard.js) are covered by the manual QA checklist in
 * TESTING.md instead, since they need a real browser + live database to
 * exercise meaningfully.
 *
 * Run with:  npm test
 *   (or directly:  node --test tests/)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  slugify,
  formatDate,
  formatLongDate,
  estimateReadingTime,
  toDatetimeLocal,
  initials,
  renderContentHtml,
} from '../js/utils.js';

test('escapeHtml escapes all five reserved characters', () => {
  assert.equal(
    escapeHtml(`<script>alert("x") & 'y'</script>`),
    '&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;'
  );
});

test('escapeHtml leaves plain text untouched', () => {
  assert.equal(escapeHtml('The quiet mind hears what the noisy mind misses.'),
    'The quiet mind hears what the noisy mind misses.');
});

test('escapeHtml handles the default empty argument', () => {
  assert.equal(escapeHtml(), '');
});

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Searching for Truth in an Age of Noise'), 'searching-for-truth-in-an-age-of-noise');
});

test('slugify strips punctuation rather than keeping it', () => {
  assert.equal(slugify("Who Am I, Really?!"), 'who-am-i-really');
});

test('slugify trims leading/trailing hyphens produced by punctuation at the edges', () => {
  assert.equal(slugify('  -- Hello World --  '), 'hello-world');
});

test('slugify on an empty string returns an empty string, not a lone hyphen', () => {
  assert.equal(slugify(''), '');
});

test('formatDate renders a short US-style date', () => {
  assert.equal(formatDate('2026-08-05T12:00:00Z'), 'Aug 5, 2026');
});

test('formatDate returns an empty string for a falsy input', () => {
  assert.equal(formatDate(null), '');
  assert.equal(formatDate(undefined), '');
});

test('formatLongDate renders the full month name', () => {
  assert.equal(formatLongDate('2026-08-05T12:00:00Z'), 'August 5, 2026');
});

test('estimateReadingTime rounds to the nearest minute at 200wpm', () => {
  const words300 = new Array(300).fill('word').join(' ');
  assert.equal(estimateReadingTime(words300), 2); // 300/200 = 1.5 -> rounds to 2
});

test('estimateReadingTime never returns less than 1 minute', () => {
  assert.equal(estimateReadingTime('just a few words'), 1);
  assert.equal(estimateReadingTime(''), 1);
});

test('toDatetimeLocal returns empty string for a falsy input', () => {
  assert.equal(toDatetimeLocal(null), '');
});

test('toDatetimeLocal produces a value shaped like <input type="datetime-local"> expects', () => {
  const result = toDatetimeLocal('2026-08-05T14:30:00Z');
  assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test('initials takes the first letter of up to two words, uppercased', () => {
  assert.equal(initials('Edgar Tee'), 'ET');
  assert.equal(initials('Madonna'), 'M');
});

test('initials falls back to "Edgar Tee" when given nothing', () => {
  assert.equal(initials(), 'ET');
});

test('renderContentHtml splits on blank lines into separate paragraphs', () => {
  const html = renderContentHtml('First paragraph.\n\nSecond paragraph.');
  assert.equal(html, '<p>First paragraph.</p>\n<p>Second paragraph.</p>');
});

test('renderContentHtml preserves single line breaks within a paragraph as <br>', () => {
  const html = renderContentHtml('Line one.\nLine two.');
  assert.equal(html, '<p>Line one.<br>Line two.</p>');
});

test('renderContentHtml escapes HTML found inside post content', () => {
  const html = renderContentHtml('<b>bold</b> text');
  assert.equal(html, '<p>&lt;b&gt;bold&lt;/b&gt; text</p>');
});

test('renderContentHtml drops extra blank paragraphs from stray whitespace', () => {
  const html = renderContentHtml('Para one.\n\n\n\nPara two.');
  assert.equal(html, '<p>Para one.</p>\n<p>Para two.</p>');
});
