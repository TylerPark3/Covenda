// The scenario state engine.
//
// ── WHAT THIS ADDS THAT DID NOT EXIST ─────────────────────────────────────────────────
// api/assessments.js already supplies a task per specialisation, and api/session-script.js
// already fires prompts at points during a recording. Neither has STATE: nothing branches on
// what a candidate decided, and nothing introduces information partway through.
//
// That is the whole difference between a task and a simulation. A task asks someone to do a
// thing. A simulation asks them to decide, then changes in response, then asks them to defend
// the decision they made rather than a decision in general.
//
// ── WHY ONE ENGINE AND NOT TWENTY-FIVE ────────────────────────────────────────────────
// A scenario is DATA: steps, decisions, branch rules, and what each decision reveals. The
// engine reads that data. Adding a vertical is authoring a scenario, not writing a program,
// which is the only way twenty-five of these stay maintainable by two people.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────────────────
// It does not score. It emits events and evidence with their limitations attached, and a human
// reads them. The moment an engine like this produces a number, that number becomes the
// product, and nobody can explain it.

import { normaliseEvidence } from './evidence.js';

export const SIMULATION_VERSION = 'simulation-1.0.0';

export const EVENT_TYPES = [
  'scenario_started',
  'information_revealed',   // the engine introduced something new
  'decision_made',
  'artifact_submitted',
  'defense_answered',
  'scenario_completed',
  'scenario_abandoned',
];

// ── Scenario shape ────────────────────────────────────────────────────────────────────
// A scenario is a list of steps. A step either reveals something, asks for a decision, or
// asks for an artifact. Branch rules map a decision to the step that follows, so two
// candidates can take genuinely different paths through the same scenario.
export function validateScenario(scenario) {
  const problems = [];
  if (!scenario?.id) problems.push('A scenario needs an id.');
  if (!scenario?.specialization) problems.push('A scenario must name the specialisation it belongs to.');
  if (!Array.isArray(scenario?.steps) || !scenario.steps.length) problems.push('A scenario needs at least one step.');

  const ids = new Set((scenario?.steps || []).map(s => s.id));
  for (const step of scenario?.steps || []) {
    if (!step.id) problems.push('Every step needs an id.');
    if (!['reveal', 'decide', 'produce', 'defend'].includes(step.kind)) {
      problems.push(`Step ${step.id}: kind must be reveal, decide, produce or defend.`);
    }
    if (step.kind === 'decide') {
      if (!Array.isArray(step.options) || step.options.length < 2) {
        problems.push(`Step ${step.id}: a decision needs at least two options, or it is not a decision.`);
      }
      // Every option must say what choosing it reveals about the candidate. Without that the
      // event log is a record of clicks rather than evidence.
      for (const option of step.options || []) {
        if (!option.reveals) problems.push(`Step ${step.id}, option ${option.id}: missing what this choice reveals.`);
        if (option.next && !ids.has(option.next)) problems.push(`Step ${step.id}: option ${option.id} branches to a step that does not exist.`);
      }
    }
    if (step.next && !ids.has(step.next)) problems.push(`Step ${step.id} points at a step that does not exist.`);
  }
  return { ok: problems.length === 0, problems };
}

// ── State ─────────────────────────────────────────────────────────────────────────────
// Held as plain data so a run can be persisted, resumed, and replayed exactly. A run that
// cannot be replayed cannot be reviewed, and a rater who cannot see what the candidate saw is
// guessing.
export function startRun(scenario, { now = 0 } = {}) {
  const check = validateScenario(scenario);
  if (!check.ok) throw new Error(`Scenario is not runnable: ${check.problems[0]}`);
  return {
    scenarioId: scenario.id,
    specialization: scenario.specialization,
    stepId: scenario.steps[0].id,
    startedAt: now,
    decisions: [],
    revealed: [],
    artifacts: [],
    events: [{ type: 'scenario_started', at: now, stepId: scenario.steps[0].id }],
    done: false,
  };
}

