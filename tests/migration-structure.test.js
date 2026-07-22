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
const operatorFollowUp = readFileSync(
  new URL('../supabase/migrations/20260721225331_add_operator_follow_up_fields.sql', import.meta.url),
  'utf8',
).toLowerCase();
const memberPortal = readFileSync(
  new URL('../supabase/migrations/20260721231522_create_member_portal.sql', import.meta.url),
  'utf8',
).toLowerCase();
const projectMessages = readFileSync(
  new URL('../supabase/migrations/20260722003808_create_project_messages.sql', import.meta.url),
  'utf8',
).toLowerCase();
const projectReview = readFileSync(
  new URL('../supabase/migrations/20260724000000_add_project_review_fields.sql', import.meta.url),
  'utf8',
).toLowerCase();
const profileOnboarding = readFileSync(
  new URL('../supabase/migrations/20260724200000_member_profile_onboarding_fields.sql', import.meta.url),
  'utf8',
).toLowerCase();
const projectTargeting = readFileSync(
  new URL('../supabase/migrations/20260724300000_project_targeting_and_files.sql', import.meta.url),
  'utf8',
).toLowerCase();
const creditLedger = readFileSync(
  new URL('../supabase/migrations/20260725000000_credit_ledger_and_project_credits.sql', import.meta.url),
  'utf8',
).toLowerCase();
const escrowFunctions = readFileSync(
  new URL('../supabase/migrations/20260725100000_escrow_release_functions.sql', import.meta.url),
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
  // all valid intake types remain allowed
  for (const type of ['employer_intake', 'student_interest', 'call_request', 'university_partner', 'student_quick']) {
    assert.match(universityMigration, new RegExp(type));
  }
  // reference format accepts the UNI- and SQ- prefixes
  assert.match(universityMigration, /\^\(emp\|stu\|call\|uni\|sq\)-\[a-z0-9\]\{6,20\}\$/);
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

test('operator follow-up migration adds private bounded workflow fields', () => {
  for (const column of ['internal_note', 'follow_up_at', 'reviewed_by', 'reviewed_at']) {
    assert.match(operatorFollowUp, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(operatorFollowUp, /char_length\(internal_note\) <= 2000/);
  assert.match(operatorFollowUp, /create index if not exists submissions_follow_up_at_idx/);
  assert.match(operatorFollowUp, /revoke all on table public\.submissions from public, anon, authenticated/);
  assert.match(operatorFollowUp, /grant select, insert, update on table public\.submissions to service_role/);
  assert.match(operatorFollowUp, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(operatorFollowUp, /grant delete|create policy|grant [^;]* to (anon|authenticated)/);
});

test('member portal migration creates private role-aware projects and applications', () => {
  assert.match(memberPortal, /create table public\.member_profiles/);
  assert.match(memberPortal, /create table public\.member_projects/);
  assert.match(memberPortal, /create table public\.project_applications/);
  assert.match(memberPortal, /role in \('student', 'company', 'university'\)/);
  assert.match(memberPortal, /alter table public\.member_profiles force row level security/);
  assert.match(memberPortal, /alter table public\.member_projects force row level security/);
  assert.match(memberPortal, /revoke all on table public\.project_applications from public, anon, authenticated/);
  assert.match(memberPortal, /grant select, insert, update, delete on table public\.member_profiles to service_role/);
});

test('project message migration keeps conversations server-only and indexed', () => {
  assert.match(projectMessages, /create table public\.project_messages/);
  assert.match(projectMessages, /references public\.member_projects\(id\) on delete cascade/);
  assert.match(projectMessages, /char_length\(body\) between 1 and 4000/);
  assert.match(projectMessages, /create index project_messages_project_created_idx/);
  assert.match(projectMessages, /create index project_messages_author_idx/);
  assert.match(projectMessages, /alter table public\.project_messages force row level security/);
  assert.match(projectMessages, /revoke all on table public\.project_messages from public, anon, authenticated/);
  assert.match(projectMessages, /grant select, insert on table public\.project_messages to service_role/);
  assert.doesNotMatch(projectMessages, /create policy|grant [^;]* to (anon|authenticated)/);
});

test('project review migration adds close-the-loop fields idempotently without loosening access', () => {
  for (const column of ['deliverable_submitted_at timestamptz', 'review_note text', 'completed_at timestamptz']) {
    assert.match(projectReview, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(projectReview, /char_length\(review_note\) <= 2000/);
  assert.match(projectReview, /create index if not exists member_projects_review_idx/);
  assert.match(projectReview, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(projectReview, /drop table|truncate|delete from|grant delete|create policy|grant [^;]* to (anon|authenticated)/);
});

test('member profile onboarding migration adds matching fields idempotently without loosening access', () => {
  for (const column of ['verticals jsonb', 'work_types jsonb', 'avatar_url text']) {
    assert.match(profileOnboarding, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(profileOnboarding, /jsonb_typeof\(verticals\) = 'array'/);
  assert.match(profileOnboarding, /jsonb_typeof\(work_types\) = 'array'/);
  assert.match(profileOnboarding, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(profileOnboarding, /drop table|truncate|delete from|grant delete|create policy|grant [^;]* to (anon|authenticated)/);
});

test('credit ledger is append-only, guards double payouts, and stays server-only', () => {
  assert.match(creditLedger, /create table if not exists public\.credit_ledger/);
  // signed credits, nullable user_id (platform revenue), and the full entry vocabulary
  for (const entry of ['purchase', 'reach_fee', 'escrow_hold', 'escrow_release', 'platform_fee', 'refund', 'adjustment']) {
    assert.match(creditLedger, new RegExp(`'${entry}'`));
  }
  // a project can only ever be released once / refunded once, enforced by the database
  assert.match(creditLedger, /create unique index if not exists credit_ledger_one_release_per_project[\s\S]*?where entry_type = 'escrow_release'/);
  assert.match(creditLedger, /create unique index if not exists credit_ledger_one_refund_per_project[\s\S]*?where entry_type = 'refund'/);
  for (const column of ['credits_listed integer', 'targeting text', 'credits_held integer', 'platform_fee_credits integer']) {
    assert.match(creditLedger, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(creditLedger, /targeting in \('public', 'targeted'\)/);
  assert.match(creditLedger, /force row level security/);
  assert.match(creditLedger, /revoke all on table public\.credit_ledger from public, anon, authenticated/);
  // append-only: select + insert only, never update or delete
  assert.match(creditLedger, /grant select, insert on table public\.credit_ledger to service_role/);
  assert.doesNotMatch(creditLedger, /grant[^;]*(update|delete)[^;]*on table public\.credit_ledger/);
  assert.doesNotMatch(creditLedger, /create policy|grant [^;]* to (anon|authenticated)/);
});

test('escrow settlement runs in the database so payout and completion commit together', () => {
  for (const fn of ['release_project_escrow', 'refund_project_escrow']) {
    assert.match(escrowFunctions, new RegExp(`create or replace function public\\.${fn}`));
    assert.match(escrowFunctions, new RegExp(`grant execute on function public\\.${fn}\\(uuid, uuid\\) to service_role`));
    assert.match(escrowFunctions, new RegExp(`revoke all on function public\\.${fn}\\(uuid, uuid\\) from public, anon, authenticated`));
  }
  // the row lock is what serializes two concurrent accepts
  assert.match(escrowFunctions, /for update/);
  // ownership and state are re-checked inside the transaction, not just in the API
  assert.match(escrowFunctions, /only the project owner can review a deliverable/);
  assert.match(escrowFunctions, /no submitted deliverable to review/);
  // the student is paid credits_held in full; the fee is booked to the platform (null user)
  assert.match(escrowFunctions, /'escrow_release', proj\.credits_held/);
  assert.match(escrowFunctions, /values \(null, 'platform_fee', proj\.platform_fee_credits/);
  // cancelling returns the whole hold (listed + fee) to the company
  assert.match(escrowFunctions, /coalesce\(proj\.credits_held, 0\) \+ coalesce\(proj\.platform_fee_credits, 0\)/);
  assert.match(escrowFunctions, /security definer/);
  assert.match(escrowFunctions, /set search_path = public, pg_temp/);
  assert.doesNotMatch(escrowFunctions, /grant [^;]* to (anon|authenticated)/);
});

test('project targeting migration adds intake and file columns idempotently without loosening access', () => {
  for (const column of ['verticals jsonb', 'work_types jsonb', 'attachments jsonb', 'ai_brief jsonb', 'problem_text text', 'consult_booked boolean']) {
    assert.match(projectTargeting, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(projectTargeting, /jsonb_typeof\(attachments\) = 'array'/);
  assert.match(projectTargeting, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(projectTargeting, /drop table|truncate|delete from|grant delete|create policy|grant [^;]* to (anon|authenticated)/);
});
