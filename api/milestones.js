// Stage 4 — milestone telemetry and the flake defense.
//
// Stage 0 added the `milestones` / `founder_eval` / `founder_time_actual_min_week` columns
// and then nothing ever wrote to or read them. This is that runtime.
//
// From docs/COMPATIBILITY_ENGINE_MASTER.md, Stage 4:
//   * sequential unlocks — milestone 1 due in 24–72h, and N+1 does not open until N is in
//   * missed WITHOUT NOTICE → notify, then reassign to a pre-selected backup
//   * reassignment is recorded, never silent
//   * estimated-vs-actual founder time is a first-class metric
//
// Two design rules carried over from the rest of the engine:
//   1. PURE. No clock, no I/O, no randomness — `now` is always passed in. That keeps this
//      testable and keeps a resumed/replayed evaluation deterministic.
//   2. "Missed" is never inferred from lateness alone. A student who says they are running
//      late has communicated, which is the opposite of flaking; only silence escalates.
//      Conflating the two would punish exactly the behaviour we want to encourage.

export const MILESTONE_VERSION = 'milestones-1.0.0';

const HOUR = 3600_000;
export const FIRST_MILESTONE_MIN_HOURS = 24;
export const FIRST_MILESTONE_MAX_HOURS = 72;
// How long after a due date silence becomes a missed milestone. Late-but-talking never
// reaches this; the grace window exists so a few hours of timezone drift is not a flake.
export const SILENCE_GRACE_HOURS = 24;

