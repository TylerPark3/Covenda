import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRepoRef, analyzeRepo, fetchRepoData } from '../api/github.js';

const DAY = 24 * 60 * 60 * 1000;
// n commits spaced `stepDays` apart ending `endDaysAgo` days ago, authored by `login`.
function commits(n, { stepDays = 7, endDaysAgo = 3, login = 'you' } = {}) {
  const end = Date.now() - endDaysAgo * DAY;
  return Array.from({ length: n }, (_, i) => ({
    commit: { author: { date: new Date(end - i * stepDays * DAY).toISOString() } },
    author: { login },
  }));
}

const healthy = {
  repo: { full_name: 'you/proj', html_url: 'https://github.com/you/proj', fork: false, stargazers_count: 12, owner: { login: 'you' }, created_at: new Date(Date.now() - 240 * DAY).toISOString() },
  languages: { TypeScript: 200000, CSS: 20000 },
  commits: commits(30, { stepDays: 6 }),
  contents: [{ name: 'README.md', type: 'file' }, { name: 'tests', type: 'dir' }, { name: '.github', type: 'dir' }, { name: 'src', type: 'dir' }],
};

test('parseRepoRef accepts URLs, owner/repo, and .git; rejects junk', () => {
  assert.deepEqual(parseRepoRef('https://github.com/you/proj'), { owner: 'you', repo: 'proj' });
  assert.deepEqual(parseRepoRef('github.com/you/proj/'), { owner: 'you', repo: 'proj' });
  assert.deepEqual(parseRepoRef('you/proj.git'), { owner: 'you', repo: 'proj' });
  assert.deepEqual(parseRepoRef('https://github.com/you/proj/tree/main?x=1'), { owner: 'you', repo: 'proj' });
  assert.equal(parseRepoRef('not a repo'), null);
  assert.equal(parseRepoRef('https://gitlab.com/'), null);
  assert.equal(parseRepoRef(''), null);
});

test('analyzeRepo emits per-skill scores with evidence and NO overall score', () => {
  const out = analyzeRepo(healthy);
  assert.equal(out.needsReview, false);
  assert.ok(!('score' in out), 'must not expose an overall person-score');
  const ts = out.skills.find(s => s.skill === 'TypeScript');
  assert.ok(ts, 'TypeScript skill present');
  assert.ok(ts.score > 0 && ts.score <= 9);
  assert.match(ts.evidence, /TypeScript/);
  assert.equal(ts.source, 'github');
  // Sustained delivery should be recognised and can score high (hard-to-fake).
  const sustained = out.skills.find(s => s.skill === 'Sustained delivery (version control)');
  assert.ok(sustained && sustained.confidence === 'high');
  assert.ok(out.skills.some(s => s.skill === 'Automated testing'));
  assert.ok(out.skills.some(s => s.skill === 'Documentation'));
  // every score carries evidence
  for (const s of out.skills) assert.ok(typeof s.evidence === 'string' && s.evidence.length > 0);
});

test('analyzeRepo flags a one-shot dump for review and caps its scores', () => {
  const oneShot = {
    repo: { full_name: 'you/dump', fork: false, owner: { login: 'you' }, created_at: new Date().toISOString() },
    languages: { Python: 5000 },
    commits: commits(1, { endDaysAgo: 0 }),
    contents: [{ name: 'main.py', type: 'file' }],
  };
  const out = analyzeRepo(oneShot);
  assert.equal(out.needsReview, true);
  assert.ok(out.flags.some(f => /one-shot/i.test(f)));
  for (const s of out.skills) assert.ok(s.score <= 5, `capped: ${s.skill}=${s.score}`);
});

test('analyzeRepo flags a fork and caps scores even with lots of commits', () => {
  const fork = { ...healthy, repo: { ...healthy.repo, fork: true } };
  const out = analyzeRepo(fork);
  assert.equal(out.needsReview, true);
  assert.ok(out.flags.some(f => /fork/i.test(f)));
  for (const s of out.skills) assert.ok(s.score <= 5);
});

test('analyzeRepo skips trace languages but keeps the primary', () => {
  const out = analyzeRepo({ ...healthy, languages: { TypeScript: 200000, Makefile: 300 } });
  assert.ok(out.skills.some(s => s.skill === 'TypeScript'));
  // Makefile isn't in the skill map and is a trace share — no skill for it.
  assert.ok(!out.skills.some(s => /makefile/i.test(s.skill)));
});

test('fetchRepoData composes the GitHub endpoints and rejects private repos', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const body = url.endsWith('/languages') ? { TypeScript: 1000 }
      : url.endsWith('/commits?per_page=100') ? commits(5)
      : url.endsWith('/contents') ? [{ name: 'README.md', type: 'file' }]
      : { full_name: 'you/proj', private: false, fork: false, owner: { login: 'you' } };
    return { ok: true, status: 200, json: async () => body };
  };
  const raw = await fetchRepoData('github.com/you/proj', { fetchImpl });
  assert.equal(raw.repo.full_name, 'you/proj');
  assert.ok(calls.some(u => u.endsWith('/languages')));

  const privateFetch = async () => ({ ok: true, status: 200, json: async () => ({ full_name: 'x/y', private: true }) });
  await assert.rejects(() => fetchRepoData('x/y', { fetchImpl: privateFetch }), /private/i);

  const notFound = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(() => fetchRepoData('x/y', { fetchImpl: notFound }), /could not be found/i);
});
