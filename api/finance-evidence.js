// The finance evidence graph. Second reference implementation after api/technical-evidence.js,
// and deliberately the same shape: TYPE (here) x SOURCE (evidence.js) -> claim, with
// normaliseEvidence doing the tier capping so provenance rules are written once.
//
// ── WHY FINANCE NEEDED ITS OWN TYPES ──────────────────────────────────────────────────
// Software evidence answers "did you build it". Finance evidence answers "was the judgement
// sound", and those fail differently. A repo can be read for structure; a stock pitch cannot,
// because the number at the end is not the point. What matters is whether the thesis followed
// from the work, whether the risk was named before it happened, and whether the person can say
// what would make them wrong.
//
// So `demonstrates` and `cannotShow` are not decoration here. A DCF with beautiful formulas and
// an indefensible terminal assumption is worse than a rough model with a stated one, and a type
// system that cannot express that difference will rank them the wrong way round.
//
// ── WHAT THE FIRM TYPE CHANGES ────────────────────────────────────────────────────────
// A VC and a hedge fund reading the same profile should not see the same thing first. A market
// map is close to the whole job at seed and nearly irrelevant on a levered buyout. Rather than
// score artifacts globally, each firm type declares what it actually reads, and the profile is
// re-ordered per reader. Nothing is hidden: an artifact a firm does not weight still appears,
// it just stops being the headline.

import { SOURCES, TIERS, normaliseEvidence } from './evidence.js';

export const FINANCE_EVIDENCE_VERSION = 'finance-evidence-1.0.0';

// ── The disciplines a piece of finance work touches ───────────────────────────────────
export const DISCIPLINES = {
  valuation: { id: 'valuation', label: 'Valuation' },
  modelling: { id: 'modelling', label: 'Financial modelling' },
  accounting: { id: 'accounting', label: 'Accounting' },
  research: { id: 'research', label: 'Research & sourcing' },
  thesis: { id: 'thesis', label: 'Thesis construction' },
  risk: { id: 'risk', label: 'Risk & downside' },
  markets: { id: 'markets', label: 'Markets & macro' },
  diligence: { id: 'diligence', label: 'Diligence' },
  writing: { id: 'writing', label: 'Written argument' },
  portfolio: { id: 'portfolio', label: 'Portfolio construction' },
};

