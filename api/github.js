// GitHub skill-analysis engine (item 1 of the skill-inference profile spec).
//
// Design rules straight from docs/SKILL_INFERENCE_PROFILE.md:
//  - Per-skill scores only (0–10, one decimal). NEVER an overall person-score.
//  - Every score ships with its evidence (what in the repo justified it).
//  - Anti-gaming: signals that are hard to fake over an afternoon (commit history spanning
//    months, sustained cadence, first-party authorship) outweigh presence-only signals a
//    polished one-shot repo can fake. Forks and single-dump repos are flagged for human
//    review and capped, never auto-scored as proof.
//  - Only emit a skill we have real evidence for. No filler.
//
// analyzeRepo() is PURE (no network) so it is fully unit-tested against fixtures.
// fetchRepoData() is the thin network layer (GitHub REST); the two are composed by the
// portal handler's analyze-github action.

const clampScore = n => Math.max(0, Math.min(10, Math.round(n * 10) / 10));
const monthsBetween = (a, b) => Math.max(0, (b - a) / (1000 * 60 * 60 * 24 * 30.44));

// Accepts https://github.com/owner/repo(.git), github.com/owner/repo, or owner/repo.
// Returns { owner, repo } or null. Owner/repo charset is GitHub's own (alnum, -, _, .).
export function parseRepoRef(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let path = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/^www\./i, '')
    .replace(/^github\.com\//i, '');
  path = path.replace(/[?#].*$/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1];
  const ok = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,38})$/;
  if (!ok.test(owner) || !ok.test(repo)) return null;
  return { owner, repo };
}

// A curated map of GitHub language names to the skill we surface. Languages not in the map
// still count toward "polyglot" breadth but don't mint a named skill on their own.
const LANGUAGE_SKILL = {
  Python: 'Python', JavaScript: 'JavaScript', TypeScript: 'TypeScript', Java: 'Java',
  Go: 'Go', Rust: 'Rust', 'C++': 'C++', C: 'C', 'C#': 'C#', Ruby: 'Ruby', PHP: 'PHP',
  Swift: 'Swift', Kotlin: 'Kotlin', Scala: 'Scala', R: 'R', 'Jupyter Notebook': 'Data science (notebooks)',
  HTML: 'Front-end (HTML/CSS)', CSS: 'Front-end (HTML/CSS)', SQL: 'SQL', Shell: 'Shell scripting',
  Solidity: 'Smart contracts (Solidity)', Dart: 'Dart',
};

const README_RE = /^readme(\.md|\.rst|\.txt)?$/i;
const TEST_DIR_RE = /^(tests?|__tests__|spec|specs|e2e)$/i;
const TEST_FILE_RE = /(^|[._-])(test|spec)([._-]|\.)|\.(test|spec)\./i;
const CI_HINT = ['.github', '.gitlab-ci.yml', '.circleci', '.travis.yml', 'azure-pipelines.yml'];

// contents: root-directory listing [{ name, type }]. Detects README / tests / CI without
// pulling file bodies.
function inspectContents(contents) {
  const entries = Array.isArray(contents) ? contents : [];
  const names = entries.map(e => String(e?.name || ''));
  const hasReadme = names.some(n => README_RE.test(n));
  const hasTests = entries.some(e =>
    (e?.type === 'dir' && TEST_DIR_RE.test(String(e.name))) ||
    (e?.type === 'file' && TEST_FILE_RE.test(String(e.name))));
  const hasCI = names.some(n => CI_HINT.includes(n));
  return { hasReadme, hasTests, hasCI, fileCount: entries.length };
}

