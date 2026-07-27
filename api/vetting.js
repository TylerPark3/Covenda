// One vetting process per vertical, and they are genuinely different.
//
// A single process across all five would be a lie of convenience. A robotics candidate and a
// private-equity candidate produce different artifacts, which can be checked by different
// means, and pretending one pipeline reads both is exactly the "one score for everything"
// posture this product exists to replace.
//
// What stays constant is the SHAPE, because it is the shape that works: a real artifact, an
// automated check of what a machine can actually establish, an unscripted defense of that
// specific artifact, and more than one calibrated reader. Everything else — what counts as
// an artifact, what the machine can verify, what the questions probe — is per vertical.
//
// ── ORDERED BY WHAT WE CAN ACTUALLY DO TODAY ──────────────────────────────────────────
// Software and finance are live: OAuth proves ownership of a repo, and a workbook can be
// parsed for formula integrity. The rest run on the human rail and SAY so, because a process
// nobody can run consistently is worse than an honest "a person read this".

import { STAGES as SOFTWARE_STAGES, adjudicate, PASS_MARK } from './vetting-software.js';

export const VETTING_VERSION = 'vetting-1.0.0';

export const PROCESSES = {
  'Software & AI': {
    vertical: 'Software & AI',
    maturity: 'automated',
    artifact: 'A repository you wrote',
    machineCan: 'Confirm the account owns it, and read how the work accumulated over time.',
    machineCannot: 'Tell anyone whether the design decisions were good.',
    stages: SOFTWARE_STAGES,
    defenseProbes: [
      'Why this structure and not the obvious alternative',
      'What broke while you were building it, and how you found out',
      'What you would change if you rebuilt it tomorrow',
    ],
  },

  'Accounting & finance': {
    vertical: 'Accounting & finance',
    maturity: 'automated',
    artifact: 'A model or memo you built',
    // The workbook parser is live — this is a real check, not an aspiration.
    machineCan: 'Open the workbook and read formula integrity, linkage and circularity handling.',
    machineCannot: 'Tell anyone whether the assumptions driving the answer are defensible.',
    stages: [
      { key: 'upload', label: 'Upload the model', kind: 'automated', minutes: 2, produces: 'workbook',
        why: 'We open the file itself. A model of pasted values scores low by construction, which a PDF would hide.',
        blockedMessage: 'Upload the workbook, not a screenshot or an export.' },
      { key: 'parse', label: 'We read the formulas', kind: 'automated', minutes: 2, produces: 'formula_report',
        why: 'Structure, linkage, and whether the outputs are actually driven by the inputs.',
        blockedMessage: 'That file could not be parsed. Upload the .xlsx.' },
      { key: 'defense', label: 'Defend the assumptions', kind: 'human', minutes: 20, produces: 'defense_record',
        why: 'The numbers are checkable by machine; the reasoning behind them is not. Questions come from your own model.',
        blockedMessage: 'Record your defense to finish.' },
      { key: 'review', label: 'Two people score it', kind: 'human', minutes: 0, produces: 'rubric_scores',
        why: 'Against the published anchors, with a third reader on a wide split.',
        blockedMessage: 'Waiting on review.' },
    ],
    defenseProbes: [
      'Which assumption moves the answer most, and why you chose it',
      'What would have to be true for this to be wrong',
      'Where you would push back if a partner handed you these inputs',
    ],
  },

  'Healthcare operations': {
    vertical: 'Healthcare operations',
    maturity: 'human_rail',
    artifact: 'A de-identified process artifact',
    machineCan: 'Very little. There is no API that reads a clinical workflow.',
    machineCannot: 'Verify almost any of it — which is why this vertical leans on people who can.',
    stages: humanRailStages('a de-identified process artifact', 'a named supervisor'),
    defenseProbes: [
      'Walk through the process end to end, including the exception path',
      'What you changed, and what it cost the people using it',
      'How you knew it was actually better afterwards',
    ],
  },

  'Consumer & retail': {
    vertical: 'Consumer & retail',
    maturity: 'instrumented',
    artifact: 'A bounded exercise inside tooling we provision',
    machineCan: 'Record what you actually did inside the exercise, because the platform ran it.',
    machineCannot: 'Verify any self-reported campaign number from somewhere else.',
    stages: [
      { key: 'exercise', label: 'Run the exercise', kind: 'automated', minutes: 45, produces: 'instrumented_run',
        why: 'A budgeted task in tooling Covenda provisions, so the outcome is observed rather than claimed.',
        blockedMessage: 'Start the exercise to continue.' },
      { key: 'defense', label: 'Explain your calls', kind: 'human', minutes: 15, produces: 'defense_record',
        why: 'What you did is recorded. Why you did it is not.',
        blockedMessage: 'Record your walkthrough to finish.' },
      { key: 'review', label: 'Two people score it', kind: 'human', minutes: 0, produces: 'rubric_scores',
        why: 'Against the published anchors.',
        blockedMessage: 'Waiting on review.' },
    ],
    defenseProbes: [
      'What you would have done with ten times the budget, and with none',
      'Which number you distrusted and why',
      'What you would test next',
    ],
  },

  'Professional services': {
    vertical: 'Professional services',
    maturity: 'human_rail',
    artifact: 'A written sample',
    machineCan: 'Check the document parses and the sources resolve.',
    machineCannot: 'Judge whether the argument holds — and written work is the easiest thing for a model to produce.',
    // Which is exactly why the defense carries more weight here than anywhere else.
    stages: humanRailStages('a written sample', 'whoever reviewed it'),
    defenseProbes: [
      'How you framed the problem before you started writing',
      'Which source you trusted least, and what you did about it',
      'The strongest argument against your own conclusion',
    ],
  },
};

