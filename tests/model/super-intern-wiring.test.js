import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REVERSE_AUDIT_QUESTIONS, BUDGET_MINUTES } from '../../api/super-intern.js';

const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../supabase/migrations/20260729100000_super_intern.sql', import.meta.url), 'utf8');

// The engine existed and reached nobody. This is the wiring.
test('the engine is imported and its routes are reachable', () => {
  assert.match(api, /from '\.\/super-intern\.js'/);
  for (const action of ['save-company-environment', 'assessment-disclosure', 'start-assessment']) {
    assert.match(api, new RegExp(`input\\.action === '${action}'`), `${action} has no route`);
  }
});

test('only a company describes an environment, only a student sits an assessment', () => {
  const env = api.slice(api.indexOf('export async function saveCompanyEnvironment'), api.indexOf('export async function loadCompanyEnvironments'));
  assert.match(env, /role !== 'company'/);
  const run = api.slice(api.indexOf('export async function startAssessmentRun'), api.indexOf('export async function startAssessmentRun') + 900);
  assert.match(run, /role !== 'student'/);
});

// A plan derived on read would silently rewrite what somebody was already judged against.
test('the plan is stored with the engine version that produced it', () => {
  const env = api.slice(api.indexOf('export async function saveCompanyEnvironment'), api.indexOf('export async function loadCompanyEnvironments'));
  assert.match(env, /from\('assessment_plans'\)\.insert/);
  assert.match(env, /engine_version: plan\.version/);
  assert.match(env, /total_minutes: plan\.minutes/);
});

// Reads of post-launch tables must degrade; writes must fail loudly. The lesson that took the
// portal down once already.
test('reads degrade and writes fail loudly', () => {
  for (const table of ['company_environments', 'assessment_plans', 'assessment_runs']) {
    const reads = [...api.matchAll(new RegExp(`(\\w+)\\(member\\.supabase\\.from\\('${table}'\\)\\s*\\n?\\s*\\.select`, 'g'))];
    for (const [, helper] of reads) assert.equal(helper, 'optional', `a select on ${table} uses ${helper}()`);
  }
  const env = api.slice(api.indexOf('export async function saveCompanyEnvironment'), api.indexOf('export async function loadCompanyEnvironments'));
  assert.match(env, /migration may not be applied yet/);
});

