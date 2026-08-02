// Live open roles (§30).
//
// The first thing on this page that is not Covenda's own inventory. A student with no batch to
// apply to and no project assigned had nothing to do here; this gives them the actual open
// internships, scored against what they have.
//
// ── WHY GREENHOUSE, AND WHY THE BOARD API ─────────────────────────────────────────────
// `boards-api.greenhouse.io/v1/boards/<token>/jobs` is the public job board feed. No key, no
// OAuth, no partnership, no scraping: it is the same endpoint that renders a company's own
// careers page, so reading it is the intended use and cannot break a terms-of-service line.
//
// Note the direction. api/ats.js PUSHES a candidate into a company's Greenhouse and needs a
// Harvest key from that company. This PULLS public postings and needs nothing. They are
// opposite halves and share no credentials.
//
// ── WHAT THIS REFUSES TO OUTPUT ───────────────────────────────────────────────────────
// No offer probability, no interview probability, no "estimated time to improve", no 0-10
// overall match. Covenda has placed zero students, so every one of those would be a number
// with nothing behind it, dressed as a prediction. What comes out instead is the same shape
// the batch scorer uses: itemised, fixed-weight arithmetic where a student can see each
// component and check it. If a number here is wrong, it is wrong in a way you can point at.
import { canonicalizeSkill } from './skills-taxonomy.js';

export const ROLES_VERSION = 'roles-1.0.0';

// Greenhouse board tokens. Hand-picked startups rather than everything on Greenhouse: the
// point is companies a Covenda student could plausibly join, not a job board.
export const BOARDS = [
  { token: 'vercel', company: 'Vercel', domain: 'vercel.com', source: 'greenhouse' },
  { token: 'anthropic', company: 'Anthropic', domain: 'anthropic.com', source: 'greenhouse' },
  { token: 'scaleai', company: 'Scale AI', domain: 'scale.com', source: 'greenhouse' },
  { token: 'databricks', company: 'Databricks', domain: 'databricks.com', source: 'greenhouse' },
  { token: 'figma', company: 'Figma', domain: 'figma.com', source: 'greenhouse' },
  { token: 'discord', company: 'Discord', domain: 'discord.com', source: 'greenhouse' },
  { token: 'robinhood', company: 'Robinhood', domain: 'robinhood.com', source: 'greenhouse' },
];

// board_token -> domain. Keyed on the token because that is the column the table already has,
// so the mark survives a round trip through the database without a schema change.
export const BOARD_DOMAINS = Object.fromEntries(BOARDS.filter(b => b.domain).map(b => [b.token, b.domain]));

export const boardUrl = token =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;

// ── Which postings are for students ───────────────────────────────────────────────────
// Title-based, and deliberately conservative. A false positive puts a senior role in front of
// a sophomore, which wastes their time and makes the whole surface look untrustworthy.
const STUDENT_TITLE = /\b(intern|internship|co-?op|new ?grad|university|campus|apprentice|early career|student)\b/i;
// Seniority words that override the above: "Internal Audit Manager" contains "intern".
const SENIOR_TITLE = /\b(senior|staff|principal|lead|manager|director|head of|vp|vice president|architect)\b/i;
// Roles that recruit students rather than employ them. "University Recruiter" and "Campus
// Recruiting Coordinator" both matched the student pattern and were being ranked as
// internships, which is the worst kind of false positive: it looks like a real opportunity.
const HIRES_STUDENTS = /\b(recruit|recruiter|recruiting|talent acquisition|sourcer|coordinator, campus)\b/i;

export function isStudentRole(title = '') {
  const t = String(title || '');
  if (!STUDENT_TITLE.test(t)) return false;
  if (SENIOR_TITLE.test(t)) return false;
  if (HIRES_STUDENTS.test(t)) return false;
  // "intern" inside another word: internal, international, internet.
  if (/\bintern\b/i.test(t) === false && /intern/i.test(t) && !/internship|co-?op/i.test(t)) return false;
  return true;
}

// ── Normalising a posting ─────────────────────────────────────────────────────────────
const stripHtml = html => String(html || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/\s+/g, ' ')
  .trim();

const REMOTE = /\bremote\b/i;

export function normaliseRole(job = {}, board = {}) {
  const title = String(job.title || '').trim();
  if (!title) return null;
  const location = String(job.location?.name || '').trim();
  const text = stripHtml(job.content);
  return {
    external_id: String(job.id || job.internal_job_id || ''),
    source: board.source || 'greenhouse',
    board_token: board.token || null,
    company: board.company || job.company_name || null,
    title,
    location: location || null,
    remote: REMOTE.test(location) || REMOTE.test(title),
    url: job.absolute_url || null,
    posted_at: job.first_published || job.updated_at || null,
    // Capped: the full description can run to 40kB and nothing downstream reads past the
    // requirements, which are near the top.
    description: text.slice(0, 6000),
  };
}

