import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCES, TIERS, normaliseEvidence, evidenceProfile, evidenceGaps, acceptThirdParty,
} from '../../api/evidence.js';

const claim = (source, tier, skill = 'Python') =>
  normaliseEvidence({ source, skill, tier, pointer: tier === 'claimed' ? null : 'https://x' }).claim;

// The tier vocabulary is the existing one. A parallel scale would fork the model.
test('tiers match the existing skill_claim vocabulary exactly', () => {
  assert.deepEqual(TIERS, ['claimed', 'artifact', 'referral', 'trial']);
});

// A vendor asserting "verified" cannot promote itself past what its category supports.
test('a source cannot exceed its ceiling, whatever it claims', () => {
  const r = normaliseEvidence({ source: 'third_party_assessment', skill: 'Python', tier: 'trial', pointer: 'https://x' });
  assert.equal(r.claim.verification_tier, 'artifact');
  assert.equal(r.capped, true);
  assert.equal(r.cappedFrom, 'trial');
});

test('self-report is capped at claimed and says it establishes nothing else', () => {
  const r = normaliseEvidence({ source: 'self_reported', skill: 'Python', tier: 'trial' });
  assert.equal(r.claim.verification_tier, 'claimed');
  assert.match(SOURCES.self_reported.doesNot, /Anything else/);
});

// Club membership is context. Treating it as capability would be the exact institutional
// proxy the product argues against.
test('club membership never counts as evidence of skill', () => {
  assert.equal(SOURCES.club_confirmation.ceiling, 'claimed');
  assert.match(SOURCES.club_confirmation.doesNot, /never evidence of skill/);
});

test('every source declares what it does NOT establish', () => {
  for (const [id, s] of Object.entries(SOURCES)) {
    assert.ok(s.establishes.length > 20, id);
    assert.ok(s.doesNot.length > 20, id);
    assert.ok(TIERS.includes(s.ceiling), id);
  }
});

// The connected-repo limit is the one that matters most, and it is recorded on the claim.
test('a connected repo records that ownership is not authorship', () => {
  const c = claim('connected_repo', 'artifact');
  assert.equal(c.evidence_meta.ownership, 'verified');
  assert.match(c.evidence_meta.doesNot, /Gradual paste-in defeats this/);
});

test('anything above claimed needs a pointer', () => {
  const r = normaliseEvidence({ source: 'connected_repo', skill: 'Python', tier: 'artifact' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /evidence pointer/);
});

test('evidence must attach to a named skill', () => {
  assert.equal(normaliseEvidence({ source: 'covenda_trial', skill: '  ' }).ok, false);
  assert.equal(normaliseEvidence({ source: 'nope', skill: 'x' }).ok, false);
});

// Ten claims from one account is one source, not ten.
test('a profile concentrated in one source says so', () => {
  // Half from one source is a spread profile.
  const spread = evidenceProfile([
    claim('connected_repo','artifact'), claim('connected_repo','artifact','SQL'),
    claim('structured_referral','referral','Research'), claim('covenda_trial','trial','Ops'),
  ]);
  assert.equal(spread.concentrated, false, '50% from one source is not concentration');

  // Three quarters is, and the threshold is 70%.
  const skewed = evidenceProfile([
    claim('connected_repo','artifact'), claim('connected_repo','artifact','SQL'),
    claim('connected_repo','artifact','Go'), claim('structured_referral','referral','Research'),
  ]);
  assert.equal(skewed.concentrated, true, '75% from one source is');
  assert.match(skewed.concentrationNote, /not the same as corroboration/);
});

// The product's own rule: admission is a checklist, never a person-score.
test('the profile is not a score', () => {
  const p = evidenceProfile([claim('covenda_trial','trial')]);
  assert.equal(p.score, undefined);
  assert.equal(p.rating, undefined);
  assert.equal(p.standing, 1);
});

test('gaps are phrased as the next thing to get, not a deficiency', () => {
  const gaps = evidenceGaps(evidenceProfile([]));
  assert.ok(gaps.length > 0);
  for (const g of gaps) assert.ok(g.ask && g.ask.length > 20);
  assert.match(gaps.find(g => g.key === 'defense').ask, /a third-party score cannot do for you/);
});

// Importing a vendor result uncritically would launder an unknown process into a Covenda claim.
test('a third-party result needs a verifiable link, not a screenshot', () => {
  const r = acceptThirdParty({ vendor: 'HackerRank', skill: 'Python' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /claim about a claim/);
});

test('proctored and unproctored results are described differently on the profile', () => {
  const p = acceptThirdParty({ vendor: 'HackerRank', skill: 'Python', proctored: true, resultUrl: 'https://x' });
  const u = acceptThirdParty({ vendor: 'HackerRank', skill: 'Python', proctored: false, resultUrl: 'https://x' });
  assert.match(p.note, /proctored/);
  assert.match(u.note, /Treat as a claim the student can defend/);
  assert.equal(p.tier, 'artifact');
  assert.equal(u.tier, 'artifact', 'neither gets above artifact');
});
