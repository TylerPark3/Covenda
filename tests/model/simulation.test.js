import test from 'node:test';
import assert from 'node:assert/strict';
import { startRun, advance, currentStep, defenseQuestions, evidenceFrom, validateScenario, EVENT_TYPES } from '../../api/simulation.js';
import { DEAL_ROOM, CODEBASE, scenarioFor } from '../../api/scenarios.js';

function play(scenario, picks) {
  let run = startRun(scenario, { now: 0 });
  let t = 0, guard = 0;
  const queue = [...picks];
  while (!run.done && guard++ < 30) {
    const step = currentStep(scenario, run);
    t += 30000;
    if (step.kind === 'decide') run = advance(scenario, run, { optionId: queue.shift() || step.options[0].id }, { now: t });
    else if (step.kind === 'produce') run = advance(scenario, run, { artifact: 'ref' }, { now: t });
    else if (step.kind === 'defend') run = advance(scenario, run, { answer: 'because' }, { now: t });
    else run = advance(scenario, run, {}, { now: t });
  }
  return run;
}

// The whole reason to build two before twenty-five.
test('two radically different workflows run on one engine, unmodified', () => {
  const ib = play(DEAL_ROOM, ['bridge', 'flag-now']);
  const swe = play(CODEBASE, ['patch', 'integers']);
  assert.equal(ib.done, true);
  assert.equal(swe.done, true);
  assert.ok(ib.decisions.length >= 2 && swe.decisions.length >= 2);
});

test('a scenario missing what a choice reveals is refused', () => {
  const bad = { id: 'x', specialization: 'y', steps: [
    { id: 'a', kind: 'decide', options: [{ id: '1', label: 'one' }, { id: '2', label: 'two', reveals: 'ok' }] },
  ] };
  const v = validateScenario(bad);
  assert.equal(v.ok, false);
  // Without it the event log is a record of clicks rather than evidence.
  assert.ok(v.problems.some(p => /missing what this choice reveals/.test(p)));
});

test('a decision with one option is refused, because it is not a decision', () => {
  const v = validateScenario({ id: 'x', specialization: 'y', steps: [{ id: 'a', kind: 'decide', options: [{ id: '1', reveals: 'r' }] }] });
  assert.ok(v.problems.some(p => /at least two options/.test(p)));
});

test('a branch pointing nowhere is caught before anyone runs it', () => {
  const v = validateScenario({ id: 'x', specialization: 'y', steps: [
    { id: 'a', kind: 'decide', options: [{ id: '1', reveals: 'r', next: 'ghost' }, { id: '2', reveals: 'r' }] },
  ] });
  assert.ok(v.problems.some(p => /branches to a step that does not exist/.test(p)));
});

// Two candidates must be able to take genuinely different paths.
test('decisions branch, they do not just advance', () => {
  const withBranch = DEAL_ROOM.steps.find(s => s.kind === 'decide');
  assert.ok(withBranch.options.every(o => o.next || withBranch.next), 'every option must lead somewhere');
});

// A run that cannot be replayed cannot be reviewed.
test('advancing returns new state rather than mutating', () => {
  const run = startRun(DEAL_ROOM, { now: 0 });
  const before = JSON.stringify(run);
  advance(DEAL_ROOM, run, {}, { now: 1000 });
  assert.equal(JSON.stringify(run), before, 'the original run must be untouched');
});

test('an invalid option is refused rather than silently ignored', () => {
  let run = startRun(DEAL_ROOM, { now: 0 });
  run = advance(DEAL_ROOM, run, {}, { now: 1 });   // past the reveal, onto the decision
  assert.throws(() => advance(DEAL_ROOM, run, { optionId: 'not-real' }, { now: 2 }), /not one of the options/);
});

// A generic follow-up can be prepared in advance and answered by anyone.
test('defense questions quote the candidate back to themselves', () => {
  const shortcut = play(CODEBASE, ['patch', 'integers']);
  const questions = defenseQuestions(CODEBASE, shortcut);
  assert.match(questions[0].question, /Rounding would have made the reports stop/);

  const thorough = play(CODEBASE, ['reproduce', 'integers']);
  assert.match(defenseQuestions(CODEBASE, thorough)[0].question, /failing test first/);
  assert.notEqual(questions[0].question, defenseQuestions(CODEBASE, thorough)[0].question);
});

// The engine emits evidence, never a score. A number would become the product.
test('the engine produces evidence, not a verdict', () => {
  const run = play(DEAL_ROOM, ['bridge', 'flag-now']);
  const ev = evidenceFrom(DEAL_ROOM, run);
  assert.equal(ev.ok, true);
  assert.ok(ev.claims.length > 0);
  const asText = JSON.stringify(ev);
  assert.doesNotMatch(asText, /"score"|"rating"|"rank"/, 'no verdict anywhere in the output');
});

test('every claim carries what it cannot prove', () => {
  const ev = evidenceFrom(DEAL_ROOM, play(DEAL_ROOM, ['bridge', 'flag-now']));
  for (const claim of ev.claims) {
    assert.match(claim.evidence_meta.limitation, /not that they have done this work in a real role/);
  }
});

// job_simulation caps at artifact in the registry; a simulation is observed behaviour under
// conditions Covenda controlled, which is not the same as having done the job.
test('a simulation cannot exceed the artifact tier', () => {
  const ev = evidenceFrom(CODEBASE, play(CODEBASE, ['reproduce', 'integers']));
  for (const claim of ev.claims) assert.equal(claim.verification_tier, 'artifact');
});

test('an unfinished run produces no evidence at all', () => {
  const run = startRun(DEAL_ROOM, { now: 0 });
  assert.equal(evidenceFrom(DEAL_ROOM, run).ok, false);
});

test('time to decide is recorded but never scored by the engine', () => {
  const run = play(DEAL_ROOM, ['bridge', 'flag-now']);
  assert.ok(Number.isFinite(run.decisions[0].secondsTaken));
  // Whether speed matters is a property of the scenario, not the engine.
  const src = JSON.stringify(run);
  assert.doesNotMatch(src, /speedScore|penalty/);
});

test('nothing in either scenario is a real company, deal, or codebase', () => {
  const text = JSON.stringify([DEAL_ROOM, CODEBASE]).toLowerCase();
  for (const name of ['goldman', 'stripe', 'evercore', 'blackstone', 'linear']) {
    assert.ok(!text.includes(name), `${name} must not appear inside a scenario`);
  }
});

test('scenarios are addressable by specialisation', () => {
  assert.equal(scenarioFor('investment-banking').id, DEAL_ROOM.id);
  assert.equal(scenarioFor('product-engineering').id, CODEBASE.id);
  assert.equal(scenarioFor('nothing-here'), null);
  assert.ok(EVENT_TYPES.includes('scenario_abandoned'));
});
