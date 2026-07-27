import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/portal.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../portal.js', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/20260727700000_ideal_intern.sql', import.meta.url), 'utf8');

// Traits and skills are different kinds of claim. Merging them would let "self-starter" sit
// beside a verified capability as though the two were comparable.
test('traits and skills are stored separately, never merged', () => {
  assert.match(sql, /ideal_traits jsonb/);
  assert.match(sql, /ideal_skills jsonb/);
  assert.match(ui, /Not testable from an artifact/);
  assert.match(ui, /These can be evidenced/);
});

// A skills list says what to filter on. The memo says what the work is for, which is what
// decides whether a trial discriminates usefully.
test('the memo is required, because a skills list does not scope a trial', () => {
  assert.match(api, /a skills list on its own does not scope a trial/);
});

test('a company can reach out, and the form asks for the terms up front', () => {
  assert.match(ui, /openIntroduction/);
  assert.match(ui, /a number, a range, or “unpaid”\. Not “competitive”\./);
  assert.match(api, /action === 'request-introduction'/);
});

test('the outcome survey is offered where the company is already reflecting', () => {
  assert.match(ui, /openOutcomeSurvey/);
  assert.match(ui, /Tell us how it went/);
  assert.match(api, /action === 'outcome-survey'/);
});

test('only the project owner can describe the role or record an outcome', () => {
  assert.match(api, /Only the company on this project can describe the role/);
  assert.match(api, /Only the company on this project can answer this/);
});