// commits: array of GitHub commit objects (newest first as the API returns them). We read
// authored dates and the author login to measure span, cadence, and first-party authorship.
function inspectCommits(commits, ownerLogin) {
  const list = Array.isArray(commits) ? commits : [];
  const dates = list
    .map(c => new Date(c?.commit?.author?.date || c?.commit?.committer?.date || 0).getTime())
    .filter(t => t > 0)
    .sort((a, b) => a - b);
  const count = list.length;
  const spanMonths = dates.length >= 2 ? monthsBetween(dates[0], dates[dates.length - 1]) : 0;
  const activeWeeks = new Set(dates.map(t => Math.floor(t / (1000 * 60 * 60 * 24 * 7)))).size;
  const owned = ownerLogin
    ? list.filter(c => String(c?.author?.login || '').toLowerCase() === String(ownerLogin).toLowerCase()).length
    : 0;
  const ownedFraction = count ? owned / count : 0;
  // Cadence quality: sustained work across many weeks is the hard-to-fake signal.
  const sustained = spanMonths >= 2 && activeWeeks >= 4;
  const oneShot = count <= 2 || (spanMonths < (1 / 30.44) && count >= 1); // <=2 commits, or all in a day
  // `dates` (epoch ms, ascending) is the commit timeline the shared forensics service reads.
  return { count, spanMonths, activeWeeks, ownedFraction, sustained, oneShot, timestamps: dates };
}

// Health multiplier in [0.45, 1]: how much the repo's own maturity should scale skill scores.
// A sustained, tested, documented repo earns close to 1; a bare one-shot dump is pulled down.
function healthMultiplier({ commits, contents, repo }) {
  let m = 0.6;
  if (commits.sustained) m += 0.22;
  else if (commits.spanMonths >= 0.5) m += 0.1;
  if (commits.activeWeeks >= 8) m += 0.08;
  if (contents.hasTests) m += 0.06;
  if (contents.hasReadme) m += 0.04;
  if (contents.hasCI) m += 0.04;
  if (commits.oneShot) m -= 0.28;
  if (repo.fork) m -= 0.25;
  if (commits.ownedFraction && commits.ownedFraction < 0.5) m -= 0.12;
  return Math.max(0.45, Math.min(1, m));
}

