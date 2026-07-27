// The software vetting process, end to end.
//
// Every batch has published REQUIREMENTS (api/batches.js) and the machinery to evaluate
// evidence against them. What has been missing is the PROCESS: the ordered thing a student
// actually walks through, what each stage produces, who decides, and what happens when a
// stage is inconclusive rather than pass or fail.
//
// Software first because it is the only vertical where the mechanism is genuinely proven:
// GitHub OAuth establishes ownership, the commit timeline establishes history, and neither
// can be produced by pasting a link to someone else's work. Finance is next (the workbook
// parser is live); the human-rail verticals are last, because a process nobody can run
// consistently is worse than an honest "reviewed by a person".
//
// ── THE ONE RULE ──────────────────────────────────────────────────────────────────────
// No stage may pass a student on automated signal alone. Code analysis says the work is
// theirs and how it accumulated; it cannot say whether the thinking was any good. That is
// what the defense is for, and it is why a perfect analysis score still cannot clear the
// batch on its own.

export const VETTING_SOFTWARE_VERSION = 'vetting-software-1.0.0';

export const STAGES = [
  {
    key: 'connect',
    label: 'Connect the account that owns your work',
    kind: 'automated',
    minutes: 2,
    produces: 'ownership_verified',
    why: 'A pasted link proves nothing about who wrote the code. Read-only OAuth does.',
    // Failing here is not a judgement — it is a missing prerequisite, and the wording matters
    // because a student reading "failed" about an OAuth step will assume they were rejected.
    blockedMessage: 'Connect GitHub to continue. Read-only, and you can disconnect any time.',
  },
  {
    key: 'analyse',
    label: 'We read the code',
    kind: 'automated',
    minutes: 3,
    produces: 'skill_signals',
    why: 'Per-skill scores with the file behind each one. Never an overall person-score.',
    blockedMessage: 'Link at least one repository you wrote.',
  },
  {
    key: 'history',
    label: 'How the work accumulated',
    kind: 'automated',
    minutes: 0,
    produces: 'history_span',
    why: 'A repo committed in one sitting the night before applying reads differently from six months of work. Neither is disqualifying; they are different evidence.',
    blockedMessage: 'We need commit history, not a single upload.',
  },
  {
    key: 'defense',
    label: 'Talk through what you built',
    kind: 'human',
    minutes: 15,
    produces: 'defense_record',
    why: 'The only stage a model cannot sit for. Questions come from YOUR code, so they cannot be prepared in advance.',
    blockedMessage: 'Record your walkthrough to finish.',
  },
  {
    key: 'review',
    label: 'Two people score it',
    kind: 'human',
    minutes: 0,
    produces: 'rubric_scores',
    why: 'Two raters against the published 4/6/9 anchors. A wide split goes to a third rather than being averaged into a number nobody stands behind.',
    blockedMessage: 'Waiting on review.',
  },
];

// What each stage needs before it can even run. Missing prerequisites are reported as
// "not yet", never as a failure — the distinction is the difference between a queue and a
// rejection.
export function stageState(stageKey, evidence = {}) {
  const has = key => Boolean(evidence[key]);
  switch (stageKey) {
    case 'connect':
      return has('ownershipVerified') ? done() : blocked('connect');
    case 'analyse':
      if (!has('ownershipVerified')) return waiting('Connect your account first.');
      return (evidence.analysedRepos || 0) > 0 ? done() : blocked('analyse');
    case 'history':
      if (!(evidence.analysedRepos > 0)) return waiting('Nothing analysed yet.');
      return Number(evidence.historyDays) > 0 ? done() : blocked('history');
    case 'defense':
      if (!(evidence.analysedRepos > 0)) return waiting('Analyse a repository first — the questions come from it.');
      return has('defenseRecordedAt') ? done() : blocked('defense');
    case 'review':
      if (!has('defenseRecordedAt')) return waiting('Nothing to review yet.');
      return (evidence.raterScores || []).length >= 2 ? done() : blocked('review');
    default:
      return waiting('Unknown stage.');
  }
}

