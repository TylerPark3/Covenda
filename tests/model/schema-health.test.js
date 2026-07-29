import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;
const api = readFileSync(root + 'api/admin.js', 'utf8');
const js = readFileSync(root + 'admin.js', 'utf8');
const html = readFileSync(root + 'admin.html', 'utf8');
const block = api.slice(api.indexOf("input.action === 'schema-health'"), api.indexOf("input.action === 'people-directory'"));

// "Did the migration land" was unanswerable without opening the Supabase console, so a missing
// table showed up as a broken feature rather than as a missing table.
test('the operator can check migration state from the admin', () => {
  assert.match(api, /input\.action === 'schema-health'/);
  assert.match(js, /action: 'schema-health'/);
  assert.match(html, /id="adminSchema"/);
  assert.match(js, /renderSchemaHealth\(\)/);
});

// degradedReport only knows about tables already read and failed since boot, which is useless
// straight after a deploy.
test('it probes actively rather than reporting past failures', () => {
  assert.match(block, /select\('\*', \{ count: 'exact', head: true \}\)/);
  assert.ok(!/degradedReport/.test(block), 'a lagging indicator cannot answer this question');
});

// Sending somebody to re-run a migration that already landed is worse than saying nothing.
test('a permission error is not reported as a missing table', () => {
  assert.match(block, /does not exist\|schema cache\|relation/);
  assert.match(block, /error && !missing/);
});

test('every table it checks names the migration and what breaks without it', () => {
  const specs = [...block.matchAll(/\{ table: '([a-z_]+)', migration: '([0-9]+_[a-z_]+)', breaks: '([^']+)'/g)];
  assert.ok(specs.length >= 8, `only ${specs.length} tables checked`);
  const files = readdirSync(root + 'supabase/migrations');
  for (const [, table, migration, breaks] of specs) {
    assert.ok(files.some(f => f.startsWith(migration)), `${table} names migration ${migration}, which does not exist`);
    assert.ok(breaks.length > 10, `${table} does not say what breaks without it`);
  }
});

// One migration usually creates several tables; listing it once per table reads as several
// outstanding migrations.
test('outstanding migrations are deduplicated', () => {
  assert.match(block, /\[\.\.\.new Set\(missing\.map\(m => m\.migration\)\)\]/);
});

test('the summary tells the operator exactly what to run', () => {
  assert.match(block, /Run npm run sql and apply/);
});

// A list of everything that works is noise when the question is what does not.
test('the panel lists only what is missing', () => {
  const render = js.slice(js.indexOf('async function renderSchemaHealth'), js.indexOf('async function renderPeopleDirectory'));
  assert.match(render, /\.filter\(t => t\.missing\)/);
  assert.match(render, /Migrations outstanding/);
  assert.match(render, /Schema up to date/);
});

test('it fails visibly rather than hiding itself', () => {
  const render = js.slice(js.indexOf('async function renderSchemaHealth'), js.indexOf('async function renderPeopleDirectory'));
  assert.match(render, /Could not check the schema/);
  assert.ok(!/catch \{ host\.hidden = true; return; \}/.test(render), 'the panel vanishes on error');
});

// The panel exists to explain the directory below it, so it has to render first.
test('schema health renders above the directory', () => {
  assert.ok(html.indexOf('id="adminSchema"') < html.indexOf('id="adminPeople"'));
  assert.ok(js.indexOf('renderSchemaHealth()') < js.indexOf('renderPeopleDirectory().catch'));
});
