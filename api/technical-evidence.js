// The Software & AI technical evidence graph.
//
// ── WHY THIS IS A SEPARATE AXIS FROM api/evidence.js ──────────────────────────────────
// evidence.js answers "how much can this source establish", and its SOURCES table caps every
// claim at what its provenance actually supports. That axis is about TRUST and it is not
// duplicated here.
//
// This module answers a different question: "what KIND of work is this, and what does having
// done it demonstrate". A hackathon project and an open-source pull request can both be
// evidenced by a connected repo, so they share a ceiling and prove different things. Folding
// kind into source would have forced one table to answer both, and every new evidence type
// would have needed a new ceiling invented for it.
//
// So: TYPE (here) x SOURCE (evidence.js) -> claim. normaliseEvidence still does the capping.
//
// ── WHAT THIS DELIBERATELY DOES NOT DO ────────────────────────────────────────────────
// There is no engineering quality score, and there is no ranking of students against each
// other. A single number is exactly the artifact this product exists to replace: it is
// unfalsifiable, it hides what produced it, and a company cannot act on it. Everything here
// returns named, sourced, interrogable components instead.
//
// Breadth is reported as surface area, never as a percentile. "Interacted with eight domains"
// is a fact about a person. "Top 12% for breadth" is a claim about a population Covenda does
// not have.

import { SOURCES, TIERS, normaliseEvidence } from './evidence.js';
import { canonicalizeSkill } from './skills-taxonomy.js';

export const TECHNICAL_EVIDENCE_VERSION = 'technical-evidence-1.0.0';

// ── Technical domains ─────────────────────────────────────────────────────────────────
// The surface a piece of work touches. A student is not asked to pick these; they are derived
// from the skills the evidence actually demonstrates, because self-declared breadth is the
// easiest thing in the world to overstate.
export const DOMAINS = {
  algorithms: { id: 'algorithms', label: 'Algorithms & data structures' },
  backend: { id: 'backend', label: 'Backend engineering' },
  frontend: { id: 'frontend', label: 'Frontend engineering' },
  databases: { id: 'databases', label: 'Databases & data modelling' },
  infrastructure: { id: 'infrastructure', label: 'Infrastructure & deployment' },
  distributed: { id: 'distributed', label: 'Distributed systems' },
  aiml: { id: 'aiml', label: 'AI & machine learning' },
  security: { id: 'security', label: 'Security' },
  robotics: { id: 'robotics', label: 'Robotics & embedded' },
  product: { id: 'product', label: 'Product engineering' },
};

// Canonical skill (from skills-taxonomy) -> the domains it touches. A skill can touch more
// than one, because most real ones do: SQL is databases and backend both.
const SKILL_DOMAINS = {
  'Python': ['backend', 'aiml'],
  'JavaScript': ['frontend', 'backend'],
  'TypeScript': ['frontend', 'backend'],
  'React': ['frontend', 'product'],
  'HTML/CSS': ['frontend'],
  'Java': ['backend', 'algorithms'],
  'C++': ['algorithms', 'robotics'],
  'C#': ['backend'],
  'Go': ['backend', 'distributed'],
  'Rust': ['backend', 'algorithms'],
  'SQL': ['databases', 'backend'],
  'API design': ['backend', 'product'],
  'Cloud & DevOps': ['infrastructure', 'distributed'],
  'Shell scripting': ['infrastructure'],
  'Git & version control': ['infrastructure'],
  'QA & testing': ['backend', 'security'],
  'Machine learning': ['aiml'],
  'LLMs & prompting': ['aiml', 'product'],
  'Computer vision': ['aiml', 'robotics'],
  'Robotics (ROS)': ['robotics'],
  'Statistics': ['aiml', 'algorithms'],
  'Data analysis': ['aiml', 'databases'],
  'Data visualization': ['frontend', 'product'],
  'Design (UI/UX)': ['frontend', 'product'],
  'Project management': ['product'],
};

export function domainsForSkill(skill) {
  const { canonical } = canonicalizeSkill(skill);
  return SKILL_DOMAINS[canonical] || [];
}