export function parseBoard(payload, board) {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs
    .filter(j => isStudentRole(j?.title))
    .map(j => normaliseRole(j, board))
    .filter(Boolean);
}

// ── Reading skills out of a posting ───────────────────────────────────────────────────
// Routed through the same taxonomy the rest of the product uses, so a role asking for PyTorch
// and a student who listed TensorFlow both land on "Machine learning" and actually meet.
//
// Word-boundary matched. Substring matching turned "R" into a hit on every posting containing
// the letter and "Go" into a hit on "Going".
const PROBES = [
  'python', 'javascript', 'typescript', 'java', 'c++', 'go', 'rust', 'ruby', 'swift', 'kotlin',
  'react', 'node', 'django', 'flask', 'rails', 'next.js', 'vue',
  'sql', 'postgres', 'postgresql', 'mysql', 'mongodb', 'snowflake', 'spark', 'hadoop',
  'pytorch', 'tensorflow', 'machine learning', 'deep learning', 'nlp', 'computer vision', 'llm',
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ci/cd',
  'figma', 'sketch', 'ui', 'ux', 'design systems',
  'excel', 'spreadsheets', 'financial modeling', 'valuation', 'accounting',
  'tableau', 'looker', 'power bi', 'data visualization', 'statistics', 'data analysis',
  'git', 'testing', 'qa', 'research', 'writing', 'documentation', 'project management',
  'marketing', 'growth', 'seo', 'operations', 'product management',
];

export function extractSkills(text = '') {
  const haystack = String(text || '').toLowerCase();
  const found = new Set();
  for (const probe of PROBES) {
    // Escape regex metacharacters: c++, next.js, ci/cd all contain them.
    const safe = probe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Lookaround rather than consuming characters. The previous version excluded '.' on BOTH
    // sides to stop "js" matching inside "next.js", which also meant a probe at the end of a
    // sentence never matched: "comfortable in Python and SQL." found neither. A dot before the
    // probe still blocks it; a dot after it is just punctuation.
    const re = new RegExp(`(?<![a-z0-9+#.])${safe}(?![a-z0-9+#])`, 'i');
    if (re.test(haystack)) {
      const { canonical, matched } = canonicalizeSkill(probe);
      // Probes are written lowercase. One the taxonomy does not know comes back as typed, so
      // it is title-cased rather than shown to a student in lower case.
      found.add(matched ? canonical : canonical.replace(/\b[a-z]/g, c => c.toUpperCase()));
    }
  }
  return [...found];
}

