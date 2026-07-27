// "Strong fit today" versus "could become a strong fit."
//
// This distinction is the difference between a filter and a coach, and getting it wrong in
// either direction does real damage. Score someone low and stop there and you have told a
// capable nineteen-year-old they are not good enough, on the basis of a résumé that was
// never the point. Hide the gap to be kind and they walk into a batch they cannot clear.
//
// So: the score says where you stand today. The classification says whether that is fixed.
// And the gaps come with the specific thing that closes each one — a gap without a next step
// is just a rejection with extra words.
//
// Nothing here is a decision. Admission runs on evaluateBatchAdmission against published
// requirements; this only tells a student what to do about it.

export const READINESS_VERSION = 'readiness-1.0.0';

// What a requirement is worth, and — the part that matters — how long it takes to earn.
// Sorted by effort so the recommended next step is the cheapest real move, not the biggest.
// Keys match the requirement keys emitted by evaluateBatchAdmission — ownership, history,
// skills, defense, availability, artifact, referral, trial. An earlier version of this map
// invented its own names and silently fell through to the generic case for most of them.
const CLOSEABLE = {
  availability: { effort: 'immediate', how: 'State your weekly hours on the application so a blank field is not what filters you out.' },
  defense: { effort: 'minutes', how: 'Record the walkthrough. Ninety seconds, and it is the single fastest gap here to close.' },
  ownership: { effort: 'minutes', how: 'Connect the account that owns your work — read-only OAuth. A pasted link counts for less than a verified one.' },
  club: { effort: 'days', how: 'Claim your club, then send the confirmation link to an officer.' },
  referral: { effort: 'days', how: 'Ask one person who has actually seen you work. A supervisor or club officer counts; a friend does not.' },
  skills: { effort: 'weeks', how: 'Build one thing that needs the skill and point at the file that proves it.' },
  artifact: { effort: 'weeks', how: 'Ship something you can link to. The artifact is the claim — nothing else counts as one.' },
  history: { effort: 'months', how: 'Keep working in the open. This one is earned by accumulation; there is no shortcut to a commit history.' },
  trial: { effort: 'months', how: 'Complete a trial project. The slowest gap here, and the one that outweighs everything else.' },
};

const EFFORT_ORDER = { immediate: 0, minutes: 1, days: 2, weeks: 3, months: 4 };

// A gap that cannot be closed inside a term is structural for THIS cycle — the student should
// hear that plainly rather than be told to try harder before a deadline they cannot meet.
const SLOW = new Set(['months']);

export function classifyReadiness(score, gaps = [], { threshold = 70 } = {}) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const open = (gaps || []).filter(g => g && !g.met);

  if (!open.length && value >= threshold) {
    return {
      state: 'ready', label: 'Strong fit today',
      summary: 'You meet the published bar. Apply.',
      reachable: true,
    };
  }

  const slowOnly = open.length > 0 && open.every(g => SLOW.has(CLOSEABLE[g.key]?.effort));
  const anyFast = open.some(g => !SLOW.has(CLOSEABLE[g.key]?.effort));

  if (anyFast) {
    const fast = open.filter(g => !SLOW.has(CLOSEABLE[g.key]?.effort));
    return {
      state: 'reachable', label: 'Could be a strong fit',
      summary: fast.length === 1
        ? 'One thing stands between you and the bar, and it is closeable.'
        : `${fast.length} things stand between you and the bar, and all of them are closeable.`,
      reachable: true,
    };
  }
  if (slowOnly) {
    return {
      state: 'building', label: 'Not this cycle — but on the path',
      summary: 'What is missing takes real time to earn. That is worth knowing now rather than after a rejection.',
      reachable: true,
    };
  }
  return {
    state: 'early', label: 'Early for this one',
    summary: 'Your profile does not point here yet. That is a statement about evidence, not about you.',
    reachable: true,
  };
}

// Gaps, each with the specific move that closes it, cheapest first.
export function nextSteps(gaps = [], { limit = 3 } = {}) {
  return (gaps || [])
    .filter(g => g && !g.met)
    .map(g => {
      const spec = CLOSEABLE[g.key] || { effort: 'weeks', how: 'Add evidence for this requirement.' };
      return {
        key: g.key,
        label: g.label || g.key,
        effort: spec.effort,
        how: spec.how,
        // Said out loud so a student is never left guessing whether a gap is worth chasing.
        blocking: !SLOW.has(spec.effort),
      };
    })
    .sort((a, b) => (EFFORT_ORDER[a.effort] ?? 9) - (EFFORT_ORDER[b.effort] ?? 9))
    .slice(0, limit);
}

// One call: where you stand, whether it is fixed, and what to do about it.
export function readinessFor({ score = 0, gaps = [], threshold = 70 } = {}) {
  const verdict = classifyReadiness(score, gaps, { threshold });
  const steps = nextSteps(gaps);
  return {
    version: READINESS_VERSION,
    score: Math.max(0, Math.min(100, Math.round(Number(score) || 0))),
    ...verdict,
    steps,
    // Never a permanent label. The wording matters: this is alignment now, not a verdict on
    // the person, and it is recomputed every time their evidence changes.
    disclaimer: 'This describes your evidence today, not your ceiling. It changes the moment you add to it.',
  };
}

// ── Opportunity categories ────────────────────────────────────────────────────────────
// One sorted list buries everything below the top few, which trains a student to only ever
// look at what they already qualify for. Categories keep a stretch visible without dressing
// it up as a match.
export const OPPORTUNITY_CATEGORIES = [
  { key: 'strong', label: 'Strong matches', blurb: 'You meet the bar. These are worth your best effort.' },
  { key: 'growth', label: 'Growth opportunities', blurb: 'Close, and what is missing is closeable. The fastest way to level up.' },
  { key: 'stretch', label: 'Stretch', blurb: 'Beyond you today. Worth knowing what they ask for.' },
  { key: 'explore', label: 'Worth a look', blurb: 'Outside what you said you wanted — sometimes that is the point.' },
];

export function categorise(item, { score = 0, gaps = [], matched = true } = {}) {
  const r = readinessFor({ score, gaps });
  if (!matched && r.state !== 'ready') return 'explore';
  if (r.state === 'ready') return 'strong';
  if (r.state === 'reachable') return 'growth';
  return 'stretch';
}

export function groupByCategory(items = []) {
  const out = OPPORTUNITY_CATEGORIES.map(c => ({ ...c, items: [] }));
  const index = Object.fromEntries(out.map((c, i) => [c.key, i]));
  for (const item of items) {
    const key = categorise(item, {
      score: item.fitScore ?? 0,
      gaps: item.gaps ?? [],
      matched: item.matched !== false,
    });
    out[index[key]].items.push(item);
  }
  return out.filter(c => c.items.length);
}
