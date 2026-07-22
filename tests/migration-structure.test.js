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
const applicationReview = readFileSync(
  new URL('../supabase/migrations/20260722014120_review_project_applications.sql', import.meta.url),
  'utf8',
).toLowerCase();
const projectMilestones = readFileSync(
  new URL('../supabase/migrations/20260722031619_create_project_milestones.sql', import.meta.url),
  'utf8',
).toLowerCase();
const projectDeliverables = readFileSync(
  new URL('../supabase/migrations/20260722041319_create_project_deliverables.sql', import.meta.url),
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

test('application review migration creates an atomic server-only matching operation', () => {
  assert.match(applicationReview, /create or replace function public\.review_project_application/);
  assert.match(applicationReview, /security invoker/);
  assert.match(applicationReview, /set search_path = ''/);
  assert.match(applicationReview, /for update/);
  assert.match(applicationReview, /assigned_student_user_id = v_application\.student_user_id/);
  assert.match(applicationReview, /status = 'matched'/);
  assert.match(applicationReview, /status = 'declined'/);
  assert.match(applicationReview, /revoke all on function public\.review_project_application\(uuid, uuid, text\) from public, anon, authenticated/);
  assert.match(applicationReview, /grant execute on function public\.review_project_application\(uuid, uuid, text\) to service_role/);
  assert.doesNotMatch(applicationReview, /security definer|grant [^;]* to (anon|authenticated)/);
});

test('project milestone migration creates a constrained server-only delivery plan', () => {
  assert.match(projectMilestones, /create table if not exists public\.project_milestones/);
  assert.match(projectMilestones, /references public\.member_projects\(id\) on delete cascade/);
  assert.match(projectMilestones, /status in \('planned', 'in_progress', 'blocked', 'complete'\)/);
  assert.match(projectMilestones, /project_milestones_completion_consistent/);
  assert.match(projectMilestones, /create index if not exists project_milestones_project_position_idx/);
  assert.match(projectMilestones, /alter table public\.project_milestones force row level security/);
  assert.match(projectMilestones, /revoke all on table public\.project_milestones from public, anon, authenticated/);
  assert.match(projectMilestones, /revoke delete on table public\.project_milestones from service_role/);
  assert.match(projectMilestones, /grant select, insert, update on table public\.project_milestones to service_role/);
  assert.doesNotMatch(projectMilestones, /grant delete|create policy|grant [^;]* to (anon|authenticated)/);
});

test('project deliverable migration creates versioned server-only evidence review', () => {
  assert.match(projectDeliverables, /create table if not exists public\.project_deliverables/);
  assert.match(projectDeliverables, /references public\.member_projects\(id\) on delete cascade/);
  assert.match(projectDeliverables, /references public\.project_milestones\(id\) on delete set null/);
  assert.match(projectDeliverables, /artifact_type in \('document', 'presentation', 'dashboard', 'repository', 'other'\)/);
  assert.match(projectDeliverables, /artifact_url ~\* '\^https\?:\/\/'/);
  assert.match(projectDeliverables, /status in \('submitted', 'changes_requested', 'accepted'\)/);
  assert.match(projectDeliverables, /project_deliverables_review_consistent/);
  assert.match(projectDeliverables, /create index if not exists project_deliverables_project_created_idx/);
  assert.match(projectDeliverables, /alter table public\.project_deliverables force row level security/);
  assert.match(projectDeliverables, /revoke all on table public\.project_deliverables from public, anon, authenticated/);
  assert.match(projectDeliverables, /revoke delete on table public\.project_deliverables from service_role/);
  assert.match(projectDeliverables, /grant select, insert, update on table public\.project_deliverables to service_role/);
  assert.doesNotMatch(projectDeliverables, /grant delete|create policy|grant [^;]* to (anon|authenticated)/);
});
