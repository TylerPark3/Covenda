import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20260721051450_create_submission_inbox.sql', import.meta.url),
  'utf8',
).toLowerCase();
const accessRepair = readFileSync(
  new URL('../supabase/migrations/20260721054507_repair_submission_inbox_access.sql', import.meta.url),
  'utf8',
).toLowerCase();

test('submission migration creates a constrained private operator inbox', () => {
  assert.match(migration, /create table public\.submissions/);
  assert.match(migration, /reference text not null unique/);
  assert.match(migration, /details jsonb not null/);
  assert.match(migration, /constraint submissions_type_allowed check/);
  assert.match(migration, /constraint submissions_consent_required check \(consent = true\)/);
  assert.match(migration, /foreign key \(revision_of\) references public\.submissions\(reference\)/);
});

test('submission migration denies browser roles and limits the server role', () => {
  assert.match(migration, /alter table public\.submissions enable row level security/);
  assert.match(migration, /alter table public\.submissions force row level security/);
  assert.match(migration, /revoke all on table public\.submissions from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.submissions to service_role/);
  assert.doesNotMatch(migration, /grant delete on table public\.submissions/);
  assert.doesNotMatch(migration, /create policy/);
});

test('submission access repair is repeatable and refreshes the Data API schema', () => {
  assert.match(accessRepair, /alter table public\.submissions enable row level security/);
  assert.match(accessRepair, /revoke all on table public\.submissions from public, anon, authenticated/);
  assert.match(accessRepair, /grant usage on schema public to service_role/);
  assert.match(accessRepair, /grant select, insert, update on table public\.submissions to service_role/);
  assert.match(accessRepair, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(accessRepair, /grant delete/);
});
