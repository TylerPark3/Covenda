import test from 'node:test';
import assert from 'node:assert/strict';
import { fileFor, hasGeneratedData, SUPPLIED_SLUGS } from '../../api/exercise-files.js';
import { assessmentFor } from '../../api/assessments.js';
import { BATCH_CATALOG } from '../../api/batches.js';

const ex = slug => {
  const b = BATCH_CATALOG.find(x => x.slug === slug);
  return assessmentFor(b.discipline, b.slug)?.exercise;
};

// Two applicants graded on different files are not comparable, and a rater months later has
// to be able to regenerate exactly what the student saw.
test('the same slug always produces a byte-identical file', () => {
  for (const slug of SUPPLIED_SLUGS) {
    assert.equal(fileFor(slug, ex(slug)).body, fileFor(slug, ex(slug)).body, slug);
  }
});

test('every exercise in the catalogue supplies something real', () => {
  for (const b of BATCH_CATALOG) {
    const exercise = ex(b.slug);
    if (!exercise) continue;
    const f = fileFor(b.slug, exercise);
    assert.ok(f && f.body && f.body.length > 120, `${b.slug} supplies nothing usable`);
    assert.ok(f.name && /\.(csv|py|md|json|txt)$/.test(f.name), `${b.slug}: ${f.name}`);
  }
});

// A synthetic file with a cosmetic flaw tests nothing.
test('the ledger discrepancies are actually present', () => {
  const body = fileFor('accounting-audit', ex('accounting-audit')).body;
  const [a, b] = body.split('# LEDGER B');
  assert.ok(a.includes('# LEDGER A'));
  const rowsA = a.trim().split('\n').filter(l => /^E\d/.test(l));
  const rowsB = b.trim().split('\n').filter(l => /^E\d/.test(l));
  const idsA = rowsA.map(r => r.split(',')[0]);
  const idsB = rowsB.map(r => r.split(',')[0]);

  // The row counts deliberately match: a duplicate and a dropped row cancel out, so the
  // discrepancy cannot be found by counting rows. You have to reconcile, which is the task.
  assert.equal(rowsA.length, rowsB.length);
  assert.ok(idsA.some(id => !idsB.includes(id)), 'one entry must be missing from B entirely');
  assert.ok(new Set(idsB).size < idsB.length, 'one entry must be duplicated in B');
  assert.ok(rowsB.some(r => /,-\d/.test(r)), 'one amount must have its sign flipped');
  assert.ok(rowsB.some(r => r.endsWith('.03') || r.includes('2026-07-02')), 'a rounding or timing difference must be present');
});

test('the funnel hides the real loss behind an obvious one', () => {
  const rows = fileFor('growth-performance', ex('growth-performance')).body.trim().split('\n').slice(1).map(r => r.split(','));
  const at = (device, step) => rows.filter(r => r[1] === device && r[2] === step).reduce((n, r) => n + Number(r[3]), 0);
  const mobileAddressLoss = 1 - at('mobile', 'payment') / at('mobile', 'address');
  const desktopAddressLoss = 1 - at('desktop', 'payment') / at('desktop', 'address');
  assert.ok(mobileAddressLoss > desktopAddressLoss + 0.2, 'mobile must lose materially more at address');
});

test('the missing follow-ups are concentrated in the sickest patients', () => {
  const rows = fileFor('health-analytics', ex('health-analytics')).body.trim().split('\n').slice(1).map(r => r.split(','));
  const missingRate = sev => {
    const s = rows.filter(r => Number(r[2]) === sev);
    return s.filter(r => r[4] === '').length / Math.max(1, s.length);
  };
  assert.ok(missingRate(5) > missingRate(1) + 0.4, 'missingness must not be random, that is the exercise');
});

test('nothing supplied is real data', () => {
  for (const b of BATCH_CATALOG) {
    const exercise = ex(b.slug);
    if (!exercise) continue;
    const body = fileFor(b.slug, exercise).body.toLowerCase();
    for (const leak of ['@gmail', '@yahoo', 'ssn', 'medical record number']) {
      assert.ok(!body.includes(leak), `${b.slug} looks like it contains real data: ${leak}`);
    }
  }
});

test('ten exercises hand over generated data; the rest hand over a written brief', () => {
  assert.equal(SUPPLIED_SLUGS.length, 10);
  assert.equal(hasGeneratedData('ai-ml'), true);
  assert.equal(hasGeneratedData('management-consulting'), false);
  const brief = fileFor('management-consulting', ex('management-consulting'));
  assert.match(brief.body, /## What to do/);
  assert.match(brief.body, /synthetic/, 'a brief must still say nothing real is in it');
});
