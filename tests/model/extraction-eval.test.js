import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBrief } from '../../api/project-intake.js';

// Extraction eval (Scoring spec B2) — the HALLUCINATION check for AI project intake.
//
// The intake extractor is contractually EXTRACTIVE: it restates what the founder wrote in a
// structured shape. It must never invent a budget, a deadline, a headcount, a technology or a
// guarantee that isn't in the source text — those become contractual terms a company reads as
// commitments. This suite runs model-shaped payloads through normalizeBrief (the server-side
// gate every generated brief passes through) and asserts the invariants that make an invented
// fact either impossible or detectable.
//
// These fixtures are model-SHAPED, not model-generated: they exercise the gate deterministically
// and run with no API key. A live-model eval belongs in a separate, key-gated harness — a test
// suite that silently passes when ANTHROPIC_API_KEY is absent would be worse than no test.

// Numbers, dates and money in the output that never appeared in the founder's text are the
// highest-risk hallucinations, so we check for them explicitly.
function unsourcedFacts(sourceText, brief) {
  const source = String(sourceText).toLowerCase();
  const emitted = [
    brief.title, brief.summary, brief.context, brief.objective, brief.estimatedEffort,
    ...brief.scopeInclusions, ...brief.scopeExclusions, ...brief.approvedInputs,
    ...brief.candidateDeliverables.flatMap(d => [d.title, d.description, d.acceptanceCriteria]),
  ].join(' ').toLowerCase();
  const findings = [];
  // Money amounts and explicit week/day counts are the ones that become expectations.
  for (const m of emitted.match(/\$[\d,]+(?:\.\d+)?/g) || []) if (!source.includes(m)) findings.push(m);
  for (const m of emitted.match(/\b\d+\s*(?:weeks?|days?|months?|hours?)\b/g) || []) if (!source.includes(m)) findings.push(m);
  return findings;
}

const SOURCE = 'We need help cleaning up our customer list. It is a mess of duplicates across two spreadsheets. '
  + 'Budget is $800 and we would like it done in 3 weeks. Please do not touch our production database.';

test('a faithful extraction introduces no unsourced money or duration', () => {
  const brief = normalizeBrief({
    title: 'Customer list cleanup',
    summary: 'Deduplicate a customer list spread across two spreadsheets.',
    context: 'The list is a mess of duplicates across two spreadsheets.',
    objective: 'Produce one clean, deduplicated customer list.',
    scopeInclusions: ['Deduplicate across the two spreadsheets'],
    scopeExclusions: ['Do not touch the production database'],
    candidateDeliverables: [{ title: 'Clean customer list', description: 'One deduplicated sheet', acceptanceCriteria: 'No duplicate rows remain' }],
    estimatedEffort: '3 weeks',
    suggestedVerticals: ['Professional services'],
    suggestedWorkTypes: ['Data & spreadsheets'],
  });
  assert.deepEqual(unsourcedFacts(SOURCE, brief), [], 'every number in the brief must trace to the founder text');
  assert.equal(brief.scopeExclusions[0], 'Do not touch the production database');
});

test('HALLUCINATION CAUGHT: invented budget and timeline are detected as unsourced', () => {
  const brief = normalizeBrief({
    title: 'Customer list cleanup',
    summary: 'Deduplicate the list. Budget $5,000 with delivery in 12 weeks.', // neither is in SOURCE
    objective: 'Clean the list',
    candidateDeliverables: [{ title: 'Clean list', description: 'Also includes a 6 months support retainer.' }],
    estimatedEffort: '12 weeks',
  });
  const findings = unsourcedFacts(SOURCE, brief);
  assert.ok(findings.includes('$5,000'), `expected the invented budget to be flagged, got ${JSON.stringify(findings)}`);
  assert.ok(findings.some(f => /12\s*weeks/.test(f)), 'expected the invented timeline to be flagged');
  assert.ok(findings.some(f => /6\s*months/.test(f)), 'expected the invented retainer to be flagged');
});

test('taxonomy fields cannot be invented — unknown values are dropped, not passed through', () => {
  const brief = normalizeBrief({
    title: 'x', summary: 'y', objective: 'z',
    suggestedVerticals: ['Software & AI', 'Cryptocurrency trading', 'Defense contracting'],
    suggestedWorkTypes: ['Research', 'Penetration testing'],
  });
  assert.deepEqual(brief.suggestedVerticals, ['Software & AI']);
  assert.deepEqual(brief.suggestedWorkTypes, ['Research']); // off-taxonomy values silently dropped
});

test('out-of-range engine ratings become null rather than a fabricated confident number', () => {
  const wild = normalizeBrief({ title: 'x', summary: 'y', complexityRating: 11, ambiguityRating: 0, opportunityType: 'permanent_executive' });
  assert.equal(wild.complexityRating, null);
  assert.equal(wild.ambiguityRating, null);
  assert.equal(wild.opportunityType, 'project'); // unknown type falls back, never invents a new one
  const sane = normalizeBrief({ title: 'x', summary: 'y', complexityRating: 4, ambiguityRating: 2 });
  assert.equal(sane.complexityRating, 4);
  assert.equal(sane.ambiguityRating, 2);
});

test('field lengths are clamped so a runaway generation cannot flood the record', () => {
  const brief = normalizeBrief({
    title: 'T'.repeat(500), summary: 'S'.repeat(5000),
    scopeInclusions: Array.from({ length: 40 }, (_, i) => `item ${i}`),
    candidateDeliverables: Array.from({ length: 20 }, (_, i) => ({ title: `d${i}`, description: 'x'.repeat(2000) })),
  });
  assert.equal(brief.title.length, 160);
  assert.equal(brief.summary.length, 1200);
  assert.ok(brief.scopeInclusions.length <= 8);
  assert.ok(brief.candidateDeliverables.length <= 4);
  assert.ok(brief.candidateDeliverables[0].description.length <= 800);
});

test('a non-object or empty generation degrades to empty strings, never to placeholder prose', () => {
  for (const junk of [null, undefined, 'a string', 42, []]) {
    const brief = normalizeBrief(junk);
    assert.equal(brief.title, '');
    assert.equal(brief.summary, '');
    assert.deepEqual(brief.scopeInclusions, []);
    assert.deepEqual(brief.candidateDeliverables, []);
    // Critically: no invented defaults like "TBD - 4 weeks" that a company might read as a quote.
    assert.equal(brief.estimatedEffort, '');
  }
});
