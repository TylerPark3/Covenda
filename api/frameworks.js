// Industry frameworks — the systematised part of turning a founder's complaint into a trial.
//
// The brief engine decomposes a stated problem into candidate causes. Doing that generically
// is what produces the consulting parody: three plausible-sounding branches that would fit
// any company in any industry. A firm that is actually good at this does not decompose
// generically — it reaches for the framework that fits the industry, because the failure
// modes of a SaaS funnel and a clinical intake process are not the same shape.
//
// So: one framework per vertical. Each carries the dimensions a problem in that industry
// actually decomposes along, the questions that separate the branches, the causes that are
// common enough to check first, and — the part that matters for us — what a TRIAL in that
// vertical can actually test.
//
// ── WHY THE LAST FIELD IS THE POINT ───────────────────────────────────────────────────
// A framework that diagnoses beautifully and cannot be turned into two weeks of student work
// is a consulting deliverable, not a Covenda brief. Every framework here states what a
// bounded trial can realistically produce against it, so the engine refuses early rather
// than proposing something no undergraduate could deliver.
//
// Pure module: no I/O, no model calls. The prompt layer reads these.

export const FRAMEWORKS_VERSION = 'frameworks-1.0.0';

export const FRAMEWORKS = {
  'Software & AI': {
    vertical: 'Software & AI',
    // Dimensions are MECE within the vertical: a software problem lands in one of these.
    dimensions: [
      { key: 'correctness', label: 'It does the wrong thing', probe: 'Is the output wrong, or right but unusable?' },
      { key: 'performance', label: 'It is too slow or too expensive', probe: 'Slow for everyone, or slow at a particular size?' },
      { key: 'reliability', label: 'It breaks under real conditions', probe: 'Does it fail predictably, or only in production?' },
      { key: 'velocity', label: 'Changes take too long to ship', probe: 'Is the blocker the code, the tests, or the review?' },
      { key: 'clarity', label: 'Nobody knows how it works', probe: 'Could a new person change this safely next week?' },
    ],
    commonMisdiagnosis: 'Blaming the code when the constraint is review capacity or unclear requirements. Check who is waiting on whom before scoping a rewrite.',
    structuralSignal: 'The same class of bug keeps returning after being fixed.',
    behavioralSignal: 'The fix is known and keeps being deprioritised.',
    trialCanTest: [
      'Reproduce a failure and characterise when it happens',
      'Instrument something currently unmeasured',
      'Build a bounded tool that removes a recurring manual step',
      'Write the tests that would have caught a real past bug',
    ],
    trialCannotTest: 'A rewrite, a migration, or anything needing production access.',
  },

  'Accounting & finance': {
    vertical: 'Accounting & finance',
    dimensions: [
      { key: 'inputs', label: 'The numbers going in are wrong', probe: 'Where does this data come from, and who checks it?' },
      { key: 'model', label: 'The model does not reflect the business', probe: 'Which driver actually moves the answer?' },
      { key: 'process', label: 'The work happens too late to matter', probe: 'Is the answer wrong, or right but a week late?' },
      { key: 'controls', label: 'Errors are not caught before they land', probe: 'What would have to fail for this to go unnoticed?' },
      { key: 'interpretation', label: 'The numbers are right and misread', probe: 'Who acts on this, and what do they do differently?' },
    ],
    commonMisdiagnosis: 'Treating a slow close as a modelling problem when it is a reconciliation problem — the model is fine and the inputs arrive late.',
    structuralSignal: 'The process was designed for a smaller company and never revisited.',
    behavioralSignal: 'The checklist exists and is skipped when things get busy.',
    trialCanTest: [
      'Rebuild a driver tree from public or founder-approved figures',
      'Reconcile two sources and document every discrepancy',
      'Build the sensitivity analysis nobody has time for',
      'Write the close checklist that currently lives in one person’s head',
    ],
    trialCannotTest: 'Anything requiring live financial systems or unaudited internal ledgers.',
  },

  'Healthcare operations': {
    vertical: 'Healthcare operations',
    dimensions: [
      { key: 'flow', label: 'People or work wait too long', probe: 'Where does the queue actually form?' },
      { key: 'handoff', label: 'Things get dropped between roles', probe: 'Who owns it in the gap?' },
      { key: 'documentation', label: 'The process is not written down', probe: 'What happens when the person who knows it is out?' },
      { key: 'compliance', label: 'The requirement is unclear or unmet', probe: 'Is the rule ambiguous, or clear and unfollowed?' },
      { key: 'measurement', label: 'Nobody knows if it is working', probe: 'What number would move if this were fixed?' },
    ],
    commonMisdiagnosis: 'Reading a staffing problem as a process problem. Map the queue before redesigning anything.',
    structuralSignal: 'The bottleneck moves when you staff around it.',
    behavioralSignal: 'The documented process and the actual process differ.',
    trialCanTest: [
      'Map a process end to end, including the exception path',
      'Analyse a de-identified dataset for where time is lost',
      'Draft the SOP that does not exist yet',
      'Compare stated policy against observed practice',
    ],
    // The hard constraint in this vertical, and it is not negotiable.
    trialCannotTest: 'Anything touching identifiable patient data. De-identified or synthetic only.',
  },

  'Consumer & retail': {
    vertical: 'Consumer & retail',
    dimensions: [
      { key: 'acquisition', label: 'Not enough people arrive', probe: 'Is it reach, or is it the wrong people arriving?' },
      { key: 'conversion', label: 'People arrive and do not act', probe: 'Where exactly do they stop?' },
      { key: 'retention', label: 'They act once and never again', probe: 'Did the product disappoint, or did nobody ask them back?' },
      { key: 'economics', label: 'It works and does not pay', probe: 'What does one more customer actually cost?' },
      { key: 'supply', label: 'Demand exists and cannot be met', probe: 'Is the constraint stock, staff, or lead time?' },
    ],
    commonMisdiagnosis: 'Blaming marketing when traffic is up and conversion is flat — the classic. Check the funnel before the channel.',
    structuralSignal: 'The unit economics never worked; volume was hiding it.',
    behavioralSignal: 'The playbook works when it is followed and it is followed inconsistently.',
    trialCanTest: [
      'Analyse a funnel and locate the drop with evidence',
      'Build a cohort view the team does not currently have',
      'Run a bounded, budgeted experiment inside provisioned tooling',
      'Rebuild unit economics from first principles',
    ],
    trialCannotTest: 'Anything requiring spend authority or access to customer PII.',
  },

  'Professional services': {
    vertical: 'Professional services',
    dimensions: [
      { key: 'scoping', label: 'Work is sold before it is understood', probe: 'Did the scope change, or was it never clear?' },
      { key: 'utilisation', label: 'The right people are on the wrong work', probe: 'Who is doing work below their level?' },
      { key: 'delivery', label: 'Output quality varies by who does it', probe: 'Is there a standard, or is it individual judgement?' },
      { key: 'knowledge', label: 'Everything is rebuilt from scratch', probe: 'What did we already do that nobody could find?' },
      { key: 'positioning', label: 'The offer is not distinct', probe: 'Why did the last client choose you?' },
    ],
    commonMisdiagnosis: 'Treating inconsistent delivery as a hiring problem when no standard exists to hire against.',
    structuralSignal: 'Every engagement is bespoke because nothing was ever templated.',
    behavioralSignal: 'The template exists and people work around it.',
    trialCanTest: [
      'Synthesise past work into a reusable template',
      'Research and structure a market or competitive question',
      'Build the knowledge base from material that already exists',
      'Draft the scoping questions that would have caught a past overrun',
    ],
    trialCannotTest: 'Anything requiring client-confidential material.',
  },
};

