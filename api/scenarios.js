// The first two scenarios, chosen because they are as different as this product gets.
//
// Investment banking is a judgement scenario: information arrives, priorities conflict, and the
// interesting moment is what you do when the number stops making sense. Software is an
// artifact scenario: the work is a diff, and the interesting moment is whether you understood
// the code you changed.
//
// If both run on one engine without either needing a special case, the architecture
// generalises. That is the only reason to build two before building twenty-five.
//
// Every scenario here is synthetic. No real company, transaction, or codebase appears in it.
// The architecture did generalise: all 25 specialisations run on this engine with no special
// cases. Phases 3-6 are in ./scenarios-2.js.

import { SCENARIOS_2 } from './scenarios-2.js';

export const SCENARIOS_VERSION = 'scenarios-1.1.0';

// ── Investment banking ────────────────────────────────────────────────────────────────
export const DEAL_ROOM = {
  id: 'ib-deal-room-1',
  specialization: 'investment-banking',
  title: 'The number that stopped matching',
  minutes: 40,
  skills: ['financial statement analysis', 'valuation', 'prioritisation under pressure'],
  brief: 'You are an analyst on a sell-side process. The management pack arrived this morning and a bid is due Thursday.',
  steps: [
    {
      id: 'pack', kind: 'reveal', next: 'first-look',
      title: 'The management pack',
      body: 'Three years of financials, an adjusted EBITDA bridge, and a one-page industry summary. The bridge adds back a restructuring charge in all three years.',
    },
    {
      id: 'first-look', kind: 'decide', title: 'Where do you start?',
      options: [
        { id: 'bridge', label: 'Interrogate the EBITDA bridge', next: 'discrepancy',
          reveals: 'Goes to the adjustment first. A recurring add-back across three years is not restructuring, and noticing that unprompted is the signal.',
          defense: 'You went to the bridge before the model. What made the add-back worth looking at before anything else?' },
        { id: 'model', label: 'Build the model and come back to the pack', next: 'discrepancy',
          reveals: 'Builds first. Not wrong, and it usually means the discrepancy is found later and under more time pressure.',
          defense: 'You built before interrogating the pack. When the add-back turned out to be recurring, how much rework did that cost you?' },
        { id: 'comps', label: 'Pull comparable transactions first', next: 'discrepancy',
          reveals: 'Anchors on market before understanding the asset. Comps built on an inflated EBITDA inherit the error.',
          defense: 'You anchored on comps first. If the EBITDA you multiplied was overstated, what happens to that range?' },
      ],
    },
    {
      id: 'discrepancy', kind: 'reveal', next: 'vp',
      title: 'Something does not reconcile',
      body: 'The restructuring charge appears in FY22, FY23 and FY24, at roughly the same size each year. Management calls it one-off in the pack.',
    },
    {
      id: 'vp', kind: 'decide', title: 'Your VP wants the valuation range in twenty minutes',
      options: [
        { id: 'flag-now', label: 'Send the range and flag the add-back in the same message', next: 'produce',
          reveals: 'Delivers and discloses together. The senior gets a number and the caveat that governs it.',
          defense: 'You flagged it in the same message. What would you have done if the VP had asked for the number without the caveat?' },
        { id: 'range-only', label: 'Send the range now, raise the add-back after', next: 'produce',
          reveals: 'Optimises for responsiveness. The risk is a number circulating without the thing that qualifies it.',
          defense: 'The range went out before the caveat. Where could it have travelled in the meantime?' },
        { id: 'hold', label: 'Hold the range until the add-back is resolved', next: 'produce',
          reveals: 'Optimises for accuracy over responsiveness. Defensible, and it can read as being unable to work under a deadline.',
          defense: 'You held the number. How would you have handled the VP asking again at minute nineteen?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The range',
      body: 'Give the valuation range you would actually send, with the assumption that governs it.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

// ── Software engineering ──────────────────────────────────────────────────────────────
export const CODEBASE = {
  id: 'swe-inherited-bug-1',
  specialization: 'product-engineering',
  title: 'A test that passes for the wrong reason',
  minutes: 45,
  skills: ['debugging', 'reading unfamiliar code', 'test design'],
  brief: 'You have joined a team. A checkout bug reaches production roughly once a week, and the test suite is green.',
  steps: [
    {
      id: 'repo', kind: 'reveal', next: 'approach',
      title: 'What you have',
      body: 'A small service, a passing suite, and three production reports that all mention a total being one cent short.',
    },
    {
      id: 'approach', kind: 'decide', title: 'First move',
      options: [
        { id: 'reproduce', label: 'Write a failing test from the production reports', next: 'cause',
          reveals: 'Reproduces before reading. The bug becomes checkable rather than argued about.',
          defense: 'You wrote the failing test first. What did the three reports have in common that told you what to assert?' },
        { id: 'read', label: 'Read the checkout path end to end', next: 'cause',
          reveals: 'Builds a model of the code first. Thorough, and on an unfamiliar codebase it can cost a lot of time before anything is confirmed.',
          defense: 'You read first. At what point would you have stopped reading and started reproducing?' },
        { id: 'patch', label: 'Round the total and see if the reports stop', next: 'cause',
          reveals: 'Treats the symptom. It usually works and it hides the cause, which is the thing worth knowing about a candidate.',
          defense: 'Rounding would have made the reports stop. What would still have been wrong underneath?' },
      ],
    },
    {
      id: 'cause', kind: 'reveal', next: 'fix',
      title: 'What is actually happening',
      body: 'Line items are summed as floats and rounded once at the end. The existing test asserts on a total that happens to round correctly.',
    },
    {
      id: 'fix', kind: 'decide', title: 'How do you fix it?',
      options: [
        { id: 'integers', label: 'Move the money to integer minor units', next: 'produce',
          reveals: 'Fixes the class of bug rather than the instance. The larger change, and the one that stops it recurring.',
          defense: 'You changed the representation. What does that break elsewhere, and how would you find out before merging?' },
        { id: 'decimal', label: 'Use a decimal type at the boundaries', next: 'produce',
          reveals: 'Correct and narrower. Depends on every path adopting it, which is the failure mode.',
          defense: 'A decimal type only helps where it is used. How would you stop a float creeping back in next quarter?' },
        { id: 'assert', label: 'Fix the test first, then the code', next: 'produce',
          reveals: 'Makes the suite tell the truth before changing behaviour, so the fix is provable.',
          defense: 'You changed the test before the code. How do you know the new assertion is right and not just different?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The change',
      body: 'Submit the diff, including whatever test proves it.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};


// ── Phase 2: the rest of Software & AI ────────────────────────────────────────────────
// Authored, not programmed. Each of these is a data structure the existing engine reads; none
// of them required a line of engine change, which was the point of building two first.

export const LEAK = {
  id: 'aiml-leaky-eval-1',
  specialization: 'ai-ml',
  title: 'A number that is too good',
  minutes: 35,
  skills: ['experiment design', 'data leakage detection', 'metric selection'],
  brief: 'A churn model reports 0.98 validation accuracy. On last month\'s real data it gets 0.62.',
  steps: [
    { id: 'setup', kind: 'reveal', next: 'first',
      title: 'What you inherited',
      body: 'One training script, one CSV, and a README claiming the model is production-ready. Scaling happens before the split.' },
    { id: 'first', kind: 'decide', title: 'Where do you look first?',
      options: [
        { id: 'split', label: 'Check what happens before the train/test split', next: 'found',
          reveals: 'Goes to the ordering. Fitting a scaler on the whole frame leaks test statistics into training, and it is the most common cause of exactly this gap.',
          defense: 'You went to the split ordering first. What in the reported numbers pointed you there rather than at the model?' },
        { id: 'metric', label: 'Check whether accuracy is the right metric', next: 'found',
          reveals: 'Goes to class balance. A reasonable instinct, and on a 1% churn base rate 0.98 would be trivial, so it is worth ruling out.',
          defense: 'You checked the metric. Once you knew the classes were balanced, what did that leave?' },
        { id: 'more', label: 'Retrain with more regularisation', next: 'found',
          reveals: 'Treats it as overfitting. The gap is too large and too clean for that, and retraining hides the cause rather than finding it.',
          defense: 'Regularisation would have narrowed the gap without explaining it. What would you still not know?' },
      ] },
    { id: 'found', kind: 'reveal', next: 'fix',
      title: 'The scaler',
      body: 'StandardScaler is fit on the full frame, then the split happens. Validation rows contributed to the statistics used to normalise them.' },
    { id: 'fix', kind: 'decide', title: 'What do you do about the reported number?',
      options: [
        { id: 'retract', label: 'Retract 0.98 and rerun before saying anything else', next: 'produce',
          reveals: 'Removes the wrong number from circulation first. Slowest and the only one that stops it being quoted again.',
          defense: 'You retracted before you had a replacement. What did you tell the person who had already used the old number?' },
        { id: 'both', label: 'Report the leak and the corrected number together', next: 'produce',
          reveals: 'Delivers the correction with its cause. Requires the rerun to be quick enough to hold.',
          defense: 'You waited to send both. How long was that, and what happened to the old number meanwhile?' },
        { id: 'note', label: 'Add a caveat to the README and move on', next: 'produce',
          reveals: 'Documents rather than corrects. The number stays in the deck it was already pasted into.',
          defense: 'A README caveat does not reach a slide. Who was still holding 0.98?' },
      ] },
    { id: 'produce', kind: 'produce', next: 'defend',
      title: 'The corrected evaluation',
      body: 'Submit the fixed script or the corrected numbers, with what changed.' },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const ROWS = {
  id: 'infra-silent-loss-1',
  specialization: 'infrastructure-data',
  title: 'Three percent that never arrives',
  minutes: 35,
  skills: ['pipeline debugging', 'join semantics', 'data validation'],
  brief: 'A nightly pipeline runs green. Source has 41,882 rows and the output has 40,610. Nobody has accounted for the difference.',
  steps: [
    { id: 'shape', kind: 'reveal', next: 'first',
      title: 'What the job does',
      body: 'Parses a timestamp with a fixed format and coerces failures, then inner-joins to a users table, then filters positive amounts.' },
    { id: 'first', kind: 'decide', title: 'Which step do you suspect?',
      options: [
        { id: 'join', label: 'The inner join', next: 'both',
          reveals: 'An inner join silently drops anything without a match. The most common silent loss in a pipeline that reports success.',
          defense: 'You suspected the join. How would you have measured the loss without changing the job?' },
        { id: 'parse', label: 'The coerced timestamp parse', next: 'both',
          reveals: 'Coercion turns a bad format into a null, and the next filter removes it. Also silent, and it compounds with the join.',
          defense: 'Coercion plus a notna filter is two steps. Which one would you instrument first?' },
        { id: 'filter', label: 'The positive-amount filter', next: 'both',
          reveals: 'The only step that is meant to drop rows. Checking it first is defensible and usually not where the surprise is.',
          defense: 'The filter is intentional. What made you check the deliberate one before the accidental ones?' },
      ] },
    { id: 'both', kind: 'reveal', next: 'guard',
      title: 'Both, as it happens',
      body: 'Roughly 900 rows fail the timestamp format and are coerced away. Another 370 have a user_id with no match.' },
    { id: 'guard', kind: 'decide', title: 'How do you stop this recurring?',
      options: [
        { id: 'assert', label: 'Fail the job when row counts move more than a threshold', next: 'produce',
          reveals: 'Turns a silent loss into a loud one. Needs a threshold somebody has to choose and defend.',
          defense: 'You picked a threshold. What number, and what happens on the day a legitimate drop exceeds it?' },
        { id: 'log', label: 'Log the count at every step and alert on drift', next: 'produce',
          reveals: 'Observability rather than enforcement. Nothing breaks, and somebody has to be looking.',
          defense: 'Logging depends on someone reading it. Who, and how often?' },
        { id: 'outer', label: 'Change the join and handle unmatched rows explicitly', next: 'produce',
          reveals: 'Fixes one cause properly and leaves the parse untouched.',
          defense: 'That fixes the join. What happens to the 900 rows with the bad timestamp?' },
      ] },
    { id: 'produce', kind: 'produce', next: 'defend',
      title: 'The fix',
      body: 'Submit the change, including whatever proves the rows now arrive.' },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const INCIDENT = {
  id: 'sec-incident-1',
  specialization: 'security-reliability',
  title: 'Information arriving out of order',
  minutes: 30,
  skills: ['incident triage', 'blast-radius reasoning', 'communication under pressure'],
  brief: 'Alerting fired eleven minutes ago. You are the first responder and nobody senior is online yet.',
  steps: [
    { id: 'alert', kind: 'reveal', next: 'first',
      title: 'What you have',
      body: 'Anomalous outbound traffic from one service account, and a support ticket from a customer who cannot log in. They may be unrelated.' },
    { id: 'first', kind: 'decide', title: 'First move',
      options: [
        { id: 'contain', label: 'Disable the service account now', next: 'twist',
          reveals: 'Contains before understanding. Stops the bleeding and can take a production dependency down with it.',
          defense: 'You disabled it before knowing what used it. What broke, and would you do it again?' },
        { id: 'scope', label: 'Establish what that account can reach', next: 'twist',
          reveals: 'Sizes the blast radius first. Costs minutes during which the traffic continues.',
          defense: 'You scoped before containing. What was your limit before you would have contained anyway?' },
        { id: 'ticket', label: 'Work the login ticket, it may be the same thing', next: 'twist',
          reveals: 'Looks for a link. If they are related this saves time; if not it spends the window on a coincidence.',
          defense: 'You followed the ticket. At what point would you have dropped it?' },
      ] },
    { id: 'twist', kind: 'reveal', next: 'comms',
      title: 'A third thing',
      body: 'The traffic began four hours ago, not eleven minutes. Alerting only fired when it crossed a volume threshold.' },
    { id: 'comms', kind: 'decide', title: 'Who do you tell, and what?',
      options: [
        { id: 'facts', label: 'Page the on-call lead with what is known and unknown, separately', next: 'produce',
          reveals: 'Separates fact from inference under pressure, which is the thing that stops an incident channel inventing a story.',
          defense: 'You separated the two. What was the hardest thing to leave in the unknown column?' },
        { id: 'wait', label: 'Keep investigating until you can say what happened', next: 'produce',
          reveals: 'Avoids a premature story and delays everyone else starting.',
          defense: 'You waited for clarity. What did the four-hour window cost while you did?' },
        { id: 'broad', label: 'Notify the wider engineering channel immediately', next: 'produce',
          reveals: 'Maximises awareness and invites a dozen people to speculate in the same place.',
          defense: 'A broad notification brings help and noise. How would you have managed the second?' },
      ] },
    { id: 'produce', kind: 'produce', next: 'defend',
      title: 'The handover',
      body: 'Write what you would hand to the person taking over: known, unknown, done, next.' },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const HARDWARE = {
  id: 'physical-ai-rig-1',
  specialization: 'physical-ai',
  title: 'It held in simulation',
  minutes: 25,
  skills: ['control intuition', 'sensor reasoning', 'failure diagnosis'],
  brief: 'A controller holds setpoint perfectly in simulation and oscillates at about 6 Hz on the rig, worsening as gain rises.',
  steps: [
    { id: 'symptom', kind: 'reveal', next: 'first',
      title: 'What differs',
      body: 'Simulation feeds the loop a clean value. The rig feeds it a raw encoder read with about two counts of noise and no filter anywhere.' },
    { id: 'first', kind: 'decide', title: 'What do you change first?',
      options: [
        { id: 'filter', label: 'Filter the signal before the derivative term', next: 'tradeoff',
          reveals: 'Goes to the cause. A derivative on an unfiltered noisy signal amplifies the noise, which is exactly what oscillation at fixed frequency looks like.',
          defense: 'You filtered before the derivative. What does that filter cost you, and where would you notice it?' },
        { id: 'gain', label: 'Lower the derivative gain', next: 'tradeoff',
          reveals: 'Reduces the symptom without addressing why. Works, and gives up response.',
          defense: 'Lowering the gain settles it. What did you trade to get that?' },
        { id: 'rate', label: 'Slow the loop rate', next: 'tradeoff',
          reveals: 'Changes the frequency the noise appears at rather than removing it.',
          defense: 'A slower loop moves the oscillation. Does it remove it?' },
      ] },
    { id: 'tradeoff', kind: 'reveal', next: 'produce',
      title: 'The tradeoff nobody avoids',
      body: 'Every option costs either responsiveness or phase margin. There is no setting that gives both.' },
    // This scenario used to run reveal -> defend with nothing in between, so it was the only
    // one of the twenty-five that never asked the student to commit to anything before being
    // questioned on it. There is nothing to defend if nothing was produced.
    { id: 'produce', kind: 'produce', next: 'defend',
      title: 'The change you would make',
      body: 'State the change you would actually push to the rig, and the one measurement you would take first to confirm it worked.' },
    { id: 'defend', kind: 'defend', title: 'Talk through a time this happened to you' },
  ],
};

// Phases 3-6 live in a second file so neither is unreadable. They are the same shape and are
// registered here, so scenarioFor() and every consumer see one flat catalogue.
export const SCENARIOS = Object.fromEntries(
  [DEAL_ROOM, CODEBASE, LEAK, ROWS, INCIDENT, HARDWARE, ...SCENARIOS_2].map(s => [s.id, s]),
);

export function scenarioFor(specialization) {
  return Object.values(SCENARIOS).find(s => s.specialization === specialization) || null;
}

// The optional sittings a vertical can offer on top of its specialisation's default. Kept
// separate from scenarioFor() because these are opt-in: a student chooses to sit one, and it
// must never displace the scenario their batch actually runs.
export function optionalScenariosFor(verticalSlug) {
  return Object.values(SCENARIOS).filter(s => s.optional && (s.offeredTo || []).includes(verticalSlug));
}
