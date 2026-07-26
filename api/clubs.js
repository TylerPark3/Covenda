// Club verification — the referral layer, rebuilt around clubs instead of professors.
//
// WHY THE SHIFT. The original referral design assumed the scarce, credible referrer was a
// professor. In practice a selective club is the better unit for three reasons:
//   1. It already screens. A club with a single-digit admit rate has done vetting work
//      before Covenda sees anyone, and it repeats that screen every year.
//   2. It is specialised. "Columbia Robotics" tells a robotics startup far more than
//      "a professor at Columbia" does — the signal is domain-shaped, which is exactly what
//      a per-vertical batch needs.
//   3. It is durable. Professors refer a few students and move on; a club is an institution
//      with turnover, so the relationship outlives any individual member.
//
// WHAT THE CLUB GETS — and this is the whole reason a club participates. Verification is
// COLLECTIVE: when a club is verified for a batch, every member inherits the standing, and
// the club gets a public record it can show prospective members and its own department.
// That is a real asset to a student organisation, and it costs Covenda nothing to give.
//
// WHAT KEEPS IT HONEST. Verification is EARNED FROM OUTCOMES, never granted, never sold and
// never awarded for signing up. A club becomes verified for a batch only after its members
// actually clear that batch's bar and deliver accepted work. Otherwise "Covenda-verified"
// would mean "showed up", the badge would be worthless to the club, and we would be
// manufacturing exactly the fake credential the platform exists to replace.

export const CLUB_VERIFICATION_VERSION = 'club-verification-1.0.0';

// Earned thresholds, per club per batch. Deliberately small — these must be reachable by a
// real club in one term, or nobody ever clears them and the tier is decoration.
export const VERIFICATION_TIERS = [
  {
    id: 'recognised',
    label: 'Recognised pipeline',
    minAdmitted: 2,
    minAccepted: 0,
    grants: 'Listed as a pipeline for this batch. Members show their club on their profile.',
  },
  {
    id: 'verified',
    label: 'Covenda-verified for this batch',
    minAdmitted: 3,
    minAccepted: 2,
    grants: 'Members carry the club badge into every application in this vertical, and the club gets a public track record page.',
  },
  {
    id: 'distinguished',
    label: 'Distinguished pipeline',
    minAdmitted: 6,
    minAccepted: 5,
    grants: 'Featured to companies unlocking this bench, plus first look at new openings in the vertical.',
  },
];

// A club is verified FOR A BATCH, not in general. A robotics club is strong evidence for a
// robotics team and no evidence at all for an accounting one; a global club score would be
// the same lossy summary as a global person score.
export function evaluateClubVerification(record = {}) {
  const admitted = Math.max(0, Math.round(Number(record.admittedCount) || 0));
  const accepted = Math.max(0, Math.round(Number(record.acceptedWorkCount) || 0));

  let earned = null;
  for (const tier of VERIFICATION_TIERS) {
    if (admitted >= tier.minAdmitted && accepted >= tier.minAccepted) earned = tier;
  }
  const nextTier = VERIFICATION_TIERS.find(t => !earned || VERIFICATION_TIERS.indexOf(t) > VERIFICATION_TIERS.indexOf(earned)) || null;

  return {
    clubId: record.clubId || null,
    clubName: record.clubName || null,
    batchSlug: record.batchSlug || null,
    admittedCount: admitted,
    acceptedWorkCount: accepted,
    tier: earned ? earned.id : null,
    label: earned ? earned.label : 'Not yet a verified pipeline',
    grants: earned ? earned.grants : null,
    // The bar is published so a club knows exactly what to aim at, same as students.
    nextTier: nextTier
      ? {
          id: nextTier.id,
          label: nextTier.label,
          needsAdmitted: Math.max(0, nextTier.minAdmitted - admitted),
          needsAccepted: Math.max(0, nextTier.minAccepted - accepted),
          grants: nextTier.grants,
        }
      : null,
    // Verification says the club's members have delivered here before. It does not promise
    // the next one will, and it must never read as a guarantee to a company.
    disclaimer: 'Earned from real outcomes in this vertical. A track record, not a guarantee.',
    version: CLUB_VERIFICATION_VERSION,
  };
}

// What a member of a verified club carries into an application. This is a HEAD START, not a
// bypass: it never satisfies a batch requirement, because the club did not do the student's
// work. It tells a reviewer where the student came from, nothing more.
export function memberStanding(clubVerification, options = {}) {
  const tier = clubVerification?.tier || null;
  if (!tier) return { badge: null, note: null, satisfiesRequirement: false };
  return {
    badge: `${clubVerification.clubName} · ${clubVerification.label}`,
    note: options.verbose
      ? `Members of this club have cleared this bench before (${clubVerification.admittedCount} admitted, ${clubVerification.acceptedWorkCount} with accepted work).`
      : null,
    // Load-bearing: a club badge can never stand in for evidence the student owes.
    satisfiesRequirement: false,
    version: CLUB_VERIFICATION_VERSION,
  };
}

// Honest answer to "what does a PROFESSOR get out of this?" — kept in code because it is a
// product decision, not marketing. A professor's return is genuinely thinner than a club's:
// there is no collective badge, because an individual referrer has no constituency to lend
// standing to. What they do get is information and placement evidence.
export const REFERRER_VALUE = {
  club: [
    'Collective standing — every member inherits the club’s verified status in this vertical.',
    'A public track record page the club can show prospective members and its department.',
    'Priority visibility to companies unlocking this bench.',
    'A repeatable pipeline that outlives any individual officer.',
  ],
  professor: [
    'Placement outcomes you can point to, without running a placement programme.',
    'Evidence of how your students actually perform on real work — information you cannot get from grading.',
    'Zero administrative load: students self-onboard through your link, so no rosters and no FERPA exposure.',
    'Stronger letters, because you are writing from delivered work rather than classroom impressions.',
  ],
};
