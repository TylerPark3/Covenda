import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');

// Tables added after launch. On any deployment where the migration has not been applied, a
// READ of one of these must degrade. It must never take the portal down: a student's projects,
// batches and wallet have nothing to do with whether the newest table exists.
//
// This has now broken production three times in the same shape, which is why it is a test and
// not a note. The most recent: loadTechnicalEvidence used checked(), and every student got
// PORTAL_SCHEMA_MISSING until the migration was run.
const POST_LAUNCH_TABLES = [
  'technical_evidence',
  'company_evidence_requests',
  'simulation_runs',
  'people_directory',
];

test('every read of a post-launch table degrades instead of throwing', () => {
  for (const table of POST_LAUNCH_TABLES) {
    const reads = [...api.matchAll(new RegExp(`(\\w+)\\(member\\.supabase\\s*\\.?\\s*\\n?\\s*\\.from\\('${table}'\\)\\s*\\n?\\s*\\.select`, 'g'))];
    for (const [, helper] of reads) {
      assert.equal(helper, 'optional', `a select on ${table} uses ${helper}(), which throws and takes the portal with it`);
    }
  }
});

// A read degrading silently is how a missing table goes unnoticed for a week. Each one is
// labelled so degradedReport() can name it in the operator health view.
test('a degraded read is labelled so an operator can see which table is missing', () => {
  for (const table of POST_LAUNCH_TABLES) {
    if (!api.includes(`.from('${table}')`)) continue;
    if (!new RegExp(`optional\\([^;]*?\\.from\\('${table}'\\)`, 's').test(api)) continue;
    assert.match(api, new RegExp(`optional\\([^;]*?\\.from\\('${table}'\\)[^;]*?'${table}'`, 's'),
      `the optional read of ${table} passes no label, so degradedReport cannot name it`);
  }
});

// A write is the opposite case. The user is actively trying to save, and silently returning
// an empty result would tell them it worked.
test('a write to a missing table fails loudly and says why', () => {
  for (const fn of ['saveTechnicalEvidence', 'saveEvidenceRequest']) {
    const body = api.slice(api.indexOf(`export async function ${fn}`));
    const insert = body.slice(0, body.indexOf('\n}\n'));
    assert.match(insert, /checked\(/, `${fn} must not swallow a failed insert`);
    assert.match(insert, /migration may not be applied yet/, `${fn} does not say why the save failed`);
  }
});

test('the degrade helper reports once per table, not once per request', () => {
  const note = api.slice(api.indexOf('function noteDegraded'), api.indexOf('export function degradedReport'));
  assert.match(note, /if \(reported\.has\(label\)\) return;/, 'a row per skipped read would bury the signal in its own noise');
  assert.match(note, /catch\(\(\) =>/, 'recording a degradation must never degrade anything further');
});
