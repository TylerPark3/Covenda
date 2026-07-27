// Getting data into the scorer.
//
// api/ml.js can train and evaluate but had no way to be fed anything except live rows from
// the database — which means it could not be tested against a real dataset, tuned offline,
// or evaluated before the 50-outcome gate clears. This is the loader.
//
// ── THE GUARANTEE THIS PROTECTS ───────────────────────────────────────────────────────
// FEATURES contains no protected attributes and no proxies for them, and ml.js says they are
// absent "BY CONSTRUCTION: they are not extracted, so no amount of retraining can smuggle
// them in." A CSV loader is exactly the hole in that argument — hand it a file with a
// `school` or `age` column and the guarantee is gone.
//
// So this module REFUSES contaminated files rather than dropping the offending column
// quietly. Silently ignoring it would train a clean model from a file whose provenance
// nobody checked, and the next person would assume the check happened.
//
// Dependency-free: the CSV parser is here because adding a package for this would be the
// wrong trade for one well-understood format.

import { FEATURES } from './ml.js';

export const ML_DATA_VERSION = 'ml-data-1.0.0';

// Names that are protected attributes, or stand in for them closely enough that a model
// would learn the same thing. Matched loosely — `applicant_school_name` should trip it.
const FORBIDDEN_PATTERNS = [
  /\bschool\b/i, /\buniversity\b/i, /\bcollege\b/i, /\balma[_\s-]?mater\b/i,
  /\bname\b/i, /\bfirst[_\s-]?name\b/i, /\blast[_\s-]?name\b/i, /\bemail\b/i,
  /\bage\b/i, /\bdob\b/i, /\bbirth/i, /\bgender\b/i, /\bsex\b/i,
  /\brace\b/i, /\bethnic/i, /\bnationality\b/i, /\bcitizen/i, /\bvisa\b/i,
  /\bzip\b/i, /\bpostcode\b/i, /\bpostal\b/i, /\bgpa\b/i, /\bsat\b/i, /\bact\b/i,
  /\bgrad(uation)?[_\s-]?year\b/i, /\bphoto\b/i, /\bpronoun/i,
];

// A minimal RFC-4180 reader: quoted fields, escaped quotes, embedded commas and newlines.
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  // A file not ending in a newline still has a final row.
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

export function checkColumns(headers = []) {
  const clean = headers.map(h => String(h || '').trim());
  // Underscore is a word character, so \b never fires inside applicant_school_name or
  // date_of_birth — both slipped through until a test caught it. Separators are
  // normalised to spaces before matching so the boundaries land where a reader expects.
  const normalise = h => String(h).replace(/[_\-.]+/g, ' ').trim();
  const forbidden = clean.filter(h => FORBIDDEN_PATTERNS.some(p => p.test(normalise(h))));
  const missing = FEATURES.filter(f => !clean.includes(f));
  const hasLabel = clean.includes('label') || clean.includes('outcome');
  const extra = clean.filter(h => !FEATURES.includes(h) && h !== 'label' && h !== 'outcome' && h !== 'id');

  const problems = [];
  if (forbidden.length) {
    problems.push(
      `Refusing this file: ${forbidden.join(', ')} ${forbidden.length === 1 ? 'is a protected attribute or a proxy for one' : 'are protected attributes or proxies'}. `
      + 'Remove the column at the source. Dropping it here would train a clean model from a file nobody checked.',
    );
  }
  if (missing.length) problems.push(`Missing feature ${missing.length === 1 ? 'column' : 'columns'}: ${missing.join(', ')}.`);
  if (!hasLabel) problems.push('No label column. Add `label` (1 = shipped and accepted, 0 = not).');

  return { ok: problems.length === 0, forbidden, missing, extra, problems, headers: clean };
}

// Rows the trainer can use, plus an honest account of what was thrown away and why.
export function rowsFromCsv(text) {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return { ok: false, rows: [], problems: ['That file has no data rows.'], skipped: [] };
  }
  const headers = grid[0].map(h => String(h || '').trim());
  const columns = checkColumns(headers);
  if (!columns.ok) return { ok: false, rows: [], skipped: [], ...columns };

  const index = Object.fromEntries(headers.map((h, i) => [h, i]));
  const labelKey = headers.includes('label') ? 'label' : 'outcome';
  const rows = [];
  const skipped = [];

  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    const features = [];
    let bad = null;
    for (const f of FEATURES) {
      const cell = String(raw[index[f]] ?? '').trim();
      const n = Number(cell);
      if (cell === '' || !Number.isFinite(n)) { bad = `${f} is "${cell}"`; break; }
      // Features are 0..1 by contract. Out-of-range means the file was built differently,
      // and silently clamping would hide that.
      if (n < 0 || n > 1) { bad = `${f} is ${n}, outside 0..1`; break; }
      features.push(n);
    }
    const labelCell = String(raw[index[labelKey]] ?? '').trim().toLowerCase();
    const label = ['1', 'true', 'yes', 'accepted'].includes(labelCell) ? 1
      : ['0', 'false', 'no', 'declined', ''].includes(labelCell) ? 0 : null;
    if (label === null) bad = bad || `label is "${labelCell}"`;

    if (bad) { skipped.push({ line: r + 1, reason: bad }); continue; }
    rows.push({ id: String(raw[index.id] ?? `row-${r}`), features, label });
  }

  return { ok: rows.length > 0, rows, skipped, problems: rows.length ? [] : ['No usable rows.'], headers };
}

// Whether a dataset is worth training on at all — separate from the outcome gate in ml.js,
// which asks "do we have enough". This asks "is what we have any use".
export function describeDataset(rows = []) {
  const n = rows.length;
  const positives = rows.filter(r => r.label === 1).length;
  const negatives = n - positives;
  const warnings = [];

  if (n && (positives === 0 || negatives === 0)) {
    warnings.push('Every row has the same label. A model trained on this learns to output one constant.');
  } else if (n) {
    const minority = Math.min(positives, negatives) / n;
    if (minority < 0.1) warnings.push(`Only ${Math.round(minority * 100)}% of rows are the minority class — accuracy will look high and mean nothing.`);
  }

  // A feature that never varies contributes nothing and quietly inflates confidence in the
  // ones that do.
  const constant = [];
  FEATURES.forEach((name, i) => {
    const values = rows.map(r => r.features[i]);
    if (values.length > 1 && values.every(v => v === values[0])) constant.push(name);
  });
  if (constant.length) warnings.push(`Constant across every row, so contributing nothing: ${constant.join(', ')}.`);

  const means = FEATURES.map((_, i) => rows.length
    ? Math.round((rows.reduce((s, r) => s + r.features[i], 0) / rows.length) * 1000) / 1000
    : 0);

  return {
    version: ML_DATA_VERSION,
    rows: n, positives, negatives,
    balance: n ? Math.round((positives / n) * 100) / 100 : 0,
    featureMeans: Object.fromEntries(FEATURES.map((f, i) => [f, means[i]])),
    constantFeatures: constant,
    warnings,
    usable: n > 0 && positives > 0 && negatives > 0,
  };
}

// The header line to hand someone who asks what shape the file should be.
export function csvTemplate() {
  return [...FEATURES, 'label'].join(',') + '\n'
    + FEATURES.map(() => '0.0').join(',') + ',0\n';
}
