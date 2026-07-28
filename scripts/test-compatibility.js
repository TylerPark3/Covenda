/**
 * Required tests for the compatibility engine.
 *
 * These four exist because each one guards a promise Covenda makes out loud.
 * If any of them starts failing, the corresponding claim must come off the
 * website the same day.
 *
 * Run: node scripts/test-compatibility.js
 */

import assert from 'node:assert';
import { scoreMatch } from '../api/compatibility.js';
import * as config from '../api/compatibility.config.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

const baseStudent = {
  id: "T001",
  evidence: "verified:eng:4; assessment:eng:6; resume:eng:9",
  workHistory: [{ employer: "SomeCompany" }],
  availabilityHoursWeek: 12,
  weeksAvailable: 12,
  interestFamilies: ["eng"],
  priorNegative: "",
};

const baseProject = { id: "P006", estimatedHours: 8, deadlineDays: 7 };

console.log("\n=== Compatibility engine tests ===\n");

// 1. Pedigree cannot influence the score. This is the test behind the claim
//    that Covenda scores evidence rather than where someone goes to school.
test("school name invariance", () => {
  const a = scoreMatch({ ...baseStudent, school: "Columbia University", gpa: 4.0 }, baseProject);
  const b = scoreMatch({ ...baseStudent, school: "State Community College", gpa: 2.1 }, baseProject);
  assert.deepStrictEqual(
    JSON.stringify(a),
    JSON.stringify(b),
    "school or GPA changed the output — banned fields are reaching the scoring path"
  );
});

// 2. Employer names are allowed as signal, but their influence must be
//    measurable and removable. Without this test, "verified evidence
//    outweighs brand names" is an unprovable marketing line.
test("employer name contribution is exactly the configured bonus", () => {
  const withEmployer = scoreMatch(baseStudent, baseProject);
  const withoutEmployer = scoreMatch({ ...baseStudent, workHistory: [] }, baseProject);
  const delta =
    withEmployer.internals.score - withoutEmployer.internals.score;
  assert.ok(
    Math.abs(delta - config.EMPLOYER_NAME_BONUS) < 1e-9,
    `expected delta ${config.EMPLOYER_NAME_BONUS}, got ${delta}`
  );
});

// 3. A long list of weak claims must never beat one strong item. This is the
//    top-three decay cap doing its job.
test("breadth of self-reported claims cannot outscore one accepted trial", () => {
  const claimer = scoreMatch(
    {
      ...baseStudent,
      evidence:
        "self:eng:1; self:eng:1; self:eng:1; self:eng:1; self:eng:1; self:eng:1; self:eng:1; self:eng:1",
    },
    baseProject
  );
  const doer = scoreMatch(
    { ...baseStudent, evidence: "accepted_trial:eng:3" },
    baseProject
  );
  assert.ok(
    doer.internals.score > claimer.internals.score,
    "eight self-reported claims outscored an accepted trial — decay cap is broken"
  );
});

// 4. Availability is a scoring factor, never a silent capability verdict.
//    A brilliant student with two hours a week still surfaces, with the
//    timeline risk stated plainly.
test("low availability caps the tier and warns without failing on capability", () => {
  const result = scoreMatch(
    { ...baseStudent, availabilityHoursWeek: 2 },
    baseProject
  );
  assert.strictEqual(result.failing, "timeline", "should fail on timeline, not capability");
  assert.ok(result.timelineWarning, "must surface a timeline warning to the employer");
  assert.notStrictEqual(result.tier, "High fit", "tier should be capped");
  assert.ok(result.tier, "student should still be shown, not silently dropped");
});

// 5. Negative history is not overridden by a strong skills list.
test("prior negative trial caps the tier", () => {
  const result = scoreMatch(
    { ...baseStudent, evidence: "accepted_trial:eng:3; verified:eng:4", priorNegative: "rejected:eng" },
    baseProject
  );
  assert.strictEqual(result.tier, "Exploratory fit");
  assert.strictEqual(result.failing, "history");
});

// 6. Reasons must come from the score, not be written alongside it.
test("reasons cite the actual top-weighted evidence items", () => {
  const result = scoreMatch(baseStudent, baseProject);
  const topKind = result.internals.topItems[0].kind;
  assert.ok(
    result.reasons[0].kind === topKind,
    "first reason does not correspond to the highest-weighted evidence item"
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