// ── Artifact types ────────────────────────────────────────────────────────────────────
// `ownershipQuestions` carry the weight, exactly as in the technical graph. A model can be
// downloaded and a memo can be ghost-written; what cannot be borrowed is an account of why the
// driver was chosen and what would change the answer.
export const ARTIFACT_TYPES = {
  stock_pitch: {
    id: 'stock_pitch', label: 'Stock pitch', disciplines: ['thesis', 'valuation', 'risk'],
    demonstrates: 'A view with a reason attached, and a price somebody can disagree with.',
    cannotShow: 'That the view was right. A pitch that worked can still have been badly reasoned, '
      + 'and one that lost can have been the better call.',
    ownershipQuestions: [
      'What has to be true for this to work, and what would tell you early that it is not?',
      'What is the strongest argument against you, and why do you not find it decisive?',
      'Which assumption is the whole thesis resting on?',
    ],
  },
  investment_memo: {
    id: 'investment_memo', label: 'Investment memo', disciplines: ['thesis', 'diligence', 'writing'],
    demonstrates: 'Committing to a recommendation in writing, with the reasoning exposed.',
    cannotShow: 'Whether the work behind it was theirs. A memo is a summary of diligence, not the diligence.',
    ownershipQuestions: [
      'What did you find that changed your mind while writing this?',
      'What did you deliberately leave out, and why was that safe?',
    ],
  },
  dcf_model: {
    id: 'dcf_model', label: 'DCF model', disciplines: ['valuation', 'modelling'],
    demonstrates: 'Building a valuation that computes rather than one that arrives at a target.',
    // The single most common failure in a student DCF, said out loud.
    cannotShow: 'Judgement about the inputs. Terminal value usually dominates the answer, so a '
      + 'clean model with an unexamined growth rate is a tidy way to be confidently wrong.',
    ownershipQuestions: [
      'How much of your value is terminal, and how did you choose that growth rate?',
      'What does the answer do if WACC moves a point?',
      'Which line here would you least want a senior to check?',
    ],
  },
  lbo_model: {
    id: 'lbo_model', label: 'LBO model', disciplines: ['modelling', 'risk'],
    demonstrates: 'Reasoning about a capital structure and what it does under stress.',
    cannotShow: 'Whether the deal was worth doing. Returns can clear a hurdle on assumptions nobody would underwrite.',
    ownershipQuestions: [
      'Where does the return actually come from, and how much of it is leverage?',
      'What happens in the downside case, and who bears it?',
      'How did you handle the circularity?',
    ],
  },
  ma_model: {
    id: 'ma_model', label: 'M&A model', disciplines: ['modelling', 'accounting'],
    demonstrates: 'Working through the accounting consequences of a transaction, not just its price.',
    cannotShow: 'Strategic logic. Accretion is arithmetic, and an accretive deal can still be a bad one.',
    ownershipQuestions: [
      'Is this accretive for the right reason or just because of the financing mix?',
      'What did the purchase accounting do to the earnings you are showing?',
    ],
  },
  research_report: {
    id: 'research_report', label: 'Research report', disciplines: ['research', 'writing', 'markets'],
    demonstrates: 'Getting credible on something unfamiliar and showing the working.',
    cannotShow: 'Originality. A well-sourced report can restate consensus accurately.',
    ownershipQuestions: [
      'What in here is not already the consensus view?',
      'Which of your sources would you not rely on again, and why?',
    ],
  },
  published_writing: {
    id: 'published_writing', label: 'Published writing', disciplines: ['writing', 'thesis'],
    demonstrates: 'Putting a view somewhere it can be read back to you, and keeping it up over time.',
    cannotShow: 'Rigour. Publishing rewards being interesting, which is not the same as being right.',
    ownershipQuestions: [
      'Which piece have you since changed your mind about?',
      'What did a reader push back on that you had to concede?',
    ],
  },
  market_map: {
    id: 'market_map', label: 'Market map', disciplines: ['research', 'markets'],
    demonstrates: 'Structuring an unfamiliar sector into segments that hold up.',
    cannotShow: 'Investment judgement. A complete map says nothing about which square is worth owning.',
    ownershipQuestions: [
      'Which of these segments would you actually put money into, and why not the others?',
      'What did you decide was NOT part of this market?',
    ],
  },
  diligence_pack: {
    id: 'diligence_pack', label: 'Diligence work', disciplines: ['diligence', 'accounting', 'risk'],
    demonstrates: 'Checking a claim rather than repeating it, and reporting what did not reconcile.',
    cannotShow: 'Access. Student diligence works from public information, which is a real limit on what it can find.',
    ownershipQuestions: [
      'What did not reconcile, and what did you do about it?',
      'What would you have asked for if you could have asked?',
    ],
  },
  accounting_project: {
    id: 'accounting_project', label: 'Accounting work', disciplines: ['accounting'],
    demonstrates: 'Working where precision is the job and an error is not an opinion.',
    cannotShow: 'Commercial judgement. Correct books do not imply a view on the business.',
    ownershipQuestions: [
      'What did you find that was wrong, and how did you find it?',
      'Which treatment here was a judgement call rather than a rule?',
    ],
  },
  portfolio_record: {
    id: 'portfolio_record', label: 'Portfolio record', disciplines: ['portfolio', 'risk', 'markets'],
    demonstrates: 'Living with decisions after making them, including the ones that went against you.',
    // The most over-read artifact in student finance, so the limit is stated first.
    cannotShow: 'Skill, over a student time horizon. A year of returns is mostly the market and luck, '
      + 'which is why the sizing and the reasoning matter here and the number does not.',
    ownershipQuestions: [
      'What is your worst decision in here, and what did you learn from it?',
      'How did you size this, and what were you protecting against?',
    ],
  },
  macro_credit: {
    id: 'macro_credit', label: 'Macro or credit analysis', disciplines: ['markets', 'risk', 'research'],
    demonstrates: 'Reasoning about things that cannot be modelled precisely and saying so.',
    cannotShow: 'Predictive accuracy, which nobody has at this horizon.',
    ownershipQuestions: [
      'What would falsify this view?',
      'Which part of this is analysis and which part is a guess you are comfortable with?',
    ],
  },
};

export const ARTIFACT_IDS = Object.keys(ARTIFACT_TYPES);

