#!/usr/bin/env node
// Bundle migrations into one paste-ready script.
//
// The workflow this replaces: find the new migration files by hand, open each one, copy,
// paste into the Supabase SQL editor, repeat, and hope none were missed. That went wrong
// repeatedly — a migration applied to the wrong project, an index that already existed,
// a file skipped because its timestamp sorted oddly.
//
// Every migration in this repo is idempotent, so the safe default is to emit ALL of them.
// Re-running a migration that already applied is a no-op; running one that never applied
// repairs the schema. That makes "which ones do I still need?" a question you never have
// to answer correctly.
//
//   npm run sql              all migrations (safe default — repairs any project)
//   npm run sql -- --new     only ones added since the last bundle you generated
//   npm run sql -- --last 3  the three most recent
//   npm run sql -- --since 20260726420000_clubs.sql
//
// Output goes to the clipboard AND to a file, and prints what it included.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'migrations');
const migrationsDir = existsSync(dir) ? dir : join(root, 'supabase', 'migrations');
const stateFile = join(root, 'supabase', '.last-bundle');

const argv = process.argv.slice(2);
const flag = name => {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? true);
};

const all = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
if (!all.length) {
  console.error('No migrations found in', migrationsDir);
  process.exit(1);
}

let chosen = all;
let why = `all ${all.length} migrations`;

if (flag('--last')) {
  const n = Math.max(1, parseInt(flag('--last'), 10) || 1);
  chosen = all.slice(-n);
  why = `the last ${chosen.length}`;
} else if (flag('--since')) {
  const marker = String(flag('--since'));
  const i = all.findIndex(f => f === marker || f.startsWith(marker));
  if (i === -1) {
    console.error(`No migration matches "${marker}". Available:\n  ` + all.slice(-8).join('\n  '));
    process.exit(1);
  }
  chosen = all.slice(i + 1);
  why = `everything after ${all[i]}`;
} else if (argv.includes('--new')) {
  const last = existsSync(stateFile) ? readFileSync(stateFile, 'utf8').trim() : '';
  const i = last ? all.indexOf(last) : -1;
  chosen = i === -1 ? all : all.slice(i + 1);
  why = i === -1 ? `all ${all.length} (no previous bundle recorded)` : `everything after ${last}`;
}

if (!chosen.length) {
  console.log('Nothing new since the last bundle. Your schema is already current.');
  process.exit(0);
}

// A bare `create table` cannot be re-run, which defeats the whole point of a safe bundle.
// Refuse to emit one rather than hand over SQL that fails halfway through.
const unsafe = [];
for (const f of chosen) {
  const body = readFileSync(join(migrationsDir, f), 'utf8');
  const bad = body.match(/^create (table|index|unique index) (?!if not exists)/gim);
  if (bad) unsafe.push(`${f} (${bad.length} statement${bad.length === 1 ? '' : 's'})`);
}
if (unsafe.length) {
  console.error('Refusing to bundle — these are not safe to re-run:\n  ' + unsafe.join('\n  '));
  console.error('\nAdd "if not exists" to each, then run again.');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const parts = [
  '-- ══════════════════════════════════════════════════════════════════════',
  `-- Covenda schema bundle · ${stamp}`,
  `-- ${why}`,
  '--',
  '-- Every statement is idempotent: safe to run against a project that already',
  '-- has some or all of this, and safe to run twice. Paste the whole thing into',
  '-- the Supabase SQL editor for the project your Vercel deployment points at',
  '-- (Settings → API → Project URL should match SUPABASE_URL in Vercel).',
  '-- ══════════════════════════════════════════════════════════════════════',
  '',
];
for (const f of chosen) {
  parts.push(`-- ─── ${f} ${'─'.repeat(Math.max(0, 66 - f.length))}`, '');
  parts.push(readFileSync(join(migrationsDir, f), 'utf8').trim(), '');
}
// One reload at the end covers every table the bundle touched.
parts.push("notify pgrst, 'reload schema';", '');
const sql = parts.join('\n');

const outDir = join(root, 'supabase', 'bundles');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `bundle-${new Date().toISOString().slice(0, 10)}.sql`);
writeFileSync(outFile, sql);

let clipped = false;
try {
  execFileSync('pbcopy', { input: sql });
  clipped = true;
} catch { /* not macOS, or no clipboard — the file is still written */ }

const kb = (Buffer.byteLength(sql) / 1024).toFixed(1);
console.log(`\n  ${chosen.length} migration${chosen.length === 1 ? '' : 's'} · ${kb} KB · ${why}\n`);
for (const f of chosen) console.log(`    ${f}`);
console.log(`\n  Written to  ${outFile.replace(root + '/', '')}`);
console.log(clipped ? '  Copied to your clipboard — paste it into the Supabase SQL editor.\n'
                    : '  Could not reach the clipboard; open the file above and copy it.\n');

writeFileSync(stateFile, chosen[chosen.length - 1] + '\n');
