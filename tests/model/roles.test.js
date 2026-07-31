import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isStudentRole, normaliseRole, parseBoard, roleSkills, scoreRole, rankRoles, BOARDS, boardUrl } from '../../api/roles.js';
import { syncRoles, fetchBoard } from '../../api/roles-cron.js';

const role = {
  title: 'Software Engineering Intern', company: 'Scale AI', location: 'Remote - US', remote: true,
  posted_at: new Date().toISOString(),
  description: 'You will write Python and SQL, work with PyTorch, and ship with Docker.',
};

test('the title filter keeps students in and everyone else out', () => {
  for (const t of ['Software Engineering Intern', 'New Grad Engineer', 'Data Science Co-op', '2027 Summer Internship']) {
    assert.ok(isStudentRole(t), `${t} should be a student role`);
  }
  // Each of these matched the naive pattern and was a real false positive on live data.
  for (const t of ['Internal Audit Manager', 'International Sales Lead', 'Senior Engineer, Internship Program',
    'University Recruiter, Contract', 'Campus Recruiting Coordinator', 'Talent Acquisition Partner']) {
    assert.ok(!isStudentRole(t), `${t} is not a job a student can take`);
  }
});

test('skills are read with word boundaries, not substrings', () => {
  const skills = roleSkills(role);
  assert.ok(skills.includes('Python'));
  assert.ok(skills.includes('SQL'));
  // 'go' must not match 'going', and 'ui' must not match 'building'.
  const trap = roleSkills({ title: 'Ops Intern', description: 'Going to be building guidance for a big audience.' });
  assert.ok(!trap.includes('Go'), 'the letter probe matched inside another word');
  assert.ok(!trap.includes('Design (UI/UX)'), '"ui" matched inside "building"');
});

test('the fit components always sum to the printed score', () => {
  const fit = scoreRole(role, { skills: ['Python', 'SQL'], evidencedSkills: ['Python'] });
  assert.equal(fit.components.reduce((a, c) => a + c.points, 0), fit.score);
  for (const c of fit.components) assert.ok(c.points <= c.max, `${c.id} exceeds its ceiling`);
  assert.equal(fit.components.filter(c => c.backed === 'evidence').length, 1);
});

test('no probability, no prediction, anywhere in the output', async () => {
  const fit = scoreRole(role, { skills: ['Python'] });
  for (const banned of ['probability', 'offerChance', 'interview', 'likelihood', 'timeToImprove', 'projected']) {
    assert.ok(!(banned in fit), `scoreRole returns a ${banned}`);
  }
  const src = await readFile(new URL('../../api/roles.js', import.meta.url), 'utf8').then(t => t.replace(/\/\/.*$/gm, ''));
  for (const banned of ['probability', 'likelihood', 'offer_chance']) {
    assert.ok(!new RegExp(banned, 'i').test(src), `api/roles.js computes a ${banned}`);
  }
});

test('a student with no skills gets a route rather than a zero', () => {
  const fit = scoreRole(role, { skills: [] });
  assert.equal(fit.score, null);
  assert.match(fit.why, /Add skills/);
});

test('unscoreable roles are kept, not dropped', () => {
  const ranked = rankRoles([role, { ...role, title: 'Ops Intern', description: 'A role.' }], { skills: ['Python'] });
  assert.equal(ranked.length, 2, 'a role we could not score was silently hidden');
  assert.ok((ranked[0].fit.score ?? -1) >= (ranked[1].fit.score ?? -1));
});

test('a failing board is reported, never thrown', async () => {
  const bad = await fetchBoard({ token: 'nope', company: 'Nope', source: 'greenhouse' },
    { fetchImpl: async () => ({ ok: false, status: 404 }) });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.roles, []);
  const threw = await fetchBoard({ token: 'x', company: 'X', source: 'greenhouse' },
    { fetchImpl: async () => { throw new Error('socket hang up'); } });
  assert.equal(threw.ok, false);
  assert.match(threw.reason, /socket/);
});

