import test from 'node:test';
import assert from 'node:assert/strict';
import { batchCompatibility, BATCH_CATALOG } from '../../api/batches.js';

const swe = BATCH_CATALOG.find(b => /software|engineering|ai/i.test(b.discipline + ' ' + b.name));
const finance = BATCH_CATALOG.find(b => /private equity|wealth|venture|finance|accounting/i.test(b.discipline + ' ' + b.name));

test('a student with no skills gets no score, and is told why', () => {
  const r = batchCompatibility(swe, { skills: [] });
  assert.equal(r.score, null);
  assert.equal(r.basis, 'no-skills');
  assert.match(r.why, /add skills/i);
});

// The number is worthless if it cannot be interrogated — the product's own claim is that
// nothing here is a black-box score.
test('the score always ships the terms that produced it', () => {
  const r = batchCompatibility(swe, { skills: ['Python', 'Financial modelling'] });
  assert.ok(Array.isArray(r.matched));
  assert.equal(typeof r.why, 'string');
  assert.ok(r.why.length > 0);
});

test('an interest in the vertical lifts the score above skills alone', () => {
  const bare = batchCompatibility(finance, { skills: ['Cooking'] });
  const followed = batchCompatibility(finance, { skills: ['Cooking'], verticals: [finance.verticalSlug] });
  assert.ok(followed.score > bare.score);
  assert.equal(followed.verticalMatch, true);
});

test('skills evidenced by analysed code count for more than claimed ones', () => {
  const claimed = batchCompatibility(swe, { skills: ['Python'] });
  const evidenced = batchCompatibility(swe, { skills: ['Python'], evidencedSkills: ['Python'] });
  assert.ok(evidenced.score >= claimed.score);
});

test('an unrelated profile scores low rather than defaulting to something flattering', () => {
  const r = batchCompatibility(finance, { skills: ['Ceramics', 'Trail running'] });
  assert.ok(r.score < 30, `expected a low score, got ${r.score}`);
  assert.deepEqual(r.matched, []);
});

test('the score is bounded and never negative', () => {
  for (const batch of BATCH_CATALOG.slice(0, 8)) {
    const r = batchCompatibility(batch, {
      skills: ['Python', 'SQL', 'Research', 'Valuation', 'Writing'],
      verticals: [batch.verticalSlug],
      evidencedSkills: ['Python', 'SQL'],
    });
    assert.ok(r.score >= 0 && r.score <= 100, `${batch.slug} scored ${r.score}`);
  }
});

// Compatibility answers "is this for me?"; admission answers "am I in?". Conflating them
// would let a browsing score read as a decision.
test('compatibility is not admission and says so in its shape', () => {
  const r = batchCompatibility(swe, { skills: ['Python'] });
  assert.equal(r.basis, 'stated-skills');
  assert.ok(!('admitted' in r));
  assert.ok(!('decision' in r));
});

test('a missing batch does not throw', () => {
  const r = batchCompatibility(null, { skills: ['Python'] });
  assert.equal(r.score, 0);
});
