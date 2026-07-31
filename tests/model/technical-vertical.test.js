import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { technicalProfile, collaborationEvidence, builderHistory } from '../../api/technical-evidence.js';

const claims = [
  { skill: 'Python', verification_tier: 'artifact', evidence_meta: { evidence_type: 'shipped_product', title: 'Scheduler', entry_id: 'a', occurred_at: '2026-03-01', ownership: 'primary' } },
  { skill: 'Go', verification_tier: 'claimed', evidence_meta: { evidence_type: 'open_source', title: 'CLI patch', entry_id: 'b', agency_signals: ['contributed_upstream'] } },
  { skill: 'React', verification_tier: 'artifact', evidence_meta: { evidence_type: 'hackathon', title: 'HackNY', entry_id: 'c', occurred_at: '2026-06-10' } },
];

// The blueprint's hardest rule for this surface: "Do not display a single engineering quality
// score." It is the one that would be easiest to violate by accident.
test('the profile exposes no composite score', () => {
  const p = technicalProfile(claims);
  for (const banned of ['score', 'rating', 'rank', 'grade', 'quality', 'overall', 'percentile', 'readiness']) {
    assert.ok(!(banned in p), `technicalProfile returns a ${banned}`);
  }
});

test('collaboration is derived from evidence, never asked for', () => {
  const c = collaborationEvidence(claims);
  assert.equal(c.entries, 2, 'open source and hackathon should both count');
  assert.ok(c.kinds.some(k => k.id === 'open_source'));
  assert.ok(c.kinds.some(k => k.id === 'hackathon'));
  // Absence is stated rather than left blank.
  assert.match(collaborationEvidence([]).note, /nothing here yet/i);
});

test('an upstream contribution counts as collaboration whatever it was filed as', () => {
  const c = collaborationEvidence([
    { skill: 'C', verification_tier: 'artifact', evidence_meta: { evidence_type: 'independent_project', entry_id: 'x', agency_signals: ['contributed_upstream'] } },
  ]);
  assert.equal(c.entries, 1);
});

test('builder history is a sequence, and undated work is kept rather than hidden', () => {
  const h = builderHistory(claims);
  assert.equal(h.count, 3);
  assert.equal(h.dated, 2);
  assert.equal(h.items[0].title, 'HackNY', 'newest first');
  // The undated entry sorts last but is still present: an artifact with no date is still an
  // artifact, and dropping it would understate the person.
  assert.equal(h.items[h.items.length - 1].title, 'CLI patch');
});

test('one entry producing several claims appears once in the history', () => {
  const h = builderHistory([
    { skill: 'Python', evidence_meta: { evidence_type: 'shipped_product', title: 'One thing', entry_id: 'z' } },
    { skill: 'SQL', evidence_meta: { evidence_type: 'shipped_product', title: 'One thing', entry_id: 'z' } },
  ]);
  assert.equal(h.count, 1, 'the same artifact was counted twice');
});

test('the dashboard renders all nine readings and states each absence', async () => {
  const ui = await readFile(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = ui.slice(ui.indexOf('function renderTechnicalVertical'), ui.indexOf('function renderTechnicalProfile'));
  for (const section of ['Technical breadth', 'Technical depth', 'Agency', 'Builder history',
    'AI engineering', 'Collaboration', 'Verification', 'Current gaps']) {
    assert.ok(fn.includes(section), `the dashboard is missing "${section}"`);
  }
  // Every section is built through the helper that supplies an empty state, so none of them
  // can silently disappear when there is nothing to show.
  assert.equal((fn.match(/techSection\(/g) || []).length, 8);
  assert.match(ui, /renderTechnicalVertical\(body,state\.dashboard\)/, 'the panel is never mounted');
});

test('the dashboard states that there is no single score', async () => {
  const ui = await readFile(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = ui.slice(ui.indexOf('function renderTechnicalVertical'), ui.indexOf('function renderTechnicalProfile'));
  assert.match(fn, /no single engineering score/i);
  // And does not compute one anywhere in the view.
  assert.ok(!/overallScore|qualityScore|engineeringScore/.test(fn));
});
