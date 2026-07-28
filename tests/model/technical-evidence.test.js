import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_TYPES, DOMAINS, AGENCY_SIGNALS, OWNERSHIP_LEVELS,
  recordTechnicalEvidence, technicalProfile, technicalGaps, explainAlignment,
  agencySignalsFor, aiDisclosureQuality, domainsForSkill,
} from '../../api/technical-evidence.js';

const shipped = (over = {}) => ({
  id: 'p1', type: 'shipped_product', source: 'connected_repo', ownership: 'sole',
  skills: ['Python', 'PostgreSQL', 'Docker'], deploymentUrl: 'https://x.dev', ...over,
});
const claimsFor = (...entries) => entries.flatMap(e => recordTechnicalEvidence(e).claims || []);

// The product exists to replace the unfalsifiable number. Reintroducing one here would be
// the whole thesis undone.
test('no function returns a composite score', () => {
  const profile = technicalProfile(claimsFor(shipped()));
  for (const banned of ['score', 'rating', 'rank', 'percentile', 'grade']) {
    assert.ok(!(banned in profile), `technicalProfile returns a ${banned}`);
  }
  const alignment = explainAlignment(profile, ['Python']);
  for (const banned of ['score', 'percentage', 'match']) {
    assert.ok(!(banned in alignment), `explainAlignment returns a ${banned}`);
  }
});

// Provenance capping lives in evidence.js and must not be reimplemented here.
test('the source ceiling still caps the claim', () => {
  // A connected repo tops out at `artifact`, whatever tier is requested.
  const out = recordTechnicalEvidence(shipped({ tier: 'trial' }));
  assert.ok(out.claims.every(c => c.verification_tier === 'artifact'), 'a repo claim was recorded above its ceiling');
});

test('evidence above claimed cannot be recorded without a pointer', () => {
  const out = recordTechnicalEvidence({ type: 'independent_project', source: 'connected_repo', skills: ['Go'], tier: 'artifact' });
  assert.equal(out.ok, false);
  assert.match(out.reason, /pointer/i);
});

test('every type and every domain is fully described', () => {
  for (const [id, type] of Object.entries(EVIDENCE_TYPES)) {
    assert.equal(type.id, id);
    assert.ok(type.demonstrates, `${id} does not say what it demonstrates`);
    assert.ok(type.cannotShow, `${id} does not state its limit`);
    assert.ok(type.ownershipQuestions.length >= 2, `${id} has no way to separate doing from claiming`);
  }
  for (const [id, d] of Object.entries(DOMAINS)) assert.equal(d.id, id);
});

// The spec's hardest requirement: do not award points for "started a project".
test('agency comes from what happened, not from the category', () => {
  const intent = agencySignalsFor({ type: 'shipped_product' });
  assert.ok(!intent.some(s => s.id === 'shipped_to_users'), 'shipping was credited with no deployment');

  const real = agencySignalsFor({ type: 'shipped_product', deploymentUrl: 'https://x.dev', monthsOperated: 6, iterations: 3 });
  const ids = real.map(s => s.id);
  assert.ok(ids.includes('shipped_to_users'));
  assert.ok(ids.includes('operated_over_time'));
  assert.ok(ids.includes('iterated_on_feedback'));
});

test('assigned work earns no initiative signal', () => {
  const assigned = agencySignalsFor({ type: 'independent_project', assigned: true }).map(s => s.id);
  assert.ok(!assigned.includes('unprompted_start'));
});

test('every agency signal carries the question that would expose it', () => {
  for (const [id, signal] of Object.entries(AGENCY_SIGNALS)) {
    assert.equal(signal.id, id);
    assert.ok(signal.reads, `${id} does not say what it reads as`);
    assert.ok(signal.probe.trim().endsWith('?'), `${id} has no probe question`);
  }
});

// One project tagged with four skills is one project. Counting claims counted SKILLS, and a
// single good build read as a repeated pattern.
test('a repeated builder means repeated projects, not repeated skills', () => {
  const one = technicalProfile(claimsFor(shipped({ skills: ['Python', 'PostgreSQL', 'Docker', 'React', 'Go'] })));
  assert.equal(one.evidenceTypes.shipped_product, 1, 'skills were counted as projects');
  assert.equal(one.repeatedBuilder, false, 'one project read as a pattern');

  const two = technicalProfile(claimsFor(
    shipped(),
    { id: 'p2', type: 'independent_project', source: 'connected_repo', skills: ['Go'], ownership: 'primary', pointer: 'https://g' },
  ));
  assert.equal(two.repeatedBuilder, true);
  assert.equal(two.ownedOutright, 2);
});

test('breadth is surface area, never a rank against other students', () => {
  const profile = technicalProfile(claimsFor(shipped()));
  assert.ok(Array.isArray(profile.breadth));
  assert.equal(profile.domainsAvailable, Object.keys(DOMAINS).length);
  for (const domain of profile.breadth) {
    assert.ok(domain.skills.length, `${domain.id} claims a domain with no skill behind it`);
    assert.ok(domain.best, 'a domain must carry its strongest evidence tier');
  }
  const text = JSON.stringify(profile);
  assert.ok(!/percentile|top \d+%|better than/i.test(text), 'breadth is being ranked against a population Covenda does not have');
});

test('depth reports a skill at its best evidence, not its most mentioned', () => {
  const profile = technicalProfile(claimsFor(
    shipped({ skills: ['Python'] }),
    { id: 'p2', type: 'hackathon', source: 'covenda_defense', skills: ['Python'], tier: 'referral', pointer: 'https://d' },
  ));
  assert.equal(profile.depth.find(d => d.skill === 'Python').tier, 'referral');
});

