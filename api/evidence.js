// The evidence layer.
//
// ── THE REFRAME THIS IMPLEMENTS ───────────────────────────────────────────────────────
// Covenda does not need to own every test. It needs to own the interpretation layer that
// sits above them.
//
// The five vetting passes were drifting toward Covenda-designed assessments for all 25
// specialisations — which would make us an assessment company competing with firms whose
// entire business is building better assessments than ours. The correct position is that
// evidence arrives from wherever it arrives, and what Covenda owns is:
//
//   1. Normalising it — so a GitHub history, a HackerRank score and a professor's referral
//      can sit in one profile without pretending they are the same kind of claim.
//   2. Tiering it — how much each source can actually establish.
//   3. Defending it — the one thing no third party does, because no third party has a
//      relationship with the student afterwards.
//   4. Interpreting it against a specific opportunity.
//
// That last pair is the defensible part. Assessment vendors sell a score. Covenda sells a
// profile that survives being interrogated.
//
// ── WHY THIS DOES NOT REBUILD `skill_claim` ───────────────────────────────────────────
// `skill_claim` (Stage 0) already stores a skill with a verification_tier and an evidence
// pointer, and `evaluateBatchAdmission` already reads it. This module does not replace that
// and does not introduce a second store. It is the NORMALISER that turns heterogeneous
// sources into rows `skill_claim` can hold, plus the honest accounting of what each source
// establishes. The existing tiers stay exactly as they are.

export const EVIDENCE_VERSION = 'evidence-1.0.0';

// The existing tiers, unchanged, in the order they carry weight. Repeated here so the source
// registry can be checked against them rather than inventing a parallel vocabulary.
export const TIERS = ['claimed', 'artifact', 'referral', 'trial'];

// ── The source registry ───────────────────────────────────────────────────────────────
// Every place evidence can come from, and — the point of the table — the ceiling on what it
// can establish. A source cannot be recorded above its ceiling, whatever it claims about
// itself. A vendor's "verified" badge is their word, not ours.
export const SOURCES = {
  // First-party: Covenda ran it, so we know what happened.
  covenda_trial: {
    id: 'covenda_trial', label: 'Accepted Covenda trial', party: 'first',
    ceiling: 'trial', ownership: 'observed',
    establishes: 'The student did bounded, real work and a named reviewer accepted it.',
    doesNot: 'Generalise beyond the specific work — one accepted trial is one data point.',
  },
  covenda_defense: {
    id: 'covenda_defense', label: 'Recorded defense', party: 'first',
    ceiling: 'referral', ownership: 'observed',
    establishes: 'The student can account for the decisions inside their own submission.',
    doesNot: 'Prove they produced every line of it.',
  },

  // Connected accounts: the platform vouches for provenance, not authorship.
  connected_repo: {
    id: 'connected_repo', label: 'Connected code account', party: 'connected',
    ceiling: 'artifact', ownership: 'verified',
    establishes: 'The account owns the work and how it accumulated over time.',
    doesNot: 'Establish that a human wrote it. Gradual paste-in defeats this entirely.',
  },
  parsed_workbook: {
    id: 'parsed_workbook', label: 'Parsed financial model', party: 'connected',
    ceiling: 'artifact', ownership: 'unverified',
    establishes: 'Formula integrity, linkage, and that outputs are computed rather than typed.',
    doesNot: 'Establish that the assumptions are defensible, or who built it.',
  },

  // Third-party assessments. Deliberately capped at `artifact`, and the reason is not
  // snobbery: a score from a proctored test tells us a person performed on a day. It does
  // not survive the question "walk me through what you did", which is the thing companies
  // actually want and the thing we can offer.
  third_party_assessment: {
    id: 'third_party_assessment', label: 'Third-party assessment', party: 'third',
    ceiling: 'artifact', ownership: 'unverified',
    establishes: 'A measured result under that vendor’s conditions.',
    doesNot: 'Transfer to different work, or survive interrogation on its own.',
  },
  job_simulation: {
    id: 'job_simulation', label: 'Job simulation', party: 'third',
    ceiling: 'artifact', ownership: 'unverified',
    establishes: 'Completion of a structured task under observation.',
    doesNot: 'Distinguish a strong completion from a compliant one.',
  },

  // Human vouches.
  structured_referral: {
    id: 'structured_referral', label: 'Structured referral', party: 'human',
    ceiling: 'referral', ownership: 'attested',
    establishes: 'A named person who saw the work answers for it under their own identity.',
    doesNot: 'Guarantee the referee’s judgement, or that they observed closely.',
  },
  club_confirmation: {
    id: 'club_confirmation', label: 'Confirmed club membership', party: 'human',
    ceiling: 'claimed', ownership: 'attested',
    establishes: 'An officer of a real organisation confirms current membership.',
    doesNot: 'Say anything about capability. Membership is context, never evidence of skill.',
  },

  // Self-report. Present because students will provide it, capped so it never counts.
  self_reported: {
    id: 'self_reported', label: 'Self-reported', party: 'self',
    ceiling: 'claimed', ownership: 'none',
    establishes: 'What the student says about themselves.',
    doesNot: 'Anything else. Excluded from matching by default.',
  },
};