export function frameworkFor(vertical) {
  return FRAMEWORKS[vertical] || null;
}

// The decomposition prompt for one vertical. This is what makes the diagnosis specific
// instead of three branches that would fit anybody.
export function decompositionGuide(vertical) {
  const f = frameworkFor(vertical);
  if (!f) return null;
  return {
    version: FRAMEWORKS_VERSION,
    vertical: f.vertical,
    instruction:
      `Decompose the founder's problem across these ${f.dimensions.length} dimensions. Assign the evidence to whichever branches it supports; `
      + 'name the branches it does NOT support too, because ruling one out is a finding.',
    dimensions: f.dimensions,
    checkFirst: f.commonMisdiagnosis,
    structuralVsBehavioral: {
      structural: f.structuralSignal,
      behavioral: f.behavioralSignal,
    },
  };
}

// What a bounded trial can realistically produce here. The engine reads this to refuse early
// rather than proposing work no undergraduate could deliver in two weeks.
export function trialEnvelope(vertical) {
  const f = frameworkFor(vertical);
  if (!f) return null;
  return { vertical: f.vertical, can: f.trialCanTest, cannot: f.trialCannotTest };
}

// Is this proposed trial inside what the vertical actually supports? Advisory on the "can"
// side — the list is representative, not exhaustive — and firm on the "cannot", because
// those are hard constraints (PII, spend authority, production access).
export function checkAgainstEnvelope(vertical, { deliverable = '', inputsRequired = [] } = {}) {
  const env = trialEnvelope(vertical);
  if (!env) return { ok: true, note: 'No framework for that vertical yet.' };

  const text = `${deliverable} ${inputsRequired.map(i => i?.label || '').join(' ')}`.toLowerCase();
  const hard = [
    [/\bpatient\b|\bphi\b|identifiable/, 'identifiable patient data'],
    [/\bpii\b|customer (data|list|emails)/, 'customer PII'],
    [/production (access|database)|live system/, 'production access'],
    [/\bbudget\b|\bspend\b|ad account/, 'spend authority'],
    [/client[- ]confidential|nda/, 'client-confidential material'],
  ];
  const hit = hard.find(([re]) => re.test(text));
  if (hit) {
    return {
      ok: false,
      reason: `This needs ${hit[1]}, which a trial in ${env.vertical} cannot use. ${env.cannot} Redesign it around public, synthetic or founder-approved inputs.`,
    };
  }
  return { ok: true, examples: env.can };
}
