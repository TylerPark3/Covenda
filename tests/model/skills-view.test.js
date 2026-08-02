// M-6, the Skills view. Two things are load-bearing: it must be reachable (the last view
// added to this portal became a trap because its nav button was hidden), and it must not
// grow a universal score, because a page called "Skills" is exactly where one would appear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');

// Strip comments before scanning: three tests in this repo have false-positived on their
// own explanatory prose, and this file talks about the thing it forbids.
const code = portal
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

test('the view is registered, so setView("skills") does not silently fall back to overview', () => {
  const fn = code.slice(code.indexOf('function setView(view, opts)'), code.indexOf('#memberBreadcrumb'));
  assert.match(fn, /'skills'/, 'skills must be in the allowed list');
});

test('it has a nav button, so it is reachable without typing a view name', () => {
  assert.match(html, /data-view="skills"[^>]*data-roles="[^"]*student/,
    'students need a visible route to the view');
});

test('it has a panel, so the nav button leads somewhere', () => {
  assert.match(html, /data-portal-view="skills"/);
  assert.match(html, /id="skillsEvidencePanel"/);
});

test('it is labelled in NAV_LABELS, so the button is not named by two systems', () => {
  const labels = code.slice(code.indexOf('const NAV_LABELS'), code.indexOf('const labels ='));
  assert.match(labels, /skills: 'Skills'/);
  // Companies and universities must not get it — they have no evidence ladder.
  const student = labels.slice(labels.indexOf('student:'), labels.indexOf('company:'));
  assert.match(student, /skills:/);
  const company = labels.slice(labels.indexOf('company:'));
  assert.equal(/skills:/.test(company), false, 'skills is a student view only');
});

test('render is wired into the dashboard paint, not left defined and uncalled', () => {
  assert.match(code, /renderSkills\(\);/, 'renderSkills must actually be called');
  assert.match(code, /renderDiscover\(\);\s*renderSkills\(\);/);
});

test('D10 — the view computes no total, rank, or overall level', () => {
  const fn = code.slice(code.indexOf('function renderSkills()'), code.indexOf('function renderDiscover()'));
  for (const forbidden of ['overallScore', 'totalScore', 'skillScore', 'employability',
    'percentile', 'averageTier', 'overallLevel']) {
    assert.equal(fn.includes(forbidden), false, `the skills view must not compute ${forbidden}`);
  }
  // No arithmetic that would aggregate skills into one figure.
  assert.equal(/\.reduce\s*\(/.test(fn), false, 'no aggregation across skills');
});

test('every skill carries exactly one tier, and claimed is the honest default', () => {
  const rows = code.slice(code.indexOf('function skillEvidenceRows'), code.indexOf('function renderSkills()'));
  assert.match(rows, /put\(s,'claimed'\)/, 'listed skills default to claimed');
  assert.match(rows, /trial/); assert.match(rows, /artifact/);
  // A stronger tier must win, never sum.
  assert.match(rows, /rank>SKILL_TIERS\[prev\.tier\]\.rank/);
});

test('the tiers mirror the matching engine, so the student sees the engine\'s ladder', () => {
  const match = readFileSync(new URL('../../api/match.js', import.meta.url), 'utf8');
  for (const tier of ['trial', 'artifact', 'claimed']) {
    assert.ok(match.includes(tier), `${tier} must exist in the engine`);
    assert.ok(code.includes(`${tier}:`) || code.includes(`'${tier}'`), `${tier} must exist in the view`);
  }
});

test('sections are fault-isolated, so one bad row cannot blank the page', () => {
  const fn = code.slice(code.indexOf('function renderSkills()'), code.indexOf('function renderDiscover()'));
  assert.match(fn, /buildSection\(/, 'must render through buildSection');
});

test('list reads go through the shape guard, not truthiness', () => {
  const rows = code.slice(code.indexOf('function skillEvidenceRows'), code.indexOf('function renderSkills()'));
  assert.match(rows, /asList\(/);
  assert.equal(/\|\|\s*\[\]\)\.forEach/.test(rows), false, 'use asList, not || []');
});

test('the verify panel stays hidden when there is nothing to say', () => {
  const fn = code.slice(code.indexOf('function renderSkills()'), code.indexOf('function renderDiscover()'));
  assert.match(fn, /verify\.hidden=true/, 'default hidden');
  assert.match(fn, /worth\.length/, 'only shown when the reader produced gaps');
});

test('the gap list repeats the caveat rather than presenting résumé reads as verified', () => {
  const fn = code.slice(code.indexOf('function renderSkills()'), code.indexOf('function renderDiscover()'));
  assert.match(fn, /Not verified/i);
  assert.match(fn, /no company sees it/i);
});