const TIER_RANK = Object.fromEntries(TIERS.map((t, i) => [t, i]));

// Normalise one piece of evidence into a claim `skill_claim` can hold. The ceiling is
// enforced here rather than trusted from the caller — a vendor asserting "verified" cannot
// promote itself past what its category supports.
export function normaliseEvidence({ source, skill, tier, pointer, meta = {} } = {}) {
  const spec = SOURCES[source];
  if (!spec) return { ok: false, reason: `Unknown evidence source: ${source}.` };
  const cleanSkill = String(skill || '').trim();
  if (!cleanSkill) return { ok: false, reason: 'Evidence has to attach to a named skill.' };

  const asked = TIERS.includes(tier) ? tier : 'claimed';
  const capped = TIER_RANK[asked] > TIER_RANK[spec.ceiling] ? spec.ceiling : asked;

  // Above `claimed`, a pointer is mandatory — the existing schema constraint, restated here
  // so a bad row is refused before it reaches the database.
  if (capped !== 'claimed' && !pointer) {
    return { ok: false, reason: `${spec.label} needs an evidence pointer to sit above "claimed".` };
  }

  return {
    ok: true,
    claim: {
      skill: cleanSkill,
      verification_tier: capped,
      evidence_pointer: pointer || null,
      evidence_meta: {
        ...meta,
        source: spec.id,
        party: spec.party,
        ownership: spec.ownership,
        // Carried so any downstream reader sees the limit alongside the claim.
        establishes: spec.establishes,
        doesNot: spec.doesNot,
        version: EVIDENCE_VERSION,
      },
    },
    capped: capped !== asked,
    cappedFrom: capped !== asked ? asked : null,
  };
}

// What a profile actually rests on. Deliberately not a score — the product's own rule is
// that admission is a checklist and never a person-score, and a "profile strength number"
// would be that by another name.
export function evidenceProfile(claims = []) {
  const rows = (claims || []).filter(c => c && c.skill);
  const byTier = Object.fromEntries(TIERS.map(t => [t, rows.filter(c => c.verification_tier === t).length]));

  const parties = new Set(rows.map(c => c.evidence_meta?.party).filter(Boolean));
  const skills = new Set(rows.map(c => String(c.skill).toLowerCase()));

  // Concentration risk: ten claims from one source is one source, not ten. Worth surfacing
  // to a reviewer, because a profile that looks deep can be a single GitHub account.
  const bySource = {};
  for (const c of rows) {
    const s = c.evidence_meta?.source || 'unknown';
    bySource[s] = (bySource[s] || 0) + 1;
  }
  const dominant = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
  const concentrated = Boolean(dominant && rows.length >= 3 && dominant[1] / rows.length > 0.7);

  return {
    version: EVIDENCE_VERSION,
    total: rows.length,
    skills: skills.size,
    byTier,
    bySource,
    independentSources: parties.size,
    // The honest headline: what stands up without self-report.
    standing: rows.filter(c => c.verification_tier !== 'claimed').length,
    concentrated,
    concentrationNote: concentrated
      ? `Most of this profile comes from one source (${dominant[0]}). Depth in one place is not the same as corroboration.`
      : null,
    defended: rows.some(c => c.evidence_meta?.source === 'covenda_defense'),
  };
}

