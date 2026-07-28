/**
 * Covenda compatibility engine — configuration.
 *
 * Every constant here was calibrated against 216 labeled student x project
 * pairings. Do not adjust these to make a test pass. If validation fails,
 * the port is wrong, not the constants.
 *
 * See docs/compatibility-brief/RUBRIC_CONSTANTS.md for provenance.
 */

// Evidence hierarchy. Weight by how independently verified an item is.
const EVIDENCE_WEIGHT = {
  accepted_trial: 1.0, // a real employer already said yes
  verified: 0.8, // deliverable reviewed by Covenda
  assessment: 0.55, // passed Covenda assessment
  resume: 0.38, // real signal, unverified authorship
  self: 0.12, // assume unverified
};

// Domain relevance multiplier.
const RELEVANCE = { direct: 1.0, adjacent: 0.5, unrelated: 0.15 };

// Only the top three evidence items count, with decay. This cap is load
// bearing: it stops a long list of weak self-reported claims from
// out-scoring one accepted trial in the right domain. Do not remove it.
const DECAY = [1.0, 0.55, 0.3];

// Staleness by evidence age in months.
function stalenessFactor(months) {
  if (months > 36) return 0.35;
  if (months > 24) return 0.5;
  return 1.0;
}

// Adjacency is a property of the project, not a symmetric family graph.
// A banker can run a market study, so fin evidence counts toward P004.
// A market researcher cannot build a three-statement model, so P003
// admits finance evidence only. New projects must declare both fields.
const PROJECT_FAMILY = {
  P001: { direct: "ml", adjacent: ["data", "eng"] },
  P002: { direct: "data", adjacent: ["ml", "eng"] },
  P003: { direct: "fin", adjacent: [] },
  P004: { direct: "research", adjacent: ["fin", "growth"] },
  P005: { direct: "growth", adjacent: ["research"] },
  P006: { direct: "eng", adjacent: ["ml", "data"] },
};

const THRESHOLDS = {
  ACCEPT: 0.42, // capability bar
  REPEAT: 0.68, // bar for would-request-again
  NO_DIRECT_FLOOR: 0.6, // bar when no evidence is direct-family
  TIMELINE_HARD: 0.65, // capacity ratio floor
  TIMELINE_SOFT: 1.0, // below this, deadline risk costs the rating
};

// Discrete and ablatable by design. Set to 0 to measure exactly how much
// brand names move scores. Never fold this into an embedding.
const EMPLOYER_NAME_BONUS = 0.03;

// Tier boundaries. Re-tune with scripts/calibrate-thresholds.js, never by hand.
const TIERS = [
  { name: "High fit", min: 0.68 },
  { name: "Moderate fit", min: 0.42 },
  { name: "Exploratory fit", min: 0.3 },
];

// Fields that must never reach the scoring path.
const BANNED_FIELDS = [
  "school",
  "schoolName",
  "university",
  "gpa",
  "clubs",
  "fraternity",
  "affiliations",
  "prestige",
];

export {
  EVIDENCE_WEIGHT,
  RELEVANCE,
  DECAY,
  stalenessFactor,
  PROJECT_FAMILY,
  THRESHOLDS,
  EMPLOYER_NAME_BONUS,
  TIERS,
  BANNED_FIELDS,
};
