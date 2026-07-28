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

export const SCENARIOS_VERSION = 'scenarios-1.0.0';

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

export const SCENARIOS = { [DEAL_ROOM.id]: DEAL_ROOM, [CODEBASE.id]: CODEBASE };

export function scenarioFor(specialization) {
  return Object.values(SCENARIOS).find(s => s.specialization === specialization) || null;
}
