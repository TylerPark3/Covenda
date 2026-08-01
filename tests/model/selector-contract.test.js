import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The homepage was dead for a full day because of one line:
//
//   $('[data-clear-draft]', form).addEventListener('click', ...)
//
// The markup had dropped [data-clear-draft]. querySelector returned null, the deref threw,
// app.js aborted at module scope, and every control on the site stopped working. HTTP returned
// 200 the entire time. A 1,375-test suite did not notice, because it asserted structure rather
// than the contract between the script and the markup it reaches into.
//
// This file asserts that contract directly: a selector that is dereferenced without a guard
// must exist in the markup. It is the cheapest possible stand-in for the synthetic browser
// check that the retro asked for, and unlike that check it needs no browser.

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

// Comments name absent selectors on purpose, so they are stripped before scanning.
const src = app.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const classes = new Set();
for (const m of html.matchAll(/class="([^"]+)"/g)) {
  for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
}
const attrs = new Set([...html.matchAll(/\s([a-zA-Z-]+)(?:=|[\s>])/g)].map(m => m[1]));
const attrVals = new Map();
for (const m of html.matchAll(/\s([a-zA-Z-]+)="([^"]*)"/g)) {
  if (!attrVals.has(m[1])) attrVals.set(m[1], new Set());
  attrVals.get(m[1]).add(m[2]);
}
const tags = new Set([...html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1].toLowerCase()));

// Returns the first statically-checkable component that is absent, or null.
// Anything it cannot judge with confidence passes: this test must never produce a false
// positive, or the next person will delete it instead of fixing their bug.
function missingPart(selector) {
  for (const part of selector.trim().split(/\s*[\s>+~,]\s*/).filter(Boolean)) {
    let m;
    if ((m = part.match(/^#([A-Za-z0-9_-]+)$/))) { if (!ids.has(m[1])) return `#${m[1]}`; continue; }
    if ((m = part.match(/^\.([A-Za-z0-9_-]+)$/))) { if (!classes.has(m[1])) return `.${m[1]}`; continue; }
    if ((m = part.match(/^\[([a-zA-Z-]+)\]$/))) { if (!attrs.has(m[1])) return `[${m[1]}]`; continue; }
    if ((m = part.match(/^\[([a-zA-Z-]+)="([^"]*)"\]$/))) {
      const vals = attrVals.get(m[1]);
      if (!vals || !vals.has(m[2])) return `[${m[1]}="${m[2]}"]`;
      continue;
    }
    if ((m = part.match(/^([a-zA-Z][a-zA-Z0-9]*)$/))) { if (!tags.has(m[1].toLowerCase())) return m[1]; continue; }
  }
  return null;
}

// $ is querySelector and returns null when nothing matches. $$ is querySelectorAll spread into
// an array, so .forEach on an empty result is safe. The lookbehind keeps $$ out of this scan.
const UNGUARDED_DEREF = /(?<!\$)\$\('([^']+)'(?:\s*,\s*[^)]+)?\)\s*(\??)\.\s*([A-Za-z_$][\w$]*)/g;

test('every unguarded $() deref targets a selector that exists in index.html', () => {
  const offenders = [];
  for (const m of src.matchAll(UNGUARDED_DEREF)) {
    const [, selector, optional, prop] = m;
    if (optional === '?') continue;              // ?. already handles the null case
    const missing = missingPart(selector);
    if (missing) {
      const line = src.slice(0, m.index).split('\n').length;
      offenders.push(`app.js:${line}  $('${selector}').${prop}  — ${missing} is not in index.html`);
    }
  }
  assert.deepEqual(offenders, [],
    `these throw the moment they run, and a throw at module scope kills every control on the page:\n  ${offenders.join('\n  ')}`);
});

// The specific line that caused the outage. Pinned by behaviour, not by line number, so it
// survives the file moving around.
test('the clear-draft handler stays guarded', () => {
  assert.match(src, /\$\('\[data-clear-draft\]', form\)\?\./,
    'the line that took the homepage down keeps its optional chain');
});

// $$ must never be confused for $. If someone rewrites $$ to return a NodeList or null, every
// .forEach in this file becomes a new outage, so the contract is pinned here.
test('the selector helpers keep their null and array contracts', () => {
  assert.match(app, /const \$ = \(selector, root = document\) => root\.querySelector\(selector\)/,
    '$ returns null when nothing matches, which is why derefs need guarding');
  assert.match(app, /const \$\$ = \(selector, root = document\) => \[\.\.\.root\.querySelectorAll\(selector\)\]/,
    '$$ spreads into a real array, which is why .forEach on it is always safe');
});

// The workDetail block is unreachable today only by accident: .work-option is absent from
// index.html, so classList.contains('work-option') never fires. If that class is ever added to
// a [data-work-type] button the block runs, so it must stay guarded regardless.
test('the workDetail block cannot be armed by adding one class', () => {
  const block = src.slice(src.indexOf('function renderFlowStep()'), src.indexOf('function closeWorkDetail()'));
  assert.doesNotMatch(block, /\$\('#workDetail[A-Za-z]*'\)\s*\.\s*[A-Za-z]/,
    'no bare deref of a #workDetail element survives in renderFlowStep/openWorkDetail');
  assert.match(src, /const panel = \$\('#workDetail'\); if \(panel\) panel\.hidden = true;/,
    'closeWorkDetail is guarded too');
});