// ── Evidence types ────────────────────────────────────────────────────────────────────
// What kind of work this is. `demonstrates` is what having done it can show; `cannotShow` is
// the limit, carried alongside so no reader has to infer it.
//
// `ownershipQuestions` is the point of the whole table. "Started a project" is not a signal;
// what the person decided, built and changed is. These are the questions that separate them,
// and they are written here rather than improvised per applicant so two reviewers reading two
// students are asking the same thing.
export const EVIDENCE_TYPES = {
  shipped_product: {
    id: 'shipped_product', label: 'Shipped product', agency: 'high',
    demonstrates: 'The full loop: build, deploy, operate, and change it after contact with users.',
    cannotShow: 'That the code is good. Shipping and engineering quality are different claims.',
    ownershipQuestions: [
      'What did you build yourself, and what did you take off the shelf?',
      'What broke after you deployed it, and what did you change?',
      'Who used it, and what did they do that you did not expect?',
    ],
  },
  hackathon: {
    id: 'hackathon', label: 'Hackathon project', agency: 'medium',
    demonstrates: 'Learning velocity and shipping something whole under a hard time limit.',
    // Stated up front because the assumption is nearly universal and it is wrong.
    cannotShow: 'Technical depth by placement. A losing project is often the harder build, and '
      + 'judging at these events weights demo polish heavily.',
    ownershipQuestions: [
      'Which parts did you personally write, and which did teammates write?',
      'What did you have to learn during the event that you did not know going in?',
      'What did you cut to finish, and what would you put back first?',
    ],
  },
  open_source: {
    id: 'open_source', label: 'Open-source contribution', agency: 'high',
    demonstrates: 'Working inside someone else\'s codebase and standards, and surviving review.',
    cannotShow: 'Anything by commit count. A typo fix and a subsystem rewrite are both one commit.',
    ownershipQuestions: [
      'What did the maintainer ask you to change, and did you agree with it?',
      'How did you work out where in the codebase this belonged?',
      'What did you have to understand about the project before you could touch it?',
    ],
  },
  independent_project: {
    id: 'independent_project', label: 'Independent project', agency: 'high',
    demonstrates: 'Choosing a problem nobody assigned and carrying it to something that runs.',
    cannotShow: 'That anyone needed it. Unused is not the same as unfinished.',
    ownershipQuestions: [
      'Why this problem, and how did you decide it was worth your time?',
      'Where did you get stuck longest, and how did you get unstuck?',
      'What did you decide not to build, and why?',
    ],
  },
  coursework: {
    id: 'coursework', label: 'Coursework project', agency: 'low',
    demonstrates: 'Completing a specified build to a standard someone else set.',
    cannotShow: 'Initiative. The problem, the scope and the deadline were all chosen for you.',
    ownershipQuestions: [
      'What did you do beyond the specification?',
      'What would you change if the constraints were yours to set?',
    ],
  },
  research: {
    id: 'research', label: 'Research work', agency: 'medium',
    demonstrates: 'Working on a question with no known answer, and reporting what happened.',
    cannotShow: 'Engineering practice. Research code is usually not production code, and does not need to be.',
    ownershipQuestions: [
      'What was your contribution as distinct from your supervisor\'s?',
      'What result surprised you, and what did you do to check it was real?',
    ],
  },
  technical_writing: {
    id: 'technical_writing', label: 'Technical writing', agency: 'medium',
    demonstrates: 'Understanding something well enough to make another engineer able to use it.',
    cannotShow: 'That you can build the thing you documented.',
    ownershipQuestions: [
      'What did you have to learn to write this?',
      'What did readers get wrong that made you rewrite a section?',
    ],
  },
  community: {
    id: 'community', label: 'Technical community', agency: 'medium',
    demonstrates: 'Organising other engineers, which is a different skill from being one.',
    cannotShow: 'Technical ability of any kind, on its own.',
    ownershipQuestions: [
      'What existed before you started, and what exists now?',
      'What did you do when it nearly did not happen?',
    ],
  },
};

// ── Ownership ─────────────────────────────────────────────────────────────────────────
// How much of the thing is actually this person's. Separate from verification: a claim can be
// well-evidenced and still be a small slice of a large team project, and a company reading it
// needs both facts.
export const OWNERSHIP_LEVELS = ['contributor', 'substantial', 'primary', 'sole'];

const OWNERSHIP_MEANING = {
  contributor: 'Worked on it. The shape of the thing was decided by others.',
  substantial: 'Owned a named part of it end to end.',
  primary: 'Made the architectural decisions and did most of the building.',
  sole: 'Built it alone.',
};

