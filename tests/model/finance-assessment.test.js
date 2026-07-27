import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXCEL_EXERCISES, TECHNICAL_BANK, assessmentFor, EXCEL_RUBRIC, DISQUALIFYING, scoreGuidance,
} from '../../api/finance-assessment.js';

const SLUGS = Object.keys(EXCEL_EXERCISES);

// The whole point: the student is not asked to invent a project from nothing.
test('Covenda supplies the exercise rather than asking for one', () => {
  for (const slug of SLUGS) {
    const e = EXCEL_EXERCISES[slug];
    assert.ok(e.supplied.length > 40, `${slug} must state what we provide`);
    assert.ok(e.task.length > 20, slug);
    assert.ok(e.minutes > 0 && e.minutes <= 30, `${slug}: has to fit in a sitting`);
  }
});

// Excel adeptness is only visible in the doing. A finished workbook hides all of it.
test('the recording is the artifact, and the rubric reads method not answer', () => {
  assert.match(EXCEL_RUBRIC[9], /Structures before calculating/);
  assert.match(scoreGuidance('accounting-audit').note, /Score the method, not the finished file/);
  assert.match(scoreGuidance('accounting-audit').note, /reached by trial and error scores below/);
});

test('every exercise tells a rater what to watch for', () => {
  for (const slug of SLUGS) {
    assert.ok(EXCEL_EXERCISES[slug].watchFor.length >= 3, slug);
    assert.ok(EXCEL_EXERCISES[slug].shortcuts.length >= 2, slug);
  }
});

// Publishing the bank is deliberate — we are testing the follow-up, not secret knowledge.
test('every technical question carries a follow-up and what it probes', () => {
  for (const [slug, qs] of Object.entries(TECHNICAL_BANK)) {
    assert.ok(qs.length >= 3, slug);
    for (const q of qs) {
      assert.ok(q.q.length > 15, slug);
      assert.ok(q.followUp.length > 15, `${slug}: every question needs a follow-up`);
      assert.ok(q.probes.length > 15, `${slug}: state what it is reading`);
    }
  }
});

test('the student is told the bank is published on purpose', () => {
  assert.match(assessmentFor('investment-banking').note, /published on purpose/);
  assert.match(assessmentFor('investment-banking').note, /listening to the follow-up/);
});

// The classic undergraduate confusion, and the classic tell, are both in the bank.
test('the bank includes the questions that actually discriminate', () => {
  const ib = TECHNICAL_BANK['investment-banking'].map(q => q.q).join(' ');
  assert.match(ib, /enterprise value if a company raises debt/);
  const awm = TECHNICAL_BANK['asset-wealth-management'].map(q => q.q).join(' ');
  assert.match(awm, /good decision and a good outcome/);
});

// Hiding an error is different in kind from making one.
test('forcing a balance with a plug is named as disqualifying, with the reason', () => {
  assert.equal(DISQUALIFYING.length >= 1, true);
  assert.match(DISQUALIFYING[0].move, /plug/i);
  assert.match(DISQUALIFYING[0].why, /conceals the error/);
});

test('an unknown specialisation returns null rather than a generic assessment', () => {
  assert.equal(assessmentFor('underwater-basket-weaving'), null);
});

test('the whole assessment fits in a sitting', () => {
  for (const slug of SLUGS) {
    assert.ok(assessmentFor(slug).totalMinutes <= 45, `${slug} is too long`);
  }
});