// What is missing, phrased as the next thing to get rather than a deficiency. Same posture
// as the readiness module: a gap with no route attached is a rejection with extra words.
export function evidenceGaps(profile) {
  const gaps = [];
  if (!profile.standing) {
    gaps.push({ key: 'any_evidence', ask: 'Nothing here is backed by anything yet. One artifact with a pointer changes that.' });
  }
  if (!profile.defended) {
    gaps.push({ key: 'defense', ask: 'Record a walkthrough. It is the one thing a third-party score cannot do for you.' });
  }
  if (profile.independentSources < 2 && profile.total > 0) {
    gaps.push({ key: 'corroboration', ask: 'Everything comes from one kind of source. A referral or a trial would corroborate it.' });
  }
  if (profile.concentrated) {
    gaps.push({ key: 'concentration', ask: profile.concentrationNote });
  }
  return gaps;
}

// Whether a third-party result may be imported at all. Vendors differ enormously in what
// their score means, and importing one uncritically would launder an unknown process into a
// Covenda-branded claim.
export function acceptThirdParty({ vendor, skill, proctored = false, resultUrl = null } = {}) {
  if (!vendor) return { ok: false, reason: 'Name the assessment provider.' };
  if (!skill) return { ok: false, reason: 'A result has to attach to a named skill.' };
  if (!resultUrl) {
    return { ok: false, reason: 'We need a verifiable result link. A screenshot is a claim about a claim.' };
  }
  return {
    ok: true,
    tier: 'artifact',
    // Stated on the profile, not hidden in a tooltip. A reader should know an unproctored
    // vendor result is weaker than a proctored one without having to ask.
    note: proctored
      ? `${vendor} result, proctored. Establishes a measured performance under their conditions.`
      : `${vendor} result, unproctored. Treat as a claim the student can defend rather than a verified capability.`,
  };
}

// ── The bridge to presentation ────────────────────────────────────────────────────────
// Two vocabularies exist and they are not duplicates, despite the similar names:
//
//   evidence.js  claimed -> artifact -> referral -> trial     what a source can ESTABLISH
//   hardening.js self_reported -> bronze -> silver -> gold    how wide the DISPLAYED band is
//
// The first is a fact about provenance. The second is a statement about confidence, and it
// controls how much uncertainty a company sees around a number.
//
// They were bridged by two hardcoded checks in portal.js — completed work meant gold, a linked
// repo meant bronze — which meant the ceilings in this file governed nothing a company
// actually saw. This is the mapping, in one place, derived from the ladder.
const TIER_TO_BAND = {
  trial: 'gold',        // a named reviewer accepted real work
  referral: 'silver',   // someone put their name to a specific claim
  artifact: 'bronze',   // a file or account exists and was read
  claimed: 'self_reported',
};

// The band follows the STRONGEST evidence on file, not an average. A student with one accepted
// trial and nine self-reported claims has proved something, and averaging would hide it.
export function presentationBand(claims = []) {
  let best = 'claimed';
  for (const entry of claims) {
    // normaliseEvidence returns { ok, claim }, and the tier it settled on after applying the
    // source ceiling lives on claim.verification_tier. Reading a raw `tier` here would silently
    // ignore every ceiling, which is the one thing this file exists to enforce.
    const tier = entry?.claim?.verification_tier || entry?.verification_tier;
    if (TIERS.indexOf(tier) > TIERS.indexOf(best)) best = tier;
  }
  return TIER_TO_BAND[best] || 'self_reported';
}

// What a profile's evidence actually supports, read from the profile rather than guessed.
// Anything not backed by a source stays `claimed`, which is the whole point of the ceilings.
export function claimsFromProfile(profile = {}, { completedCount = 0 } = {}) {
  const claims = [];
  if (Number(completedCount) > 0) {
    claims.push(normaliseEvidence({ source: 'covenda_trial', skill: 'delivery', tier: 'trial', pointer: 'covenda' }));
  }
  const github = profile?.skill_signals?.github;
  if (Array.isArray(github) && github.length) {
    claims.push(normaliseEvidence({ source: 'connected_repo', skill: 'code', tier: 'artifact', pointer: 'github' }));
  }
  if (profile?.referral_verified || profile?.club_confirmed) {
    claims.push(normaliseEvidence({
      source: profile.referral_verified ? 'structured_referral' : 'club_confirmation',
      skill: 'general', tier: profile.referral_verified ? 'referral' : 'claimed', pointer: 'covenda',
    }));
  }
  return claims.filter(entry => entry && entry.ok !== false);
}
