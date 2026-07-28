import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { presentationBand, claimsFromProfile, normaliseEvidence, SOURCES } from '../../api/evidence.js';
import { studentEvidenceTier } from '../../api/portal.js';

// The registry's ceilings governed nothing a company saw, because the band was two hardcoded
// checks that never consulted them.
test('the displayed band now comes from the evidence ladder', () => {
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const fn = api.slice(api.indexOf('export function studentEvidenceTier'), api.indexOf('export function rankOpportunities'));
  assert.match(fn, /presentationBand\(claimsFromProfile/);
  assert.doesNotMatch(fn, /return 'gold'/, 'no hardcoded band remains');
  assert.doesNotMatch(fn, /skill_signals && profile\.skill_signals\.github/);
});

// This is the ceiling that was being ignored, and the one that matters most: belonging to a
// club says nothing about whether someone can do the work.
test('a club confirmation cannot reach the same band as a connected repository', () => {
  assert.equal(studentEvidenceTier({ club_confirmed: true }, 0), 'self_reported');
  assert.equal(studentEvidenceTier({ skill_signals: { github: ['repo'] } }, 0), 'bronze');
});

test('accepted work outranks everything else', () => {
  assert.equal(studentEvidenceTier({}, 1), 'gold');
  assert.equal(studentEvidenceTier({ referral_verified: true }, 0), 'silver');
  assert.equal(studentEvidenceTier({}, 0), 'self_reported');
});

// A student with one accepted trial and nine weak claims has proved something; averaging hides it.
test('the band follows the strongest evidence, never an average', () => {
  const many = claimsFromProfile({ skill_signals: { github: ['a'] }, club_confirmed: true }, { completedCount: 1 });
  assert.equal(presentationBand(many), 'gold');
});

test('a source cannot exceed its own ceiling however it is asked', () => {
  // club_confirmation caps at claimed; asking for 'trial' must not grant it.
  const forced = normaliseEvidence({ source: 'club_confirmation', skill: 'python', tier: 'trial', pointer: 'x' });
  assert.equal(forced.claim.verification_tier, SOURCES.club_confirmation.ceiling);
  assert.notEqual(forced.claim.verification_tier, 'trial');
});

test('reading a raw tier would bypass every ceiling, so it reads the capped one', () => {
  const src = readFileSync(new URL('../../api/evidence.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export function presentationBand'), src.indexOf('export function claimsFromProfile'));
  assert.match(fn, /claim\?\.verification_tier/, 'it reads the tier after the ceiling was applied');
  assert.match(src, /the one thing this file exists to enforce/, 'and the reasoning is recorded above it');
});

test('a refused claim never contributes to the band', () => {
  // normaliseEvidence returns { ok: false } for an unknown source or a missing pointer.
  const bad = normaliseEvidence({ source: 'nonsense', skill: 'x' });
  assert.equal(bad.ok, false);
  assert.equal(presentationBand([bad]), 'self_reported');
});
