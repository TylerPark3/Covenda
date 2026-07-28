import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERIFICATION_TIERS, memberStanding } from '../../api/clubs.js';
import { studentEvidenceTier } from '../../api/portal.js';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

// The page used to imply registering led to verification. They are different things.
test('the page separates registering from being verified', () => {
  assert.match(html, /Registering takes a minute/);
  assert.match(html, /Verification is earned/);
  assert.match(html, /class="club-step-cap"><span>1<\/span> Register/);
  assert.match(html, /class="club-step-cap"><span>2<\/span> Earn verification/);
});

test('registering is described as committing to nothing', () => {
  assert.match(html, /commits you to nothing/);
});

// This is the honest core: memberStanding returns satisfiesRequirement false at every tier,
// so the page must not imply a club badge substitutes for evidence.
test('no club tier lets a member skip their own evidence', () => {
  for (const tier of ['recognised', 'verified', 'distinguished']) {
    assert.equal(memberStanding(tier).satisfiesRequirement, false, `${tier} must not be a shortcut`);
  }
  assert.match(html, /never substitutes for a member's own evidence/);
});

test('and the evidence ceiling agrees with the page', () => {
  // A club confirmation caps the displayed band, exactly as the copy claims.
  assert.equal(studentEvidenceTier({ club_confirmed: true }, 0), 'self_reported');
});

test('every rung has a real threshold, so "earned" means something checkable', () => {
  for (const tier of VERIFICATION_TIERS) {
    assert.ok(tier.minAdmitted > 0, `${tier.id} has no admission bar`);
    assert.ok(tier.grants && tier.grants.length > 20, `${tier.id} does not say what it grants`);
  }
  // Each rung must actually be harder than the last, or the ladder is decoration.
  for (let i = 1; i < VERIFICATION_TIERS.length; i++) {
    assert.ok(VERIFICATION_TIERS[i].minAdmitted >= VERIFICATION_TIERS[i - 1].minAdmitted);
    assert.ok(VERIFICATION_TIERS[i].minAccepted >= VERIFICATION_TIERS[i - 1].minAccepted);
  }
});

test('the ladder is not for sale, and says so', () => {
  assert.match(html, /Nothing here is granted or sold/);
});
