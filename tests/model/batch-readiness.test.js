import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { batchReadinessPlan, SPECIALISATION_SKILLS, acceptsFor } from '../../api/batches.js';

const batch = { slug: 'management-consulting', name: 'Management consulting' };
const core = SPECIALISATION_SKILLS['management-consulting'];

test('a student with nothing gets every core skill, ordered by the batch weighting', () => {
  const p = batchReadinessPlan(batch, {});
  assert.equal(p.standing.covered, 0);
  assert.equal(p.standing.total, core.length);
  assert.equal(p.items.length, core.length);
  // The batch ranks its own skills by centrality. A plan sorted by what is easiest tells a
  // student to do the cheap thing first, which is how a profile fills with small artifacts.
  const weights = p.items.map(i => i.weight);
  assert.deepEqual(weights, [...weights].sort((a, b) => b - a), 'the plan is not in weight order');
  assert.equal(p.items[0].skill, core[0], 'the most central skill should lead');
});

test('listed and absent are different jobs, not one bucket', () => {
  const p = batchReadinessPlan(batch, { skills: ['Research'] });
  const research = p.items.find(i => i.skill === 'Research');
  assert.equal(research.have, 'stated');
  assert.match(research.why, /reads it from work, not from a list/i);
  assert.equal(p.items.find(i => i.skill === 'Data analysis').have, 'none');
  assert.equal(p.standing.covered, 1);
  assert.equal(p.standing.evidenced, 0, 'listing a skill is not evidence of it');
});

test('an evidenced skill drops out of the plan entirely', () => {
  const p = batchReadinessPlan(batch, { skills: ['Research'], tierBySkill: { Research: 'trial' } });
  assert.ok(!p.items.some(i => i.skill === 'Research'), 'a proven skill is still being asked for');
  assert.equal(p.standing.evidenced, 1);
});

test('a claimed tier does not count as evidenced', () => {
  // `claimed` is the ceiling for self-report and coursework, and both are excluded from
  // matching. Treating it as shown would let a typed profile empty its own plan.
  const p = batchReadinessPlan(batch, { skills: ['Research'], tierBySkill: { Research: 'claimed' } });
  assert.equal(p.items.find(i => i.skill === 'Research').have, 'stated');
  assert.equal(p.standing.evidenced, 0);
});

test('every item names something concrete to build', () => {
  const p = batchReadinessPlan(batch, {});
  const accepts = acceptsFor('management-consulting');
  for (const item of p.items) {
    assert.ok(item.build && item.build.length > 10, `${item.skill} has no artifact attached`);
    assert.ok(accepts.includes(item.build), `${item.skill} points at an artifact this batch does not accept`);
  }
});

test('the plan carries no score, rank, or percentage', () => {
  const p = batchReadinessPlan(batch, { skills: ['Research'] });
  for (const banned of ['score', 'readiness', 'percent', 'rank', 'grade', 'rating', 'complete']) {
    assert.ok(!(banned in p), `the plan returns a ${banned}`);
    assert.ok(!(banned in p.standing), `standing returns a ${banned}`);
  }
  // Counts, not a fraction dressed as progress.
  assert.deepEqual(Object.keys(p.standing).sort(), ['covered', 'evidenced', 'total']);
});

test('a batch that publishes nothing returns a reason rather than an empty list', () => {
  const p = batchReadinessPlan({ slug: 'not-a-batch' }, { skills: ['Research'] });
  assert.deepEqual(p.items, []);
  assert.match(p.note, /has not published/i);
});

test('the plan never implies admission', async () => {
  const src = await readFile(new URL('../../api/batches.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export function batchReadinessPlan'), src.indexOf('export function batchBrief'));
  for (const word of ['admit', 'accepted', 'guarantee', 'qualify', 'eligible']) {
    assert.ok(!new RegExp(word, 'i').test(fn.replace(/\/\/.*$/gm, '')),
      `the plan's own strings use "${word}", which reads as a gate`);
  }
  const p = batchReadinessPlan(batch, { skills: ['Research'] });
  assert.match(p.note, /never a gate/i);
});

test('the plan is wired to the dashboard and rendered in the batch panel', async () => {
  const api = await readFile(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(api, /readiness: batchReadinessPlan\(full/, 'the plan never reaches the client');
  const ui = await readFile(new URL('../../portal.js', import.meta.url), 'utf8');
  assert.match(ui, /function batchReadinessBlock\(batch\)/);
  assert.match(ui, /batchDetailSection\('What to work on for this batch',readiness\)/,
    'the plan is built but never mounted');
  // Directly under the score it explains, not on a separate surface.
  const detail = ui.slice(ui.indexOf("batchDetailSection('How this score is built'"));
  assert.ok(detail.indexOf('What to work on for this batch') < 400, 'the plan is not beside the score');
});
