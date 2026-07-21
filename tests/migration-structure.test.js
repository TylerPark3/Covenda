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
const universityMigration = readFileSync(
  new URL('../supabase/migrations/20260721060000_allow_university_partner.sql', import.meta.url),
  'utf8',
).toLowerCase();
const deliveryRepair = readFileSync(
  new URL('../supabase/migrations/20260721172703_harden_submission_delivery.sql', import.meta.url),
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

test('university migration idempotently allows university_partner and the UNI- reference', () => {
  // idempotent drop-then-add so it is safe to re-run on the live table
  assert.match(universityMigration, /drop constraint if exists submissions_type_allowed/);
  assert.match(universityMigration, /drop constraint if exists submissions_reference_format/);
  // all four audiences remain valid
  for (const type of ['employer_intake', 'student_interest', 'call_request', 'university_partner']) {
    assert.match(universityMigration, new RegExp(type));
  }
  // reference format now accepts the UNI- prefix
  assert.match(universityMigration, /\^\(emp\|stu\|call\|uni\)-\[a-z0-9\]\{6,20\}\$/);
  // refreshes the Data API and never loosens access
  assert.match(universityMigration, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(universityMigration, /grant delete/);
  assert.doesNotMatch(universityMigration, /anon|authenticated/);
});

test('delivery repair upgrades an existing inbox without deleting data or exposing browser roles', () => {
  assert.match(deliveryRepair, /create table if not exists public\.submissions/);
  assert.match(deliveryRepair, /add column if not exists submission_type/);
  assert.match(deliveryRepair, /add column if not exists details jsonb/);
  assert.match(deliveryRepair, /create unique index if not exists submissions_reference_unique_idx/);
  assert.match(deliveryRepair, /university_partner/);
  assert.match(deliveryRepair, /grant select, insert, update on table public\.submissions to service_role/);
  assert.match(deliveryRepair, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(deliveryRepair, /drop table|truncate|delete from|grant delete/);
  assert.doesNotMatch(deliveryRepair, /grant [^;]* to (anon|authenticated)/);
});
