#!/usr/bin/env node
// Deref scanner — find the crash class that took the site down twice.
//
// Both outages had the same shape: a nested property was read off an object that was
// sometimes absent, and the result was immediately treated as an array.
//
//     verification.signals.map(...)      // verification exists, signals does not -> throws
//     data.batches.forEach(...)          // batches missing on an older payload -> throws
//
// One throw inside a render function blanks the panel, and before buildSection() existed it
// blanked the page. The fix each time was a shape guard — asList(x), Array.isArray(x) ? x : [] —
// never a truthiness check, because `x || []` still throws when x is a non-array truthy value.
//
// WHAT THIS FLAGS
//   A chain of two or more property reads (a.b.c) ending in an array-ish operation
//   (.map .forEach .filter .reduce .some .every .find .flatMap .join .slice .length)
//   where no guard is visible on the same line.
//
// WHAT COUNTS AS A GUARD
//   ?.            optional chaining anywhere in the chain
//   asList(       the repo's own shape guard
//   Array.isArray on the same line
//   || []  ?? []  a defaulted read (weaker, but deliberate — reported at low confidence)
//
// This is deliberately a linter, not a prover. It reads text, not types, so it will miss
// dereferences split across lines and will flag some safe ones. It exits non-zero only on
// HIGH findings so it can gate CI without blocking on judgement calls.
//
// Comments and string literals are stripped before scanning. Three separate tests in this
// repo have false-positived on their own explanatory comment text; that is why.
//
//   node scripts/deref-scan.mjs                 # scan the default set
//   node scripts/deref-scan.mjs portal.js       # scan specific files
//   node scripts/deref-scan.mjs --json          # machine-readable

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const ARRAY_OPS = ['map', 'forEach', 'filter', 'reduce', 'some', 'every', 'find', 'findIndex',
  'flatMap', 'join', 'slice', 'sort', 'concat', 'includes', 'length'];

// Replace comment and string bodies with spaces, preserving offsets so line/column stay true.
export function stripNonCode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code';
  let quote = '';
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { state = 'str'; quote = c; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; i += 1; continue; }
      out += ' '; i += 1; continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; out += '  '; i += 2; continue; }
      out += (c === '\n' ? '\n' : ' '); i += 1; continue;
    }
    // string
    if (c === '\\') { out += '  '; i += 2; continue; }
    if (c === quote) { state = 'code'; out += c; i += 1; continue; }
    out += (c === '\n' ? '\n' : ' '); i += 1; continue;
  }
  return out;
}

const CHAIN = new RegExp(
  // a.b.c.op(   — at least two dots before the operation, no ?. in the chain
  String.raw`\b([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*){1,})\.(${ARRAY_OPS.join('|')})\b`,
  'g');

// Chains rooted at something we know is a literal/namespace are not the crash class.
const SAFE_ROOTS = new Set(['Object', 'Array', 'JSON', 'Math', 'String', 'Number', 'Promise',
  'console', 'process', 'document', 'window', 'globalThis', 'Reflect', 'Date']);

export function scanSource(src, file = '<input>') {
  const code = stripNonCode(src);
  const lines = code.split('\n');
  const raw = src.split('\n');
  const findings = [];
  lines.forEach((line, idx) => {
    CHAIN.lastIndex = 0;
    let m;
    while ((m = CHAIN.exec(line))) {
      const [full, root, mid, op] = m;
      if (SAFE_ROOTS.has(root)) continue;
      if (full.includes('?.')) continue;
      // Guards visible on the same line.
      const guarded =
        line.includes('?.') && line.indexOf('?.') < m.index + full.length ||
        /\basList\s*\(/.test(line) ||
        /Array\.isArray\s*\(/.test(line);
      if (guarded) continue;
      const defaulted = /\|\|\s*\[\]|\?\?\s*\[\]/.test(line);
      const depth = (mid.match(/\./g) || []).length; // dots before the op
      findings.push({
        file,
        line: idx + 1,
        expression: full,
        operation: op,
        depth: depth + 1,
        confidence: defaulted ? 'low' : (depth >= 2 ? 'high' : 'medium'),
        why: defaulted
          ? 'Defaulted with || [] — safe against undefined, still throws if the value is a truthy non-array'
          : `Reads ${depth + 1} levels deep then calls .${op} with no shape guard`,
        source: (raw[idx] || '').trim().slice(0, 160),
      });
    }
  });
  return findings;
}

function jsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) jsFiles(p, acc);
    else if (/\.m?js$/.test(entry)) acc.push(p);
  }
  return acc;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const explicit = args.filter(a => !a.startsWith('--'));
  const targets = explicit.length
    ? explicit.map(f => join(ROOT, f))
    : [join(ROOT, 'portal.js'), join(ROOT, 'admin.js'), join(ROOT, 'server.js'),
       ...jsFiles(join(ROOT, 'api'))];

  const all = [];
  for (const file of targets) {
    let src;
    try { src = readFileSync(file, 'utf8'); } catch { continue; }
    all.push(...scanSource(src, relative(ROOT, file)));
  }

  const high = all.filter(f => f.confidence === 'high');
  const medium = all.filter(f => f.confidence === 'medium');
  const low = all.filter(f => f.confidence === 'low');

  if (json) {
    console.log(JSON.stringify({ high, medium, low, counts: { high: high.length, medium: medium.length, low: low.length } }, null, 2));
    process.exit(high.length ? 1 : 0);
  }

  const show = (label, list) => {
    if (!list.length) return;
    console.log(`\n${label} (${list.length})`);
    for (const f of list) {
      console.log(`  ${f.file}:${f.line}  ${f.expression}`);
      console.log(`      ${f.why}`);
      console.log(`      ${f.source}`);
    }
  };
  show('HIGH — three or more levels, no guard', high);
  show('MEDIUM — two levels, no guard', medium);
  show('LOW — defaulted, still not shape-guarded', low);

  console.log(`\nScanned ${targets.length} files — ${high.length} high, ${medium.length} medium, ${low.length} low.`);
  if (!all.length) console.log('No unguarded nested dereferences found.');
  if (high.length) console.log('\nFix with asList(x) or Array.isArray(x) ? x : [] — not with x || [].');
  process.exit(high.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
