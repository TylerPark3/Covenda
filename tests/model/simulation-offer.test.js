import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offerableSimulations } from '../../api/portal.js';
import { SCENARIOS } from '../../api/scenarios.js';

const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');

const batches = [
  { slug: 'ai-ml', name: 'AI & machine learning', status: 'open' },
  { slug: 'product-engineering', name: 'Product engineering', status: 'open' },
  { slug: 'investment-banking', name: 'Investment banking', status: 'closed' },
];

// Twenty-six scenarios, a working engine and a working route, with no caller anywhere in the
// client. The whole feature was unreachable.
test('the simulation runner is actually called from the UI', () => {
  const callers = js.split('openSimulation(').length - 1;
  assert.ok(callers >= 2, 'openSimulation is still defined and never called');
  assert.match(js, /go\.addEventListener\('click',\(\)=>openSimulation\(/);
});

test('an open batch offers its sitting, a closed one does not', () => {
  const offers = offerableSimulations({}, batches);
  assert.ok(offers.some(o => o.specialization === 'ai-ml'));
  assert.ok(!offers.some(o => o.specialization === 'investment-banking'), 'a closed batch offered a sitting');
});

// The optional sitting must be offered on top, never in place of a batch's own.
test('the polymath sitting is offered alongside the defaults, not instead', () => {
  const offers = offerableSimulations({ verticals: ['software-ai'] }, batches);
  const polymath = offers.find(o => o.id === 'swe-polymath-builder-1');
  assert.ok(polymath, 'the polymath sitting is not reachable');
  assert.equal(polymath.optional, true);
  assert.ok(offers.some(o => o.id === 'swe-inherited-bug-1'), 'the product-engineering default was displaced');
});

test('an optional sitting reaches a student browsing the vertical without declaring interest', () => {
  const offers = offerableSimulations({}, [{ slug: 'ai-ml', name: 'AI & ML', status: 'open' }]);
  assert.ok(offers.some(o => o.id === 'swe-polymath-builder-1'), 'derived from the batch vertical');
});

test('software extras never leak into an unrelated vertical', () => {
  const offers = offerableSimulations({ verticals: ['accounting-finance'] },
    [{ slug: 'investment-banking', name: 'IB', status: 'open' }]);
  assert.ok(!offers.some(o => o.optional), 'a software sitting was offered to a finance student');
});

test('nothing is offered twice', () => {
  const offers = offerableSimulations({ verticals: ['software-ai'] }, [...batches, ...batches]);
  assert.equal(new Set(offers.map(o => o.id)).size, offers.length);
});

test('every offer carries what it costs and what it reads for', () => {
  for (const offer of offerableSimulations({ verticals: ['software-ai'] }, batches)) {
    assert.ok(offer.minutes > 0, `${offer.id} does not say how long it takes`);
    assert.ok(offer.brief, `${offer.id} does not say what it is`);
    assert.ok(SCENARIOS[offer.id], `${offer.id} is not a real scenario`);
  }
});

// A button saying Start over a half-finished 55-minute sitting reads as though it was lost.
test('an in-progress run offers Resume rather than Start', () => {
  const panel = js.slice(js.indexOf('function renderSimulations'), js.indexOf('function renderTechnicalProfile'));
  assert.match(panel, /inProgress\?'Resume'/);
  assert.match(panel, /run\?'Sit it again':'Start'/);
});

// .sim-* already belongs to the simulation RUNNER dialog. These rules land later in the file,
// so sharing a name would have silently overridden the dialog's own styling.
test('the offer cards do not collide with the runner dialog styles', () => {
  // Only these two existed in the runner namespace before; sim-card and sim-top never did.
  for (const name of ['sim-brief', 'sim-done']) {
    const count = (css.match(new RegExp(`^\\.${name}\\s*\\{`, 'gm')) || []).length;
    assert.equal(count, 1, `.${name} is defined ${count} times, the later rule silently wins`);
  }
  assert.match(css, /\.simoffer-card/);
});

test('the simulations panel is rendered for students only', () => {
  assert.match(js, /renderSimulations\(root,state\.dashboard\)/);
  const panel = js.slice(js.indexOf('function renderSimulations'), js.indexOf('function renderTechnicalProfile'));
  assert.match(panel, /role!=='student'/);
});

test('the dashboard ships what a student can sit', () => {
  assert.match(api, /availableSimulations/);
  assert.match(api, /simulations, availableSimulations/);
});

// ── Company evidence requests ─────────────────────────────────────────────────────────
test('only a company can post an evidence request', () => {
  const fn = api.slice(api.indexOf('export async function saveEvidenceRequest'), api.indexOf('export async function loadEvidenceRequests'));
  assert.match(fn, /role !== 'company'/);
  assert.match(fn, /at least one thing you want to see/);
  assert.match(fn, /Say in a sentence/);
});

test('deleting a request is scoped to its owner', () => {
  const fn = api.slice(api.indexOf('export async function deleteEvidenceRequest'), api.indexOf('// Which sittings'));
  assert.match(fn, /\.eq\('company_user_id', member\.user\.id\)/);
});

test('both company routes are reachable', () => {
  assert.match(api, /input\.action === 'save-evidence-request'/);
  assert.match(api, /input\.action === 'delete-evidence-request'/);
});

test('a priority that maps onto nothing is named rather than dropped', () => {
  const fn = api.slice(api.indexOf('export async function saveEvidenceRequest'), api.indexOf('export async function loadEvidenceRequests'));
  assert.match(fn, /guidance: recommendedEvidence\(priorities\)/);
  assert.match(js, /Not mapped to a technical domain/);
});

// The distinction the whole feature rests on.
test('the request is presented as a next step, not a filter', () => {
  const dialog = html.slice(html.indexOf('id="evidenceRequestDialog"'), html.indexOf('id="techEvidenceDialog"'));
  assert.match(dialog, /next step, not a filter/);
  assert.match(dialog, /Students who do not match still see it/);
  const panel = js.slice(js.indexOf('function renderEvidenceRequests'), js.indexOf('function openEvidenceRequest'));
  assert.match(panel, /decides what they go and build/);
});

test('every class both panels render is styled', () => {
  const region = js.slice(js.indexOf('// ── What a team wants to see'), js.indexOf('function renderTechnicalProfile'));
  const classes = [...region.matchAll(/className=['"]([^'"]+)['"]/g)]
    .flatMap(m => m[1].split(/\s+/))
    .filter(c => c.startsWith('simoffer-') || c.startsWith('evreq-'));
  for (const name of new Set(classes)) {
    assert.ok(css.includes(`.${name}`), `.${name} is rendered but never styled`);
  }
});

test('the request dialog icons resolve', () => {
  const dialog = html.slice(html.indexOf('id="evidenceRequestDialog"'), html.indexOf('id="techEvidenceDialog"'));
  for (const icon of [...dialog.matchAll(/#(p-[a-z-]+)/g)].map(m => m[1])) {
    assert.ok(html.includes(`id="${icon}"`), `${icon} is referenced but not defined`);
  }
});