// ── Firm types ────────────────────────────────────────────────────────────────────────
// What each kind of firm actually reads first. `reads` is ordered: the earlier an artifact
// appears, the more it leads. `evaluates` names the judgement the firm is hiring for, which is
// what the assessment should discriminate on rather than the artifact list.
export const FIRM_TYPES = {
  investment_banking: {
    id: 'investment_banking', label: 'Investment banking',
    reads: ['dcf_model', 'ma_model', 'accounting_project', 'lbo_model', 'research_report'],
    evaluates: 'Whether the workbook holds up under someone else opening it at midnight.',
  },
  private_equity: {
    id: 'private_equity', label: 'Private equity',
    reads: ['lbo_model', 'diligence_pack', 'investment_memo', 'dcf_model', 'accounting_project'],
    evaluates: 'Whether they can find the assumption the return actually depends on.',
  },
  venture_capital: {
    id: 'venture_capital', label: 'Venture capital',
    reads: ['market_map', 'investment_memo', 'research_report', 'published_writing', 'stock_pitch'],
    evaluates: 'Whether they can get credible on an unfamiliar market fast and commit to a view.',
  },
  hedge_fund: {
    id: 'hedge_fund', label: 'Hedge fund',
    reads: ['stock_pitch', 'investment_memo', 'portfolio_record', 'macro_credit', 'research_report'],
    evaluates: 'Whether the thesis names its own catalyst and its own way of being wrong.',
  },
  asset_management: {
    id: 'asset_management', label: 'Asset management',
    reads: ['portfolio_record', 'research_report', 'macro_credit', 'stock_pitch', 'investment_memo'],
    evaluates: 'Whether they think in portfolios rather than in individual bets.',
  },
  accounting: {
    id: 'accounting', label: 'Accounting & audit',
    reads: ['accounting_project', 'diligence_pack', 'ma_model', 'research_report'],
    evaluates: 'Whether they treat an unexplained difference as something to resolve rather than round.',
  },
  corporate_finance: {
    id: 'corporate_finance', label: 'Corporate finance',
    reads: ['dcf_model', 'accounting_project', 'research_report', 'portfolio_record'],
    evaluates: 'Whether they can connect a model to a decision somebody has to make.',
  },
};

export const FIRM_IDS = Object.keys(FIRM_TYPES);

export function firmType(id) {
  return FIRM_TYPES[id] || null;
}

// ── Recording one artifact ────────────────────────────────────────────────────────────
// Same reusable path as the technical graph. There is no per-type branch: a type contributes
// its disciplines and its questions, and the shared code does the rest.
export function recordFinanceEvidence(entry = {}) {
  const type = ARTIFACT_TYPES[entry.type];
  if (!type) return { ok: false, reason: `Unknown finance artifact: ${entry.type}.` };
  if (!SOURCES[entry.source]) return { ok: false, reason: `Unknown evidence source: ${entry.source}.` };

  const pointer = entry.pointer || entry.url || null;
  const skills = [...new Set((entry.skills || []).map(s => String(s || '').trim()).filter(Boolean))];
  const subject = String(entry.subject || '').trim();

  // Every finance artifact is about something. A pitch with no company and a memo with no
  // target cannot be checked, and unverifiable evidence is the thing this product exists to
  // stop accepting.
  if (!subject) return { ok: false, reason: 'Name what this is about: the company, sector, or target.' };

  const claims = [];
  const refused = [];
  // One claim per discipline the type touches, plus any named skills, each capped by the source.
  const attach = [...new Set([...type.disciplines.map(d => DISCIPLINES[d]?.label || d), ...skills])];
  for (const label of attach) {
    const result = normaliseEvidence({
      source: entry.source,
      skill: label,
      tier: entry.tier || 'artifact',
      pointer,
      meta: {
        artifact_type: type.id,
        subject,
        disciplines: type.disciplines,
        demonstrates: type.demonstrates,
        cannotShow: type.cannotShow,
        published: Boolean(entry.published),
        defended: Boolean(entry.defended),
        // One memo producing five claims is still one memo.
        entry_id: entry.id || pointer || `${type.id}:${subject}`,
      },
    });
    if (result.ok) claims.push(result.claim); else refused.push({ label, reason: result.reason });
  }

  return {
    ok: claims.length > 0,
    reason: claims.length ? null : (refused[0]?.reason || 'No claim could be recorded.'),
    claims,
    refused,
    questions: type.ownershipQuestions,
    demonstrates: type.demonstrates,
    cannotShow: type.cannotShow,
  };
}

