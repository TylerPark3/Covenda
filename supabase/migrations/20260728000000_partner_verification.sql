-- Partner verification is a distinct founder decision. Approving an intake only
-- accepts the record into Covenda's workflow; it must not certify the source.

alter table public.submissions
  add column if not exists partner_verified boolean not null default false,
  add column if not exists partner_verified_at timestamptz,
  add column if not exists partner_verified_by text,
  add column if not exists founding_partner boolean not null default false;

alter table public.submissions
  drop constraint if exists submissions_partner_verification_scope,
  add constraint submissions_partner_verification_scope check (
    submission_type in ('university_partner', 'referrer_endorsement')
    or (
      partner_verified = false
      and founding_partner = false
      and partner_verified_at is null
      and partner_verified_by is null
    )
  ) not valid;

alter table public.submissions
  drop constraint if exists submissions_partner_verification_consistent,
  add constraint submissions_partner_verification_consistent check (
    (
      partner_verified = true
      and partner_verified_at is not null
      and partner_verified_by is not null
      and char_length(partner_verified_by) between 3 and 254
    )
    or (
      partner_verified = false
      and founding_partner = false
      and partner_verified_at is null
      and partner_verified_by is null
    )
  ) not valid;

create index if not exists submissions_verified_partner_idx
  on public.submissions (submission_type, founding_partner, updated_at desc)
  where partner_verified = true;

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
    when new.status = 'approved' and new.partner_verified = true then 'verified'
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

-- Re-evaluate older approvals. They stay pending until a founder explicitly
-- confirms the source through the operator inbox.
update public.submissions
set status = status
where submission_type = 'referrer_endorsement';

notify pgrst, 'reload schema';
