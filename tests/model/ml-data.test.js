import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, checkColumns, rowsFromCsv, describeDataset, csvTemplate } from '../../api/ml-data.js';
import { FEATURES, fitScorerModel, trainingReadiness } from '../../api/ml.js';

const header = [...FEATURES, 'label'].join(',');
const row = (v, label) => FEATURES.map(() => v).join(',') + ',' + label;
const csv = (...lines) => [header, ...lines].join('\n');

// ── The guarantee ─────────────────────────────────────────────────────────────────────
// ml.js claims protected attributes cannot be smuggled in "by construction". A CSV loader
// is precisely the hole in that argument, so it refuses rather than quietly dropping.
test('a file carrying a protected attribute is refused, not silently cleaned', () => {
  const bad = 'school,' + header + '\nColumbia,' + row(0.5, 1);
  const r = rowsFromCsv(bad);
  assert.equal(r.ok, false);
  assert.deepEqual(r.forbidden, ['school']);
  assert.match(r.problems.join(' '), /Remove the column at the source/);
  assert.equal(r.rows.length, 0, 'nothing is trained from a refused file');
});

test('proxies are caught too, including prefixed column names', () => {
  for (const col of ['applicant_school_name', 'gpa', 'grad_year', 'zip', 'ethnicity', 'date_of_birth']) {
    const r = checkColumns([col, ...FEATURES, 'label']);
    assert.equal(r.ok, false, col);
    assert.ok(r.forbidden.length, col);
  }
});

test('a clean file with every feature and a label is accepted', () => {
  const r = rowsFromCsv(csv(row(0.5, 1), row(0.2, 0)));
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].features.length, FEATURES.length);
});

// ── Parsing ───────────────────────────────────────────────────────────────────────────
test('quoted fields, escaped quotes and embedded commas survive', () => {
  const grid = parseCsv('a,b\n"x,1","he said ""hi"""');
  assert.deepEqual(grid[1], ['x,1', 'he said "hi"']);
});

test('a file with no trailing newline keeps its last row', () => {
  assert.equal(parseCsv('a,b\n1,2').length, 2);
});

// ── Bad data is reported, never guessed at ────────────────────────────────────────────
test('an out-of-range feature is skipped with the line and the reason', () => {
  const r = rowsFromCsv(csv(row(0.5, 1), row(7, 0)));
  assert.equal(r.rows.length, 1);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0].reason, /outside 0\.\.1/);
  assert.equal(r.skipped[0].line, 3);
});

test('a missing feature column is named rather than defaulted to zero', () => {
  const short = FEATURES.slice(0, 3).join(',') + ',label\n0.1,0.1,0.1,1';
  const r = rowsFromCsv(short);
  assert.equal(r.ok, false);
  assert.ok(r.missing.length > 0);
  assert.match(r.problems.join(' '), /Missing feature/);
});

test('a file with no label column says what to add', () => {
  const r = rowsFromCsv(FEATURES.join(',') + '\n' + FEATURES.map(() => '0.5').join(','));
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /1 = shipped and accepted/);
});

test('common label spellings are accepted', () => {
  const r = rowsFromCsv(csv(row(0.5, 'yes'), row(0.5, 'true'), row(0.5, 'declined')));
  assert.deepEqual(r.rows.map(x => x.label), [1, 1, 0]);
});

// ── Is the data any use ───────────────────────────────────────────────────────────────
test('a single-label dataset is called out — it can only learn a constant', () => {
  const { rows } = rowsFromCsv(csv(row(0.5, 1), row(0.6, 1), row(0.7, 1)));
  const d = describeDataset(rows);
  assert.equal(d.usable, false);
  assert.match(d.warnings.join(' '), /learns to output one constant/);
});

test('a lopsided dataset warns that accuracy will flatter it', () => {
  const rows = rowsFromCsv(csv(...Array.from({ length: 19 }, () => row(0.4, 0)), row(0.9, 1))).rows;
  const d = describeDataset(rows);
  assert.match(d.warnings.join(' '), /accuracy will look high and mean nothing/);
});

test('a feature that never varies is named as contributing nothing', () => {
  const rows = rowsFromCsv(csv(row(0.5, 1), row(0.5, 0))).rows;
  const d = describeDataset(rows);
  assert.equal(d.constantFeatures.length, FEATURES.length);
  assert.match(d.warnings.join(' '), /contributing nothing/);
});

test('a balanced dataset reports means and no warnings', () => {
  const lines = [];
  for (let i = 0; i < 10; i++) lines.push(row(0.8, 1), row(0.2, 0));
  const d = describeDataset(rowsFromCsv(csv(...lines)).rows);
  assert.equal(d.usable, true);
  assert.equal(d.balance, 0.5);
  assert.equal(d.warnings.length, 0);
  assert.equal(d.featureMeans[FEATURES[0]], 0.5);
});

// ── The gate still holds ──────────────────────────────────────────────────────────────
// Loading a CSV must not become a way around the 50-outcome rule.
test('a small CSV still cannot train a model', () => {
  const { rows } = rowsFromCsv(csv(row(0.9, 1), row(0.1, 0)));
  const fit = fitScorerModel(rows);
  assert.equal(fit.ready, false);
  assert.equal(fit.model, null);
  assert.match(fit.reason, /completed outcomes/);
  assert.ok(trainingReadiness(rows));
});

test('the template names exactly the columns the loader wants', () => {
  const r = rowsFromCsv(csvTemplate());
  assert.equal(r.ok, true, 'the template must itself load');
  assert.equal(r.rows.length, 1);
});