export function ownershipMeaning(level) {
  return OWNERSHIP_MEANING[level] || null;
}

// ── Agency ────────────────────────────────────────────────────────────────────────────
// The spec's hardest requirement: do not award points for "started a project".
//
// Agency is read from the SHAPE of what happened, not from the category it was filed under.
// Every signal below requires something that cannot be produced by intent alone: a deployment
// that exists, an iteration that followed feedback, a stack learned because the work needed
// it. Each carries the question that would expose it if it were not real.
export const AGENCY_SIGNALS = {
  unprompted_start: {
    id: 'unprompted_start', label: 'Started without being assigned',
    reads: 'Chose the problem. Nobody set it, graded it, or asked for it.',
    probe: 'What made you pick this over everything else you could have built?',
  },
  shipped_to_users: {
    id: 'shipped_to_users', label: 'Put it in front of real users',
    reads: 'Crossed the gap between working on a laptop and working for somebody else.',
    probe: 'What was the first thing a user did that you had not anticipated?',
  },
  iterated_on_feedback: {
    id: 'iterated_on_feedback', label: 'Changed it after feedback',
    reads: 'Kept going after the interesting part was over, which is where most projects stop.',
    probe: 'What did you change that you did not want to change?',
  },
  learned_new_stack: {
    id: 'learned_new_stack', label: 'Learned an unfamiliar stack for it',
    reads: 'Let the problem choose the tools rather than the other way round.',
    probe: 'What did you get wrong while you were still learning it?',
  },
  operated_over_time: {
    id: 'operated_over_time', label: 'Kept it running',
    reads: 'Owned the thing after launch, including the parts nobody thanks you for.',
    probe: 'What has broken since, and what did you do about it?',
  },
  contributed_upstream: {
    id: 'contributed_upstream', label: 'Contributed to someone else\'s codebase',
    reads: 'Worked to a standard set by other people and had the change accepted.',
    probe: 'What did review make you change?',
  },
  repeated: {
    id: 'repeated', label: 'Did it more than once',
    reads: 'A pattern rather than an episode. One project can be luck or a good term.',
    probe: 'What did the second one do differently because of the first?',
  },
};

// Which agency signals a piece of evidence supports, derived from what is actually recorded
// on it rather than from what the student says about it.
export function agencySignalsFor(entry = {}) {
  const type = EVIDENCE_TYPES[entry.type];
  const out = [];
  if (!type) return out;

  const unprompted = ['independent_project', 'shipped_product', 'open_source', 'community'];
  if (unprompted.includes(type.id) && !entry.assigned) out.push(AGENCY_SIGNALS.unprompted_start);
  // Deployment is a fact with a URL, not an intention.
  if (entry.deploymentUrl || entry.deploymentStatus === 'live') out.push(AGENCY_SIGNALS.shipped_to_users);
  if (Number(entry.iterations) > 1 || entry.changedAfterFeedback) out.push(AGENCY_SIGNALS.iterated_on_feedback);
  if (entry.learnedForThis) out.push(AGENCY_SIGNALS.learned_new_stack);
  if (Number(entry.monthsOperated) >= 3) out.push(AGENCY_SIGNALS.operated_over_time);
  if (type.id === 'open_source' && entry.mergeStatus === 'merged') out.push(AGENCY_SIGNALS.contributed_upstream);
  return out;
}

// ── AI-assisted engineering ───────────────────────────────────────────────────────────
// Not a penalty and not a loophole. Assume the tools were used, ask what the person did with
// what came out. Disclosure is rewarded with a defense rather than a deduction, because the
// alternative is a rule everybody breaks quietly.
export const AI_DISCLOSURE_FIELDS = ['tools', 'generated', 'changed', 'verified', 'learned'];

export const AI_OWNERSHIP_QUESTIONS = [
  'Why is it built this way rather than the obvious alternative?',
  'Which part did you change after it was generated, and what was wrong with it?',
  'What fails first when this goes to production?',
  'What would you redesign at a hundred times the traffic?',
];