export function currentStep(scenario, run) {
  return (scenario.steps || []).find(s => s.id === run.stepId) || null;
}

// Advances the run. Returns a NEW state rather than mutating, so a caller can diff two states
// or replay a run from its events without the engine having quietly changed something.
export function advance(scenario, run, input = {}, { now = 0 } = {}) {
  if (run.done) return run;
  const step = currentStep(scenario, run);
  if (!step) return { ...run, done: true };

  const next = { ...run, decisions: [...run.decisions], revealed: [...run.revealed], artifacts: [...run.artifacts], events: [...run.events] };

  if (step.kind === 'decide') {
    const option = (step.options || []).find(o => o.id === input.optionId);
    if (!option) throw new Error('That is not one of the options on this step.');
    next.decisions.push({
      stepId: step.id, optionId: option.id, at: now,
      // Time to decide is recorded, never scored by default. Some roles reward speed and most
      // do not, so whether it matters is a property of the scenario, not of the engine.
      secondsTaken: Math.max(0, Math.round((now - (run.lastAt ?? run.startedAt)) / 1000)),
      reveals: option.reveals,
    });
    next.events.push({ type: 'decision_made', at: now, stepId: step.id, optionId: option.id });
    next.stepId = option.next || step.next || null;
  } else if (step.kind === 'produce') {
    if (!input.artifact) throw new Error('This step needs the work itself.');
    next.artifacts.push({ stepId: step.id, at: now, ref: String(input.artifact).slice(0, 500) });
    next.events.push({ type: 'artifact_submitted', at: now, stepId: step.id });
    next.stepId = step.next || null;
  } else if (step.kind === 'defend') {
    next.events.push({ type: 'defense_answered', at: now, stepId: step.id });
    next.artifacts.push({ stepId: step.id, at: now, answer: String(input.answer || '').slice(0, 4000) });
    next.stepId = step.next || null;
  } else {
    next.revealed.push({ stepId: step.id, at: now });
    next.events.push({ type: 'information_revealed', at: now, stepId: step.id });
    next.stepId = step.next || null;
  }

  next.lastAt = now;
  if (!next.stepId) {
    next.done = true;
    next.events.push({ type: 'scenario_completed', at: now });
  }
  return next;
}

// ── Defense ───────────────────────────────────────────────────────────────────────────
// Generated from what THIS candidate did. A generic follow-up can be prepared in advance and
// answered by anyone; "you chose to hold rather than rebalance, and the drawdown widened,
// walk me through that" cannot.
export function defenseQuestions(scenario, run) {
  return run.decisions.map(decision => {
    const step = (scenario.steps || []).find(s => s.id === decision.stepId);
    const option = (step?.options || []).find(o => o.id === decision.optionId);
    return {
      stepId: decision.stepId,
      // The candidate's own choice, quoted back at them.
      question: option?.defense || `You chose "${option?.label || decision.optionId}". What would have had to be true for the other option to be right?`,
      reads: option?.reveals || null,
    };
  });
}

// ── Evidence ──────────────────────────────────────────────────────────────────────────
// A completed run produces evidence, and the evidence states its own ceiling. A simulation is
// observed behaviour under conditions Covenda controlled, which is real and is not the same as
// having done the job.
export function evidenceFrom(scenario, run) {
  if (!run.done) return { ok: false, reason: 'The run is not finished.' };
  const skills = [...new Set((scenario.skills || []).map(String))];
  const claims = skills.map(skill => normaliseEvidence({
    source: 'job_simulation',
    skill,
    tier: 'artifact',
    pointer: `simulation:${scenario.id}`,
    meta: {
      decisions: run.decisions.length,
      defended: run.events.some(e => e.type === 'defense_answered'),
      // Carried on every claim, because a company reading this needs to know what it is not.
      limitation: 'Observed in a controlled scenario. It shows how they decided under these conditions, not that they have done this work in a real role.',
    },
  })).filter(c => c.ok);
  return { ok: true, claims: claims.map(c => c.claim), scenarioId: scenario.id, version: SIMULATION_VERSION };
}
