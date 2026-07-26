import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLUB_VERIFICATION_VERSION, VERIFICATION_TIERS,
  evaluateClubVerification, memberStanding, REFERRER_VALUE,
} from '../../api/clubs.js';

test('a club that has only signed up is not verified', () => {
  const v = evaluateClubVerification({ clubName: 'Columbia Robotics', batchSlug: 'software-ai' });
  assert.equal(v.tier, null);
  assert.match(v.label, /Not yet/i);
  // The bar is published, so the club knows what to aim at.
  assert.equal(v.nextTier.id, 'recognised');
  assert.equal(v.nextTier.needsAdmitted, 2);
});

test('verification is earned from admitted members AND accepted work', () => {
  // Admissions alone do not reach 'verified' — delivery is the load-bearing half.
  const admittedOnly = evaluateClubVerification({ admittedCount: 5, acceptedWorkCount: 0 });
  assert.equal(admittedOnly.tier, 'recognised');
  const delivered = evaluateClubVerification({ admittedCount: 5, acceptedWorkCount: 2 });
  assert.equal(delivered.tier, 'verified');
  assert.match(delivered.grants, /club badge/i);
});

test('a distinguished pipeline requires sustained delivery', () => {
  const v = evaluateClubVerification({ admittedCount: 6, acceptedWorkCount: 5 });
  assert.equal(v.tier, 'distinguished');
  assert.equal(v.nextTier, null);
});

// Verification is per batch on purpose: a robotics club is strong evidence for a robotics
// team and none at all for an accounting one.
test('verification is scoped to one batch, never a global club score', () => {
  const v = evaluateClubVerification({ clubName: 'Columbia Robotics', batchSlug: 'software-ai', admittedCount: 4, acceptedWorkCount: 3 });
  assert.equal(v.batchSlug, 'software-ai');
  assert.equal(v.score, undefined);
  assert.equal(v.rank, undefined);
  assert.equal(v.overall, undefined);
});

// The guardrail that keeps a club badge from becoming a credential shortcut.
test('a club badge never satisfies a student requirement', () => {
  const v = evaluateClubVerification({ clubName: 'Columbia Robotics', admittedCount: 6, acceptedWorkCount: 5 });
  const standing = memberStanding(v, { verbose: true });
  assert.ok(standing.badge.includes('Columbia Robotics'));
  assert.equal(standing.satisfiesRequirement, false, 'the club did not do the student\'s work');
});

test('an unverified club lends its members nothing', () => {
  const standing = memberStanding(evaluateClubVerification({ admittedCount: 1 }));
  assert.equal(standing.badge, null);
  assert.equal(standing.satisfiesRequirement, false);
});

test('verification never reads as a guarantee', () => {
  const v = evaluateClubVerification({ admittedCount: 6, acceptedWorkCount: 5 });
  assert.match(v.disclaimer, /not a guarantee/i);
  assert.equal(v.version, CLUB_VERIFICATION_VERSION);
});

test('tiers are ordered and reachable in a single term', () => {
  for (let i = 1; i < VERIFICATION_TIERS.length; i++) {
    assert.ok(VERIFICATION_TIERS[i].minAdmitted >= VERIFICATION_TIERS[i - 1].minAdmitted);
    assert.ok(VERIFICATION_TIERS[i].minAccepted >= VERIFICATION_TIERS[i - 1].minAccepted);
  }
  assert.ok(VERIFICATION_TIERS[0].minAdmitted <= 3, 'entry tier must be reachable or it is decoration');
});

test('the referrer value proposition is stated for clubs and professors both', () => {
  assert.ok(REFERRER_VALUE.club.length >= 3);
  assert.ok(REFERRER_VALUE.professor.length >= 3);
  // A professor has no constituency, so no collective badge is promised to them.
  assert.ok(!REFERRER_VALUE.professor.some(v => /collective|badge/i.test(v)));
});
