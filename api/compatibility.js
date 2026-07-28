/**
 * Covenda compatibility engine.
 *
 * Scores a student x project pairing and returns a tier, evidence-cited
 * reasons, and one stated uncertainty.
 *
 * This is NOT a machine learning model. It is deterministic arithmetic over
 * hand-calibrated constants. A trained model comes later, once enough real
 * trial outcomes exist. Do not add ML libraries here.
 *
 * Contract: docs/compatibility-brief/SPEC.md
 */

import {
  EVIDENCE_WEIGHT,
  RELEVANCE,
  DECAY,
  stalenessFactor,
  PROJECT_FAMILY,
  THRESHOLDS,
  EMPLOYER_NAME_BONUS,
  TIERS,
  BANNED_FIELDS,
} from './compatibility.config.js';

/**
 * Remove banned fields before anything else touches the student object.
 * These are physically absent from the scoring path, not merely unused,
 * so that "we don't score pedigree" is enforced by the code rather than
 * by discipline.
 */
function sanitizeStudent(student) {
  const clean = {};
  for (const [key, value] of Object.entries(student)) {
    if (!BANNED_FIELDS.includes(key)) clean[key] = value;
  }
  return clean;
}

/** "verified:ml:6; resume:fin:14" -> [{kind, family, monthsOld}, ...] */
function parseEvidence(dsl) {
  if (Array.isArray(dsl)) return dsl;
  if (!dsl) return [];
  return dsl
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [kind, family, months] = chunk.split(":");
      return { kind, family, monthsOld: parseInt(months, 10) || 0 };
    });
}

function relevanceOf(family, projectId) {
  const fam = PROJECT_FAMILY[projectId];
  if (!fam) throw new Error(`Project ${projectId} has no declared family`);
  if (family === fam.direct) return "direct";
  if (fam.adjacent.includes(family)) return "adjacent";
  return "unrelated";
}

/**
 * Weighted top-three sum with decay.
 * Breadth of weak claims must never out-score one strong item.
 */
function evidenceScore(evidence, projectId) {
  const scored = evidence
    .map((item) => ({
      ...item,
      relevance: relevanceOf(item.family, projectId),
      value:
        EVIDENCE_WEIGHT[item.kind] *
        RELEVANCE[relevanceOf(item.family, projectId)] *
        stalenessFactor(item.monthsOld),
    }))
    .sort((a, b) => b.value - a.value);

  const total = scored
    .slice(0, 3)
    .reduce((sum, item, i) => sum + item.value * DECAY[i], 0);

  return { total, scored };
}

function timelineMath(student, project) {
  const weeks = project.deadlineDays / 7;
  const requiredHoursPerWeek = project.estimatedHours / weeks;
  const capacity = student.availabilityHoursWeek * weeks;
  const capacityRatio = capacity / project.estimatedHours;
  const goneBeforeDue = student.weeksAvailable * 7 < project.deadlineDays;
  return { requiredHoursPerWeek, capacityRatio, goneBeforeDue };
}

function hasDirectEvidence(evidence, projectId) {
  return evidence.some((e) => relevanceOf(e.family, projectId) === "direct");
}

function interestAligned(student, projectId) {
  const fam = PROJECT_FAMILY[projectId];
  const allowed = new Set([fam.direct, ...fam.adjacent]);
  return (student.interestFamilies || []).some((f) => allowed.has(f));
}

function hasNegativeHistory(student, projectId) {
  if (!student.priorNegative) return false;
  const [, family] = student.priorNegative.split(":");
  const rel = relevanceOf(family, projectId);
  return rel === "direct" || rel === "adjacent";
}

function readableKind(kind) {
  return {
    accepted_trial: "Accepted Covenda trial",
    verified: "Verified deliverable",
    assessment: "Passed assessment",
    resume: "Work history",
    self: "Self-reported",
  }[kind];
}

function tierFor(score) {
  for (const tier of TIERS) if (score >= tier.min) return tier.name;
  return null; // below floor: not shown
}

function capTier(tier, ceiling) {
  const order = ["Exploratory fit", "Moderate fit", "High fit"];
  if (!tier) return null;
  return order.indexOf(tier) > order.indexOf(ceiling) ? ceiling : tier;
}

/**
 * Score one student against one project.
 *
 * Returns tier + reasons + uncertainty for employer display, and an
 * `internals` block that must never be sent to employer-facing UI.
 */
