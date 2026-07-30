import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERTICALS, verticalFor, coverage, anchorsArePartners, ANCHOR_DISCLAIMER } from '../../api/vertical-map.js';
import { BATCH_CATALOG } from '../../api/batches.js';
import { SCENARIOS } from '../../api/scenarios.js';
import { validateScenario, startRun, advance, currentStep, evidenceFrom } from '../../api/simulation.js';

// A founder who spots an implied partnership that does not exist stops believing the rest of
// the page, and they are right to.
test('anchors are never presented as partners', () => {
  assert.equal(anchorsArePartners, false);
  assert.match(ANCHOR_DISCLAIMER, /No partnership, affiliation, customer relationship or endorsement/);
  const src = readFileSync(new URL('../../api/vertical-map.js', import.meta.url), 'utf8');
  for (const word of ['partnered', 'our partner', 'in partnership', 'trusted by', 'works with']) {
    assert.ok(!src.toLowerCase().includes(word), `"${word}" must never appear beside an anchor`);
  }
});

test('the disclaimer travels with every read', () => {
  const v = verticalFor('investment-banking');
  assert.equal(v.arePartners, false);
  assert.ok(v.disclaimer, 'no caller can surface anchors without it');
});

test('every specialisation in the catalogue is mapped', () => {
  const slugs = [...new Set(BATCH_CATALOG.map(b => b.slug))];
  for (const slug of slugs) {
    assert.ok(VERTICALS[slug], `${slug} has no anchor or simulation direction`);
  }
  // Derived from the catalogue rather than restated, so adding a specialisation cannot leave
  // this number quietly wrong. Every vertical keeps a floor of five; professional services now
  // carries seven, since content and creator work is professional services sold as a service.
  assert.equal(coverage().total, BATCH_CATALOG.length);
  for (const [vertical, n] of Object.entries(coverage().byBatch)) {
    assert.ok(n >= 5, `${vertical} maps only ${n}`);
  }
});

test('every vertical says what it evaluates and what to build versus buy', () => {
  for (const [slug, v] of Object.entries(VERTICALS)) {
    assert.ok(v.evaluates?.length > 20, `${slug}: no statement of what it evaluates`);
    assert.ok(v.simulation?.length > 20, `${slug}: no simulation direction`);
    assert.ok(v.skills?.length >= 3, `${slug}: fewer than three skills`);
    assert.ok(v.buildVsBuy?.build, `${slug}: no build-vs-buy call`);
  }
});

// Healthcare is built last for a reason, and the reason has to survive being read quickly.
test('every healthcare vertical says synthetic data only', () => {
  const health = Object.entries(VERTICALS).filter(([, v]) => v.batch === 'Healthcare operations');
  assert.equal(health.length, 5);
  const dataOnes = health.filter(([, v]) => /dataset|queue|denial/i.test(v.simulation));
  for (const [slug, v] of dataOnes) {
    assert.match(v.buildVsBuy.build, /Synthetic data only/, `${slug} must say it`);
  }
});

// The whole bet of building two scenarios first.
test('phase 2 needed no engine changes', () => {
  assert.ok(Object.keys(SCENARIOS).length >= 6);
  for (const sc of Object.values(SCENARIOS)) {
    assert.equal(validateScenario(sc).ok, true, `${sc.id} does not validate`);
  }
});

test('every scenario runs to completion and produces evidence', () => {
  for (const sc of Object.values(SCENARIOS)) {
    let run = startRun(sc, { now: 0 });
    let t = 0, guard = 0;
    while (!run.done && guard++ < 30) {
      const step = currentStep(sc, run);
      t += 20000;
      if (step.kind === 'decide') run = advance(sc, run, { optionId: step.options[0].id }, { now: t });
      else if (step.kind === 'produce') run = advance(sc, run, { artifact: 'x' }, { now: t });
      else if (step.kind === 'defend') run = advance(sc, run, { answer: 'y' }, { now: t });
      else run = advance(sc, run, {}, { now: t });
    }
    assert.equal(run.done, true, `${sc.id} never finished`);
    assert.equal(evidenceFrom(sc, run).ok, true, `${sc.id} produced no evidence`);
  }
});

// Every option must be a real position somebody would take, not an obviously wrong distractor.
test('no scenario option is a throwaway', () => {
  for (const sc of Object.values(SCENARIOS)) {
    for (const step of sc.steps.filter(s => s.kind === 'decide')) {
      for (const o of step.options) {
        assert.ok(o.reveals.length > 40, `${sc.id}/${step.id}/${o.id}: reveals too thin to grade against`);
        assert.ok(o.defense, `${sc.id}/${step.id}/${o.id}: no defense question`);
      }
    }
  }
});

test('anchors never leak into a scenario a candidate reads', () => {
  // Whole words, not substrings: "EY" lives inside "money" and short anchors would fail on
  // ordinary prose. Same trap as "age" inside "stage".
  //
  // Case-SENSITIVE, which the first version was not. Lowercasing both sides threw away the
  // only thing separating the retailer Target from "growth target", "add-on target" and
  // "target segment", so five scenarios failed for using an ordinary English noun. A company
  // name in prose is capitalised; the common noun is not, and that is the whole signal.
  const words = new Set(
    JSON.stringify(SCENARIOS).split(/[^A-Za-z0-9]+/).filter(Boolean),
  );
  const anchors = [...new Set(Object.values(VERTICALS).flatMap(v => v.anchors))];
  for (const anchor of anchors) {
    const parts = anchor.split(/\s+/);
    // A multi-word anchor only counts as leaked if every word of it is present.
    const leaked = parts.every(part => words.has(part));
    assert.ok(!leaked, `${anchor} appears inside a scenario a candidate reads`);
  }
});

// The case-sensitive rule above has one hole: a sentence STARTING with a common-noun anchor
// capitalises it and reads as the company. Cheaper to forbid than to detect.
test('no scenario sentence opens with a word that is also a company anchor', () => {
  const anchors = new Set(Object.values(VERTICALS).flatMap(v => v.anchors).map(a => a.split(/\s+/)[0]));
  for (const scenario of Object.values(SCENARIOS)) {
    for (const [, value] of Object.entries(scenario.steps.flatMap(s => [
      ['body', s.body], ['title', s.title],
      ...(s.options || []).flatMap(o => [['reveals', o.reveals], ['defense', o.defense]]),
    ]).filter(([, v]) => v))) {
      for (const sentence of String(value).split(/(?<=[.?!])\s+/)) {
        const first = sentence.trim().split(/[^A-Za-z0-9]+/)[0];
        assert.ok(!anchors.has(first), `"${sentence.slice(0, 60)}" opens with the anchor ${first} in ${scenario.id}`);
      }
    }
  }
});
