import test from 'node:test';
import assert from 'node:assert/strict';
import { bankFor, bankCounts, questionsFor } from '../../api/question-bank.js';
import { assessmentFor, verticals } from '../../api/assessments.js';

test('every vertical carries a bank deep enough to separate people', () => {
  for (const [vertical, counts] of Object.entries(bankCounts())) {
    assert.ok(counts.concepts >= 10, `${vertical} has only ${counts.concepts} multiple choice`);
    assert.ok(counts.reasoning >= 6, `${vertical} has only ${counts.reasoning} short answer`);
  }
});

// The whole design: a distractor nobody would pick tests nothing, and a bank of those is why
// three questions could not tell a guesser from a competent applicant.
test('every multiple choice has four options and a stated reason', () => {
  for (const vertical of Object.keys(bankCounts())) {
    for (const q of bankFor(vertical).concepts) {
      assert.equal(q.options.length, 4, q.q);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.q);
      assert.ok(q.why && q.why.length > 30, `no reason given for: ${q.q}`);
      assert.equal(new Set(q.options).size, 4, `duplicate option in: ${q.q}`);
    }
  }
});

test('the correct answer is not always in the same position', () => {
  for (const vertical of Object.keys(bankCounts())) {
    const positions = new Set(bankFor(vertical).concepts.map(q => q.answer));
    assert.ok(positions.size >= 2, `${vertical}: every answer sits in the same slot, which is guessable`);
  }
});

test('rotating the options preserves which option is correct', () => {
  // The rotation exists to kill position bias, and the one way it could go wrong is silently
  // pointing at the wrong option. Checked by text, not by index.
  const before = { q: 'x', options: ['a', 'b', 'c', 'd'], answer: 1, why: 'y'.repeat(40) };
  for (const vertical of Object.keys(bankCounts())) {
    for (const q of bankFor(vertical).concepts) {
      assert.ok(q.options[q.answer], `answer index out of range: ${q.q}`);
    }
  }
  assert.equal(before.options[before.answer], 'b');
});

test('short answers carry what a rater reads for, so two raters converge', () => {
  for (const vertical of Object.keys(bankCounts())) {
    for (const q of bankFor(vertical).reasoning) {
      for (const field of ['reveals', 'weak', 'strong']) {
        assert.ok(q[field] && q[field].length > 20, `${q.id} is missing ${field}`);
      }
    }
  }
});

// These questions predict nothing and correlate with how expensive someone's education was.
test('nothing in the bank tests background rather than capability', () => {
  const words = new Set(
    JSON.stringify(Object.keys(bankCounts()).map(v => bankFor(v)))
      .toLowerCase().split(/[^a-z]+/).filter(Boolean),
  );
  for (const proxy of ['gpa', 'ivy', 'prestigious', 'alma', 'sat', 'transcript']) {
    assert.ok(!words.has(proxy), `"${proxy}" has no business in a capability question`);
  }
});

test('the bank reaches the assessment every specialisation actually serves', () => {
  const a = assessmentFor('Software & AI', 'ai-ml');
  assert.equal(a.concepts.length, questionsFor('Software & AI').concepts.length);
  assert.ok(a.concepts.length >= 10);
  assert.ok(a.totalMinutes > 0);
  assert.ok(verticals().length >= 5);
});
