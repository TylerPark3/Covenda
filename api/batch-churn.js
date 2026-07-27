// Keeping a batch worth being in.
//
// A batch that never turns over stops meaning anything. Members admitted in March who have
// done nothing since are still on the list a company pays to open, and the list is the
// product. So there has to be churn.
//
// ── WHERE I PUSHED BACK, AND WHY ──────────────────────────────────────────────────────
// The instinct is right; "bottom 5 every two weeks, relative to the cohort" has three
// specific failure modes, and the design below keeps the instinct while closing them.
//
// 1. RELATIVE RANKING PUNISHES BEING IN A STRONG COHORT. A student doing genuinely good
//    work can be bottom-5 in an exceptional batch. Removing them says nothing about them
//    and everything about who they were admitted alongside — and they will tell people that.
//    So: an ABSOLUTE floor is the primary mechanism. Relative removal only runs when the
//    batch is over capacity AND somebody is waiting, because that is the only situation
//    where a seat is genuinely scarce.
//
// 2. TWO WEEKS IS FASTER THAN A UNIVERSITY TERM. Midterms, illness, a family week — all
//    look identical to abandonment over fourteen days. So: a warning first, a stated grace
//    period, and a student can declare an absence in advance and keep their seat.
//
// 3. NOBODY IS REMOVED MID-TRIAL. A student who has accepted work and is doing it cannot
//    lose their seat while doing it. That would be Covenda breaking the same promise it
//    asks companies to keep, and it is the one rule here with no exception.
//
// The clubs make this sharper, not softer. A student removed from a batch reflects on the
// club that vouched for them, which is the mechanism working — but it also means removal
// has to be defensible to a third party, not just to us.

export const CHURN_VERSION = 'batch-churn-1.0.0';

export const CHURN_POLICY = {
  reviewEveryDays: 14,
  // Absolute floor: no activity at all for this long is the primary removal reason. It is
  // predictable, it is about the person's own behaviour, and nobody can be surprised by it.
  inactiveDays: 45,
  // Warning lands well before removal, so the first message a student gets is never "you
  // are out".
  warnAfterDays: 30,
  graceDays: 14,
  // Relative removal only bites when a seat is genuinely scarce.
  maxRemovedPerReview: 5,
  requiresWaitlistForRelative: true,
};

const days = (from, to) => (!from || !to) ? Infinity : Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);

// What "productive" means here, said explicitly rather than left to a vague "productivity".
// Deliberately excludes session time — an inactive member is one who has not DONE anything,
// not one who has not been present.
export function memberActivity(member = {}, now) {
  const last = [
    member.lastSubmissionAt, member.lastApplicationAt,
    member.lastDeliverableAt, member.lastAnswerAt,
  ].filter(Boolean).sort().pop() || null;

  return {
    lastActiveAt: last,
    idleDays: days(last, now),
    // Completed work is the strongest signal and is what relative ranking uses.
    accepted: Number(member.acceptedDeliverables) || 0,
    applications: Number(member.applications) || 0,
    answers: Number(member.correctAnswers) || 0,
    inTrial: Boolean(member.activeTrial),
    absenceUntil: member.declaredAbsenceUntil || null,
  };
}

// Productivity for ranking. Accepted work dominates; applying is worth something because
// trying is the behaviour a batch exists to produce; answers are the smallest slice.
export function productivity(a) {
  return a.accepted * 100 + a.applications * 15 + a.answers * 2;
}

// One member's standing. Returns a decision plus the reason a human would have to give.
export function reviewMember(member = {}, { now = null, rank = null, cohortSize = 0, waitlisted = 0 } = {}) {
  const a = memberActivity(member, now);

  // The rule with no exception.
  if (a.inTrial) {
    return { action: 'keep', reason: 'Currently doing accepted work. Never removed mid-trial.', protected: true };
  }
  // A declared absence is honoured. Asking a student to tell us beats guessing from silence.
  if (a.absenceUntil && Date.parse(a.absenceUntil) > Date.parse(now)) {
    return { action: 'keep', reason: `Declared absence until ${a.absenceUntil.slice(0, 10)}.`, protected: true };
  }

  if (a.idleDays >= CHURN_POLICY.inactiveDays) {
    return {
      action: 'remove',
      basis: 'inactivity',
      reason: `No activity for ${a.idleDays} days. The bar is ${CHURN_POLICY.inactiveDays}.`,
      // Absolute, so it is explicable to the student and to the club that vouched for them.
      appealable: true,
    };
  }
  if (a.idleDays >= CHURN_POLICY.warnAfterDays) {
    return {
      action: 'warn',
      basis: 'inactivity',
      reason: `Quiet for ${a.idleDays} days. ${CHURN_POLICY.inactiveDays - a.idleDays} days before the seat is released.`,
      graceDays: CHURN_POLICY.graceDays,
    };
  }

  // Relative removal — only when a seat is actually scarce.
  const overCapacity = cohortSize > 0 && rank !== null && rank > cohortSize;
  if (overCapacity && waitlisted > 0) {
    return {
      action: 'remove',
      basis: 'capacity',
      reason: `Ranked ${rank} of ${cohortSize} seats with ${waitlisted} waiting. Removed for the seat, not for the work.`,
      // The wording matters: this is not a judgement on them, and telling them otherwise
      // would be dishonest as well as unkind.
      appealable: true,
    };
  }
  return { action: 'keep', reason: 'Active.' };
}

// A whole batch, in one pass. Ordered so an operator reviews removals before warnings.
export function reviewBatch(members = [], { now = null, capacity = 0, waitlisted = 0 } = {}) {
  const scored = members.map(m => {
    const a = memberActivity(m, now);
    return { member: m, activity: a, productivity: productivity(a) };
  }).sort((x, y) => y.productivity - x.productivity);

  const results = scored.map((row, i) => ({
    userId: row.member.userId,
    rank: i + 1,
    productivity: row.productivity,
    ...reviewMember(row.member, { now, rank: i + 1, cohortSize: capacity, waitlisted }),
  }));

  const removals = results.filter(r => r.action === 'remove');
  // Capped, because removing a third of a cohort in one pass is a policy change, not a
  // review — and it should require somebody to decide it deliberately.
  const capped = removals.slice(0, CHURN_POLICY.maxRemovedPerReview);
  const deferred = removals.slice(CHURN_POLICY.maxRemovedPerReview);

  return {
    version: CHURN_VERSION,
    reviewed: results.length,
    keep: results.filter(r => r.action === 'keep').length,
    warn: results.filter(r => r.action === 'warn'),
    remove: capped,
    deferred,
    // Recommendations, never automatic. Same posture as every other decision in the product.
    binding: false,
    note: deferred.length
      ? `${deferred.length} further removals were deferred — more than ${CHURN_POLICY.maxRemovedPerReview} in one review needs a deliberate decision, not a cron job.`
      : 'An operator confirms each removal. Nobody is removed automatically.',
  };
}

// What the student is told. Removal has to be explicable to them and to the club that
// vouched for them, so the message carries the reason and the route back.
export function removalMessage(result = {}) {
  if (result.basis === 'capacity') {
    return {
      subject: 'Your batch seat has been released',
      body: 'Your seat went to someone on the waitlist. This is about the seat, not your work — '
        + 'you can reapply at the next intake, and the work you have already done still stands on your profile.',
      reapply: true,
    };
  }
  return {
    subject: 'Your batch seat has been released',
    body: `You have not been active for ${CHURN_POLICY.inactiveDays} days, so the seat has gone back to the pool. `
      + 'Nothing you earned is lost — accepted work stays on your record. Reapply whenever you are ready.',
    reapply: true,
  };
}
