import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const intake = readFileSync(new URL('../../api/project-intake.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../../supabase/migrations/20260727400000_brief_engine.sql', import.meta.url), 'utf8');

// Stage 3 is required, not optional: a founder must see and change a brief before it ships.
test('a founder can revise and must approve before a brief ships', () => {
  assert.match(api, /action === 'revise-brief'/);
  assert.match(api, /action === 'approve-brief'/);
  assert.match(ui, /Nothing goes out until you approve it/);
});

test('an edit reopens approval rather than leaving a stale approval standing', () => {
  const revise = api.slice(api.indexOf('export async function reviseBrief'), api.indexOf('export async function approveBrief'));
  assert.match(revise, /brief_approved_at: null/);
});

// A brief edited into uselessness must not ship on the strength of having once passed.
test('approval re-runs the engine instead of trusting the earlier verdict', () => {
  const approve = api.slice(api.indexOf('export async function approveBrief'));
  assert.match(approve, /evaluateBrief\(/);
  assert.match(approve, /verdict\.refusal\.reasons/);
});

test('every revision is versioned and kept with its reason', () => {
  assert.match(api, /brief_version: briefVersion\(history\)/);
  assert.match(api, /brief_revisions: history/);
  assert.match(sql, /brief_revisions jsonb not null default '\[\]'::jsonb/);
  assert.match(sql, /brief_version integer not null default 1/);
});

// Extractive-only is the invariant the whole intake rests on.
test('the diagnosis prompt forbids inventing facts the founder did not give', () => {
  assert.match(intake, /Extractive only\. Never invent a metric, budget, headcount, deadline or customer count/);
});

test('the prompt refuses NDA-dependent inputs at the source, not just in validation', () => {
  assert.match(intake, /NEVER require internal or NDA'd material/);
});

test('thin input asks specific questions instead of guessing', () => {
  assert.match(intake, /needsMore: true/);
  assert.match(intake, /Not enough here to diagnose yet/);
});

// The columns extend member_projects rather than forking a parallel opportunity table.
test('the schema extends member_projects and stays idempotent', () => {
  assert.match(sql, /alter table public\.member_projects/);
  assert.doesNotMatch(sql, /create table (?!if not exists)/);
  assert.match(sql, /notify pgrst, 'reload schema';/);
  assert.match(sql, /not valid/);
});

test('the UI shows the diagnosis and the signals, not just the ask', () => {
  assert.match(ui, /What we think is going on/);
  assert.match(ui, /What this actually tests/);
  // A trait the brief does not test is stated plainly rather than implied.
  assert.match(ui, /This brief does not test it/);
});