// PURE. raw = { repo, languages, commits, contents } as returned by fetchRepoData.
// Returns per-skill scores with evidence, plus review flags. Never an aggregate score.
export function analyzeRepo(raw = {}) {
  const repoObj = raw.repo || {};
  const repo = {
    name: repoObj.full_name || repoObj.name || 'repository',
    url: repoObj.html_url || '',
    fork: !!repoObj.fork,
    stars: Number(repoObj.stargazers_count) || 0,
    ownerLogin: repoObj.owner?.login || '',
    ageMonths: repoObj.created_at ? monthsBetween(new Date(repoObj.created_at).getTime(), Date.now()) : 0,
  };
  const languages = raw.languages && typeof raw.languages === 'object' ? raw.languages : {};
  const commits = inspectCommits(raw.commits, repo.ownerLogin);
  const contents = inspectContents(raw.contents);
  const health = healthMultiplier({ commits, contents, repo });

  const flags = [];
  if (repo.fork) flags.push('Forked repository — original authorship is unclear; scores are capped pending review.');
  if (commits.oneShot) flags.push('One-shot upload (few commits in a short window) — the kind of repo AI can generate in an afternoon; anchored to trials/referrals before it counts as proof.');
  if (commits.ownedFraction && commits.ownedFraction < 0.5 && commits.count >= 4) flags.push('Most commits are by other authors — this may be a shared or forked project.');
  const needsReview = repo.fork || commits.oneShot;
  // Hard-to-fake signals cap what a suspect repo can score, so a slick one-shot never reads as proof.
  const cap = needsReview ? 5 : 9;

  const totalBytes = Object.values(languages).reduce((s, n) => s + (Number(n) || 0), 0);
  const skills = [];

  // 1) Language skills — anchored on repo health, scaled by the language's share of the repo.
  const langEntries = Object.entries(languages)
    .map(([lang, bytes]) => ({ lang, bytes: Number(bytes) || 0 }))
    .sort((a, b) => b.bytes - a.bytes);
  for (const { lang, bytes } of langEntries) {
    const skill = LANGUAGE_SKILL[lang];
    if (!skill) continue;
    const share = totalBytes ? bytes / totalBytes : 0;
    if (share < 0.05 && langEntries[0]?.lang !== lang) continue; // skip trace languages (keep the primary)
    // Base 4.5 for showing up, +up to 3.5 for being the dominant language, all scaled by health.
    const base = (4.5 + 3.5 * Math.min(1, share)) * health;
    const score = clampScore(Math.min(cap, base));
    const kb = Math.round(bytes / 1024);
    skills.push({
      skill, score, source: 'github', confidence: commits.sustained ? 'medium' : 'low',
      evidence: `${kb.toLocaleString()} KB of ${lang} (${Math.round(share * 100)}% of the repo)${commits.sustained ? `, over ${commits.spanMonths.toFixed(1)} months of commits` : ''}.`,
    });
  }

  // 2) Sustained delivery — the hardest-to-fake signal, so it can score high on its own.
  if (commits.count >= 4 && commits.spanMonths >= 0.5) {
    const cadence = 3 + Math.min(4.5, commits.activeWeeks * 0.35) + Math.min(2, commits.spanMonths * 0.4);
    skills.push({
      skill: 'Sustained delivery (version control)',
      score: clampScore(Math.min(cap, cadence)),
      source: 'github', confidence: commits.sustained ? 'high' : 'medium',
      evidence: `${commits.count} commits across ${commits.activeWeeks} active week(s) spanning ${commits.spanMonths.toFixed(1)} months${commits.ownedFraction ? `; ${Math.round(commits.ownedFraction * 100)}% authored by the owner` : ''}.`,
    });
  }

  // 3) Testing — presence-only, so it stays modest and never high.
  if (contents.hasTests) {
    skills.push({
      skill: 'Automated testing', score: clampScore(Math.min(cap, 6.5 * health)),
      source: 'github', confidence: 'low',
      evidence: 'Test files or a test/spec directory are present in the repository root.',
    });
  }

  // 4) Documentation — from a present README.
  if (contents.hasReadme) {
    skills.push({
      skill: 'Documentation', score: clampScore(Math.min(cap, 5.8 * health)),
      source: 'github', confidence: 'low',
      evidence: 'A README is present at the repository root.',
    });
  }

  // De-duplicate skills (e.g., HTML + CSS both map to Front-end), keeping the highest score.
  const bySkill = new Map();
  for (const s of skills) {
    const prev = bySkill.get(s.skill);
    if (!prev || s.score > prev.score) bySkill.set(s.skill, s);
  }
  const finalSkills = [...bySkill.values()].sort((a, b) => b.score - a.score);

  return {
    repo,
    signals: {
      commits: commits.count, spanMonths: Number(commits.spanMonths.toFixed(1)),
      activeWeeks: commits.activeWeeks, ownedFraction: Number(commits.ownedFraction.toFixed(2)),
      hasTests: contents.hasTests, hasReadme: contents.hasReadme, hasCI: contents.hasCI,
      languages: langEntries.slice(0, 6).map(l => l.lang),
    },
    skills: finalSkills,
    flags,
    needsReview,
    // The commit timeline (epoch ms) for the shared forensics service, and the repo owner login
    // so a connected account can be checked for OWNERSHIP. No overall score — render per-skill.
    commitTimestamps: commits.timestamps,
    ownerLogin: repo.ownerLogin,
  };
}

// Thin GitHub REST layer. `token` (GITHUB_TOKEN env) is optional but lifts the rate limit
// from 60/hr to 5000/hr. `fetchImpl` is injectable for tests.
export async function fetchRepoData(ref, { fetchImpl = fetch, token = '' } = {}) {
  const parsed = typeof ref === 'string' ? parseRepoRef(ref) : ref;
  if (!parsed) throw new Error('Enter a valid GitHub repository URL (e.g. github.com/you/project).');
  const { owner, repo } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'covenda-skill-analysis',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const get = async (url, allow404 = false) => {
    const res = await fetchImpl(url, { headers });
    if (res.status === 404) {
      if (allow404) return null;
      throw new Error('That repository could not be found. Check the URL, and note it must be public.');
    }
    if (res.status === 403) throw new Error('GitHub rate limit reached. Add a GITHUB_TOKEN or try again shortly.');
    if (!res.ok) throw new Error(`GitHub request failed (${res.status}).`);
    return res.json();
  };
  const repoData = await get(base);
  if (repoData?.private) throw new Error('That repository is private. Covenda only analyzes public repositories you link.');
  const [languages, commits, contents] = await Promise.all([
    get(`${base}/languages`, true),
    get(`${base}/commits?per_page=100`, true),
    get(`${base}/contents`, true),
  ]);
  return { repo: repoData, languages: languages || {}, commits: commits || [], contents: contents || [] };
}
