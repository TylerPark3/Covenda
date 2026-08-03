// Authored content is the one input nobody validates.
//
// Request data gets parsed, checked and rejected. Authored content — 28 scenarios and 80
// questions, written by hand — goes straight into code that indexes it without asking. The
// deref scanner flagged the reads; the reads are not the bug. Scattering `?.` through
// clientView() would turn "this scenario is broken" into "this scenario renders blank",
// which is worse: a student sits in a simulation missing half its steps and cannot tell.
//
// What these guard, both silent in production if they ever break:
//
//   clientView() in simulation-run.js reads scenario.steps.length and findIndex on it. A
//   scenario authored without steps throws mid-request, so a student's run 500s AFTER they
//   have started it. Duplicate step ids are worse: findIndex returns the first match, so the
//   run silently rewinds and the student repeats a step.
//
//   rotate() in question-bank.js does `index % question.options.length`. Zero options makes
//   that NaN and the answer index NaN — a question nobody can answer, scored as if they
//   could. It cannot happen today because debias() rotates `concepts` only, and reasoning
//   questions are open-response; this holds that separation in place.
//
// Nothing here was failing when it was written. That is the point of a guard.
//
// Content is fixed at build time, so a test is the right place to find this: it fails in CI,
// not in front of somebody halfway through an assessment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from '../../api/scenarios.js';
import { SCENARIOS_2 } from '../../api/scenarios-2.js';
import { bankFor, bankCounts } from '../../api/question-bank.js';

// SCENARIOS is the flat catalogue and it already spreads ...SCENARIOS_2 (scenarios.js:309).
// Iterating both counts every phase-3-6 scenario twice and reports its own duplicate.
const allScenarios = Object.entries(SCENARIOS).map(([key, s]) => [`SCENARIOS.${key}`, s]);

test('every scenario exists and is an object', () => {
  // 6 in scenarios.js + 22 in scenarios-2.js. Pinned so a scenario silently disappearing
  // from the catalogue fails here rather than being noticed by its absence.
  assert.equal(allScenarios.length, 28, `expected 28 authored scenarios, got ${allScenarios.length}`);
  for (const [name, s] of allScenarios) {
    assert.ok(s && typeof s === 'object', `${name} is not an object`);
  }
});

test('every scenario has at least one step — clientView indexes steps unguarded', () => {
  for (const [name, s] of allScenarios) {
    assert.ok(Array.isArray(s.steps), `${name}.steps must be an array`);
    assert.ok(s.steps.length > 0, `${name} has no steps; clientView would throw mid-run`);
  }
});

test('every step has a stable id, and ids are unique within a scenario', () => {
  for (const [name, s] of allScenarios) {
    const ids = s.steps.map(step => step?.id);
    for (const id of ids) {
      assert.ok(id && typeof id === 'string', `${name} has a step with no id`);
    }
    // findIndex(s => s.id === run.stepId) resolves to the FIRST match. Duplicate ids mean a
    // run silently rewinds to an earlier step and the student repeats it.
    assert.equal(new Set(ids).size, ids.length, `${name} has duplicate step ids`);
  }
});

test('every scenario carries the fields clientView reads', () => {
  for (const [name, s] of allScenarios) {
    for (const field of ['id', 'title']) {
      assert.ok(s[field], `${name} is missing ${field}`);
    }
  }
});

test('the merge into SCENARIOS loses nothing — a collision would silently shadow a scenario', () => {
  // SCENARIOS is keyed by id, so two scenarios sharing one id means the second overwrites the
  // first and a student is served work nobody meant to give them. Count the sources against
  // the merged catalogue rather than re-deriving ids from it.
  const sourceCount = 6 + SCENARIOS_2.length;   // six in scenarios.js, plus the second file
  assert.equal(Object.keys(SCENARIOS).length, sourceCount,
    'a scenario was lost in the merge — two share an id');
});

