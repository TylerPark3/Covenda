import test from 'node:test';
import assert from 'node:assert/strict';
import { BATCH_CATALOG } from '../../api/batches.js';
import { SCENARIOS, scenarioFor } from '../../api/scenarios.js';
import { validateScenario, startRun, currentStep, advance, defenseQuestions, evidenceFrom } from '../../api/simulation.js';

// Every batch card advertises "The sitting: ..." to the student. A card that promises a
// scenario with nothing behind it is worse than a card that promises nothing.
test('every batch a student can open has a scenario behind it', () => {
  const missing = BATCH_CATALOG.filter(b => !scenarioFor(b.slug)).map(b => b.slug);
  assert.deepEqual(missing, [], 'these batches advertise a sitting that does not exist');
});

test('scenario ids are unique across both files', () => {
  const ids = Object.values(SCENARIOS).map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 25);
});

test('one scenario per specialisation, so scenarioFor is not picking arbitrarily', () => {
  const bySpec = {};
  for (const s of Object.values(SCENARIOS)) (bySpec[s.specialization] ||= []).push(s.id);
  const doubled = Object.entries(bySpec).filter(([, v]) => v.length > 1);
  assert.deepEqual(doubled, []);
});

// Walk every branch of every scenario. A dangling `next` is invisible until a student picks
// that one option and the sitting dead-ends on them mid-assessment.
test('every branch of every scenario terminates', () => {
  for (const s of Object.values(SCENARIOS)) {
    const completed = [];
    const walk = (run, depth) => {
      assert.ok(depth <= 30, `${s.id} does not terminate`);
      if (run.done) { completed.push(run); return; }
      const step = currentStep(s, run);
      if (!step) { completed.push(run); return; }
      if (step.kind === 'decide') { for (const o of step.options) walk(advance(s, run, { optionId: o.id }), depth + 1); return; }
      if (step.kind === 'produce') { walk(advance(s, run, { artifact: 'An answer.' }), depth + 1); return; }
      if (step.kind === 'defend') { walk(advance(s, run, { answer: 'The trade I made.' }), depth + 1); return; }
      walk(advance(s, run, {}), depth + 1);
    };
    walk(startRun(s), 0);
    assert.ok(completed.length > 0, `${s.id} produced no completed path`);
    for (const run of completed) assert.equal(run.done, true, `${s.id} left a path unfinished`);
  }
});

test('every scenario passes the engine validator', () => {
  for (const s of Object.values(SCENARIOS)) {
    const result = validateScenario(s);
    if (result && result.ok === false) assert.fail(`${s.id}: ${JSON.stringify(result.errors || result)}`);
  }
});

// Nothing to defend if nothing was committed to. physical-ai-rig-1 ran reveal -> defend with
// no produce step, so it was the only sitting that questioned a student on work they had not
// been asked to do.
test('every scenario asks for work before it questions the student', () => {
  for (const s of Object.values(SCENARIOS)) {
    assert.ok(s.steps.some(x => x.kind === 'produce'), `${s.id} never asks the student to produce anything`);
    assert.ok(s.steps.some(x => x.kind === 'defend'), `${s.id} never questions the student`);
  }
});

// A decide step where one option is obviously correct tests reading comprehension.
test('every decision offers at least three options, each with a written cost and follow-up', () => {
  for (const s of Object.values(SCENARIOS)) {
    for (const step of s.steps.filter(x => x.kind === 'decide')) {
      assert.ok((step.options || []).length >= 3, `${s.id}/${step.id} is not a real choice`);
      for (const o of step.options) {
        assert.ok(o.reveals && o.reveals.length > 20, `${s.id}/${step.id}/${o.id} has no written reading`);
        assert.ok(o.defense && o.defense.trim().endsWith('?'), `${s.id}/${step.id}/${o.id} has no follow-up question`);
      }
    }
  }
});

// The engine emits evidence. Whether that evidence is worth anything is a human's call, and
// the moment the engine returns a number that stops being true.
test('a completed run yields defense questions and never a score', () => {
  for (const s of Object.values(SCENARIOS)) {
    let run = startRun(s);
    let guard = 0;
    while (!run.done && guard++ < 30) {
      const step = currentStep(s, run);
      if (!step) break;
      if (step.kind === 'decide') run = advance(s, run, { optionId: step.options[0].id });
      else if (step.kind === 'produce') run = advance(s, run, { artifact: 'An answer.' });
      else if (step.kind === 'defend') run = advance(s, run, { answer: 'The trade I made.' });
      else run = advance(s, run, {});
    }
    assert.ok(defenseQuestions(s, run).length > 0, `${s.id} generated no defense questions`);
    const evidence = evidenceFrom(s, run);
    assert.ok(!('score' in evidence) && !('rating' in evidence), `${s.id} emitted a score from the engine`);
  }
});

// The standing rule: never ask a student for real patient data.
test('no clinical scenario asks for real patient data, and each says it is synthetic', () => {
  const clinical = ['clinical-operations', 'health-analytics', 'revenue-cycle', 'regulatory-quality', 'digital-health-product'];
  for (const spec of clinical) {
    const s = scenarioFor(spec);
    assert.ok(/synthetic|fabricated/i.test(s.brief), `${s.id} does not state it is synthetic`);
    const text = JSON.stringify(s).toLowerCase();
    assert.ok(!/upload (your|a) (patient|medical|health) record/.test(text), `${s.id} asks for real records`);
  }
});
