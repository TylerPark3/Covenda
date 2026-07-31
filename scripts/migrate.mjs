#!/usr/bin/env node
// Apply migrations straight to the database, instead of pasting into the SQL editor.
//
// `npm run sql` bundles migrations to the clipboard, which still needs a human to open a
// browser tab and paste. This runs them. It exists because the paste step is where a schema
// silently falls behind the code: the deploy ships, the table is not there, and the only
// symptom is a read that quietly returns nothing because it was written with optional().
//
//   npm run migrate              every migration, oldest first (safe: all are idempotent)
//   npm run migrate -- --last 1  only the most recent
//   npm run migrate -- --file 20260730100000_coursework.sql
//   npm run migrate -- --dry     list what would run, connect to nothing
//
// ── WHY RUNNING ALL OF THEM IS THE SAFE DEFAULT ────────────────────────────────────────
// Every migration in this repo is idempotent: `create table if not exists`, `add column if
// not exists`, `drop policy if exists` before each `create policy`. Re-running one that
// already applied is a no-op, and running one that never applied repairs the schema. So the
// question "which ones do I still need?" is one you never have to answer correctly.
//
// ── WHAT IT WILL NOT DO ────────────────────────────────────────────────────────────────
// It never prints the connection string, and it never takes one as an argument, where it
// would land in shell history. It reads POSTGRES_URL_NON_POOLING (the direct connection,
// not the pooler, because DDL on a pooled connection can be routed mid-transaction) from the
// environment or .env.local, and reports only the host with the project ref masked.
import postgres from 'postgres';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');

const argv = process.argv.slice(2);
const flag = name => {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? true);
};

// .env.local only fills gaps; a real environment variable always wins, so CI cannot be
// overridden by a stale file someone left in the working tree.
const envFile = join(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const i = trimmed.indexOf('=');
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

let files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
const only = flag('--file');
const last = flag('--last');
if (typeof only === 'string') {
  files = files.filter(f => f === only || f === `${only}.sql`);
  if (!files.length) { console.error(`No migration named ${only}`); process.exit(1); }
} else if (last) {
  files = files.slice(-Number(last));
}

console.log(`\n  ${files.length} migration${files.length === 1 ? '' : 's'} to apply:\n`);
for (const f of files) console.log(`    ${f}`);

if (flag('--dry')) { console.log('\n  --dry: nothing was run.\n'); process.exit(0); }

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
// A placeholder is not a connection string. Caught explicitly because the failure it produces
// otherwise is an "Invalid URL" with the value redacted, which reads as a bug in this script.
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error('\n  No usable POSTGRES_URL_NON_POOLING found.'
    + '\n  Set it in .env.local or the environment, or paste supabase/bundles/ into the SQL editor instead.\n');
  process.exit(1);
}

let host = '(unknown)';
try { host = new URL(url).host.replace(/^[^.]+/, '***'); } catch { /* reported as unknown */ }
console.log(`\n  Applying to ${host}\n`);

const sql = postgres(url, {
  max: 1,
  ssl: 'require',
  // `notify pgrst, 'reload schema'` at the foot of every migration arrives as a notice. It is
  // the migration working, so it is shown rather than swallowed.
  onnotice: n => console.log(`    notice: ${n.message}`),
});

let failed = null;
for (const file of files) {
  const text = readFileSync(join(migrationsDir, file), 'utf8');
  try {
    // One transaction per file, so a failure halfway through leaves that migration unapplied
    // rather than half-applied. Files already applied are no-ops and commit instantly.
    await sql.begin(tx => tx.unsafe(text));
    console.log(`  ✓ ${file}`);
  } catch (error) {
    console.error(`  ✗ ${file}\n    ${error.message}`);
    failed = file;
    break; // Later migrations may depend on this one, so continuing would cascade errors.
  }
}

await sql.end();
if (failed) {
  console.error(`\n  Stopped at ${failed}. Nothing after it was run.\n`);
  process.exit(1);
}
console.log(`\n  Done. ${files.length} applied.\n`);
