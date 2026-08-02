// The scanner exists because the same bug shipped twice: a nested read treated as an array.
// These tests pin the two things that make it usable — it must not fire on guarded code, and
// it must not read its own explanatory prose as source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSource, stripNonCode } from '../../scripts/deref-scan.mjs';

test('flags the crash class that took the site down: nested read, then an array op', () => {
  const findings = scanSource('const rows = verification.signals.map(s => s.label);');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].expression, 'verification.signals.map');
  assert.equal(findings[0].confidence, 'medium');
});

test('deeper chains are higher confidence, because more links can be absent', () => {
  const findings = scanSource('data.member.verification.signals.forEach(fn);');
  assert.equal(findings[0].confidence, 'high');
  assert.equal(findings[0].depth, 4); // data > member > verification > signals
});

test('optional chaining is a guard', () => {
  assert.deepEqual(scanSource('verification?.signals?.map(fn);'), []);
});

test('asList is a guard — it is the shape guard this repo actually uses', () => {
  assert.deepEqual(scanSource('asList(verification.signals).map(fn);'), []);
});

test('Array.isArray on the same line is a guard', () => {
  assert.deepEqual(scanSource('const r = Array.isArray(a.b.c) ? a.b.c.map(fn) : [];'), []);
});

test('|| [] is reported, and reported as weak — it still throws on a truthy non-array', () => {
  const findings = scanSource('const n = (t.breadth || []).length; t.breadth.length;');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].confidence, 'low');
  assert.match(findings[0].why, /truthy non-array/);
});

test('built-in namespaces are not the crash class', () => {
  assert.deepEqual(scanSource('Object.keys(x).forEach(fn); JSON.parse(s).items.length;')
    .filter(f => f.expression.startsWith('Object.') || f.expression.startsWith('JSON.')), []);
});

test('a single property read is not flagged — one level cannot be the nested case', () => {
  assert.deepEqual(scanSource('items.map(fn);'), []);
});

test('comments are stripped before scanning, so prose about the bug is not read as the bug', () => {
  const src = [
    '// This used to crash on verification.signals.map(fn) before the guard landed.',
    '/* Another mention: data.member.claims.forEach(fn) */',
    'const safe = asList(x).map(fn);',
  ].join('\n');
  assert.deepEqual(scanSource(src), []);
});

test('string literals are stripped too', () => {
  assert.deepEqual(scanSource('const msg = "call a.b.c.map to break it";'), []);
});

test('stripNonCode preserves line numbers so reported lines are true', () => {
  const src = 'const a = 1;\n// a.b.c.map\nconst d = e.f.g.map(fn);';
  assert.equal(stripNonCode(src).split('\n').length, 3);
  assert.equal(scanSource(src)[0].line, 3);
});

test('template literals do not swallow the code that follows them', () => {
  const findings = scanSource('const s = `x`;\nreturn a.b.c.map(fn);');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

test('the two real findings it caught in this repo stay fixed', async () => {
  const { readFileSync } = await import('node:fs');
  const submissions = readFileSync(new URL('../../api/submissions.js', import.meta.url), 'utf8');
  const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  // submissionSummary reads a persisted `details` blob of varying vintage.
  assert.ok(!/record\.details\.(interests|roster|endorsements)\./.test(submissions),
    'submissionSummary must not read the stored details blob unguarded');
  // renderFocus blanked a panel when projects was absent.
  assert.ok(!/state\.dashboard\.projects\.find/.test(portal),
    'renderFocus must go through the shape guard');
});