test('the sync upserts and never truncates', async () => {
  const calls = [];
  const db = { from: () => ({ upsert: (rows, opts) => { calls.push({ rows, opts }); return { error: null, count: rows.length }; } }) };
  const payload = { jobs: [{ id: 1, title: 'ML Intern', location: { name: 'Remote' }, content: 'Python', first_published: '2026-07-01' }] };
  const report = await syncRoles(db, {
    boards: [{ token: 't', company: 'C', source: 'greenhouse' }],
    fetchImpl: async () => ({ ok: true, json: async () => payload }),
  });
  assert.equal(report.found, 1);
  assert.equal(calls[0].opts.onConflict, 'source,external_id', 'the sync would duplicate rows on re-run');
  assert.ok(calls[0].rows[0].last_seen_at, 'rows are not stamped, so stale postings can never be filtered out');

  const src = (await readFile(new URL('../../api/roles-cron.js', import.meta.url), 'utf8')).replace(/\/\/.*$/gm, '');
  assert.ok(!/\.delete\(\)/.test(src), 'the sync deletes rows, which empties the page when a board has a bad night');
});

test('the roles table is readable by members and writable by nobody', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/20260730200000_open_roles.sql', import.meta.url), 'utf8');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for select using \(auth\.role\(\) = 'authenticated'\)/);
  // A postings table any account could write to is a phishing surface: a real company name
  // with an attacker's apply link.
  assert.ok(!/for insert|for update|for delete/.test(sql), 'a policy lets members write job postings');
  assert.match(sql, /unique \(source, external_id\)/);
  assert.match(sql, /notify pgrst, 'reload schema';\s*$/);
  for (const banned of ['score', 'match', 'rank', 'probability', 'salary']) {
    assert.ok(!new RegExp(`^\\s+${banned}\\b`, 'm').test(sql), `the table stores a ${banned}`);
  }
});

test('the panel is wired and the sync is scheduled', async () => {
  const api = await readFile(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(api, /rankRoles\(roleRows/);
  assert.match(api, /compatibility, roles,/, 'roles never reach the dashboard');
  // Read from the table, never fetched inline: a dashboard must not wait on seven third parties.
  const block = api.slice(api.indexOf('const roleRows'), api.indexOf('const ranked'));
  assert.ok(!/fetch\(/.test(block), 'the dashboard fetches job boards on request');

  const ui = await readFile(new URL('../../portal.js', import.meta.url), 'utf8');
  // Lives on the Discover tab now, not inside a Portfolio disclosure: a student with an empty
  // profile can paste a resume there and get something back before building anything.
  assert.match(ui, /renderOpenRoles\(rolesHost,state\.dashboard\)/, 'the roles panel is not mounted on Discover');
  const html = await readFile(new URL('../../portal.html', import.meta.url), 'utf8');
  const discover = html.slice(html.indexOf('data-portal-view="discover"'), html.indexOf('data-portal-view="batches"'));
  assert.match(discover, /id="openRolesHost"/, 'the host element is not on the Discover tab');
  const vercel = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vercel.crons.some(c => c.path === '/api/roles-cron'), 'the sync never runs');
});

test('every board token is well formed', () => {
  assert.ok(BOARDS.length >= 5);
  for (const b of BOARDS) {
    assert.match(b.token, /^[a-z0-9-]+$/, `${b.token} is not a usable board token`);
    assert.ok(b.company);
    assert.match(boardUrl(b.token), /^https:\/\/boards-api\.greenhouse\.io\//);
  }
});

// Real company marks are shown on a Covenda page by an explicit founder decision, against the
// blueprint's rule 14 as written. What makes that defensible is the sentence saying these are
// not partners, so the sentence is a requirement rather than a nicety.
test('the provenance line survives as long as the logos do', async () => {
  const ui = await readFile(new URL('../../portal.js', import.meta.url), 'utf8');
  const usesLogos = /s2\/favicons/.test(ui);
  if (!usesLogos) return; // If the marks ever go, the requirement goes with them.
  assert.match(ui, /public postings, not Covenda partners/i,
    'real company marks are shown with nothing saying these are not partners');
});
