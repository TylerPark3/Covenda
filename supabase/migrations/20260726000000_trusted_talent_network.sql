-- Trusted Talent turns approved professor, lab, club, and career-center
-- endorsements into server-only evidence that can be joined to opted-in member
-- profiles. Company access requests reuse the private operator inbox so Covenda
-- can approve access through the existing admin workflow before identities leave
-- the server.

alter table public.submissions
  drop constraint if exists submissions_type_allowed,
  add constraint submissions_type_allowed
    check (submission_type in (
      'employer_intake',
      'student_interest',
      'call_request',
      'university_partner',
      'student_quick',
      'referrer_endorsement',
      'role_application',
      'network_access_request'
    )) not valid;

alter table public.submissions
  drop constraint if exists submissions_reference_format,
  add constraint submissions_reference_format
    check (reference ~ '^(EMP|STU|CALL|UNI|SQ|REF|APP|NET)-[A-Z0-9]{6,20}$') not valid;

alter table public.member_profiles
  add column if not exists contact_email text;

update public.member_profiles as profile
set contact_email = lower(auth_user.email)
from auth.users as auth_user
where auth_user.id = profile.user_id
  and auth_user.email is not null
  and profile.contact_email is distinct from lower(auth_user.email);

alter table public.member_profiles
  drop constraint if exists member_profiles_contact_email_format,
  add constraint member_profiles_contact_email_format check (
    contact_email is null
    or (
      contact_email = lower(contact_email)
      and char_length(contact_email) between 3 and 254
      and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ) not valid;

create unique index if not exists member_profiles_contact_email_unique_idx
  on public.member_profiles (lower(contact_email))
  where contact_email is not null;

create table if not exists public.student_endorsements (
  id uuid primary key default gen_random_uuid(),
  source_submission_reference text not null references public.submissions(reference) on update cascade on delete restrict,
  student_email text not null,
  student_name text not null,
  referrer_name text not null,
  referrer_email text not null,
  referrer_type text not null,
  referrer_organization text not null,
  endorsed_function text,
  endorsement_note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_endorsements_source_student_unique unique (source_submission_reference, student_email),
  constraint student_endorsements_student_email_lowercase check (student_email = lower(student_email)),
  constraint student_endorsements_student_name_length check (char_length(student_name) between 1 and 100),
  constraint student_endorsements_referrer_name_length check (char_length(referrer_name) between 1 and 120),
  constraint student_endorsements_referrer_email_lowercase check (referrer_email = lower(referrer_email)),
  constraint student_endorsements_referrer_type_length check (char_length(referrer_type) between 1 and 80),
  constraint student_endorsements_referrer_organization_length check (char_length(referrer_organization) between 1 and 160),
  constraint student_endorsements_function_length check (endorsed_function is null or char_length(endorsed_function) <= 80),
  constraint student_endorsements_note_length check (endorsement_note is null or char_length(endorsement_note) <= 500),
  constraint student_endorsements_status_allowed check (status in ('pending', 'verified', 'revoked'))
);

create index if not exists student_endorsements_student_status_idx
  on public.student_endorsements (student_email, status, updated_at desc);

create index if not exists student_endorsements_source_status_idx
  on public.student_endorsements (source_submission_reference, status);

create index if not exists student_endorsements_referrer_org_idx
  on public.student_endorsements (referrer_organization, status);

comment on table public.student_endorsements is
  'Server-only normalized referral evidence. Only operator-approved source submissions become verified company-facing signals.';

alter table public.student_endorsements enable row level security;
alter table public.student_endorsements force row level security;

revoke all on table public.student_endorsements from public, anon, authenticated;
revoke delete on table public.student_endorsements from service_role;
grant select, insert, update on table public.student_endorsements to service_role;

create or replace function public.sync_referrer_endorsements()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  mapped_status text;
begin
  if new.submission_type <> 'referrer_endorsement' then
    return new;
  end if;

  mapped_status := case
    when new.status = 'approved' then 'verified'
    when new.status in ('declined', 'archived') then 'revoked'
    else 'pending'
  end;

  update public.student_endorsements
  set status = 'revoked',
      updated_at = now()
  where source_submission_reference = new.reference;

  with entries as (
    select distinct on (lower(trim(item ->> 'email'))) item
    from jsonb_array_elements(coalesce(new.details -> 'endorsements', '[]'::jsonb)) as item
    where trim(coalesce(item ->> 'name', '')) <> ''
      and trim(coalesce(item ->> 'email', '')) <> ''
      and trim(coalesce(new.details -> 'contact' ->> 'name', '')) <> ''
      and trim(coalesce(new.details -> 'contact' ->> 'email', '')) <> ''
      and trim(coalesce(new.details -> 'contact' ->> 'company', '')) <> ''
      and trim(coalesce(new.details ->> 'referrerType', '')) <> ''
    order by lower(trim(item ->> 'email'))
  )
  insert into public.student_endorsements (
    source_submission_reference,
    student_email,
    student_name,
    referrer_name,
    referrer_email,
    referrer_type,
    referrer_organization,
    endorsed_function,
    endorsement_note,
    status,
    created_at,
    updated_at
  )
  select
    new.reference,
    lower(trim(entries.item ->> 'email')),
    left(trim(entries.item ->> 'name'), 100),
    left(trim(new.details -> 'contact' ->> 'name'), 120),
    lower(left(trim(new.details -> 'contact' ->> 'email'), 254)),
    left(trim(new.details ->> 'referrerType'), 80),
    left(trim(new.details -> 'contact' ->> 'company'), 160),
    nullif(left(trim(entries.item ->> 'function'), 80), ''),
    nullif(left(trim(entries.item ->> 'note'), 500), ''),
    mapped_status,
    new.created_at,
    now()
  from entries
  on conflict (source_submission_reference, student_email) do update
  set student_name = excluded.student_name,
      referrer_name = excluded.referrer_name,
      referrer_email = excluded.referrer_email,
      referrer_type = excluded.referrer_type,
      referrer_organization = excluded.referrer_organization,
      endorsed_function = excluded.endorsed_function,
      endorsement_note = excluded.endorsement_note,
      status = excluded.status,
      updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function public.sync_referrer_endorsements() from public, anon, authenticated;
grant execute on function public.sync_referrer_endorsements() to service_role;

drop trigger if exists submissions_sync_referrer_endorsements on public.submissions;
create trigger submissions_sync_referrer_endorsements
after insert or update of status, details on public.submissions
for each row execute function public.sync_referrer_endorsements();

-- Backfill any referral submissions that arrived before this normalized evidence
-- table existed. This is intentionally an update-in-place, so the trigger follows
-- the same path as every future operator approval.
update public.submissions
set status = status
where submission_type = 'referrer_endorsement';

notify pgrst, 'reload schema';