test('step options, where present, have ids and labels', () => {
  for (const [name, s] of allScenarios) {
    for (const step of s.steps) {
      if (!Array.isArray(step.options)) continue;
      const ids = step.options.map(o => o?.id);
      for (const o of step.options) {
        assert.ok(o?.id, `${name}/${step.id} has an option with no id`);
        assert.ok(o?.label, `${name}/${step.id} option ${o?.id} has no label`);
      }
      assert.equal(new Set(ids).size, ids.length,
        `${name}/${step.id} has duplicate option ids`);
    }
  }
});

// ── The question bank ────────────────────────────────────────────────────────────────────

const verticals = Object.keys(bankCounts());

test('every vertical has a populated bank', () => {
  assert.ok(verticals.length >= 5, 'expected the authored verticals');
  for (const v of verticals) {
    const counts = bankCounts()[v];
    assert.ok(counts.concepts > 0, `${v} has no concept questions`);
    assert.ok(counts.reasoning > 0, `${v} has no reasoning questions`);
  }
});

// Only `concepts` are multiple choice. `reasoning` questions are open-response — they carry
// `q` and `reveals` and deliberately have no options, and debias() rotates concepts only
// (question-bank.js:437), so rotate() never sees a question without options. Applying MCQ
// rules to reasoning was this file's own first mistake, not a fault in the content.
const conceptsOf = v => (bankFor(v) || {}).concepts || [];
const reasoningOf = v => (bankFor(v) || {}).reasoning || [];

test('every multiple-choice question has at least two options', () => {
  for (const v of verticals) {
    conceptsOf(v).forEach((q, i) => {
      assert.ok(Array.isArray(q.options), `${v}/concepts[${i}] options must be an array`);
      assert.ok(q.options.length >= 2,
        `${v}/concepts[${i}] has ${q.options.length} option(s); rotate() needs at least 2`);
    });
  }
});

test('every answer index points at an option that exists', () => {
  for (const v of verticals) {
    conceptsOf(v).forEach((q, i) => {
      assert.equal(Number.isInteger(q.answer), true, `${v}/concepts[${i}] answer must be an integer`);
      assert.ok(q.answer >= 0 && q.answer < q.options.length,
        `${v}/concepts[${i}] answer ${q.answer} is outside 0..${q.options.length - 1}`);
    });
  }
});

test('rotation preserves the correct answer at every shift', () => {
  // The property rotate() exists to hold: shuffling option order must move the answer index
  // with it. An off-by-one marks correct students wrong, silently, across a whole bank.
  for (const v of verticals) {
    conceptsOf(v).forEach((q, i) => {
      const correct = q.options[q.answer];
      for (let shift = 0; shift < q.options.length; shift++) {
        const rotated = q.options.slice(shift).concat(q.options.slice(0, shift));
        const answer = (q.answer - shift + q.options.length) % q.options.length;
        assert.deepEqual(rotated[answer], correct, `${v}/concepts[${i}] loses its answer at shift ${shift}`);
      }
    });
  }
});

test('no multiple-choice question has duplicate options', () => {
  for (const v of verticals) {
    conceptsOf(v).forEach((q, i) => {
      const labels = q.options.map(o => (typeof o === 'string' ? o : o?.label ?? JSON.stringify(o)));
      assert.equal(new Set(labels).size, labels.length, `${v}/concepts[${i}] has duplicate options`);
    });
  }
});

test('every question has a readable prompt — the field is `q`', () => {
  for (const v of verticals) {
    for (const [kind, list] of [['concepts', conceptsOf(v)], ['reasoning', reasoningOf(v)]]) {
      list.forEach((q, i) => {
        assert.ok(q.q && String(q.q).trim().length > 10, `${v}/${kind}[${i}] has no readable prompt`);
      });
    }
  }
});

test('open-response questions say what they reveal, and carry no answer key', () => {
  for (const v of verticals) {
    reasoningOf(v).forEach((q, i) => {
      assert.ok(q.reveals, `${v}/reasoning[${i}] must state what it reveals`);
      assert.equal('answer' in q, false, `${v}/reasoning[${i}] is open-response and must not carry an answer key`);
    });
  }
});