// A disclosure is only worth something if it is specific. "Used Claude" discloses nothing.
export function aiDisclosureQuality(disclosure = {}) {
  const present = AI_DISCLOSURE_FIELDS.filter(f => String(disclosure[f] || '').trim().length > 12);
  const missing = AI_DISCLOSURE_FIELDS.filter(f => !present.includes(f));
  return {
    fields: present.length,
    missing,
    // The distinction the spec asks for cannot be read off a form. It is read off the answers
    // to the ownership questions, which is why this returns a posture and not a verdict.
    usable: present.includes('changed') && present.includes('verified'),
    note: present.includes('changed') && present.includes('verified')
      ? 'Specific enough to question. The defense decides what it is worth.'
      : 'Too general to interrogate. Ask what they changed and what they checked before this counts.',
  };
}

// ── Recording one piece of evidence ───────────────────────────────────────────────────
// Reusable across every type, which is the spec's §11 requirement. There is no per-type
// branch here: a type contributes its skills and its questions, and the shared path does the
// rest. Adding a type is a table entry, not a code path.
export function recordTechnicalEvidence(entry = {}) {
  const type = EVIDENCE_TYPES[entry.type];
  if (!type) return { ok: false, reason: `Unknown evidence type: ${entry.type}.` };
  if (!SOURCES[entry.source]) return { ok: false, reason: `Unknown evidence source: ${entry.source}.` };

  const ownership = OWNERSHIP_LEVELS.includes(entry.ownership) ? entry.ownership : 'contributor';
  const skills = [...new Set((entry.skills || []).map(s => String(s || '').trim()).filter(Boolean))];
  if (!skills.length) return { ok: false, reason: 'Technical evidence has to name at least one skill.' };

  // One claim per skill, each capped by its SOURCE. The ceiling logic is not reimplemented.
  const claims = [];
  const refused = [];
  for (const skill of skills) {
    const result = normaliseEvidence({
      source: entry.source,
      skill,
      tier: entry.tier || 'artifact',
      pointer: entry.pointer || entry.repoUrl || entry.deploymentUrl || null,
      meta: {
        evidence_type: type.id,
        ownership_level: ownership,
        technical_domains: domainsForSkill(skill),
        demonstrates: type.demonstrates,
        cannotShow: type.cannotShow,
        ai_assisted: Boolean(entry.aiDisclosure),
        // One project producing four claims is still one project. Without this, counting
        // claims counts SKILLS, and a single well-tagged build reads as a repeated pattern.
        entry_id: entry.id || entry.pointer || entry.repoUrl || entry.deploymentUrl || `${type.id}:${entry.title || 'untitled'}`,
      },
    });
    if (result.ok) claims.push(result.claim); else refused.push({ skill, reason: result.reason });
  }

  return {
    ok: claims.length > 0,
    reason: claims.length ? null : (refused[0]?.reason || 'No claim could be recorded.'),
    claims,
    refused,
    ownership,
    ownershipMeaning: ownershipMeaning(ownership),
    agency: agencySignalsFor(entry),
    // Asked at defense. Type questions plus the AI ones when AI was disclosed.
    questions: [
      ...type.ownershipQuestions,
      ...(entry.aiDisclosure ? AI_OWNERSHIP_QUESTIONS : []),
    ],
    aiDisclosure: entry.aiDisclosure ? aiDisclosureQuality(entry.aiDisclosure) : null,
  };
}

