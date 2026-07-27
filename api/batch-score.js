// Batch admission scoring — the three-part composite.
//
// Expert assessment (33%) + compatibility (33%) + demonstrated activity (33%).
//
// ── ONE CONCERN, STATED ONCE ──────────────────────────────────────────────────────────
// The vetting brief's own rule #1 is: "Admission is a published REQUIREMENTS CHECKLIST,
// never a person-score. No cross-student ranking, no leaderboard." A weighted composite is
// a person-score, and sorting candidates by it is a ranking.
//
// The resolution built here, rather than ignoring the tension:
//
//   * The composite is OPERATOR-FACING. It orders a review queue so the people reviewing
//     applications know where to start. It is never shown to a student and never published.
//   * A student still sees the checklist — what they have met, what they have not, and the
//     specific gap. That interface does not change.
//   * The composite cannot admit anyone by itself. It ranks who gets read; a human still
//     decides, with a rationale, exactly as before.
//
// If that split is not maintained, this module becomes the leaderboard the product spent
// its whole design arguing against.
//
// ── THE ACTIVE-TIME PROBLEM ───────────────────────────────────────────────────────────
// "Time spent on the platform" as a third of an admission score has a specific failure: it
// measures availability, and availability correlates with not needing to work. A student
// with a part-time job to pay rent loses to one who does not, on a dimension that has
// nothing to do with capability. It is also the easiest thing in the system to fake — a
// tab left open scores identically to six hours of practice.
//
// So the activity third is built from WHAT WAS DONE, not how long someone was present:
// correct answers on technicals, completed exercises, submitted work. Raw session time is
// capped at a small fraction and is there only as a tie-breaker, with the cap stated. If
// you want it weighted higher, that is a founder's call to make deliberately — the code
// makes it a one-line change and the comment will still be here.

export const BATCH_SCORE_VERSION = 'batch-score-1.0.0';

export const WEIGHTS = { expert: 0.34, compatibility: 0.33, activity: 0.33 };

// Inside the activity third. Session time is deliberately the smallest slice.
const ACTIVITY_WEIGHTS = { correctAnswers: 0.5, exercises: 0.35, sessionTime: 0.15 };

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(n) || 0));

// ── Component 1: expert assessment ────────────────────────────────────────────────────
// The subjective third. Two raters, and a missing second rater is reported rather than
// silently averaged from one — a single reader's opinion is not "the expert assessment".
export function expertComponent(raterScores = []) {
  const scores = raterScores.map(r => Number(r?.score)).filter(Number.isFinite);
  if (!scores.length) return { value: null, ready: false, reason: 'Not reviewed yet.' };
  if (scores.length < 2) {
    return { value: null, ready: false, reason: 'One reviewer so far. Needs a second before it counts.' };
  }
  const spread = Math.max(...scores) - Math.min(...scores);
  if (spread >= 3 && scores.length < 3) {
    return { value: null, ready: false, reason: `Reviewers are ${spread} points apart. Goes to a third reader.` };
  }
  const sorted = [...scores].sort((a, b) => a - b);
  const raw = scores.length >= 3 ? sorted[Math.floor(sorted.length / 2)] : (sorted[0] + sorted[1]) / 2;
  // Rubric is 1–10; the composite is 0–100.
  return { value: clamp(raw * 10), ready: true, raters: scores.length, spread };
}

// ── Component 2: compatibility ────────────────────────────────────────────────────────
// Already computed elsewhere from stated interests and skills. Passed through, but flagged
// for what it is: a fit signal, not a capability one. A student can be a perfect fit for a
// batch and not be ready for it, which is why this is a third rather than a gate.
export function compatibilityComponent(score) {
  // Number(null) is 0 and isFinite(0) is true, so a null score was being read as a genuine
  // zero — ranking a student who has not been scored below one who scored badly. Absence is
  // checked before conversion.
  if (score === null || score === undefined || score === '') {
    return { value: null, ready: false, reason: 'No compatibility score yet — add skills to your profile.' };
  }
  const v = Number(score);
  if (!Number.isFinite(v)) return { value: null, ready: false, reason: 'No compatibility score yet — add skills to your profile.' };
  return { value: clamp(v), ready: true, note: 'Fit, not capability.' };
}

