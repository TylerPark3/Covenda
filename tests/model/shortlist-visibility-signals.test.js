import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiPortal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const apiAdmin = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');

// Comments in this codebase explain what is deliberately NOT sent, so they legitimately contain
// the words these tests forbid in code. Scan behaviour, not prose.
const strip = src => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const apiPortalCode = strip(apiPortal);
const portalCode = strip(portal);

// The Ch. 29.5 visibility gate was added this morning and is correct: a student who has not made
// their profile visible has not agreed to be shown to a company, and an operator proposing them
// does not substitute for that consent.
//
// It created two silences on either side of itself, and this file closes both.
//
//   Company side: an operator proposes three private students, every one is filtered out, and
//   loadCompanyShortlists returns []. The company sees nothing — indistinguishable from "no
//   shortlist has been started". They cannot tell whether to wait or to chase.
//
//   Operator side: they hand-pick five students, write five mandatory rationales, and deliver an
//   empty shortlist. Nothing ever tells them. The gate is on the far side of the system.

// ── The gate itself must not weaken ────────────────────────────────────────────────────
test('the visibility gate is still enforced server-side', () => {
  const fn = apiPortal.slice(apiPortal.indexOf('const studentIds = [...new Set(rows.map'),
                              apiPortal.indexOf('export async function loadIntroductions'));
  assert.match(fn, /\.eq\('portfolio_visibility', 'members'\)/,
    'the query still filters to visible profiles');
  assert.match(fn, /if \(!profile\) continue;/,
    'and a missing profile is omitted entirely, not rendered nameless');
});

// ── Company side ───────────────────────────────────────────────────────────────────────
test('an opportunity with withheld picks still produces a group', () => {
  const fn = apiPortal.slice(apiPortal.indexOf('const studentIds = [...new Set(rows.map'),
                              apiPortal.indexOf('export async function loadIntroductions'));
  assert.match(fn, /for \(const id of ids\) if \(!grouped\.has\(id\) && rows\.some\(r => r\.opportunity_id === id\)\) grouped\.set\(id, \[\]\);/,
    'so "nobody picked yet" and "every pick withheld" are no longer the same void');
});

// The count must NOT travel. "2 candidates withheld" tells the company that two specific people
// were shortlisted, which is exactly what the gate exists to withhold.
test('the withheld count never reaches the company', () => {
  const fn = apiPortalCode.slice(apiPortalCode.indexOf('const studentIds = [...new Set(rows.map'),
                                  apiPortalCode.indexOf('export async function loadIntroductions'));
  assert.doesNotMatch(fn, /withheld|hiddenCount|filteredCount|suppressed/i,
    'no count, flag, or hint about what was removed is returned to the company');
});

test('the empty shortlist reads identically however it got empty', () => {
  const fn = portalCode.slice(portalCode.indexOf('function shortlistSection('), portalCode.indexOf('function shortlistCard('));
  assert.match(fn, /: 'Being prepared\./, 'an empty shortlist says something rather than nothing');
  // One branch, one sentence. Any wording that varied by cause would leak the cause.
  assert.doesNotMatch(fn, /withheld|private|not visible|hidden/i,
    'the empty-state copy cannot hint at why it is empty');
  assert.match(fn, /const candidates=asList\(list\.candidates\);/,
    'shape-guarded, since a malformed payload here would kill the company dashboard');
});

// ── Operator side ──────────────────────────────────────────────────────────────────────
test('the operator is told when a proposal will not reach the company', () => {
  const fn = apiAdmin.slice(apiAdmin.indexOf('export async function decideMatch'),
                            apiAdmin.indexOf('// Operator project management'));
  assert.match(fn, /withheldFromCompany: withheld/, 'the response carries the fact');
  assert.match(fn, /withheldReason/, 'and says why in words the operator can act on');
  assert.match(fn, /\.select\('portfolio_visibility'\)/, 'read from the student\'s own setting');
  // Only on propose. Rejecting or selecting a private student is not a delivery surprise.
  assert.match(fn, /decision === 'proposed' && data\?\.student_user_id/);
});

// The decision must still be recorded. Withholding delivery is not withholding the audit trail:
// those rationales are the training labels the whole matching thesis depends on.
test('a withheld pick is still recorded and still auditable', () => {
  const fn = apiAdmin.slice(apiAdmin.indexOf('export async function decideMatch'),
                            apiAdmin.indexOf('// Operator project management'));
  const update = fn.indexOf('.update({ human_decision: decision');
  const check = fn.indexOf('let withheld = false;');
  assert.notEqual(update, -1, 'the decision is written');
  assert.ok(update < check, 'and written BEFORE the visibility check, so it is never conditional on it');
  assert.match(fn, /Your decision is recorded either way/,
    'and the operator is told that explicitly');
});

// A default of 'members' would silently mark private students as deliverable, which is the
// failure this whole gate exists to prevent.
test('an absent visibility setting is treated as private', () => {
  const fn = apiAdmin.slice(apiAdmin.indexOf('export async function decideMatch'),
                            apiAdmin.indexOf('// Operator project management'));
  assert.match(fn, /\(p\?\.portfolio_visibility \|\| 'private'\) !== 'members'/,
    'missing or null defaults to private, never to visible');
});
