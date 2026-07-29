import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AGENCY_BANDS, AI_BANDS, TAKE_HOME_RESPONSES, calibrationStatus } from '../../api/super-intern.js';

const root = new URL('../../', import.meta.url).pathname;
const api = readFileSync(root + 'api/admin.js', 'utf8');
const js = readFileSync(root + 'admin.js', 'utf8');
const css = readFileSync(root + 'admin.css', 'utf8');
const html = readFileSync(root + 'admin.html', 'utf8');
const queue = api.slice(api.indexOf("input.action === 'assessment-queue'"), api.indexOf("input.action === 'schema-health'"));

test('all three reviewer routes exist and are operator-only', () => {
  for (const action of ['assessment-queue', 'record-observation', 'record-outcome']) {
    assert.match(api, new RegExp(`input\\.action === '${action}'`), `${action} has no route`);
  }
  // They sit after the authorization boundary, so an unauthenticated caller never reaches them.
  const auth = api.indexOf('const operator = await authorizeAdmin');
  assert.ok(auth > 0 && api.indexOf("input.action === 'assessment-queue'") > auth);
});

// A score here would eventually be averaged with a score somewhere else, and the composite that
// produces is the thing the whole design refuses.
test('a reviewer places a band, never a number', () => {
  assert.match(queue, /band: AGENCY_BANDS|bands: \{ agency: AGENCY_BANDS/);
  const record = api.slice(api.indexOf("input.action === 'record-observation'"), api.indexOf("input.action === 'record-outcome'"));
  assert.ok(!/score|rating|points|out of/i.test(record), 'the reviewer route accepts a numeric judgement');
  assert.match(record, /band = String\(input\.band/);
});

// A band with no reasoning cannot be applied consistently by anyone else, which is exactly how
// two reviewers drift apart.
test('a band without a reason is refused', () => {
  const record = api.slice(api.indexOf("input.action === 'record-observation'"), api.indexOf("input.action === 'record-outcome'"));
  assert.match(record, /note\.length < 15/);
  assert.match(record, /cannot be applied consistently/);
});

// An unattributed judgement cannot be audited for drift, and drift is what the quarterly
// practitioner check exists to find.
test('every observation is attributed and timestamped', () => {
  const record = api.slice(api.indexOf("input.action === 'record-observation'"), api.indexOf("input.action === 'record-outcome'"));
  assert.match(record, /reviewer: operator\.email/);
  assert.match(record, /reviewedAt/);
});

test('the queue surfaces only what actually needs a human', () => {
  assert.match(queue, /observations\[c\.id\]\?\.answer && !observations\[c\.id\]\?\.band/);
  assert.match(queue, /awaiting:/);
  const card = js.slice(js.indexOf('function reviewRunCard'), js.indexOf('function bandsForComponent'));
  assert.match(card, /if \(!observation\.answer\) continue;/, 'unanswered components are not reviewer work');
});

// Offering every vocabulary everywhere is how a reviewer picks the wrong one.
test('each component is judged in its own vocabulary', () => {
  const fn = js.slice(js.indexOf('function bandsForComponent'), js.indexOf('function reviewComponent'));
  assert.match(fn, /'blocker'.*bands\.agency/s);
  assert.match(fn, /'verification'.*bands\.ai/s);
  assert.match(fn, /'take_home'.*bands\.takeHome/s);
  // Sent from the server rather than duplicated, so a reviewer sees the framework's own bands.
  assert.match(queue, /bands: \{ agency: AGENCY_BANDS/);
  for (const band of [...AGENCY_BANDS, ...AI_BANDS, ...TAKE_HOME_RESPONSES]) {
    assert.ok(!js.includes(band.reads), `the client carries its own copy of the ${band.id} band`);
  }
});

test('a component with no band vocabulary says so rather than showing an empty control', () => {
  const fn = js.slice(js.indexOf('function reviewComponent'), js.indexOf('// ── The review queue') + 1);
  assert.match(js, /No band for this one/);
});

// ── Outcomes ──────────────────────────────────────────────────────────────────────────
test('an outcome must belong to a student and is bounded', () => {
  const fn = api.slice(api.indexOf("input.action === 'record-outcome'"), api.indexOf("input.action === 'schema-health'"));
  assert.match(fn, /An outcome has to belong to a student/);
  assert.match(fn, /Math\.max\(0, Math\.min\(max, n\)\)/, 'rates and hours must be bounded');
  assert.match(fn, /independent_resolution/);
  assert.match(fn, /senior_hours/);
});

// The honest answer to "does this predict anything" changes only when this number changes.
test('recording an outcome reports where calibration actually stands', () => {
  const fn = api.slice(api.indexOf("input.action === 'record-outcome'"), api.indexOf("input.action === 'schema-health'"));
  assert.match(fn, /calibration: calibrationStatus/);
  assert.equal(calibrationStatus([]).ready, false);
  assert.match(calibrationStatus([]).claim, /cannot yet claim/i);
});

test('the queue renders where an operator will see it, and fails visibly', () => {
  assert.match(html, /id="adminReview"/);
  assert.match(js, /renderReviewQueue\(\)/);
  const render = js.slice(js.indexOf('async function renderReviewQueue'), js.indexOf('function reviewRunCard'));
  assert.match(render, /The review queue could not load/);
  assert.ok(!/catch \{ host\.hidden = true; return; \}/.test(render), 'the panel vanishes on error');
});

test('every class the queue renders is styled', () => {
  const region = js.slice(js.indexOf('// ── The review queue'), js.indexOf('// Which migrations have landed'));
  const classes = [...region.matchAll(/className = '([^']+)'/g)]
    .flatMap(m => m[1].split(/\s+/)).filter(c => c.startsWith('review-'));
  for (const name of new Set(classes)) assert.ok(css.includes(`.${name}`), `.${name} is rendered but never styled`);
});

// The referral network is Covenda's differentiation AND, anchored in a narrow set of
// institutions, an adverse-impact exposure sitting directly on top of it. An operator should
// see that beside the queue rather than never.
test('proxy exposure is surfaced next to the judgements it affects', () => {
  assert.match(queue, /proxies: proxyAudit\(/);
  assert.match(queue, /'referral_network', 'club'/);
  assert.match(queue, /batteryMinutes: longest/, 'an over-long battery is itself a proxy');
  const render = js.slice(js.indexOf('async function renderReviewQueue'), js.indexOf('function reviewRunCard'));
  assert.match(render, /review-proxies/);
  assert.match(render, /proxies\.note/, 'the caveat must travel with the flags');
  assert.match(css, /\.review-proxies/);
});

// Both cost the student nothing because the evidence already exists, and both were built and
// surfaced nowhere. An earlier edit to the same line silently dropped them.
test('the free reads reach the student dashboard', () => {
  const portal = readFileSync(root + 'api/portal.js', 'utf8');
  assert.match(portal, /const unprompted = unpromptedBuild\(/);
  assert.match(portal, /const reach = crossFunctional\(/);
  assert.match(portal, /entries: technicalEvidence, unprompted, reach/);
  // Reach must read from a centre, or a generalist weak everywhere outranks a real specialist.
  assert.match(portal, /d\.evidencedCount > 0/);
});
