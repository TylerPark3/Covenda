/**
 * Validate the compatibility engine against the 216-row calibration dataset.
 *
 * Bar: >= 80% overall agreement. The reference implementation agrees with
 * Tyler's hand-written anchors 83% of the time.
 *
 * If this fails, the port is wrong. Debug the port. Do NOT retune constants
 * to force a pass — that silently destroys the calibration.
 *
 * Usage: node scripts/validate-against-calibration.js [path/to/dataset.csv]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname has no ESM equivalent; derived from import.meta.url instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { scoreMatch } from '../api/compatibility.js';

const CSV =
  process.argv[2] ||
  path.join(__dirname, "..", "data", "calibration_dataset.csv");

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// The CSV stores interests as prose; the engine wants families. This mapping
// mirrors FAMILY_OF_DOMAIN in the original generator.
const DOMAIN_FAMILY = {
  "AI/ML": "ml", "ML Research": "ml", "AI/Data": "ml", "Physical AI": "ml",
  "Infrastructure/Data": "data", "Data/Research": "data", "Health Analytics": "data",
  "Supply Chain": "data", "Operations": "data",
  "Product Engineering": "eng", "Full Stack": "eng", "Security": "eng",
  "Technical Writing": "eng",
  "Finance": "fin", "Accounting/Finance": "fin", "Accounting/Audit": "fin",
  "Finance/Research": "fin", "Venture Capital": "fin",
  "Strategy/Research": "research", "Strategy/Consulting": "research",
  "Generalist": "research", "Cross-functional": "research", "Legal Operations": "research",
  "Growth/Brand": "growth", "Growth": "growth", "Ecommerce/Growth": "growth",
  "Content/Brand": "growth", "UX/Product": "growth",
};

function toStudent(row) {
  return {
    id: row.student_id,
    name: row.student_name,
    evidence: row.evidence_dsl,
    workHistory: (row.work_history || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ employer: s.split(" - ")[1] || null })),
    availabilityHoursWeek: parseFloat(row.availability_hours_week),
    weeksAvailable: parseFloat(row.weeks_available),
    interestFamilies: inferInterestFamilies(row),
    priorNegative: row.prior_negative || "",
  };
}

function inferInterestFamilies(row) {
  const fams = new Set();
  const primary = DOMAIN_FAMILY[row.primary_domain];
  if (primary) fams.add(primary);
  for (const [domain, fam] of Object.entries(DOMAIN_FAMILY)) {
    if ((row.interests || "").toLowerCase().includes(domain.toLowerCase())) fams.add(fam);
  }
  return [...fams];
}

function toProject(row) {
  return {
    id: row.project_id,
    estimatedHours: parseFloat(row.estimated_hours),
    deadlineDays: parseFloat(row.deadline_days),
  };
}

const rows = parseCSV(fs.readFileSync(CSV, "utf8"));
let agree = 0, total = 0, anchorAgree = 0, anchorTotal = 0;
const disagreements = [];

for (const row of rows) {
  const result = scoreMatch(toStudent(row), toProject(row));
  const expectedAccepted = row.accepted === "1";
  const match = result.predictedAccepted === expectedAccepted;

  total++;
  if (match) agree++;
  if (row.label_source === "human_anchor") {
    anchorTotal++;
    if (match) anchorAgree++;
  }
  if (!match) {
    disagreements.push({
      student: `${row.student_id} ${row.student_name}`,
      project: row.project_id,
      expected: expectedAccepted ? "accepted" : "rejected",
      got: result.predictedAccepted ? "accepted" : "rejected",
      score: result.internals.score.toFixed(3),
      bar: result.internals.acceptBar,
      failing: result.failing,
      source: row.label_source,
      csvRationale: row.rationale,
      modifiers: result.internals.modifiersApplied.join(", "),
    });
  }
}

const pct = (n, d) => ((n / d) * 100).toFixed(1);

console.log("\n=== Covenda compatibility engine — calibration validation ===\n");
console.log(`Overall agreement:      ${agree}/${total}  (${pct(agree, total)}%)`);
console.log(`Human-anchor agreement: ${anchorAgree}/${anchorTotal}  (${pct(anchorAgree, anchorTotal)}%)`);
console.log(`\nBar: 80% overall. ${agree / total >= 0.8 ? "PASS" : "FAIL — debug the port, do not retune constants."}`);

if (disagreements.length) {
  console.log(`\n--- ${disagreements.length} disagreements ---\n`);
  for (const d of disagreements) {
    console.log(`${d.student} x ${d.project} [${d.source}]`);
    console.log(`  expected ${d.expected}, got ${d.got}  (score ${d.score} vs bar ${d.bar}, failing: ${d.failing})`);
    console.log(`  csv said: ${d.csvRationale}`);
    if (d.modifiers) console.log(`  modifiers: ${d.modifiers}`);
    console.log();
  }
  console.log("Expected disagreements: rows where the CSV hard-failed low-capacity");
  console.log("students. Current policy shows them with a capped tier and a timeline");
  console.log("warning instead. Those are intentional, not port errors.\n");
}
