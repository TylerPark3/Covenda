import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractSkills, matchResume, roleSkills } from '../../api/roles.js';

const roles = [
  { title: 'ML Intern', company: 'A', board_token: 'a', description: 'Python, PyTorch, SQL', posted_at: new Date().toISOString(), remote: true },
  { title: 'Design Intern', company: 'B', board_token: 'b', description: 'Figma and design systems', posted_at: new Date().toISOString() },
];
const CV = 'Rising junior. Built a Django app with PostgreSQL, trained a PyTorch classifier, shipped with Docker. Strong Python and SQL.';

test('a probe at the end of a sentence is still found', () => {
  // The boundary excluded '.' on both sides to protect "next.js", which meant "and SQL." at the
  // end of a line matched nothing. Resumes are full of sentences that end on the skill.
  assert.ok(extractSkills('Comfortable in Python and SQL.').includes('SQL'));
  assert.ok(extractSkills('We ship with Docker.').includes('Cloud & DevOps'));
});

test('the boundary still refuses the traps it was written for', () => {
  assert.ok(!extractSkills('Going to be building guidance.').includes('Go'));
  assert.ok(!extractSkills('Going to be building guidance.').includes('Design (UI/UX)'));
  // A dot BEFORE a probe still blocks it, so "js" inside "next.js" is not a separate hit.
  assert.deepEqual(extractSkills('We use Next.js here.'), ['React']);
});

test('a resume and a posting are read by the same extractor', async () => {
  const src = await readFile(new URL('../../api/roles.js', import.meta.url), 'utf8');
  assert.match(src, /export function roleSkills\(role = \{\}\) \{\s*return extractSkills\(/,
    'postings and resumes are extracted by different code and will drift apart');
  assert.ok(roleSkills(roles[0]).includes('Python'));
});

test('too little text is refused with a reason, not an empty list', () => {
  const out = matchResume('hi', roles);
  assert.equal(out.ok, false);
  assert.deepEqual(out.matches, []);
  assert.match(out.reason, /^(Enter|Choose|Only|Account|This|Please|Add|Describe|A refresh)/,
    'the refusal would return 500 rather than 400');
});

test('text with no recognisable skills says what is missing', () => {
  const out = matchResume('I am a hard working team player who loves solving problems every single day.', roles);
  assert.equal(out.ok, false);
  assert.match(out.reason, /^(Enter|Choose|Only|Account|This|Please|Add|Describe|A refresh)/);
  assert.match(out.reason, /what you built it with/i);
});

test('a real resume ranks the roles it lines up with', () => {
  const out = matchResume(CV, roles);
  assert.ok(out.ok);
  assert.ok(out.skills.includes('Python') && out.skills.includes('SQL'));
  assert.equal(out.matches[0].title, 'ML Intern', 'the matching role should lead');
  // The design role shares no skills. It still scores 10 on recency alone, so filtering on
  // score would have listed it; filtering on overlap drops it, which is the honest result.
  assert.ok(!out.matches.some(m => m.title === 'Design Intern'),
    'a role with no shared skills was listed as a match');
});

test('nothing about the resume is stored', async () => {
  const api = await readFile(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const fn = api.slice(api.indexOf('export async function matchResumeToRoles'), api.indexOf('// ── Coursework'));
  assert.ok(!/\.insert\(|\.upsert\(|\.update\(/.test(fn), 'the resume text is being written somewhere');
  assert.match(fn, /open_roles/);
  assert.match(api, /input\.action === 'match-resume'/, 'the route does not exist');
});

test('the output carries no probability and no stored profile claim', () => {
  const out = matchResume(CV, roles);
  for (const banned of ['probability', 'likelihood', 'offerChance', 'readiness', 'grade']) {
    assert.ok(!(banned in out), `matchResume returns a ${banned}`);
  }
  assert.match(out.note, /not saved/i);
  assert.match(out.note, /not a model/i);
});

test('the paste box is wired into the roles panel', async () => {
  const ui = await readFile(new URL('../../portal.js', import.meta.url), 'utf8');
  assert.match(ui, /action:'match-resume'/);
  assert.match(ui, /role-match-input/);
  // One row builder for both lists, or the two start disagreeing about what a role looks like.
  assert.match(ui, /function roleRow\(role,r\)/);
  assert.equal((ui.match(/className='role-link'/g) || []).length, 1, 'a second row builder exists');
});

// ── Filling the table without a cron ──────────────────────────────────────────────────
test('an empty roles table can be filled from a signed-in session', async () => {
  const { readFile } = await import('node:fs/promises');
  const api = await readFile(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const fn = api.slice(api.indexOf('export async function refreshOpenRoles'), api.indexOf('// Paste a resume'));

  assert.match(fn, /profile\?\.role !== 'student'/, 'anyone signed in can sweep the boards');
  // Skipped unless the data is actually stale, so a member cannot pull seven third-party
  // boards on every page load.
  assert.match(fn, /age < ROLE_REFRESH_AFTER_MS/);
  // Written with the service role: the table is readable by members and writable by nobody.
  assert.match(fn, /serviceClient\(/);
  assert.match(api, /input\.action === 'refresh-roles'/, 'the route does not exist');

  const ui = await readFile(new URL('../../portal.js', import.meta.url), 'utf8');
  assert.match(ui, /action:'refresh-roles'/, 'nothing in the UI can trigger it');
});