// ── The profile ───────────────────────────────────────────────────────────────────────
// Surface area, depth, agency and what is missing. No composite number anywhere: every field
// below is either a count of named things or the named things themselves.
export function technicalProfile(claims = []) {
  const rows = (claims || []).filter(c => c && c.skill);

  // Breadth: domains actually touched, with what touched them. Reported as surface area, not
  // as a rank — Covenda has no population to rank against and would be inventing one.
  const domainHits = {};
  for (const claim of rows) {
    const domains = claim.evidence_meta?.technical_domains || domainsForSkill(claim.skill);
    for (const id of domains) {
      (domainHits[id] ||= { domain: DOMAINS[id]?.label || id, id, skills: new Set(), evidenced: new Set(), claimedOnly: new Set(), best: 'claimed' });
      domainHits[id].skills.add(claim.skill);
      // Split, because a domain reports its BEST tier and a mixed list then reads as though
      // every skill in it were backed. "Backend engineering / Artifact / Python, Rust" makes
      // a typed Rust look evidenced by standing next to a verified Python.
      if (claim.verification_tier === 'claimed') domainHits[id].claimedOnly.add(claim.skill);
      else domainHits[id].evidenced.add(claim.skill);
      if (TIERS.indexOf(claim.verification_tier) > TIERS.indexOf(domainHits[id].best)) {
        domainHits[id].best = claim.verification_tier;
      }
    }
  }
  const breadth = Object.values(domainHits)
    .map(d => ({
      ...d,
      skills: [...d.skills],
      evidenced: [...d.evidenced],
      claimedOnly: [...d.claimedOnly],
      skillCount: d.skills.size,
      // The bar is drawn from evidenced skills only, so listing more never widens it.
      evidencedCount: d.evidenced.size,
    }))
    .sort((a, b) => b.evidencedCount - a.evidencedCount || b.skillCount - a.skillCount);

  // Depth: where the strongest evidence is, by skill. A skill is only as deep as its best
  // evidence, so this reads the tier rather than counting mentions.
  const bySkill = {};
  for (const claim of rows) {
    const key = claim.skill;
    if (!bySkill[key] || TIERS.indexOf(claim.verification_tier) > TIERS.indexOf(bySkill[key].tier)) {
      bySkill[key] = { skill: key, tier: claim.verification_tier, type: claim.evidence_meta?.evidence_type || null };
    }
  }
  const depth = Object.values(bySkill)
    .filter(s => s.tier !== 'claimed')
    .sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier));

  // Counted by distinct PROJECT, not by claim. A single build tagged with four skills
  // produces four claims, and counting those made one good project read as a pattern.
  const entriesByType = {};
  for (const claim of rows) {
    const t = claim.evidence_meta?.evidence_type;
    if (!t) continue;
    (entriesByType[t] ||= new Set()).add(claim.evidence_meta?.entry_id || claim.evidence_pointer || claim.skill);
  }
  const types = Object.fromEntries(Object.entries(entriesByType).map(([t, set]) => [t, set.size]));

  const ownedEntries = new Set(rows
    .filter(c => ['primary', 'sole'].includes(c.evidence_meta?.ownership_level))
    .map(c => c.evidence_meta?.entry_id || c.evidence_pointer || c.skill));
  const aiEntries = new Set(rows
    .filter(c => c.evidence_meta?.ai_assisted)
    .map(c => c.evidence_meta?.entry_id || c.evidence_pointer || c.skill));

  return {
    version: TECHNICAL_EVIDENCE_VERSION,
    breadth,
    domainsTouched: breadth.length,
    domainsAvailable: Object.keys(DOMAINS).length,
    depth,
    deepestTier: depth[0]?.tier || null,
    evidenceTypes: types,
    // Repetition is the signal, so it is counted rather than assumed from one entry.
    repeatedBuilder: (types.shipped_product || 0) + (types.independent_project || 0) >= 2,
    ownedOutright: ownedEntries.size,
    aiAssisted: aiEntries.size,
    unverified: rows.filter(c => c.verification_tier === 'claimed').length,
    collaboration: collaborationEvidence(rows),
    history: builderHistory(rows),
  };
}

// ── Collaboration ─────────────────────────────────────────────────────────────────────
// Whether the work was done with or for other people. Derived, not asked for: an upstream
// contribution, a hackathon, and a community entry each already say it, and adding a
// "collaboration" checkbox would just be self-report wearing a new label.
//
// Reported as the evidence itself rather than a level. "Contributed upstream to two projects"
// is checkable; "collaboration: high" is not.
const COLLABORATIVE_TYPES = { open_source: 'Open source', hackathon: 'Hackathon', community: 'Community' };

export function collaborationEvidence(claims = []) {
  const rows = (claims || []).filter(c => c && c.skill);
  const kinds = new Map();
  const entries = new Set();
  for (const claim of rows) {
    const meta = claim.evidence_meta || {};
    const type = meta.evidence_type;
    const signals = meta.agency_signals || [];
    const id = meta.entry_id || `${type}:${meta.title || ''}`;
    if (COLLABORATIVE_TYPES[type]) {
      kinds.set(type, (kinds.get(type) || 0) + (entries.has(id) ? 0 : 1));
      entries.add(id);
    }
    // Contributing upstream is collaboration whatever the entry was filed as.
    if (signals.includes('contributed_upstream') && !entries.has(id)) {
      kinds.set('open_source', (kinds.get('open_source') || 0) + 1);
      entries.add(id);
    }
  }
  return {
    kinds: [...kinds.entries()].map(([id, count]) => ({ id, label: COLLABORATIVE_TYPES[id] || id, count })),
    entries: entries.size,
    // Stated, because the absence is the more common case and it is not a failing.
    note: entries.size ? null : 'Nothing here yet shows work done with other people.',
  };
}