function scoreMatch(rawStudent, project) {
  const student = sanitizeStudent(rawStudent);
  const evidence = parseEvidence(student.evidence);
  const { total: rubricScore, scored } = evidenceScore(evidence, project.id);

  const employerNameContribution =
    (student.workHistory || []).some((w) => w.employer) ? EMPLOYER_NAME_BONUS : 0;

  let score = rubricScore + employerNameContribution;

  const modifiersApplied = [];
  let failing = "none";
  let timelineWarning = null;
  let tierCeiling = null;

  const { requiredHoursPerWeek, capacityRatio, goneBeforeDue } = timelineMath(
    student,
    project
  );

  // Availability is a scoring factor with a visible warning, never a silent
  // capability verdict. A brilliant student with 2 hrs/week still surfaces;
  // the employer sees the timeline risk plainly instead of being surprised.
  if (goneBeforeDue) {
    modifiersApplied.push("timeline:gone_before_due");
    return {
      tier: null,
      reasons: [],
      uncertainty: {
        capability: null,
        text: "Student is unavailable before this deadline",
      },
      timelineWarning: `Available for ${student.weeksAvailable} more week(s) against a ${project.deadlineDays}-day deadline`,
      failing: "timeline",
      predictedAccepted: false,
      predictedRepeat: false,
      internals: {
        rubricScore,
        employerNameContribution,
        score,
        capacityRatio,
        requiredHoursPerWeek,
        acceptBar: THRESHOLDS.ACCEPT,
        modifiersApplied,
      },
    };
  }

  if (capacityRatio < THRESHOLDS.TIMELINE_SOFT) {
    tierCeiling = "Moderate fit";
    failing = "timeline";
    timelineWarning = `${student.availabilityHoursWeek} hrs/week available against ~${requiredHoursPerWeek.toFixed(1)} hrs/week needed`;
    modifiersApplied.push(
      capacityRatio < THRESHOLDS.TIMELINE_HARD
        ? "timeline:hard_shortfall"
        : "timeline:soft_shortfall"
    );
  }

  // Negative history dominates for similar work. A strong skills list does
  // not override a trial this student already failed to deliver.
  if (hasNegativeHistory(student, project.id)) {
    tierCeiling = "Exploratory fit";
    failing = "history";
    modifiersApplied.push("history:prior_negative");
  }

  // If nothing is direct-family, the domain is unproven and the bar rises.
  // OPEN POLICY QUESTION: whether verified capability should transfer across
  // domains is undecided. Kept as one config value so it can change in one
  // place; suppressions are logged so the call can be made on data later.
  const directPresent = hasDirectEvidence(evidence, project.id);
  const acceptBar = directPresent
    ? THRESHOLDS.ACCEPT
    : THRESHOLDS.NO_DIRECT_FLOOR;
  if (!directPresent) {
    modifiersApplied.push("domain:no_direct_evidence");
    if (score < THRESHOLDS.NO_DIRECT_FLOOR && score >= THRESHOLDS.ACCEPT) {
      modifiersApplied.push("domain:suppressed_by_floor");
    }
  }

  const predictedAccepted = score >= acceptBar;
  let predictedRepeat = score >= THRESHOLDS.REPEAT;

  // Engagement affects the rating, not acceptance. Capable but disengaged
  // students deliver acceptable work and still get a No.
  if (predictedAccepted && predictedRepeat && !interestAligned(student, project.id)) {
    predictedRepeat = false;
    failing = failing === "none" ? "engagement" : failing;
    modifiersApplied.push("engagement:interests_elsewhere");
  }

  if (predictedAccepted && predictedRepeat && capacityRatio < THRESHOLDS.TIMELINE_SOFT) {
    predictedRepeat = false;
  }
  if (predictedAccepted && predictedRepeat && hasNegativeHistory(student, project.id)) {
    predictedRepeat = false;
  }

  if (!predictedAccepted && failing === "none") failing = "capability";

  let tier = tierFor(score);
  if (tierCeiling) tier = capTier(tier, tierCeiling);

  // Reasons are the actual top-weighted contributors. Never write reason
  // text independently of the score: if the two can disagree, employers
  // will eventually catch one, and that is unrecoverable for trust.
  const reasons = scored
    .slice(0, 3)
    .filter((item) => item.value > 0)
    .map((item) => ({
      kind: item.kind,
      family: item.family,
      relevance: item.relevance,
      monthsOld: item.monthsOld,
      text:
        `${readableKind(item.kind)} in ${item.family}` +
        (item.relevance === "direct"
          ? " — directly matches this brief"
          : item.relevance === "adjacent"
            ? " — adjacent to this brief"
            : " — different domain") +
        (item.monthsOld > 24 ? ` (${item.monthsOld} months old)` : ""),
    }));

  // Exactly one uncertainty: the weakest link in the strongest case.
  let uncertainty;
  if (failing === "history") {
    uncertainty = {
      capability: "delivery_history",
      text: "A previous trial in this area was not completed successfully",
    };
  } else if (failing === "timeline") {
    uncertainty = {
      capability: "timeline",
      text: "Capability matches; available hours are tight for this deadline",
    };
  } else if (!directPresent) {
    uncertainty = {
      capability: PROJECT_FAMILY[project.id].direct,
      text: `No verified work yet in ${PROJECT_FAMILY[project.id].direct} specifically`,
    };
  } else if (failing === "engagement") {
    uncertainty = {
      capability: "engagement",
      text: "Stated interests point toward different work",
    };
  } else {
    const weakest = scored.slice(0, 3).pop();
    uncertainty = {
      capability: weakest ? weakest.family : null,
      text: weakest
        ? `Strongest evidence is ${readableKind(weakest.kind).toLowerCase()}; depth beyond that is unproven`
        : "Limited evidence on file",
    };
  }

  return {
    tier,
    reasons,
    uncertainty,
    timelineWarning,
    failing,
    predictedAccepted,
    predictedRepeat,
    internals: {
      rubricScore,
      employerNameContribution,
      score,
      capacityRatio,
      requiredHoursPerWeek,
      directPresent,
      acceptBar,
      topItems: scored.slice(0, 3),
      modifiersApplied,
    },
  };
}

export {
  scoreMatch,
  sanitizeStudent,
  parseEvidence,
  evidenceScore,
  timelineMath,
  relevanceOf,
};
