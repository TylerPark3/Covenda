import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20260721051450_create_submission_inbox.sql', import.meta.url),
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
