/**
 * Tier threshold calibration sweep.
 *
 * Reports the share of positive labels inside each tier. The point is to
 * confirm that "High fit" carries a materially higher label rate than
 * "Moderate fit" — if it does not, the tiers are decorative and an employer
 * who trusts them will be misled.
 *
 * Reports only. Never writes config. Threshold changes are a human decision.
 *
 * Usage: node scripts/calibrate-thresholds.js [path/to/dataset.csv]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname has no ESM equivalent; derived from import.meta.url instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { scoreMatch } from '../api/compatibility.js';

const CSV =
  process.argv[2] || path.join(__dirname, "..", "data", "calibration_dataset.csv");

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
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
  return rows.filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const DOMAIN_FAMILY = {
  "AI/ML": "ml", "ML Research": "ml", "AI/Data": "ml", "Physical AI": "ml",
  "Infrastructure/Data": "data", "Data/Research": "data", "Health Analytics": "data",
  "Supply Chain": "data", "Operations": "data",
  "Product Engineering": "eng", "Full Stack": "eng", "Security": "eng", "Technical Writing": "eng",
  "Finance": "fin", "Accounting/Finance": "fin", "Accounting/Audit": "fin",
  "Finance/Research": "fin", "Venture Capital": "fin",
  "Strategy/Research": "research", "Strategy/Consulting": "research",
  "Generalist": "research", "Cross-functional": "research", "Legal Operations": "research",
  "Growth/Brand": "growth", "Growth": "growth", "Ecommerce/Growth": "growth",
  "Content/Brand": "growth", "UX/Product": "growth",
};

function toStudent(row) {
  const fams = new Set();
  const primary = DOMAIN_FAMILY[row.primary_domain];
  if (primary) fams.add(primary);
  for (const [d, f] of Object.entries(DOMAIN_FAMILY)) {
    if ((row.interests || "").toLowerCase().includes(d.toLowerCase())) fams.add(f);
  }
  return {
    id: row.student_id,
    evidence: row.evidence_dsl,
    workHistory: (row.work_history || "").split(";").map((s) => s.trim()).filter(Boolean)
      .map((s) => ({ employer: s.split(" - ")[1] || null })),
    availabilityHoursWeek: parseFloat(row.availability_hours_week),
    weeksAvailable: parseFloat(row.weeks_available),
    interestFamilies: [...fams],
    priorNegative: row.prior_negative || "",
  };
}

const rows = parseCSV(fs.readFileSync(CSV, "utf8"));
const scored = rows.map((row) => {
  const r = scoreMatch(toStudent(row), {
    id: row.project_id,
    estimatedHours: parseFloat(row.estimated_hours),
    deadlineDays: parseFloat(row.deadline_days),
  });
  return {
    score: r.internals.score,
    tier: r.tier,
    // positive label = accepted AND would request again
    label: row.accepted === "1" && row.would_request_again === "1" ? 1 : 0,
  };
});

console.log("\n=== Tier calibration ===\n");
console.log("Label = accepted AND would-request-again\n");

const tiers = ["High fit", "Moderate fit", "Exploratory fit", null];
for (const tier of tiers) {
  const inTier = scored.filter((s) => s.tier === tier);
  if (!inTier.length) continue;
  const positives = inTier.filter((s) => s.label === 1).length;
  const rate = ((positives / inTier.length) * 100).toFixed(1);
  const name = tier || "(not shown)";
  console.log(`${name.padEnd(18)} n=${String(inTier.length).padStart(3)}   positive rate ${rate.padStart(5)}%`);
}

console.log("\n--- Threshold sweep for the High-fit boundary ---\n");
for (let t = 0.5; t <= 1.0; t += 0.05) {
  const above = scored.filter((s) => s.score >= t);
  if (!above.length) continue;
  const rate = ((above.filter((s) => s.label === 1).length / above.length) * 100).toFixed(1);
  console.log(`  >= ${t.toFixed(2)}   n=${String(above.length).padStart(3)}   positive rate ${rate.padStart(5)}%`);
}

console.log(
  "\nWhat good looks like: positive rate rises monotonically as the boundary\n" +
  "rises, and High fit is well clear of Moderate. A flat curve means the score\n" +
  "is not separating outcomes and the tiers should not be shown to employers.\n"
);