// ── Builder history ───────────────────────────────────────────────────────────────────
// The things actually shipped, in the order they happened. A profile is a set; a history is a
// sequence, and the sequence is what shows whether somebody kept going.
//
// Undated entries are kept and sorted last rather than dropped: an artifact with no date is
// still an artifact, and silently hiding it would understate the person.
const BUILT_TYPES = ['shipped_product', 'independent_project', 'open_source', 'hackathon', 'research'];

export function builderHistory(claims = []) {
  const byEntry = new Map();
  for (const claim of (claims || [])) {
    const meta = claim?.evidence_meta || {};
    if (!BUILT_TYPES.includes(meta.evidence_type)) continue;
    const id = meta.entry_id || `${meta.evidence_type}:${meta.title || ''}`;
    if (byEntry.has(id)) continue;
    byEntry.set(id, {
      id,
      title: meta.title || EVIDENCE_TYPES[meta.evidence_type]?.label || 'Untitled',
      type: meta.evidence_type,
      typeLabel: EVIDENCE_TYPES[meta.evidence_type]?.label || meta.evidence_type,
      at: meta.occurred_at || meta.shipped_at || null,
      tier: claim.verification_tier || 'claimed',
      ownership: meta.ownership || null,
    });
  }
  const items = [...byEntry.values()].sort((a, b) => {
    if (!a.at && !b.at) return 0;
    if (!a.at) return 1;
    if (!b.at) return -1;
    return Date.parse(b.at) - Date.parse(a.at);
  });
  return { items, count: items.length, dated: items.filter(i => i.at).length };
}

// What has not been shown yet, phrased as the next thing to get. A gap with no route attached
// is a rejection with extra words.
export function technicalGaps(profile) {
  const gaps = [];
  const has = t => Boolean(profile.evidenceTypes[t]);

  if (!profile.depth.length) {
    gaps.push({ key: 'nothing_backed', ask: 'Nothing here is backed by anything yet. One repo you own changes that.' });
  }
  if (!has('shipped_product')) {
    gaps.push({ key: 'never_deployed', ask: 'Nothing you have built is running anywhere. Deploying one thing is the single biggest gap here.' });
  }
  if (!has('open_source')) {
    gaps.push({ key: 'own_code_only', ask: 'Everything is your own codebase. One accepted pull request shows you can work to someone else\'s standard.' });
  }
  if (!profile.repeatedBuilder) {
    gaps.push({ key: 'single_instance', ask: 'One project can be a good term. A second one is a pattern.' });
  }
  if (profile.domainsTouched < 3) {
    gaps.push({ key: 'narrow_surface', ask: `Evidence touches ${profile.domainsTouched} of ${profile.domainsAvailable} domains. Breadth is not required, but it is what a small team is usually buying.` });
  }
  if (!profile.ownedOutright) {
    gaps.push({ key: 'no_ownership', ask: 'Every entry is a contribution to something someone else shaped. One thing you decided the architecture of would answer that.' });
  }
  return gaps;
}

// ── Company alignment ─────────────────────────────────────────────────────────────────
// The spec's §8: never output "Compatibility: 87%". A percentage is a verdict that cannot be
// argued with. What a hiring team can act on is which specific things line up, which do not,
// and what the claim rests on.
export function explainAlignment(profile, priorities = []) {
  const wanted = (priorities || []).map(p => String(p || '').trim()).filter(Boolean);
  if (!wanted.length) return { strong: [], gaps: [], evidence: [], note: 'This team has not said what it is looking for yet.' };

  const covered = new Map();
  for (const entry of profile.depth) covered.set(entry.skill.toLowerCase(), entry);
  const domainByLabel = new Map(profile.breadth.map(d => [d.domain.toLowerCase(), d]));

  const strong = [];
  const gaps = [];
  for (const priority of wanted) {
    const key = priority.toLowerCase();
    const skillHit = covered.get(key);
    const domainHit = domainByLabel.get(key);
    if (skillHit) strong.push({ priority, basis: `${skillHit.tier} evidence`, from: skillHit.type });
    else if (domainHit) strong.push({ priority, basis: `${domainHit.best} evidence across ${domainHit.skillCount} skill${domainHit.skillCount === 1 ? '' : 's'}`, from: 'domain' });
    else gaps.push({ priority, why: 'Nothing in this profile speaks to it yet.' });
  }

  return {
    strong,
    gaps,
    evidence: profile.depth.slice(0, 4).map(d => `${d.skill} (${d.tier}${d.type ? `, ${d.type.replace(/_/g, ' ')}` : ''})`),
    // Said out loud, because a list of matches invites reading absence as disqualification.
    note: gaps.length
      ? 'A gap is what has not been shown, not what the person cannot do.'
      : 'Everything this team named is backed by something here.',
  };
}