function ms(hours) { return hours * HOUR; }
function toTime(value) {
  if (value === null || value === undefined || value === '') return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

// Build the opening schedule for a project. The first checkpoint lands inside 24–72h on
// purpose: it is the cheapest possible signal that someone has actually started, and it
// surfaces a flake while the work can still be reassigned.
export function buildMilestoneSchedule(project = {}, options = {}) {
  const startAt = toTime(options.startAt) ?? toTime(project.started_at) ?? toTime(project.created_at);
  if (startAt === null) return [];
  const weeks = Number(project.duration_weeks) || Number(options.weeks) || 4;
  const titles = Array.isArray(options.titles) && options.titles.length
    ? options.titles.slice(0, 8)
    : ['First checkpoint', 'Midpoint review', 'Final delivery'];

  // First checkpoint is fixed at 48h (inside the 24–72 band); the rest spread across the
  // remaining span so the last one lands on the finish date rather than past it.
  const firstOffset = ms(48);
  const total = ms(weeks * 7 * 24);
  const rest = Math.max(total - firstOffset, ms(24));
  return titles.map((title, index) => {
    const dueAt = index === 0
      ? startAt + firstOffset
      : startAt + firstOffset + Math.round((rest * index) / (titles.length - 1 || 1));
    return {
      title,
      due_at: new Date(dueAt).toISOString(),
      submitted_at: null,
      on_time: null,
      reassigned: false,
      notified_at: null,     // set when we tell the student they are overdue
      student_notice_at: null, // set when the STUDENT tells us — this is what stops escalation
    };
  });
}

// Per-milestone state, with sequential unlocking: N+1 stays 'locked' until N is submitted.
// Statuses: locked | open | submitted | late | missed
export function evaluateMilestones(milestones, now) {
  const nowT = toTime(now);
  const rows = Array.isArray(milestones) ? milestones : [];
  let previousSubmitted = true; // the first milestone is always unlocked

  const states = rows.map(m => {
    const due = toTime(m?.due_at);
    const submitted = toTime(m?.submitted_at);
    const notice = toTime(m?.student_notice_at);
    const unlocked = previousSubmitted;
    previousSubmitted = submitted !== null;

    if (!unlocked) return { ...m, status: 'locked', overdueHours: 0, communicated: notice !== null };
    if (submitted !== null) {
      const onTime = due === null ? true : submitted <= due;
      return { ...m, status: 'submitted', onTime, overdueHours: 0, communicated: notice !== null };
    }
    if (due === null || nowT === null || nowT <= due) {
      return { ...m, status: 'open', overdueHours: 0, communicated: notice !== null };
    }
    const overdueHours = (nowT - due) / HOUR;
    // Silence is the trigger, not lateness. A student who gave notice stays 'late'
    // indefinitely — that is a conversation, not a flake.
    //
    // Any notice counts, whenever it came. An earlier version also required the notice to
    // post-date the due date, which inverted the whole rule: warning the company BEFORE you
    // slip is the most responsible thing a student can do, and it was the one case being
    // escalated to 'missed'.
    const silent = notice === null;
    const status = silent && overdueHours >= SILENCE_GRACE_HOURS ? 'missed' : 'late';
    return { ...m, status, overdueHours: Math.round(overdueHours * 10) / 10, communicated: !silent };
  });

  const active = states.find(s => s.status === 'open' || s.status === 'late' || s.status === 'missed') || null;
  return {
    milestones: states,
    activeIndex: active ? states.indexOf(active) : -1,
    submittedCount: states.filter(s => s.status === 'submitted').length,
    onTimeCount: states.filter(s => s.status === 'submitted' && s.onTime).length,
    total: states.length,
    complete: states.length > 0 && states.every(s => s.status === 'submitted'),
    version: MILESTONE_VERSION,
  };
}

// What to do about an overdue milestone. Returns an ACTION, never a mutation — the caller
// decides whether to send, and reassignment is recorded on the project either way.
//
// notify → the student is overdue and has not been told yet
// reassign → silent past the grace window AND a backup was pre-selected
// escalate → silent past the grace window with NO backup; an operator has to intervene,
//            because dropping the company without a replacement is not a defense
export function reassignmentDecision(evaluation, project = {}, now = null) {
  const state = evaluation?.milestones?.[evaluation?.activeIndex];
  if (!state) return { action: 'none', reason: 'No active milestone.' };
  if (state.status === 'open' || state.status === 'locked') {
    return { action: 'none', reason: 'Milestone is not overdue.' };
  }
  if (state.communicated) {
    return {
      action: 'none',
      reason: 'The student gave notice before the due date — late, but not silent.',
      milestone: state.title,
    };
  }
  if (state.status === 'late') {
    return toTime(state.notified_at) === null
      ? { action: 'notify', milestone: state.title, overdueHours: state.overdueHours,
          reason: `Overdue by ${state.overdueHours}h with no word. Notify before escalating.` }
      : { action: 'none', milestone: state.title, reason: 'Already notified; grace window still open.' };
  }
  // status === 'missed'
  const backup = project.backup_user_id || null;
  if (!backup) {
    return {
      action: 'escalate', milestone: state.title, overdueHours: state.overdueHours,
      reason: `Silent for ${state.overdueHours}h past due and no backup was pre-selected. Needs an operator.`,
      requiresOperator: true,
    };
  }
  return {
    action: 'reassign', milestone: state.title, overdueHours: state.overdueHours, backupUserId: backup,
    reason: `Silent for ${state.overdueHours}h past due. Reassigning to the pre-selected backup.`,
    // Recorded, never silent — the student keeps the right to contest it.
    record: { reassigned: true, reassigned_at: toTime(now) ? new Date(toTime(now)).toISOString() : null, from_milestone: state.title },
  };
}

// Estimated-vs-actual founder time. The spec calls this first-class, and it is the number
// that tells a founder whether the trial actually saved them anything: a project that
// consumes more review time than the work was worth is a failure even if it shipped.
export function founderTimeVariance(project = {}) {
  const budget = Number(project.founder_time_budget_min_week);
  const actual = Number(project.founder_time_actual_min_week);
  if (!Number.isFinite(budget) || budget <= 0 || !Number.isFinite(actual)) {
    return { known: false, note: 'Not enough data — needs both a budget and a recorded actual.' };
  }
  const deltaMin = actual - budget;
  const ratio = actual / budget;
  return {
    known: true,
    budgetMinPerWeek: budget,
    actualMinPerWeek: actual,
    deltaMin,
    ratio: Math.round(ratio * 100) / 100,
    withinBudget: actual <= budget,
    // A trial that overran its review budget by half again is the signal to tighten scope,
    // not to blame the student — complexity is set by whoever wrote the brief.
    verdict: ratio <= 1 ? 'within_budget' : ratio <= 1.5 ? 'over_budget' : 'scope_too_loose',
  };
}

// Roll a finished project into the outcome row the Stage-5 gate will eventually train on.
// Deliberately records the difficulty of the work alongside the result: a 7 on an ambiguous
// brief is not the same evidence as a 7 on a trivial one.
export function outcomeSummary(project = {}, evaluation = null) {
  const evalResult = evaluation || evaluateMilestones(project.milestones, null);
  return {
    projectId: project.id || null,
    shipped: Boolean(project.completed_at),
    milestonesTotal: evalResult.total,
    milestonesOnTime: evalResult.onTimeCount,
    onTimeRate: evalResult.total ? Math.round((evalResult.onTimeCount / evalResult.total) * 100) / 100 : null,
    reassigned: (evalResult.milestones || []).some(m => m.reassigned === true),
    complexityRating: project.complexity_rating ?? null,
    ambiguityRating: project.ambiguity_rating ?? null,
    founderTime: founderTimeVariance(project),
    conversionOutcome: project.conversion_outcome || null,
    version: MILESTONE_VERSION,
  };
}
