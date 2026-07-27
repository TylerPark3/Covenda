import test from 'node:test';
import assert from 'node:assert/strict';
import { stripProxies, RESUME_QUESTIONS_VERSION } from '../../api/resume-questions.js';
import { CONCEPT_QUESTIONS, BRAINTEASERS, brainteaserFor, BRAINTEASER_RUBRIC } from '../../api/finance-assessment.js';

// A model generating questions from a résumé will reach for prestige unprompted — résumés
// are dense with it. The instruction is not enough; the output is checked.
test('prestige questions are dropped, not rewritten', () => {
  const r = stripProxies([
    { question: 'You interned at a top-tier firm — what was that like?', followUp: 'x' },
    { question: 'What was your GPA?', followUp: 'x' },
    { question: 'You wrote "rebuilt the intake sheet" — what was wrong with the old one?', followUp: 'Why had nobody fixed it?' },
  ]);
  assert.equal(r.questions.length, 1);
  assert.equal(r.dropped.length, 2);
  assert.match(r.dropped[0].reason, /rather than capability/);
});

test('gap-in-history questions are refused', () => {
  const r = stripProxies([{ question: 'Why did you leave that role?', followUp: 'x' }]);
  assert.equal(r.questions.length, 0);
});

test('a legitimate question about their own work survives', () => {
  const r = stripProxies([
    { question: 'You wrote "cut close time from 9 days to 5" — what was taking the four days?', followUp: 'What did you try that did not work?' },
  ]);
  assert.equal(r.questions.length, 1);
  assert.equal(r.dropped.length, 0);
});

// ── Concept questions ─────────────────────────────────────────────────────────────────
// A wrong option nobody would pick teaches nothing about the person who did not pick it.
test('every multiple-choice distractor is a real misconception', () => {
  for (const [slug, qs] of Object.entries(CONCEPT_QUESTIONS)) {
    for (const q of qs) {
      assert.equal(q.options.length, 4, slug);
      assert.ok(q.answer >= 0 && q.answer < 4, slug);
      assert.ok(q.why.length > 40, `${slug}: every answer explains the misconception`);
    }
  }
});

test('the enterprise-value question is in the bank, since it is the classic error', () => {
  const ib = CONCEPT_QUESTIONS['investment-banking'];
  const ev = ib.find(q => /enterprise value/i.test(q.q));
  assert.ok(ev);
  assert.equal(ev.options[ev.answer], 'Unchanged');
  assert.match(ev.why, /most common undergraduate error/);
});

// ── Brainteasers ──────────────────────────────────────────────────────────────────────
test('brainteasers carry what they reveal, and what weak and strong look like', () => {
  for (const b of BRAINTEASERS) {
    assert.ok(b.q.length > 60, b.id);
    assert.ok(b.reveals.length > 30, `${b.id}: say what it reads`);
    assert.ok(b.weak.length > 20 && b.strong.length > 20, b.id);
  }
});

test('the two-ropes problem is there and its insight is stated', () => {
  const ropes = BRAINTEASERS.find(b => b.id === 'ropes');
  assert.match(ropes.q, /two ropes/i);
  assert.match(ropes.reveals, /both ends/);
});

test('brainteasers rotate so a cohort does not share one', () => {
  const ids = [0, 1, 2, 3].map(i => brainteaserFor(i).id);
  assert.equal(new Set(ids).size, 4);
  assert.equal(brainteaserFor(99).id, BRAINTEASERS[99 % BRAINTEASERS.length].id);
});

// Scored on reasoning, because a student who thinks it is trivia will guess.
test('the brainteaser rubric reads reasoning, not the answer', () => {
  assert.match(BRAINTEASER_RUBRIC[4], /Guesses|recites/);
  assert.match(BRAINTEASER_RUBRIC[6], /May not finish/);
  assert.match(BRAINTEASER_RUBRIC[9], /what they do not yet know/);
});

test('the module is versioned', () => {
  assert.ok(RESUME_QUESTIONS_VERSION.startsWith('resume-questions-'));
});