// ── Component 3: demonstrated activity ────────────────────────────────────────────────
// What they did, weighted above how long they were here.
export function activityComponent({
  correctAnswers = 0, totalAnswered = 0, exercisesCompleted = 0, exercisesOffered = 0,
  activeMinutes = 0,
} = {}) {
  const accuracy = totalAnswered > 0 ? (correctAnswers / totalAnswered) * 100 : null;
  const completion = exercisesOffered > 0 ? (exercisesCompleted / exercisesOffered) * 100 : null;

  // Session time saturates fast on purpose. Two hours of engaged practice and twenty hours
  // of a parked tab should not be far apart, and beyond a point more time signals nothing.
  const SATURATE_AT = 180;
  const timeScore = Math.min(100, (Number(activeMinutes) || 0) / SATURATE_AT * 100);

  const parts = [];
  if (accuracy !== null) parts.push([accuracy, ACTIVITY_WEIGHTS.correctAnswers]);
  if (completion !== null) parts.push([completion, ACTIVITY_WEIGHTS.exercises]);
  parts.push([timeScore, ACTIVITY_WEIGHTS.sessionTime]);

  const totalWeight = parts.reduce((n, [, w]) => n + w, 0);
  const value = totalWeight > 0 ? parts.reduce((n, [v, w]) => n + v * w, 0) / totalWeight : 0;

  return {
    value: clamp(value),
    ready: totalAnswered > 0 || exercisesOffered > 0,
    breakdown: {
      accuracy: accuracy === null ? null : Math.round(accuracy),
      completion: completion === null ? null : Math.round(completion),
      // Reported so an operator can see when time is doing the work, which is when to
      // distrust the number.
      timeContribution: Math.round(timeScore * ACTIVITY_WEIGHTS.sessionTime),
    },
    note: 'Correct answers and completed exercises carry this. Session time is capped at 15% and saturates at three hours.',
  };
}

// ── The composite ─────────────────────────────────────────────────────────────────────
export function batchScore(input = {}) {
  const expert = expertComponent(input.raterScores);
  const compatibility = compatibilityComponent(input.compatibility);
  const activity = activityComponent(input.activity);

  const components = { expert, compatibility, activity };
  const missing = Object.entries(components).filter(([, c]) => !c.ready).map(([k]) => k);

  // A partial composite would rank people on different bases, which is worse than no
  // ranking at all. Report what is missing instead of scoring around it.
  if (missing.length) {
    return {
      version: BATCH_SCORE_VERSION,
      ready: false,
      components,
      missing,
      reason: `Cannot score yet — waiting on: ${missing.map(k => components[k].reason || k).join(' ')}`,
      operatorOnly: true,
    };
  }

  const total = expert.value * WEIGHTS.expert
    + compatibility.value * WEIGHTS.compatibility
    + activity.value * WEIGHTS.activity;

  return {
    version: BATCH_SCORE_VERSION,
    ready: true,
    total: Math.round(total),
    components,
    weights: WEIGHTS,
    // Both flags exist so a future caller cannot mistake this for a student-facing number
    // or for a decision.
    operatorOnly: true,
    binding: false,
    note: 'Orders the review queue. Never shown to a student, never publishes a ranking, and never admits anyone on its own — an operator decides with a rationale.',
  };
}

// What a STUDENT sees instead. The checklist, unchanged, plus what is outstanding. No
// number, because a number invites comparison and comparison is the thing we said we would
// not build.
export function studentView(input = {}) {
  const s = batchScore(input);
  const waiting = [];
  if (!s.components.expert.ready) waiting.push('A reviewer is reading your application.');
  if (!s.components.compatibility.ready) waiting.push('Add skills to your profile so we can show how this batch lines up.');
  if (!s.components.activity.ready) waiting.push('Answer the technical questions and complete the exercise.');
  return {
    version: BATCH_SCORE_VERSION,
    // Deliberately absent: any number.
    stage: s.ready ? 'with_reviewers' : 'in_progress',
    outstanding: waiting,
    message: s.ready
      ? 'Everything is in. A reviewer makes the call, and you will get their reasoning either way.'
      : 'Here is what is still outstanding.',
  };
}
