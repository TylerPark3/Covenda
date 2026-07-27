import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyReadiness, nextSteps, readinessFor, categorise, groupByCategory, OPPORTUNITY_CATEGORIES,
} from '../../api/readiness.js';

const gap = (key, met = false) => ({ key, met, label: key });

test('meeting the bar with no gaps is a strong fit today', () => {
  const r = classifyReadiness(85, [gap('skills', true)]);
  assert.equal(r.state, 'ready');
  assert.match(r.label, /today/i);
});

// The distinction the whole module exists for: a closeable gap is not a rejection.
test('a closeable gap reads as "could be", never as a no', () => {
  const r = classifyReadiness(40, [gap('defense')]);
  assert.equal(r.state, 'reachable');
  assert.match(r.label, /could be/i);
  assert.equal(r.reachable, true);
});

test('a gap that takes months is named as slow rather than hidden or sugared', () => {
  const r = classifyReadiness(30, [gap('trial')]);
  assert.equal(r.state, 'building');
  assert.match(r.summary, /takes real time/i);
});

test('every state stays reachable — nothing is ever a permanent no', () => {
  for (const g of [[], [gap('trial')], [gap('defense')], [gap('skills'), gap('trial')]]) {
    assert.equal(classifyReadiness(10, g).reachable, true);
  }
});

// A gap without a next step is a rejection with extra words.
test('every gap ships the specific move that closes it', () => {
  const steps = nextSteps([gap('skills'), gap('defense'), gap('referral')]);
  assert.ok(steps.length > 0);
  for (const s of steps) {
    assert.ok(s.how && s.how.length > 10, `${s.key} has no how`);
    assert.ok(s.effort);
  }
});

test('the cheapest real move is recommended first', () => {
  const steps = nextSteps([gap('trial'), gap('defense'), gap('skills')]);
  assert.equal(steps[0].key, 'defense', 'ninety seconds beats months');
  assert.equal(steps[steps.length - 1].key, 'trial');
});

test('met gaps are never presented as work to do', () => {
  const steps = nextSteps([gap('skills', true), gap('defense', false)]);
  assert.deepEqual(steps.map(s => s.key), ['defense']);
});

test('readiness carries a disclaimer that it is not a ceiling', () => {
  const r = readinessFor({ score: 20, gaps: [gap('trial')] });
  assert.match(r.disclaimer, /not your ceiling/i);
  assert.equal(r.version.startsWith('readiness-'), true);
});

test('categories separate a stretch from a match rather than burying it', () => {
  assert.equal(categorise({}, { score: 90, gaps: [] }), 'strong');
  assert.equal(categorise({}, { score: 50, gaps: [gap('defense')] }), 'growth');
  assert.equal(categorise({}, { score: 20, gaps: [gap('trial')] }), 'stretch');
  assert.equal(categorise({}, { score: 20, gaps: [], matched: false }), 'explore');
});

test('grouping drops empty categories instead of showing hollow sections', () => {
  const groups = groupByCategory([{ fitScore: 95, gaps: [], matched: true }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'strong');
  assert.equal(groups[0].items.length, 1);
  assert.ok(OPPORTUNITY_CATEGORIES.length >= 4);
});

test('a low score alone is never described as the student being weak', () => {
  const r = readinessFor({ score: 5, gaps: [] });
  assert.doesNotMatch(JSON.stringify(r), /\b(bad|weak|unqualified|poor) candidate\b/i);
});

// Opportunities have a score, not structured requirements. Reusing the batch path with empty
// gaps would have pushed everything unmatched into `stretch`, which is why this is separate.
test('opportunities band on score, and a stretch stays visible', async () => {
  const { categoriseOpportunity, groupOpportunities } = await import('../../api/readiness.js');
  assert.equal(categoriseOpportunity({ score: 88 }), 'strong');
  assert.equal(categoriseOpportunity({ score: 55 }), 'growth');
  assert.equal(categoriseOpportunity({ score: 20 }), 'stretch');
  assert.equal(categoriseOpportunity({ score: 20, matched: false }), 'explore');

  const groups = groupOpportunities([
    { fitScore: 90, matched: true }, { fitScore: 50, matched: true }, { fitScore: 95, matched: true },
  ]);
  assert.deepEqual(groups.map(g => g.key), ['strong', 'growth']);
  assert.equal(groups[0].items[0].fitScore, 95, 'best first inside a band');
});
