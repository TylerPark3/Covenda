import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimsFromStoredEvidence, allTechnicalClaims, technicalProfile, EVIDENCE_TYPES } from '../../api/technical-evidence.js';

const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const dialog = html.slice(html.indexOf('id="techEvidenceDialog"'), html.indexOf('id="applyDialog"'));

const row = (over = {}) => ({
  id: 'e1', evidence_type: 'hackathon', evidence_source: 'connected_repo',
  verification_level: 'artifact', pointer: 'https://devpost/x',
  skills: ['Python'], ownership_level: 'substantial', ...over,
});

// The rails existed and were unreachable: only analysed GitHub repos ever reached the
// profile, so the whole agency story depended on having connected an account.
test('entered evidence reaches the profile, not just connected repos', () => {
  const profile = technicalProfile(allTechnicalClaims({}, [row()]));
  assert.equal(profile.evidenceTypes.hackathon, 1);
  assert.ok(profile.depth.some(d => d.skill === 'Python'));
});

test('a typed entry with no link can never rise above self-reported', () => {
  const claims = claimsFromStoredEvidence([row({ evidence_source: 'self_reported', verification_level: 'trial', pointer: null })]);
  assert.ok(claims.every(c => c.verification_tier === 'claimed'), 'a typed claim was recorded above its ceiling');
  assert.equal(technicalProfile(claims).depth.length, 0);
});

test('stored and repo evidence combine without double-counting a project', () => {
  const profile = technicalProfile(allTechnicalClaims(
    { skill_signals: { github: [{ repo: 'me/x', url: 'https://g/x', skills: [{ skill: 'Go' }] }] } },
    [row({ id: 'e2', skills: ['Go'], pointer: 'https://g/x' })],
  ));
  const go = profile.depth.filter(d => d.skill === 'Go');
  assert.equal(go.length, 1, 'the same skill was counted twice');
});

test('an unknown stored type is skipped rather than crashing the profile', () => {
  assert.deepEqual(claimsFromStoredEvidence([row({ evidence_type: 'vibes' })]), []);
  assert.deepEqual(claimsFromStoredEvidence([null, undefined]), []);
});

// ── The write path ────────────────────────────────────────────────────────────────────
test('the server validates through the model rather than restating its rules', () => {
  const fn = api.slice(api.indexOf('export async function saveTechnicalEvidence'), api.indexOf('export async function loadTechnicalEvidence'));
  assert.match(fn, /recordTechnicalEvidence\(/, 'the route must run the model');
  assert.match(fn, /if \(!assessed\.ok\) throw new Error\(assessed\.reason\)/);
  assert.match(fn, /role !== 'student'/, 'a company must not be able to write student evidence');
  // The ceiling must come from the model's output, never from what the client asked for.
  assert.match(fn, /verification_level: first\.verification_tier/);
});

test('a delete is scoped to the owner in the query as well as in RLS', () => {
  const fn = api.slice(api.indexOf('export async function deleteTechnicalEvidence'), api.indexOf('export async function saveMemberVideo'));
  assert.match(fn, /\.eq\('student_user_id', member\.user\.id\)/);
});

test('both routes are reachable', () => {
  assert.match(api, /input\.action === 'save-technical-evidence'/);
  assert.match(api, /input\.action === 'delete-technical-evidence'/);
});

// ── The form ──────────────────────────────────────────────────────────────────────────
test('the dialog exists and its icons resolve', () => {
  assert.ok(dialog.length > 500);
  for (const icon of [...dialog.matchAll(/#(p-[a-z-]+)/g)].map(m => m[1])) {
    assert.ok(html.includes(`id="${icon}"`), `${icon} is referenced but not defined`);
  }
});

test('every evidence type the model knows is offerable in the form', () => {
  const offered = [...js.matchAll(/\['([a-z_]+)','[^']+'\]/g)].map(m => m[1]);
  for (const id of Object.keys(EVIDENCE_TYPES)) {
    assert.ok(offered.includes(id), `${id} exists in the model but cannot be added`);
  }
});

// Duplicating the limits in the client is how a hackathon's caveat quietly stops matching the
// one a reviewer reads.
test('the type guide comes from the server, not a second copy in the client', () => {
  assert.match(api, /typeGuide/, 'the dashboard must ship the type guide');
  assert.match(js, /state\.dashboard\?\.technical\?\.typeGuide/);
  assert.ok(!js.includes('cannotShow:'), 'the client is carrying its own copy of the limits');
});

// An empty framework reads as broken. Returning early hid the Add button from exactly the
// students who had nothing yet.
test('a student with no evidence still gets a way to add some', () => {
  const panel = js.slice(js.indexOf('function renderTechnicalProfile'), js.indexOf('function renderCredibility'));
  assert.match(panel, /Add your first evidence/);
  assert.ok(!/if\(!t\.breadth\.length&&!t\.depth\.length\)return;/.test(panel), 'the panel still hides itself when empty');
});

test('AI disclosure is sent only when something was written in it', () => {
  assert.match(js, /aiDisclosure:ai\?\{/, 'an empty disclosure object would read as "disclosed nothing"');
});

test('the form tells the student that disclosing AI is not penalised', () => {
  assert.match(dialog, /Assume we expect you did/);
  assert.match(dialog, /costs you nothing/);
});

test('the form says what a missing link actually costs', () => {
  assert.match(dialog, /marked as listed rather than shown/);
});

test('the defense questions are surfaced before the dialog closes', () => {
  assert.match(js, /At defense you will be asked/);
  const submit = js.slice(js.indexOf("$('#techEvidenceForm')?.addEventListener"), js.indexOf('function renderTechEntries'));
  assert.ok(submit.indexOf('setDialogMessage') < submit.indexOf('.close()'), 'the message is shown after the dialog closes');
});
