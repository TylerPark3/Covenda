import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTIFACT_TYPES, ARTIFACT_IDS, FIRM_TYPES, FIRM_IDS, DISCIPLINES,
  recordFinanceEvidence, financeProfile, emphasisFor, financeGaps, firmType,
} from '../../api/finance-evidence.js';
import { batchesByVertical } from '../../api/batches.js';

const pitch = (over = {}) => ({ id: 'a1', type: 'stock_pitch', source: 'covenda_defense', tier: 'referral', pointer: 'https://x/p', subject: 'Cloudflare', ...over });
const claimsFor = (...es) => es.flatMap(e => recordFinanceEvidence(e).claims || []);

// Same axis separation as the technical graph: kind here, provenance in evidence.js.
test('the source ceiling still caps a finance claim', () => {
  const out = recordFinanceEvidence({ ...pitch(), source: 'parsed_workbook', tier: 'trial' });
  assert.ok(out.claims.every(c => c.verification_tier === 'artifact'), 'a parsed workbook was recorded above its ceiling');
});

// Unverifiable evidence is the thing this product exists to stop accepting.
test('an artifact has to say what it is about', () => {
  const out = recordFinanceEvidence({ type: 'stock_pitch', source: 'covenda_defense', subject: '', pointer: 'https://x' });
  assert.equal(out.ok, false);
  assert.match(out.reason, /company, sector, or target/);
});

test('every artifact and firm type is fully described', () => {
  for (const [id, a] of Object.entries(ARTIFACT_TYPES)) {
    assert.equal(a.id, id);
    assert.ok(a.demonstrates, `${id} does not say what it demonstrates`);
    assert.ok(a.cannotShow, `${id} does not state its limit`);
    assert.ok(a.ownershipQuestions.length >= 2, `${id} cannot separate doing from claiming`);
    for (const d of a.disciplines) assert.ok(DISCIPLINES[d], `${id} claims unknown discipline ${d}`);
  }
  for (const [id, f] of Object.entries(FIRM_TYPES)) {
    assert.equal(f.id, id);
    assert.ok(f.evaluates, `${id} does not say what it is hiring for`);
    assert.ok(f.reads.length >= 3, `${id} reads too few artifacts to order a profile`);
    for (const r of f.reads) assert.ok(ARTIFACT_TYPES[r], `${id} reads unknown artifact ${r}`);
  }
  assert.equal(ARTIFACT_IDS.length, 12);
  assert.equal(FIRM_IDS.length, 7);
});

// The two most over-read artifacts in student finance. Both limits are load-bearing.
test('the limits that matter most are stated on the type', () => {
  assert.match(ARTIFACT_TYPES.portfolio_record.cannotShow, /mostly the market and luck/i);
  assert.match(ARTIFACT_TYPES.dcf_model.cannotShow, /[Tt]erminal value usually dominates/);
  assert.match(ARTIFACT_TYPES.stock_pitch.cannotShow, /one that lost can have been the better call/i);
});

// A VC and a hedge fund should not see the same thing first.
test('the same profile leads differently for different firms', () => {
  const profile = financeProfile(claimsFor(
    pitch(),
    { id: 'a2', type: 'market_map', source: 'connected_repo', pointer: 'https://x/m', subject: 'vertical SaaS' },
    { id: 'a3', type: 'dcf_model', source: 'parsed_workbook', pointer: 'https://x/d', subject: 'Costco' },
  ));
  const vc = emphasisFor(profile, 'venture_capital');
  const bank = emphasisFor(profile, 'investment_banking');
  assert.equal(vc.leads[0].type, 'market_map', 'a VC should not lead with a DCF');
  assert.equal(bank.leads[0].type, 'dcf_model', 'a bank should not lead with a market map');
});

// Nothing is hidden. A reordered profile that drops evidence is a profile that lies by omission.
test('an artifact a firm does not weight still appears', () => {
  const profile = financeProfile(claimsFor(
    { id: 'a1', type: 'market_map', source: 'connected_repo', pointer: 'https://x/m', subject: 'logistics' },
  ));
  const bank = emphasisFor(profile, 'investment_banking');
  assert.equal(bank.leads.length, 0);
  assert.ok(bank.alsoHas.some(a => a.type === 'market_map'), 'the market map vanished for a bank');
  // And absence is framed as evidence missing, not as the person falling short.
  assert.match(bank.note, /a gap in evidence, not in the person/);
});

test('no firm type is set means the profile is shown as built', () => {
  const out = emphasisFor(financeProfile(claimsFor(pitch())), null);
  assert.equal(out.firm, null);
  assert.match(out.note, /as the student built it/);
  assert.equal(firmType('nonsense'), null);
});

// One memo touching three disciplines is one piece of work.
test('artifacts are counted once, not once per discipline', () => {
  const profile = financeProfile(claimsFor(pitch()));
  assert.equal(profile.artifacts.stock_pitch, 1);
  assert.ok(profile.disciplinesCovered >= 3, 'a pitch should touch several disciplines');
  assert.equal(profile.artifactCount, 1);
});

test('the profile returns no composite score', () => {
  const profile = financeProfile(claimsFor(pitch()));
  for (const banned of ['score', 'rating', 'rank', 'grade', 'total']) {
    assert.ok(!(banned in profile), `financeProfile returns a ${banned}`);
  }
});

test('gaps name the next artifact to build, including a firm-specific one', () => {
  const empty = financeGaps(financeProfile([]));
  assert.match(empty[0].ask, /One stock pitch with a stated downside/);

  const some = financeProfile(claimsFor({ id: 'a1', type: 'research_report', source: 'connected_repo', pointer: 'https://x/r', subject: 'semis' }));
  const gaps = financeGaps(some, 'private_equity');
  assert.ok(gaps.some(g => g.key === 'no_view'), 'analysis without a recommendation should be flagged');
  assert.ok(gaps.some(g => g.key === 'no_model'));
  assert.ok(gaps.some(g => g.key === 'firm_specific' && /lbo/i.test(g.ask)));
  for (const g of gaps) assert.ok(g.ask.length > 30, `${g.key} has no route attached`);
});

test('a defended artifact is recorded as defended', () => {
  const profile = financeProfile(claimsFor(pitch({ defended: true })));
  assert.equal(profile.defended, 1);
  assert.equal(financeProfile(claimsFor(pitch())).defended, 0);
});

// The finance vertical Covenda actually runs has to be covered by these firm types.
test('the firm types cover the finance specialisations in the catalogue', () => {
  const finance = batchesByVertical().find(v => v.verticalSlug === 'accounting-finance');
  assert.ok(finance, 'the finance vertical is missing from the catalogue');
  const labels = Object.values(FIRM_TYPES).map(f => f.label.toLowerCase()).join(' ');
  for (const word of ['investment banking', 'private equity', 'venture capital', 'asset', 'accounting']) {
    assert.ok(labels.includes(word), `no firm type covers ${word}`);
  }
});
