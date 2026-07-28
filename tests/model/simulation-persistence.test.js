import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientView, scenarioById } from '../../api/simulation-run.js';
import { startRun } from '../../api/simulation.js';
import { DEAL_ROOM } from '../../api/scenarios.js';

const api = readFileSync(new URL('../../api/simulation-run.js', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../../admin.js', import.meta.url), 'utf8');

// Showing what a choice reveals would turn the scenario into a multiple-choice test with the
// answers printed underneath it.
test('the candidate never sees what a choice reveals', () => {
  let run = startRun(DEAL_ROOM, { now: 0 });
  run = { ...run, stepId: 'first-look' };
  const view = clientView(DEAL_ROOM, run);
  const asText = JSON.stringify(view);
  assert.ok(view.step.options.length >= 2);
  assert.doesNotMatch(asText, /reveals/);
  assert.doesNotMatch(asText, /Goes to the adjustment first/);
  assert.doesNotMatch(asText, /defense/i, 'nor the defense question waiting for them');
});

// A client that could post its own state could post one where it decided differently.
test('the client posts a decision, never a state', () => {
  assert.match(api, /export async function advanceSimulation\(member, \{ runId, optionId, artifact, answer \}/);
  assert.doesNotMatch(api, /state: input\.state|input\.state/, 'state must never arrive from the client');
  assert.match(api, /\.eq\('user_id', member\.user\.id\)/, 'and a run can only be advanced by its owner');
});

test('a finished run cannot be advanced again', () => {
  assert.match(api, /if \(row\.status !== 'in_progress'\) throw new Error\('That run is already finished/);
});

// Losing a long run to a closed tab is the failure the batch application already had.
test('an existing run resumes rather than restarting', () => {
  assert.match(api, /status', 'in_progress'\)\.maybeSingle\(\)/);
  assert.match(api, /resumed: true/);
});

test('evidence is written only on completion', () => {
  assert.match(api, /if \(next\.done\) \{[\s\S]*?patch\.evidence/);
  // A partial run must never be readable as evidence of anything. The column is separate from
  // state for exactly that reason, and the migration says so.
  const sql = readFileSync(new URL('../../supabase/migrations/20260728500000_simulation_runs.sql', import.meta.url), 'utf8');
  assert.match(sql, /Filled only on completion/);
});

test('a misclick is not permanent: decisions are selected, then committed', () => {
  const fn = portal.slice(portal.indexOf('function paintSimulation'), portal.indexOf('async function stepSimulation'));
  assert.match(fn, /input\.type='radio'/);
  assert.match(fn, /Commit this decision/);
  assert.doesNotMatch(fn, /addEventListener\('click',\(\)=>stepSimulation\(\{optionId/, 'clicking an option must not commit it');
});

test('defense questions arrive with the final step, not before', () => {
  assert.match(api, /defense: next\.done \? defenseQuestions/);
});

// A rater under time pressure will otherwise read a simulation as a track record.
test('the reviewer view states the limitation on every card', () => {
  assert.match(admin, /not that they have done this work in a real role/);
});

test('the reviewer sees the authored reading, not their own inference', () => {
  assert.match(admin, /reveals: option\?\.reveals|d\.reveals/);
  const css = readFileSync(new URL('../../admin.css', import.meta.url), 'utf8');
  assert.match(css, /\.srd-reveals/, 'and it is set apart visually');
});

test('the reviewer view shows no score anywhere', () => {
  const fn = admin.slice(admin.indexOf('async function renderSimulationRuns'), admin.indexOf('async function renderDeliveryHealth'));
  // Checked against what is RENDERED, not the source: a comment explaining that time is never
  // a score contains the word "score" and is the opposite of the problem.
  const rendered = fn.match(/textContent = [^;]+;/g) || [];
  for (const line of rendered) {
    assert.doesNotMatch(line, /score|rating|rank/i, `a verdict reached the reviewer UI: ${line}`);
  }
  assert.ok(rendered.length > 4, 'and the view actually renders something');
});

test('the runner degrades before its migration lands', () => {
  const portalApi = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(portalApi, /loadSimulations\(member\)\.catch\(\(\) => \[\]\)/);
});

test('scenarios resolve by id for the reviewer', () => {
  assert.equal(scenarioById('ib-deal-room-1').id, 'ib-deal-room-1');
  assert.equal(scenarioById('nope'), null);
});
