// Persistence for simulation runs.
//
// The engine in api/simulation.js is pure: it takes a state and returns a new one. This is the
// only place that state touches a database, which keeps the interesting logic testable without
// a connection and keeps this file boring.
//
// ── THE RULE THAT SHAPES IT ───────────────────────────────────────────────────────────
// The client never sends state. It sends a decision, and the server loads the run, advances
// it, and stores the result. A client that could post its own state could post a state where
// it made different decisions, which would make every recorded run worthless.

import { advance, currentStep, defenseQuestions, evidenceFrom, startRun, SIMULATION_VERSION } from './simulation.js';
import { scenarioFor, SCENARIOS } from './scenarios.js';
import { recordError } from './limits.js';

export function scenarioById(id) {
  return SCENARIOS[id] || null;
}

// What the candidate is allowed to see: the step they are on, and nothing about what any
// choice reveals. Showing `reveals` would turn the scenario into a multiple-choice test with
// the answers printed underneath.
export function clientView(scenario, run) {
  const step = currentStep(scenario, run);
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    brief: scenario.brief,
    minutes: scenario.minutes,
    done: run.done,
    stepsTotal: scenario.steps.length,
    stepsDone: scenario.steps.findIndex(s => s.id === run.stepId) === -1
      ? scenario.steps.length
      : scenario.steps.findIndex(s => s.id === run.stepId),
    step: step && {
      id: step.id,
      kind: step.kind,
      title: step.title,
      body: step.body || null,
      options: (step.options || []).map(o => ({ id: o.id, label: o.label })),
    },
  };
}

export async function startSimulation(member, { specialization, scenarioId, batchId } = {}) {
  const scenario = scenarioId ? scenarioById(scenarioId) : scenarioFor(specialization);
  if (!scenario) throw new Error('No simulation exists for that specialisation yet.');

  // Resume rather than restart. Losing a run to a closed tab would be the same failure the
  // batch application had, and this one is longer.
  const { data: live } = await member.supabase.from('simulation_runs')
    .select('*').eq('user_id', member.user.id).eq('scenario_id', scenario.id)
    .eq('status', 'in_progress').maybeSingle();
  if (live) return { run: live.state, view: clientView(scenario, live.state), resumed: true, id: live.id };

  const run = startRun(scenario, { now: Date.now() });
  const { data, error } = await member.supabase.from('simulation_runs').insert({
    user_id: member.user.id,
    scenario_id: scenario.id,
    scenario_version: SIMULATION_VERSION,
    specialization: scenario.specialization,
    batch_id: batchId || null,
    state: run,
  }).select('id').single();
  if (error) throw new Error('Could not start the simulation.');
  return { run, view: clientView(scenario, run), resumed: false, id: data.id };
}

export async function advanceSimulation(member, { runId, optionId, artifact, answer } = {}) {
  const { data: row, error } = await member.supabase.from('simulation_runs')
    .select('*').eq('id', runId).eq('user_id', member.user.id).maybeSingle();
  if (error || !row) throw new Error('That run is not yours, or does not exist.');
  if (row.status !== 'in_progress') throw new Error('That run is already finished.');

  const scenario = scenarioById(row.scenario_id);
  if (!scenario) throw new Error('That scenario is no longer available.');

  let next;
  try {
    next = advance(scenario, row.state, { optionId, artifact, answer }, { now: Date.now() });
  } catch (err) {
    // A rejected input is the candidate's problem to fix, not an error to swallow.
    throw new Error(err.message);
  }

  const patch = { state: next, updated_at: new Date().toISOString() };
  if (next.done) {
    patch.status = 'completed';
    patch.completed_at = new Date().toISOString();
    const evidence = evidenceFrom(scenario, next);
    patch.evidence = evidence.ok ? evidence : null;
    patch.defense = defenseQuestions(scenario, next);
  }

  const { error: writeError } = await member.supabase.from('simulation_runs')
    .update(patch).eq('id', runId).eq('user_id', member.user.id);
  if (writeError) {
    await recordError('simulation-run', 'error', writeError.message, { userId: member.user.id, detail: { runId } });
    throw new Error('Your answer was not saved. Try that step again.');
  }

  return {
    view: clientView(scenario, next),
    done: next.done,
    // Only on completion, and only the questions. The answers come back through the same
    // advance path so they land in the event log like everything else.
    defense: next.done ? defenseQuestions(scenario, next) : null,
  };
}

export async function loadSimulations(member) {
  const { data } = await member.supabase.from('simulation_runs')
    .select('id, scenario_id, specialization, status, started_at, completed_at, state')
    .eq('user_id', member.user.id).order('started_at', { ascending: false }).limit(20);
  return (data || []).map(row => {
    const scenario = scenarioById(row.scenario_id);
    return {
      id: row.id,
      scenarioId: row.scenario_id,
      title: scenario?.title || row.scenario_id,
      specialization: row.specialization,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      decisions: (row.state?.decisions || []).length,
    };
  });
}