// ── Bridge from the stored profile ────────────────────────────────────────────────────
// The profile keeps analysed repos under skill_signals.github and self-declared skills under
// skills. Both become claims here, at very different tiers, so the difference between
// "GitHub shows this" and "the student typed this" survives all the way to the company.
//
// Nothing is invented: a skill the student only typed stays `claimed` and therefore never
// appears in depth. That is the whole point of the separation.
export function technicalClaimsFromProfile(profile = {}) {
  const claims = [];
  const seen = new Set();

  const analyses = Array.isArray(profile?.skill_signals?.github) ? profile.skill_signals.github : [];
  for (const analysis of analyses) {
    const skills = [...new Set((analysis.skills || []).map(s => String(s?.skill || s || '').trim()).filter(Boolean))];
    if (!skills.length) continue;
    const result = recordTechnicalEvidence({
      // The repo URL is the project identity, so two analyses of one repo stay one project.
      id: analysis.repo || analysis.url || analysis.name || null,
      type: analysis.evidenceType && EVIDENCE_TYPES[analysis.evidenceType] ? analysis.evidenceType : 'independent_project',
      source: 'connected_repo',
      tier: 'artifact',
      pointer: analysis.url || analysis.repo || 'github',
      skills,
      ownership: analysis.ownership || 'primary',
      deploymentUrl: analysis.deploymentUrl || null,
      monthsOperated: analysis.monthsOperated || 0,
      iterations: analysis.iterations || 0,
    });
    for (const claim of result.claims || []) {
      const key = `${claim.skill}:${claim.evidence_meta?.entry_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      claims.push(claim);
    }
  }

  // Self-declared skills, recorded honestly as self-reported. They contribute breadth context
  // and can never contribute depth, because self_reported's ceiling is `claimed`.
  for (const skill of profile?.skills || []) {
    const name = String(skill || '').trim();
    if (!name || claims.some(c => c.skill.toLowerCase() === name.toLowerCase())) continue;
    const result = recordTechnicalEvidence({
      id: 'self-reported', type: 'coursework', source: 'self_reported', tier: 'claimed', skills: [name],
    });
    claims.push(...(result.claims || []));
  }

  return claims;
}

// ── Company evidence requests (§9) ────────────────────────────────────────────────────
// A team says what it is looking for in its own words; this turns that into the evidence a
// student could actually go and get. The mapping is derived at read time rather than frozen
// into the stored row, so improving it does not require rewriting requests already made.
//
// Priorities are matched against domains and skills both, because a hiring manager writes
// "distributed systems" and a student's profile says "Go" and "Docker".
const PRIORITY_EVIDENCE = {
  aiml: ['shipped_product', 'independent_project', 'research'],
  infrastructure: ['shipped_product', 'open_source'],
  distributed: ['shipped_product', 'open_source'],
  backend: ['shipped_product', 'open_source', 'independent_project'],
  frontend: ['shipped_product', 'independent_project'],
  product: ['shipped_product', 'independent_project'],
  databases: ['shipped_product', 'independent_project'],
  security: ['open_source', 'research'],
  algorithms: ['open_source', 'research'],
  robotics: ['independent_project', 'research'],
};

const DOMAIN_BY_LABEL = new Map(Object.values(DOMAINS).map(d => [d.label.toLowerCase(), d.id]));

// Resolve a company's own phrasing onto a domain, through the label, the id, or the skill
// taxonomy. "Distributed systems", "distributed", and "Go" all land in the same place.
export function domainForPriority(priority) {
  const raw = String(priority || '').trim().toLowerCase();
  if (!raw) return null;
  if (DOMAIN_BY_LABEL.has(raw)) return DOMAIN_BY_LABEL.get(raw);
  if (DOMAINS[raw]) return raw;
  const viaSkill = domainsForSkill(priority);
  return viaSkill[0] || null;
}

export function recommendedEvidence(priorities = []) {
  const wanted = (priorities || []).map(p => String(p || '').trim()).filter(Boolean);
  const types = new Set();
  const unmapped = [];
  for (const priority of wanted) {
    const domain = domainForPriority(priority);
    if (!domain) { unmapped.push(priority); continue; }
    for (const type of PRIORITY_EVIDENCE[domain] || []) types.add(type);
  }
  // A defense is recommended whatever the priorities are: it is the one thing no artifact and
  // no third-party score can substitute for.
  const recommended = [...types].map(id => ({
    type: id,
    label: EVIDENCE_TYPES[id].label,
    why: EVIDENCE_TYPES[id].demonstrates,
    limit: EVIDENCE_TYPES[id].cannotShow,
  }));
  return {
    recommended,
    defense: 'A recorded walkthrough of one of these. It is the only evidence a third-party score cannot stand in for.',
    // Named rather than silently dropped, so an operator can see what the mapping missed.
    unmapped,
    note: unmapped.length
      ? `Not mapped to a technical domain yet: ${unmapped.join(', ')}. These still show on the request, they just do not drive a recommendation.`
      : null,
  };
}

// The student-facing view of one company's request: what they asked for, what this student
// already has, and what is worth getting next. Same components as explainAlignment, ordered
// as a next step rather than as an assessment.
export function evidencePlanFor(profile, request = {}) {
  const alignment = explainAlignment(profile, request.priorities || []);
  const suggestions = recommendedEvidence(request.priorities || []);
  const have = new Set(Object.keys(profile.evidenceTypes || {}));
  return {
    headline: request.headline || null,
    strong: alignment.strong,
    gaps: alignment.gaps,
    evidence: alignment.evidence,
    note: alignment.note,
    // Only what they do not already have. Telling somebody to ship a product when they have
    // shipped two is how a recommendation stops being read.
    next: suggestions.recommended.filter(r => !have.has(r.type)),
    alreadyHave: suggestions.recommended.filter(r => have.has(r.type)).map(r => r.label),
    defense: suggestions.defense,
    unmapped: suggestions.unmapped,
  };
}

// Claims from evidence a student entered themselves, stored in technical_evidence. Kept
// separate from technicalClaimsFromProfile because the two sources have different shapes and
// different trust: one is derived from a connected account, the other is typed by the person
// it describes. Both go through recordTechnicalEvidence, so the source ceiling applies
// identically and a typed entry with no pointer can never rise above `claimed`.
export function claimsFromStoredEvidence(rows = []) {
  const claims = [];
  for (const row of rows || []) {
    if (!row || !EVIDENCE_TYPES[row.evidence_type]) continue;
    const result = recordTechnicalEvidence({
      id: row.id,
      type: row.evidence_type,
      source: row.evidence_source,
      tier: row.verification_level,
      pointer: row.pointer || row.repo_url || row.deployment_url || null,
      skills: Array.isArray(row.skills) ? row.skills : [],
      ownership: row.ownership_level,
      deploymentUrl: row.deployment_url,
      monthsOperated: row.months_operated || 0,
      iterations: row.iterations || 0,
      assigned: row.assigned,
      aiDisclosure: row.ai_assistance_disclosure || null,
    });
    claims.push(...(result.claims || []));
  }
  return claims;
}

// Everything a student's technical profile rests on: connected repos and entered evidence
// together. One place, so no caller has to remember there are two sources.
export function allTechnicalClaims(profile = {}, storedRows = []) {
  const claims = [...claimsFromStoredEvidence(storedRows)];
  const seen = new Set(claims.map(c => `${c.skill.toLowerCase()}:${c.evidence_meta?.entry_id}`));
  for (const claim of technicalClaimsFromProfile(profile)) {
    const key = `${claim.skill.toLowerCase()}:${claim.evidence_meta?.entry_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push(claim);
  }
  return claims;
}
