import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentFor, verticals, SOFTWARE, PROFESSIONAL, CONSUMER, HEALTHCARE } from '../../api/assessments.js';
import { BATCH_CATALOG } from '../../api/batches.js';

// The framework is shared; the medium is not. One exercise with the vertical swapped into the
// wording would test reading comprehension, not the work.
test('every vertical assesses in its own medium', () => {
  const media = [SOFTWARE, PROFESSIONAL, CONSUMER, HEALTHCARE].map(v => v.medium);
  assert.equal(new Set(media).size, 4, 'no two verticals share a medium');
  assert.match(SOFTWARE.medium, /code/);
});

test('every specialisation in the catalogue has a supplied exercise', () => {
  const missing = [];
  for (const b of BATCH_CATALOG) {
    if (!assessmentFor(b.discipline, b.slug)) missing.push(`${b.discipline}/${b.slug}`);
  }
  assert.deepEqual(missing, [], 'no specialisation should be left without one');
});

// The whole point: the student invents nothing.
test('Covenda supplies the material everywhere', () => {
  for (const b of BATCH_CATALOG) {
    const a = assessmentFor(b.discipline, b.slug);
    const supplied = a.exercise?.supplied || '';
    assert.ok(supplied.length > 30, `${b.slug}: must state what we hand them`);
  }
});

test('software exercises are about reading and fixing code, not writing from scratch', () => {
  const ml = SOFTWARE.exercises['ai-ml'];
  assert.match(ml.supplied, /leak/i);
  const pe = SOFTWARE.exercises['product-engineering'];
  assert.match(pe.supplied, /unfamiliar codebase/i);
  assert.match(pe.task, /without breaking anything else/);
});

// Each exercise plants a specific trap, so raters converge on what they are watching.
test('each exercise tells a rater what to watch for', () => {
  for (const v of [SOFTWARE, PROFESSIONAL, CONSUMER, HEALTHCARE]) {
    for (const [slug, ex] of Object.entries(v.exercises)) {
      assert.ok(ex.watchFor.length >= 2, `${slug}`);
      assert.ok(ex.minutes > 0 && ex.minutes <= 30, `${slug}: fits a sitting`);
    }
  }
});

test('every concept distractor explains the misconception it catches', () => {
  for (const v of [SOFTWARE, PROFESSIONAL, CONSUMER, HEALTHCARE]) {
    for (const c of v.concepts) {
      assert.equal(c.options.length, 4, v.vertical);
      assert.ok(c.why.length > 40, `${v.vertical}: ${c.q}`);
    }
  }
});

// Healthcare must never create a reason to touch real data.
test('healthcare exercises are synthetic by construction', () => {
  assert.match(HEALTHCARE.medium, /synthetic/i);
  for (const ex of Object.values(HEALTHCARE.exercises)) {
    assert.doesNotMatch(ex.supplied, /\breal (patient|clinical) data\b/i);
  }
  const phi = HEALTHCARE.concepts.find(c => /Safe Harbor/i.test(c.q));
  assert.ok(phi, 'the de-identification trap is taught in the concepts');
  assert.equal(phi.options[phi.answer], 'Admission date');
});

test('reasoning problems read process, and say what weak and strong look like', () => {
  for (const v of [SOFTWARE, PROFESSIONAL, CONSUMER, HEALTHCARE]) {
    for (const r of v.reasoning) {
      assert.ok(r.reveals.length > 25, r.id);
      assert.ok(r.weak.length > 15 && r.strong.length > 15, r.id);
    }
  }
});

test('finance routes to its own richer module rather than being duplicated', () => {
  const fin = assessmentFor('Accounting & finance', 'investment-banking');
  assert.ok(fin);
  assert.ok(fin.exercise.shortcuts, 'finance carries Excel-specific detail the others do not');
  assert.equal(verticals().length, 5);
});

test('an unknown vertical or slug returns null rather than a generic exercise', () => {
  assert.equal(assessmentFor('Astrology', 'x'), null);
  assert.equal(assessmentFor('Software & AI', 'not-a-slug'), null);
});
