import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARTIFACT_TYPES, ARTIFACT_IDS, FIRM_TYPES, FIRM_IDS, DISCIPLINES,
  recordFinanceEvidence, financeProfile, emphasisFor, financeGaps, firmType,
  claimsFromStoredFinanceEvidence,
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

// ── Wiring ────────────────────────────────────────────────────────────────────────────
// The lesson from this build: a model with no callers is not a feature. These assert the
// route exists, the read degrades, and the write does not.
test('the finance routes are wired into the portal', () => {
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const action of ['save-finance-evidence', 'delete-finance-evidence', 'target-firm-type']) {
    assert.match(api, new RegExp(`input\\.action === '${action}'`), `${action} has no route`);
  }
  // Matches the payload key itself rather than its neighbour, so adding another key beside it
  // does not fail a test about finance.
  assert.match(api, /availableSimulations,[^;]*\bfinance\b/, 'the finance profile never reaches the dashboard');
});

// Fourth time this shape has broken production, per the note in loadTechnicalEvidence.
test('the finance read degrades and the finance write does not', () => {
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const load = api.slice(api.indexOf('export async function loadFinanceEvidence'));
  assert.match(load.slice(0, 400), /optional\(/, 'loadFinanceEvidence uses checked() and will take the portal down');

  const save = api.slice(api.indexOf('export async function saveFinanceEvidence'));
  assert.match(save.slice(0, 3000), /checked\(member\.supabase\.from\('finance_evidence'\)\.insert/, 'the write does not verify it landed');
});

test('the migration enforces the rules the model enforces', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20260729400000_finance_evidence.sql', import.meta.url), 'utf8');
  assert.match(sql, /subject text not null/, 'an artifact with no subject could be stored');
  assert.match(sql, /finance_evidence_pointer_required/, 'a verified artifact could point at nothing');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /notify pgrst, 'reload schema';\s*$/);
  // Every artifact type the model knows must be storable, or saving one 500s on a CHECK.
  for (const id of ARTIFACT_IDS) assert.ok(sql.includes(`'${id}'`), `${id} is not allowed by the CHECK constraint`);
  // No score column, deliberately.
  const cols = sql.slice(sql.indexOf('create table'), sql.indexOf('constraint'));
  for (const banned of ['score', 'rating', 'return_pct', 'grade']) {
    assert.ok(!cols.includes(banned), `the table has a ${banned} column`);
  }
});

test('a stored row is rehydrated through the model, so the ceiling still applies', () => {
  // The row claims `referral`; a parsed workbook cannot support that. If claims were stored
  // instead of derived, fixing the ceiling would never reach rows saved before the fix.
  const claims = claimsFromStoredFinanceEvidence([{
    id: 'r1', artifact_type: 'lbo_model', evidence_source: 'parsed_workbook',
    verification_level: 'referral', pointer: 'https://x/l', subject: 'Dollar General',
    skills: ['LBO'], defense_result: { ok: true },
  }]);
  assert.ok(claims.length > 0);
  assert.ok(claims.every(c => c.verification_tier === 'artifact'), 'the stored tier overrode the source ceiling');
  const profile = financeProfile(claims);
  assert.equal(profile.artifactCount, 1);
  assert.equal(profile.defended, 1);
  assert.equal(emphasisFor(profile, 'private_equity').leads[0].type, 'lbo_model');
});

test('an unknown stored type is skipped rather than throwing', () => {
  assert.deepEqual(claimsFromStoredFinanceEvidence([{ artifact_type: 'crypto_moonshot', subject: 'x' }]), []);
  assert.deepEqual(claimsFromStoredFinanceEvidence(null), []);
});

// ── The form (§20) ────────────────────────────────────────────────────────────────────
// The graph, the table and the routes all shipped before this existed, so a finance student
// could not add a single artifact. The server accepted it; nothing asked for it. These assert
// the UI is actually reachable, because "the routes exist" is what I checked last time and it
// was not the same thing.
test('the finance form exists and is reachable from the portal', () => {
  const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');

  assert.match(html, /id="financeEvidenceDialog"/);
  assert.match(html, /id="financeEvidenceForm"/);
  // Rendered beside the technical profile, or a student never sees it.
  const branch = js.slice(js.indexOf("if(profile?.role==='student'){"), js.indexOf('function renderPortfolioEmpty'));
  assert.match(branch, /renderFinanceProfile\(\w+,\s*state\.dashboard\)/, 'the panel is never mounted');
  assert.match(js, /add\.addEventListener\('click',openFinanceEvidence\)/, 'nothing opens the dialog');
});

// Every field the client sends has to be a field the server reads, and the subject and downside
// are the two the model refuses to do without.
test('the form sends exactly what the route reads', () => {
  const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');

  const dialog = html.slice(html.indexOf('id="financeEvidenceForm"'), html.indexOf('</dialog>', html.indexOf('id="financeEvidenceForm"')));
  const save = api.slice(api.indexOf('export async function saveFinanceEvidence'));
  const body = save.slice(0, save.indexOf('\n}'));

  for (const field of ['type', 'subject', 'title', 'pointer', 'asOf', 'skills', 'thesis', 'downside', 'published']) {
    assert.match(dialog, new RegExp(`name="${field}"`), `the form has no ${field} input`);
    assert.match(js, new RegExp(`${field}:`), `readFinanceEvidence never sends ${field}`);
    assert.ok(body.includes(`input.${field}`), `saveFinanceEvidence never reads ${field}`);
  }
  // A subject is required by the model and by the column, so the input must require it too
  // rather than letting the student get to a server error.
  assert.match(dialog, /name="subject"[^>]*required/, 'subject is optional in the form and required everywhere else');
});

// The type list and the limits come from the server so the form and the reviewer cannot describe
// the same artifact differently. Twelve type names duplicated in the client is how that drifts.
test('the form takes its artifact list from the server, not a local copy', () => {
  const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  assert.match(js, /state\.dashboard\?\.finance\?\.artifactGuide/, 'the guide is not read from the payload');
  assert.ok(!/stock_pitch|dcf_model|market_map/.test(js), 'the client hard-codes artifact types');
  // Both halves are shown: what it demonstrates, and what it cannot.
  assert.match(js, /entry\?\.demonstrates/);
  assert.match(js, /entry\?\.cannotShow/);
});

// The firm type reorders and never gates, so nothing here may filter or hide.
test('choosing a firm type reorders and hides nothing', () => {
  const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const panel = js.slice(js.indexOf('function renderFinanceProfile'));
  const body = panel.slice(0, panel.indexOf('\n}\n'));
  assert.match(body, /action:'target-firm-type'/);
  // alsoHas is what a firm does not weight. Dropping it would make the reorder lie by omission.
  assert.match(body, /emphasis\?\.alsoHas/, 'artifacts the firm does not read are not shown at all');
  assert.match(body, /Also on your profile/);
});

// text-transform: capitalize on the shared <small> was title-casing whole sentences:
// "Whether You Can Size A Space Nobody Has Sized For You."
test('evidence sentences are not title-cased by the stylesheet', () => {
  const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');
  const rule = css.match(/\.tech-entries small \{[^}]*\}/)[0];
  assert.ok(!/text-transform/.test(rule), 'the shared small is capitalizing sentences again');
  // The one thing that needed it, the evidence type slug, is formatted in JS instead.
  const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  assert.match(js, /typeGuide\?\.\[entry\.evidence_type\]\?\.label/);
});