// ── The profile ───────────────────────────────────────────────────────────────────────
// Coverage across disciplines and the artifacts behind each. No composite: the whole point is
// that a firm reads its own subset, and a single number would flatten exactly the differences
// that make one profile right for a fund and wrong for a bank.
export function financeProfile(claims = []) {
  const rows = (claims || []).filter(c => c && c.skill);

  const byDiscipline = {};
  for (const claim of rows) {
    for (const id of claim.evidence_meta?.disciplines || []) {
      (byDiscipline[id] ||= { id, label: DISCIPLINES[id]?.label || id, artifacts: new Set(), best: 'claimed' });
      const d = byDiscipline[id];
      d.artifacts.add(claim.evidence_meta?.artifact_type);
      if (TIERS.indexOf(claim.verification_tier) > TIERS.indexOf(d.best)) d.best = claim.verification_tier;
    }
  }

  // Counted by distinct artifact, never by claim: one memo touching three disciplines is one
  // piece of work, and counting claims would make it look like three.
  const entriesByType = {};
  for (const claim of rows) {
    const t = claim.evidence_meta?.artifact_type;
    if (!t) continue;
    (entriesByType[t] ||= new Set()).add(claim.evidence_meta?.entry_id);
  }
  const artifacts = Object.fromEntries(Object.entries(entriesByType).map(([t, set]) => [t, set.size]));

  const defended = new Set(rows.filter(c => c.evidence_meta?.defended)
    .map(c => c.evidence_meta?.entry_id));

  return {
    version: FINANCE_EVIDENCE_VERSION,
    disciplines: Object.values(byDiscipline)
      .map(d => ({ ...d, artifacts: [...d.artifacts].filter(Boolean), count: d.artifacts.size }))
      .sort((a, b) => b.count - a.count),
    disciplinesCovered: Object.keys(byDiscipline).length,
    disciplinesAvailable: Object.keys(DISCIPLINES).length,
    artifacts,
    artifactCount: Object.values(artifacts).reduce((a, b) => a + b, 0),
    defended: defended.size,
    subjects: [...new Set(rows.map(c => c.evidence_meta?.subject).filter(Boolean))],
    unverified: rows.filter(c => c.verification_tier === 'claimed').length,
  };
}

// ── Reading the same profile as a specific firm ────────────────────────────────────────
// A VC and a hedge fund should not see the same thing first. Nothing is hidden: an artifact a
// firm does not weight still appears under `alsoHas`, it just stops being the headline.
export function emphasisFor(profile, firmId) {
  const firm = FIRM_TYPES[firmId];
  if (!firm) return { firm: null, note: 'No firm type set, so the profile is shown as the student built it.' };

  const held = profile.artifacts || {};
  const leads = firm.reads
    .filter(id => held[id])
    .map(id => ({ type: id, label: ARTIFACT_TYPES[id].label, count: held[id], why: ARTIFACT_TYPES[id].demonstrates }));
  const missing = firm.reads
    .filter(id => !held[id])
    .map(id => ({ type: id, label: ARTIFACT_TYPES[id].label, why: ARTIFACT_TYPES[id].demonstrates }));
  const alsoHas = Object.keys(held)
    .filter(id => !firm.reads.includes(id))
    .map(id => ({ type: id, label: ARTIFACT_TYPES[id].label, count: held[id] }));

  return {
    firm: firm.label,
    evaluates: firm.evaluates,
    leads,
    missing,
    alsoHas,
    // Said plainly, because a reordered profile invites reading absence as a verdict.
    note: leads.length
      ? `Ordered for ${firm.label.toLowerCase()}. Everything else this student has is still below.`
      : `Nothing in this profile is what ${firm.label.toLowerCase()} reads first yet. That is a gap in evidence, not in the person.`,
  };
}

// What to build next, phrased as the next thing to get. A gap with no route attached is a
// rejection with extra words.
export function financeGaps(profile, firmId = null) {
  const gaps = [];
  const held = profile.artifacts || {};

  if (!profile.artifactCount) {
    gaps.push({ key: 'nothing_yet', ask: 'Nothing here yet. One stock pitch with a stated downside is the fastest thing to add.' });
    return gaps;
  }
  if (!profile.defended) {
    gaps.push({ key: 'undefended', ask: 'Nothing has been defended on the record. A model can be downloaded; an account of why you chose the driver cannot.' });
  }
  if (!held.stock_pitch && !held.investment_memo) {
    gaps.push({ key: 'no_view', ask: 'Everything here is analysis without a recommendation. One pitch or memo shows you will commit to a view.' });
  }
  if (!held.dcf_model && !held.lbo_model && !held.ma_model) {
    gaps.push({ key: 'no_model', ask: 'No model yet. One built from scratch, with the assumptions visible, is the standard entry-level ask.' });
  }
  if (profile.disciplinesCovered < 4) {
    gaps.push({ key: 'narrow', ask: `Your work touches ${profile.disciplinesCovered} of ${profile.disciplinesAvailable} disciplines. Risk and diligence are the two most often missing and the most asked about.` });
  }

  const firm = FIRM_TYPES[firmId];
  if (firm) {
    const firstMissing = firm.reads.find(id => !held[id]);
    if (firstMissing) {
      gaps.push({
        key: 'firm_specific',
        ask: `${firm.label} reads ${ARTIFACT_TYPES[firstMissing].label.toLowerCase()} first, and you do not have one yet.`,
      });
    }
  }
  return gaps;
}
