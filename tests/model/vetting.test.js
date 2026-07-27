import test from 'node:test';
import assert from 'node:assert/strict';
import { PROCESSES, processFor, summarise, VETTING_VERSION } from '../../api/vetting.js';

const VERTICALS = Object.keys(PROCESSES);

// One process across all five would be a lie of convenience.
test('every vertical has a genuinely different process', () => {
  assert.equal(VERTICALS.length, 5);
  const shapes = VERTICALS.map(v => PROCESSES[v].stages.map(s => s.key).join('>'));
  assert.ok(new Set(shapes).size >= 3, 'processes must differ, not just be relabelled');
});

// The shape that works is constant; what it reads is not.
test('every process ends in a defense and two readers', () => {
  for (const v of VERTICALS) {
    const keys = PROCESSES[v].stages.map(s => s.key);
    assert.ok(keys.includes('defense'), `${v} needs a defense`);
    assert.equal(keys[keys.length - 1], 'review', `${v} must end in review`);
  }
});

// The honesty differs per vertical because the capability does.
test('each process states what a machine cannot establish for it', () => {
  for (const v of VERTICALS) {
    const p = PROCESSES[v];
    assert.ok(p.machineCan.length > 20, v);
    assert.ok(p.machineCannot.length > 20, v);
  }
  // And the two live ones do not claim what the human-rail ones claim.
  assert.match(summarise('Software & AI').honesty, /judgement is not/i);
  assert.match(summarise('Healthcare operations').honesty, /No API can read this work/i);
});

test('human-rail verticals say so rather than implying automation', () => {
  assert.equal(PROCESSES['Healthcare operations'].maturity, 'human_rail');
  assert.equal(PROCESSES['Professional services'].maturity, 'human_rail');
  assert.equal(PROCESSES['Software & AI'].maturity, 'automated');
  assert.equal(PROCESSES['Consumer & retail'].maturity, 'instrumented');
});

// Written work is the easiest thing for a model to produce, so the defense has to carry more.
test('the writing-heavy vertical leans hardest on the defense', () => {
  const p = PROCESSES['Professional services'];
  assert.match(p.machineCannot, /easiest thing for a model to produce/);
  assert.ok(p.stages.find(s => s.key === 'defense').why.includes('carries the weight'));
});

test('defense questions are specific to the vertical, never generic', () => {
  const all = VERTICALS.flatMap(v => PROCESSES[v].defenseProbes);
  assert.equal(new Set(all).size, all.length, 'no probe is reused across verticals');
  for (const v of VERTICALS) assert.ok(PROCESSES[v].defenseProbes.length >= 3, v);
});

test('a summary tells a student the cost before they start', () => {
  for (const v of VERTICALS) {
    const s = summarise(v);
    assert.ok(s.minutes > 0, v);
    assert.ok(s.steps >= 3, v);
    assert.equal(s.version, VETTING_VERSION);
  }
});

test('an unknown vertical returns null instead of a default process', () => {
  assert.equal(processFor('Underwater basket weaving'), null);
  assert.equal(summarise('nope'), null);
});