// Same detection as extractSkills, but it also reports WHERE each skill was read from.
//
// A student being told "your résumé claims Python" deserves to see the sentence that claim
// came from — otherwise the product is asserting things about their own document and asking
// them to take it on faith. Sharing PROBES and the regex with extractSkills is the point:
// two extractors that drift apart would tell a student two different stories about one file.
export function locateSkills(text = '') {
  const source = String(text || '');
  const found = new Map();
  for (const probe of PROBES) {
    const safe = probe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![a-z0-9+#.])${safe}(?![a-z0-9+#])`, 'i');
    const m = re.exec(source);
    if (!m) continue;
    const { canonical, matched } = canonicalizeSkill(probe);
    const skill = matched ? canonical : canonical.replace(/\b[a-z]/g, c => c.toUpperCase());
    const prev = found.get(skill);
    if (prev && prev.index <= m.index) continue;
    // One short quote around the hit, whitespace collapsed so a PDF's line breaks do not
    // turn the evidence into a column of fragments.
    const start = Math.max(0, m.index - 45);
    const raw = source.slice(start, start + 90).replace(/\s+/g, ' ').trim();
    found.set(skill, {
      skill,
      matched_phrase: m[0],
      index: m.index,
      context: (start > 0 ? '\u2026' : '') + raw + (start + 90 < source.length ? '\u2026' : ''),
    });
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}

export function roleSkills(role = {}) {
  return extractSkills(`${role.title || ''} ${role.description || ''}`);
}

// ── Scoring a role for a student ──────────────────────────────────────────────────────
// Same construction as batchCompatibility, on purpose: itemised components with fixed weights
// that sum to the printed number, and one of them backed by evidence rather than by typing.
//
// The weights are the same shape as the batch scorer so the two numbers mean comparable
// things. They are hand-set constants, not learned, and there is no outcome data behind them
// because nothing has been placed yet. That is stated to the student rather than implied.
export const ROLE_WEIGHTS = { overlap: 60, evidence: 25, remote: 5, recency: 10 };

export function scoreRole(role = {}, { skills = [], evidencedSkills = [] } = {}, now = Date.now()) {
  const wanted = roleSkills(role);
  const stated = new Set((skills || []).map(s => canonicalizeSkill(String(s || '')).canonical));
  const shown = new Set((evidencedSkills || []).map(s => canonicalizeSkill(String(s || '')).canonical));

  if (!wanted.length) {
    return {
      score: null, wanted: [], matched: [], missing: [], components: [],
      why: 'This posting does not name skills specifically enough to line up against.',
    };
  }
  if (!stated.size) {
    return {
      score: null, wanted, matched: [], missing: wanted, components: [],
      why: 'Add skills to your profile and every role will show how it lines up.',
    };
  }

  const matched = wanted.filter(s => stated.has(s));
  const evidenced = matched.filter(s => shown.has(s));
  const missing = wanted.filter(s => !stated.has(s));
  const coverage = matched.length / wanted.length;

  const ageDays = role.posted_at ? Math.max(0, (now - Date.parse(role.posted_at)) / 86400000) : null;
  // A posting older than about two months is usually filled or stale, so recency is worth
  // points. Not a prediction, an ordering preference, and it decays rather than cutting off.
  const recency = ageDays === null ? ROLE_WEIGHTS.recency / 2
    : Math.round(ROLE_WEIGHTS.recency * Math.max(0, 1 - ageDays / 60));

  const components = [
    {
      id: 'overlap', label: 'Skills the posting names', backed: 'stated',
      points: Math.round(coverage * ROLE_WEIGHTS.overlap), max: ROLE_WEIGHTS.overlap,
      detail: `${matched.length} of ${wanted.length} skills this posting asks for.`,
    },
    {
      id: 'evidence', label: 'Backed by evidence', backed: 'evidence',
      points: matched.length ? Math.round((evidenced.length / matched.length) * ROLE_WEIGHTS.evidence) : 0,
      max: ROLE_WEIGHTS.evidence,
      detail: evidenced.length
        ? `${evidenced.length} of your matching skills has evidence behind it.`
        : 'None of your matching skills has evidence behind it yet.',
    },
    {
      id: 'remote', label: 'Open to remote', backed: 'stated',
      points: role.remote ? ROLE_WEIGHTS.remote : 0, max: ROLE_WEIGHTS.remote,
      detail: role.remote ? 'Listed as remote.' : 'On site or unspecified.',
    },
    {
      id: 'recency', label: 'Recently posted', backed: 'stated',
      points: recency, max: ROLE_WEIGHTS.recency,
      detail: ageDays === null ? 'No posting date given.'
        : `Posted ${Math.round(ageDays)} day${Math.round(ageDays) === 1 ? '' : 's'} ago.`,
    },
  ];

  const score = Math.max(0, Math.min(100, components.reduce((a, c) => a + c.points, 0)));

  const why = matched.length
    ? `Matches ${matched.slice(0, 3).join(', ')}${matched.length > 3 ? ', and more' : ''}`
      + (missing.length ? `. Asks for ${missing.slice(0, 2).join(' and ')} you have not listed.` : '.')
    : `Nothing on your profile matches yet. It asks for ${wanted.slice(0, 3).join(', ')}.`;

  return { score, wanted, matched, evidenced, missing, components, why };
}

// Ranked, with the unscoreable kept rather than dropped: a role we could not read skills out
// of is still an open role, and hiding it would quietly shrink the board.
export function rankRoles(roles = [], profile = {}, now = Date.now()) {
  return roles
    .map(role => ({ ...role, fit: scoreRole(role, profile, now) }))
    .sort((a, b) => (b.fit.score ?? -1) - (a.fit.score ?? -1));
}

// ── Reading a resume ──────────────────────────────────────────────────────────────────
// Text in, skills and ranked roles out. Deliberately NOT a parser: it does not try to find
// employers, dates, or education, because every one of those is a field somebody would then
// want scored, and scoring a school is the thing this product exists to stop doing.
//
// What it reads is the skill vocabulary, using the identical sweep applied to job postings.
// If the two sides were extracted by different code they would drift and stop meeting.
export const RESUME_MAX_CHARS = 20000;

export function matchResume(text = '', roles = [], { evidencedSkills = [] } = {}, now = Date.now()) {
  const clean = String(text || '').slice(0, RESUME_MAX_CHARS);
  if (clean.trim().length < 40) {
    return { ok: false, reason: 'Add a bit more of it. There is not enough here to read.', skills: [], matches: [] };
  }
  const skills = extractSkills(clean);
  if (!skills.length) {
    return {
      ok: false,
      reason: 'This did not name any tools or methods we recognise. Add the specifics: what you built it with, not what it was for.',
      skills: [], matches: [],
    };
  }
  const ranked = rankRoles(roles, { skills, evidencedSkills }, now);
  return {
    ok: true,
    reason: null,
    skills,
    // Filtered on SKILL OVERLAP, not on score. Recency alone is worth ten points, so a role
    // sharing nothing with the resume still scored above zero and was being listed as a match
    // purely for being posted recently. A role you match nothing on is not a match.
    matches: ranked.filter(r => (r.fit?.matched?.length ?? 0) > 0).slice(0, 12),
    // Said out loud: nothing here is stored, and the number is arithmetic.
    note: 'Read from the text you pasted and not saved. Fit is fixed arithmetic over four components, not a model.',
  };
}