test('self-reported claims never appear as depth', () => {
  const profile = technicalProfile(claimsFor({ type: 'coursework', source: 'self_reported', skills: ['Rust'], tier: 'claimed' }));
  assert.equal(profile.depth.length, 0);
  assert.ok(profile.unverified > 0);
});

// Winning is not the signal, and the assumption is common enough to state on the type itself.
test('a hackathon states that placement does not prove depth', () => {
  assert.match(EVIDENCE_TYPES.hackathon.cannotShow, /losing project is often the harder build/i);
  const text = JSON.stringify(EVIDENCE_TYPES.hackathon);
  assert.ok(!/won|winner|first place/i.test(text), 'placement is being treated as a signal');
});

test('open source refuses to be measured by commit count', () => {
  assert.match(EVIDENCE_TYPES.open_source.cannotShow, /commit count/i);
});

// AI use is assumed, not banned. A vague disclosure is not usable; a specific one is.
test('a vague AI disclosure is not usable, a specific one is', () => {
  const vague = aiDisclosureQuality({ tools: 'Claude' });
  assert.equal(vague.usable, false);
  assert.match(vague.note, /Too general to interrogate/);

  const specific = aiDisclosureQuality({
    tools: 'Cursor and Claude', generated: 'the initial API scaffold',
    changed: 'rewrote the auth middleware, it trusted the client',
    verified: 'wrote tests for the token refresh path', learned: 'how rotation works',
  });
  assert.equal(specific.usable, true);
  // Crucially it does not say the work is good, only that it can be questioned.
  assert.match(specific.note, /defense decides/i);
});

test('disclosing AI adds ownership questions rather than a deduction', () => {
  const withAi = recordTechnicalEvidence(shipped({ aiDisclosure: { tools: 'Cursor', changed: 'a lot of things here', verified: 'tests across the path' } }));
  const without = recordTechnicalEvidence(shipped());
  assert.ok(withAi.questions.length > without.questions.length);
  assert.ok(withAi.questions.some(q => /redesign|fails first/i.test(q)));
  assert.ok(withAi.claims.every(c => c.verification_tier === without.claims[0].verification_tier), 'AI use lowered the tier');
});

// A percentage is a verdict nobody can argue with.
test('alignment names what lines up and what does not', () => {
  const profile = technicalProfile(claimsFor(shipped()));
  const out = explainAlignment(profile, ['Python', 'Security']);
  assert.ok(out.strong.some(s => s.priority === 'Python'), 'a held skill was not surfaced');
  assert.ok(out.gaps.some(g => g.priority === 'Security'), 'a genuine gap was hidden');
  for (const item of out.strong) assert.ok(item.basis, 'a match with no stated basis is an assertion');
  assert.match(out.note, /gap is what has not been shown/i);
});

test('alignment says so when a company has stated no priorities', () => {
  const out = explainAlignment(technicalProfile(claimsFor(shipped())), []);
  assert.deepEqual(out.strong, []);
  assert.match(out.note, /has not said what it is looking for/i);
});

test('singular and plural read correctly in the alignment basis', () => {
  const profile = technicalProfile(claimsFor(shipped({ skills: ['Docker'] })));
  const out = explainAlignment(profile, ['Infrastructure & deployment']);
  assert.ok(!JSON.stringify(out).includes('1 skills'), 'shipped "1 skills"');
});

test('gaps name the next thing to get, not the deficiency', () => {
  const thin = technicalProfile(claimsFor({ type: 'coursework', source: 'self_reported', skills: ['Java'], tier: 'claimed' }));
  const gaps = technicalGaps(thin);
  assert.ok(gaps.length);
  for (const gap of gaps) {
    assert.ok(gap.ask.length > 30, `${gap.key} has no route attached`);
    assert.ok(!/^you (lack|have no|are missing)/i.test(gap.ask), `${gap.key} is phrased as a deficiency`);
  }
  assert.ok(gaps.some(g => g.key === 'never_deployed'));
});

test('a strong profile produces no manufactured gaps', () => {
  const profile = technicalProfile(claimsFor(
    shipped({ monthsOperated: 8 }),
    { id: 'p2', type: 'independent_project', source: 'connected_repo', skills: ['Go', 'React'], ownership: 'primary', pointer: 'https://g' },
    { id: 'p3', type: 'open_source', source: 'connected_repo', skills: ['Rust'], mergeStatus: 'merged', pointer: 'https://pr' },
  ));
  assert.deepEqual(technicalGaps(profile).map(g => g.key), []);
});

test('skills reach domains through the taxonomy, including via aliases', () => {
  assert.ok(domainsForSkill('PyTorch').includes('aiml'), 'PyTorch must reach AI/ML');
  assert.ok(domainsForSkill('docker').includes('infrastructure'), 'docker must reach infrastructure');
  assert.deepEqual(domainsForSkill('Ceramics'), []);
});

test('ownership is a separate axis from verification', () => {
  const out = recordTechnicalEvidence(shipped({ ownership: 'contributor' }));
  assert.equal(out.ownership, 'contributor');
  assert.ok(out.ownershipMeaning.length > 10);
  assert.ok(out.claims.every(c => c.verification_tier === 'artifact'), 'ownership changed the verification tier');
  assert.ok(OWNERSHIP_LEVELS.includes(out.ownership));
});

test('an unknown type or source is refused rather than coerced', () => {
  assert.equal(recordTechnicalEvidence({ type: 'vibes', source: 'connected_repo', skills: ['Go'] }).ok, false);
  assert.equal(recordTechnicalEvidence({ type: 'hackathon', source: 'a_friend', skills: ['Go'] }).ok, false);
  assert.equal(recordTechnicalEvidence({ type: 'hackathon', source: 'connected_repo', skills: [] }).ok, false);
});