test('the vertical whitelist is derived from the catalogue, not hand-listed', () => {
  assert.match(api, /const VERTICAL_SLUGS = new Set\(batchesByVertical\(\)\.map/);
  assert.match(api, /VERTICAL_SLUGS\.has\(vertical\)/);
});

// Resuming, not restarting. Losing ninety minutes to a closed tab is the failure the batch
// application already had once.
test('an existing run resumes rather than starting over', () => {
  const run = api.slice(api.indexOf('export async function startAssessmentRun'));
  assert.match(run.slice(0, 1200), /resumed: true/);
});

// A student is owed this BEFORE they spend ninety minutes.
test('disclosure works even when no company has described an environment yet', () => {
  const fn = api.slice(api.indexOf('export async function assessmentDisclosure'), api.indexOf('export async function startAssessmentRun'));
  assert.match(fn, /provisional: true/, 'an empty page is worse than a provisional plan');
  assert.match(fn, /candidateDisclosure\(/);
  assert.match(fn, /aedtPosture\(/, 'the student must be told what is not being done with the result');
});

// ── The form ──────────────────────────────────────────────────────────────────────────
test('every reverse-audit question reaches the form from the server', () => {
  assert.match(api, /questions: REVERSE_AUDIT_QUESTIONS/);
  assert.match(js, /state\.dashboard\?\.superIntern\?\.questions/);
  // Duplicating the questions client-side is how the form and the engine drift apart.
  for (const q of REVERSE_AUDIT_QUESTIONS) {
    assert.ok(!js.includes(q.ask), `the client carries its own copy of "${q.id}"`);
  }
});

test('the senior-hours field is present and framed honestly', () => {
  const dialog = html.slice(html.indexOf('id="environmentDialog"'), html.indexOf('id="evidenceRequestDialog"'));
  assert.match(dialog, /name="seniorHoursPerWeek"/);
  assert.match(dialog, /changes the assessment most/i);
  // A company that inflates this gets an assessment that does not match its own team.
  assert.match(dialog, /Be honest rather than generous/);
  assert.match(dialog, /three hours a week/);
});

test('the built plan shows its minutes, its steps, and why it is shaped that way', () => {
  const panel = js.slice(js.indexOf('function renderBatchBuilder'), js.indexOf("// ── What a team wants to see"));
  assert.match(panel, /engine\.budgetMinutes/);
  assert.match(panel, /plan\.because/, 'a plan nobody can interrogate is a black box');
  assert.match(panel, /Held back to the paid trial/);
  assert.match(panel, /role!=='company'/);
});

test('every class the builder renders is styled', () => {
  const region = js.slice(js.indexOf('// ── The batch builder'), js.indexOf("// ── What a team wants to see"));
  const classes = [...region.matchAll(/className=['"]([^'"]+)['"]/g)]
    .flatMap(m => m[1].split(/\s+/)).filter(c => c.startsWith('sib-') || c.startsWith('env-'));
  for (const name of new Set(classes)) assert.ok(css.includes(`.${name}`), `.${name} is rendered but never styled`);
});

// ── The schema ────────────────────────────────────────────────────────────────────────
test('the budget is enforced by the database, not only by product logic', () => {
  assert.match(migration, /assessment_plans_within_budget check \(total_minutes > 0 and total_minutes <= 90\)/);
  assert.equal(BUDGET_MINUTES, 90, 'the constraint and the engine disagree about the cap');
});

test('a student can start a run but never write its observations', () => {
  assert.match(migration, /assessment_runs_student_read[\s\S]{0,120}for select using \(auth\.uid\(\) = student_user_id\)/);
  assert.match(migration, /assessment_runs_student_start[\s\S]{0,140}for insert with check/);
  // No update policy: a candidate who can edit the reviewer's notes is not being assessed.
  assert.ok(!/assessment_runs[\s\S]{0,200}for update/.test(migration), 'a student can edit their own observations');
});

test('outcomes and plans are operator-only', () => {
  for (const table of ['placement_outcomes', 'assessment_plans']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.ok(!new RegExp(`create policy [a-z_]+ on public\\.${table}`).test(migration), `${table} has a policy and should be service-role only`);
  }
});

// ── The student side ──────────────────────────────────────────────────────────────────
// Both routes existed and were called by nothing, the same gap the simulation runner had.
test('the disclosure route is actually called from the portal', () => {
  assert.match(js, /action:'assessment-disclosure'/);
  assert.match(js, /action:'start-assessment'/);
  const card = js.slice(js.indexOf('function batchCard('), js.indexOf('let batchResumeUrl'));
  assert.match(card, /openAssessmentDisclosure\(batch\)/, 'nothing on the card opens it');
  assert.match(card, /What you are assessed on/);
});

// Before the ninety minutes, not after.
test('a student sees the whole battery before committing to it', () => {
  const paint = js.slice(js.indexOf('function paintAssessmentDisclosure'), js.indexOf('// ── The batch builder'));
  assert.match(paint, /plan\.minutes/);
  assert.match(paint, /c\.minutes/, 'each component must show its own cost');
  assert.match(paint, /c\.why/, 'each component must say what it measures');
});

// The difference between this and every other application a student has filled in.
test('what is NOT done with the result is shown, not just what is', () => {
  const paint = js.slice(js.indexOf('function paintAssessmentDisclosure'), js.indexOf('// ── The batch builder'));
  assert.match(paint, /What we do not do/);
  assert.match(paint, /disclosure\.notUsed/);
  assert.match(paint, /disclosure\.rights/);
  assert.match(css, /\.asd-not/);
});

test('a template is labelled as one rather than passed off as company-specific', () => {
  const paint = js.slice(js.indexOf('function paintAssessmentDisclosure'), js.indexOf('// ── The batch builder'));
  assert.match(paint, /data\.provisional/);
  assert.match(paint, /No company has described its environment for this batch yet/);
});

// A live Start button behind a closed door is a control that fails on submit.
test('no start button is offered while applications are closed', () => {
  const paint = js.slice(js.indexOf('function paintAssessmentDisclosure'), js.indexOf('// ── The batch builder'));
  assert.match(paint, /state\.dashboard\?\.batchApplicationsOpen===false/);
  assert.match(paint, /Batches are not open yet/);
  // And the button only exists when there is a real stored plan to run against.
  assert.match(paint, /else if\(plan\.id\)/);
});

test('starting again resumes, and says so', () => {
  const paint = js.slice(js.indexOf('function paintAssessmentDisclosure'), js.indexOf('// ── The batch builder'));
  assert.match(paint, /out\.resumed\?'Picked up where you left off\.'/);
});

test('the disclosure dialog exists and its icons resolve', () => {
  const dialog = html.slice(html.indexOf('id="assessmentDialog"'), html.indexOf('id="environmentDialog"'));
  assert.ok(dialog.length > 200);
  for (const icon of [...dialog.matchAll(/#(p-[a-z-]+)/g)].map(m => m[1])) {
    assert.ok(html.includes(`id="${icon}"`), `${icon} is referenced but not defined`);
  }
});

test('every class the disclosure renders is styled', () => {
  const region = js.slice(js.indexOf('function paintAssessmentDisclosure'), js.indexOf('// ── The batch builder'));
  const classes = [...region.matchAll(/className=['"]([^'"]+)['"]/g)]
    .flatMap(m => m[1].split(/\s+/)).filter(c => c.startsWith('asd-'));
  for (const name of new Set(classes)) assert.ok(css.includes(`.${name}`), `.${name} is rendered but never styled`);
});
