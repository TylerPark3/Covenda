import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { batchCompatibility, compatibilityStanding } from '../../api/batches.js';

const batch = { slug: 'management-consulting', name: 'Management consulting', verticalSlug: 'consulting' };
const scored = opts => ({ ...batch, compatibility: batchCompatibility(batch, opts) });

// ── The arithmetic must stay honest ───────────────────────────────────────────────────
test('the itemised components always sum to the printed score', () => {
  const cases = [
    { skills: ['Research'] },
    { skills: ['Research', 'Spreadsheets'], verticals: ['consulting'] },
    { skills: ['Research', 'Spreadsheets', 'Data analysis'], verticals: ['consulting'], evidencedSkills: ['research', 'spreadsheets'] },
  ];
  for (const c of cases) {
    const r = batchCompatibility(batch, c);
    const sum = r.components.reduce((a, p) => a + p.points, 0);
    assert.equal(sum, r.score, `components sum to ${sum} but the score printed is ${r.score}`);
    for (const p of r.components) assert.ok(p.points <= p.max, `${p.id} exceeds its own ceiling`);
  }
});

test('the typed and shown halves are both present and separable', () => {
  const r = batchCompatibility(batch, { skills: ['Research'], evidencedSkills: ['research'] });
  const evidence = r.components.filter(c => c.backed === 'evidence');
  const stated = r.components.filter(c => c.backed === 'stated');
  // The split is the point of the panel, not the exact count on either side. Depth and agency
  // were added on top of the original evidenced component, so evidence is now three of six.
  assert.ok(evidence.length >= 1 && stated.length >= 1, 'the typed/shown split collapsed');
  assert.ok(evidence.some(c => c.id === 'evidenced'));
  assert.equal(evidence.length + stated.length, r.components.length, 'a component is backed by neither');
  // Every ceiling together must still be a hundred, or the printed number stops meaning a
  // percentage of anything.
  assert.equal(r.components.reduce((a, c) => a + c.max, 0), 100);
});

test('evidence carries more of the score than it used to', () => {
  const r = batchCompatibility(batch, { skills: ['Research'] });
  const evidenceMax = r.components.filter(c => c.backed === 'evidence').reduce((a, c) => a + c.max, 0);
  // Twelve of a hundred meant a profile of typed skills could reach 88 without showing
  // anything. A third of the score now requires evidence.
  assert.ok(evidenceMax >= 30, `only ${evidenceMax} of 100 requires evidence`);
});

// ── No invented history ───────────────────────────────────────────────────────────────
// Nothing stores a score over time, so a trend would be drawn from data that does not exist.
test('the standing reports no trend it cannot support', () => {
  const s = compatibilityStanding([scored({ skills: ['Research'], verticals: ['consulting'] })]);
  for (const banned of ['trend', 'history', 'sparkline', 'lastWeek', 'change', 'delta', 'previous']) {
    assert.ok(!(banned in s), `compatibilityStanding returns a ${banned} with nothing storing history`);
  }
});

test('a student with no skills gets a route, not a zero', () => {
  const s = compatibilityStanding([scored({ skills: [] })]);
  assert.equal(s.scored, 0);
  assert.equal(s.best, null);
  assert.match(s.note, /Add skills/);
});

test('a skill with evidence behind it drops out of the unbacked list', () => {
  const without = compatibilityStanding([scored({ skills: ['Research', 'Spreadsheets'], verticals: ['consulting'] })]);
  assert.deepEqual(without.unbacked.map(u => u.skill).sort(), ['Research', 'Spreadsheets']);

  const with_ = compatibilityStanding([scored({ skills: ['Research', 'Spreadsheets'], verticals: ['consulting'], evidencedSkills: ['research'] })]);
  assert.deepEqual(with_.unbacked.map(u => u.skill), ['Spreadsheets']);
  assert.ok(with_.evidencedPoints > 0);
});

test('unbacked skills are ranked by how many batches they move', () => {
  const s = compatibilityStanding([
    scored({ skills: ['Research', 'Spreadsheets'] }),
    { ...batch, slug: 'strategy-research', name: 'Strategy', compatibility: batchCompatibility({ slug: 'strategy-research' }, { skills: ['Research'] }) },
  ]);
  assert.equal(s.unbacked[0].skill, 'Research', 'the skill moving the most cards should lead');
  assert.ok(s.unbacked[0].batches >= s.unbacked[s.unbacked.length - 1].batches);
});

test('the aggregate never scores an unscored batch', () => {
  const s = compatibilityStanding([scored({ skills: [] }), scored({ skills: ['Research'] })]);
  assert.equal(s.scored, 1, 'a batch with a null score was counted');
});

// ── Wiring ────────────────────────────────────────────────────────────────────────────
test('the tracker reaches the student and reads the same numbers as the cards', async () => {
  const api = await readFile(new URL('../../api/portal.js', import.meta.url), 'utf8');
  // Must aggregate the already-scored batches, not rescore them: a second scoring path is how
  // the panel starts disagreeing with the number on the card it explains.
  assert.match(api, /compatibilityStanding\(batchesWithFit\)/);
  const decl = api.indexOf('const batchesWithFit');
  const use = api.indexOf('compatibilityStanding(batchesWithFit)');
  assert.ok(decl > 0 && use > decl, 'compatibilityStanding runs before batchesWithFit exists');
  assert.match(api, /finance, coursework, compatibility,/, 'the standing never reaches the dashboard');

  const ui = await readFile(new URL('../../portal.js', import.meta.url), 'utf8');
  assert.match(ui, /renderCompatibility\(root,state\.dashboard\)/, 'the panel is defined but never called');
  assert.match(ui, /function batchScoreBreakdown\(/);

  const css = await readFile(new URL('../../portal.css', import.meta.url), 'utf8');
  for (const cls of ['compat-split', 'compat-bar', 'compat-legend', 'compat-parts', 'compat-part-track', 'compat-part-pts']) {
    assert.match(css, new RegExp(`\\.${cls}[\\s,{]`), `.${cls} is used but never styled`);
  }
  // Only the evidenced row is gold. The colour carries the claim that one of four counts.
  assert.match(css, /\.compat-part\.is-evidence \.compat-part-track i \{[^}]*var\(--gold\)/);
});
