import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERIFICATION_TIERS, memberStanding } from '../../api/clubs.js';
import { studentEvidenceTier } from '../../api/portal.js';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

// The page used to imply registering led to verification. They are different things.
test('the page separates registering from being verified', () => {
  assert.match(html, /Register free/);
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
  assert.match(html, /Members still apply with their own recorded work and are judged on it/);
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

// A badge next to the heading, and a line saying what earns it. The badge alone would read as
// decoration, or worse as a claim the club already has one.
test('the verification mark says what earns it, and that nobody starts with it', () => {
  assert.match(html, /class="club-verified-mark"/);
  assert.match(html, /class="club-verified-key"/);
  assert.match(html, /Nobody starts with it/);
  // Reuses the existing badge: a platform with two verification marks has neither.
  const marks = [...html.matchAll(/class="club-verified-(?:mark|key)"[\s\S]{0,200}?href="#([a-z-]+)"/g)].map(m => m[1]);
  assert.ok(marks.length >= 2 && new Set(marks).size === 1, `the club badge uses ${new Set(marks).size} different icons`);
  assert.equal(marks[0], 'icon-verified');
});

// A field that renders but never reaches the payload is worse than no field: somebody types
// into it and the answer is thrown away.
test('the club website is asked for and actually submitted', async () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.match(html, /name="clubWebsite"/);
  assert.match(app, /website: String\(data\.get\('clubWebsite'\)/);
  // Every named input on the club form has to be in the payload, not just this one.
  const form = html.slice(html.indexOf('id="clubRegisterForm"'), html.indexOf('</form>', html.indexOf('id="clubRegisterForm"')));
  for (const [, name] of form.matchAll(/name="(club[A-Za-z]+)"/g)) {
    assert.ok(app.includes(`data.get('${name}')`), `${name} is collected and never sent`);
  }
});