// The shape every human-rail vertical shares. Stated once rather than copy-pasted four times,
// because the honest position is that these four are the same process with different inputs.
function humanRailStages(artifact, referee) {
  return [
    { key: 'artifact', label: `Submit ${artifact}`, kind: 'automated', minutes: 3, produces: 'artifact',
      why: 'De-identified, and yours. This gets you to the interview; it is not the proof by itself.',
      blockedMessage: `Upload ${artifact} to continue.` },
    { key: 'defense', label: 'Walk us through it', kind: 'human', minutes: 20, produces: 'defense_record',
      why: 'Scored by two raters. This is the stage that carries the weight here, because no machine can read the artifact.',
      blockedMessage: 'Record your walkthrough to finish.' },
    { key: 'referral', label: `A vouch from ${referee}`, kind: 'human', minutes: 5, produces: 'referral',
      why: 'Someone who saw the work, answering under their own name. Cross-checked, not just collected.',
      blockedMessage: `Ask ${referee} to vouch for you.` },
    { key: 'review', label: 'Two people score it', kind: 'human', minutes: 0, produces: 'rubric_scores',
      why: 'Against the published anchors, with a third reader on a wide split.',
      blockedMessage: 'Waiting on review.' },
  ];
}

export function processFor(vertical) {
  return PROCESSES[vertical] || null;
}

// What a student sees before starting. Short by design — the detail belongs in the stage
// they are actually on, not in a wall they read once and skip.
export function summarise(vertical) {
  const p = processFor(vertical);
  if (!p) return null;
  const minutes = p.stages.reduce((n, s) => n + (s.minutes || 0), 0);
  return {
    version: VETTING_VERSION,
    vertical: p.vertical,
    artifact: p.artifact,
    minutes,
    steps: p.stages.length,
    machineCan: p.machineCan,
    machineCannot: p.machineCannot,
    maturity: p.maturity,
    // The claim is bounded by what the vertical can actually support, and differs per row.
    honesty: p.maturity === 'automated'
      ? 'Part of this is checked by machine. The judgement is not, and cannot be.'
      : p.maturity === 'instrumented'
        ? 'The platform observed what you did. Why you did it is judged by people.'
        : 'No API can read this work. It is judged by people, against a published bar.',
  };
}

export { adjudicate, PASS_MARK };
