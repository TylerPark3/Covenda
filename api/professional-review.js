// Where a practitioner actually touches the vetting process.
//
// ── THE PROBLEM WITH "A PROFESSIONAL VETS THIS" ───────────────────────────────────────
// Said loosely it means one of three completely different products. A practitioner who has to
// review every submission stops answering by week three, and you cannot build a batch on
// somebody's goodwill running out. A practitioner who only lends a name is decoration.
//
// So the role is defined by VOLUME, and the volume is bounded on purpose:
//
//   CALIBRATE    once per vertical. They score five anchor submissions and their scores
//                become the bar. Roughly an hour, once.
//   ADJUDICATE   only when Covenda's two raters disagree beyond threshold. Rare by design,
//                and capped, so a bad week never turns into an unbounded ask.
//   AUDIT        a small random sample each cycle, to catch the bar drifting away from what
//                they set. Fifteen minutes a quarter.
//
// That is a real relationship somebody can agree to and keep. api/hardening.js already
// computes when two raters disagree and already has an adjudication hook; what it never had
// was a named practitioner on the other end of it.

import { adjudicateRubric, adjudicationStatus } from './hardening.js';
import { reviewerFor } from './reviewers.js';

export const PROFESSIONAL_REVIEW_VERSION = 'professional-review-1.0.0';

export const ROLES = ['calibrate', 'adjudicate', 'audit'];

// Bounded so the commitment can be stated honestly when asking someone to take it on. A
// practitioner who is told "occasionally" and gets eleven requests in a week does not stay.
export const LOAD = {
  calibrationAnchors: 5,       // scored once, at the start
  maxAdjudicationsPerCycle: 8, // beyond this, Covenda absorbs the backlog rather than pushing it
  auditSampleSize: 3,          // per cycle
  cycleDays: 90,
};

// What the practitioner is being asked for, in the words you would use to ask them. This is
// the outreach script as much as it is a spec: vague asks get vague answers.
export function commitmentFor(vertical) {
  const reviewer = reviewerFor(vertical);
  return {
    vertical,
    state: reviewer.state,
    name: reviewer.name,
    ask: [
      { role: 'calibrate', when: 'Once, at the start',
        what: `Score ${LOAD.calibrationAnchors} real submissions. Your scores become the published bar for this vertical.`,
        time: 'About an hour' },
      { role: 'adjudicate', when: 'Only when two Covenda raters disagree',
        what: `Break the tie. Capped at ${LOAD.maxAdjudicationsPerCycle} per quarter; past that we absorb the backlog rather than sending it to you.`,
        time: 'Ten minutes each, rare' },
      { role: 'audit', when: 'Once a quarter',
        what: `Re-score ${LOAD.auditSampleSize} submissions we already scored, so we can see whether the bar has drifted from what you set.`,
        time: 'Fifteen minutes' },
    ],
    // Said up front, because the first question anybody sensible asks is what they are on the
    // hook for and what they are not.
    notAsked: [
      'Reviewing every applicant. That does not scale and it is not what makes the bar credible.',
      'Sourcing or referring students.',
      'Any commitment to hire from the batch.',
      'Being named publicly before you agree to it.',
    ],
  };
}

// ── Calibration ───────────────────────────────────────────────────────────────────────
// The practitioner's scores ARE the bar. Covenda does not average them with its own, because
// the point of asking a practitioner is that their judgement outranks ours on their subject.
export function calibrate({ vertical, anchors = [], by } = {}) {
  if (!by) throw new Error('Calibration has to be attributed to a named person.');
  if (anchors.length < LOAD.calibrationAnchors) {
    throw new Error(`Calibration needs ${LOAD.calibrationAnchors} scored anchors; got ${anchors.length}.`);
  }
  const scored = anchors.filter(a => Number.isFinite(a.score) && a.score >= 0 && a.score <= 10);
  if (scored.length !== anchors.length) throw new Error('Every anchor needs a score between 0 and 10.');

  const values = scored.map(a => a.score).sort((x, y) => x - y);
  const median = values[Math.floor(values.length / 2)];
  return {
    vertical,
    by,
    // The bar sits at the practitioner's median, not their mean: one generous or harsh anchor
    // should not move the standard for everyone after them.
    bar: median,
    anchors: scored.map(a => ({ ref: a.ref, score: a.score, why: a.why || null })),
    // Recorded because a bar with no reasoning behind it cannot be applied consistently by
    // anyone else, which is the entire job it has to do.
    incomplete: scored.filter(a => !a.why).length,
    at: null,
    version: PROFESSIONAL_REVIEW_VERSION,
  };
}

// ── Adjudication ──────────────────────────────────────────────────────────────────────
// Routes only genuine disagreements, and only while there is budget for them.
export function adjudicationQueue(entries = [], { usedThisCycle = 0 } = {}) {
  const contested = entries.filter(e => adjudicationStatus(e.book?.[e.skill]).needsAdjudication);
  const budget = Math.max(0, LOAD.maxAdjudicationsPerCycle - usedThisCycle);
  return {
    contested: contested.length,
    // Oldest first: a submission waiting on a tiebreak is a student waiting on an answer.
    send: contested.slice(0, budget),
    absorb: contested.slice(budget),
    budget,
    // Surfaced rather than hidden, because a queue Covenda is quietly swallowing is a queue
    // nobody knows is growing.
    note: contested.length > budget
      ? `${contested.length - budget} beyond the practitioner's cap this cycle. Covenda adjudicates those internally and they are marked as such.`
      : null,
  };
}

export function recordAdjudication(book, { skill, score, by, note } = {}) {
  const updated = adjudicateRubric(book, { skill, score, adjudicator: by, note });
  // Marked so a company can tell a practitioner tiebreak from an internal one. They are not
  // the same claim and should never be displayed as though they were.
  updated[skill] = { ...updated[skill], adjudicated: { ...updated[skill].adjudicated, source: 'practitioner' } };
  return updated;
}

// ── Audit ─────────────────────────────────────────────────────────────────────────────
// The check that the bar still means what the practitioner set it to mean.
export function auditDrift(samples = []) {
  const paired = samples.filter(s => Number.isFinite(s.covendaScore) && Number.isFinite(s.practitionerScore));
  if (!paired.length) return { ok: false, reason: 'No paired scores to compare.' };

  const deltas = paired.map(s => s.practitionerScore - s.covendaScore);
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const drifted = Math.abs(mean) >= 1;
  return {
    ok: true,
    samples: paired.length,
    meanDelta: Math.round(mean * 10) / 10,
    drifted,
    // Direction matters more than magnitude: scoring too generously admits people who then
    // fail in front of a company, which costs more than being harsh.
    direction: mean > 0 ? 'Covenda is scoring harder than the practitioner' : mean < 0 ? 'Covenda is scoring softer than the practitioner' : 'aligned',
    action: drifted
      ? 'Re-run calibration for this vertical before admitting another cohort.'
      : 'Within tolerance. No change.',
  };
}