const done = () => ({ state: 'done', canStart: false });
const blocked = key => ({ state: 'open', canStart: true, message: STAGES.find(s => s.key === key)?.blockedMessage || '' });
const waiting = message => ({ state: 'waiting', canStart: false, message });

// Two raters, and a disagreement that is not quietly averaged away. Averaging 4 and 9 gives
// 6.5, which represents nobody's judgement and hides that the panel could not agree.
export const RATER_SPLIT_THRESHOLD = 3;

export function adjudicate(scores = []) {
  const values = scores.map(s => Number(s?.score)).filter(Number.isFinite);
  if (values.length < 2) return { resolved: false, reason: 'Needs two independent scores.' };
  const spread = Math.max(...values) - Math.min(...values);
  if (spread >= RATER_SPLIT_THRESHOLD && values.length < 3) {
    return {
      resolved: false,
      needsThirdRater: true,
      spread,
      reason: `The two raters are ${spread} points apart. That goes to a third reader — averaging it would produce a number neither of them would defend.`,
    };
  }
  // With three, take the median: it discards the outlier without pretending it never happened.
  const sorted = [...values].sort((a, b) => a - b);
  const score = values.length >= 3 ? sorted[Math.floor(sorted.length / 2)] : (sorted[0] + sorted[1]) / 2;
  return { resolved: true, score: Math.round(score * 10) / 10, spread, raters: values.length };
}

// The gate. Automated signal is necessary and never sufficient.
export const PASS_MARK = 6;

export function decide({ evidence = {}, adjudication = null } = {}) {
  const stages = STAGES.map(s => ({ ...s, ...stageState(s.key, evidence) }));
  const outstanding = stages.filter(s => s.state !== 'done');

  if (outstanding.length) {
    const next = outstanding.find(s => s.canStart) || outstanding[0];
    return {
      version: VETTING_SOFTWARE_VERSION,
      decision: 'in_progress',
      stages,
      nextStage: next.key,
      nextLabel: next.label,
      message: next.message || 'In progress.',
      // Time left, so a student can decide whether to start now.
      minutesRemaining: outstanding.reduce((n, s) => n + (s.minutes || 0), 0),
    };
  }
  if (!adjudication?.resolved) {
    return {
      version: VETTING_SOFTWARE_VERSION,
      decision: 'in_review',
      stages,
      message: adjudication?.reason || 'With the reviewers.',
    };
  }
  const passed = adjudication.score >= PASS_MARK;
  return {
    version: VETTING_SOFTWARE_VERSION,
    decision: passed ? 'admit' : 'not_yet',
    score: adjudication.score,
    stages,
    // A recommendation, not an admission. An operator still decides, which is the same rule
    // evaluateBatchAdmission already states.
    binding: false,
    message: passed
      ? `Cleared the bar at ${adjudication.score}. An operator confirms every admission.`
      : `Scored ${adjudication.score} against a bar of ${PASS_MARK}. The walkthrough is the fastest thing to improve — most of the gap is there, not in the code.`,
  };
}

// What a student sees before starting: what it costs them, and what it is actually reading.
export function processSummary() {
  return {
    version: VETTING_SOFTWARE_VERSION,
    vertical: 'Software & AI',
    totalMinutes: STAGES.reduce((n, s) => n + s.minutes, 0),
    automated: STAGES.filter(s => s.kind === 'automated').length,
    human: STAGES.filter(s => s.kind === 'human').length,
    stages: STAGES.map(({ key, label, kind, minutes, why }) => ({ key, label, kind, minutes, why })),
    // Said plainly, because a vetting process that overstates what it can tell is the exact
    // thing this product exists to be an alternative to.
    honesty: 'Reading your code proves the work is yours and how it accumulated. It cannot tell anyone whether the thinking was good — that is what the walkthrough is for, and why a perfect analysis still cannot clear this on its own.',
  };
}
