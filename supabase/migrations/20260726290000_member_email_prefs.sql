-- §A transactional email: a per-member opt-out for Covenda's transactional notifications
-- (application received/accepted/declined, etc.). Defaults to false = opted-in. Operator
-- notifications are separate and unaffected. Additive + idempotent.
alter table public.member_profiles
  add column if not exists email_opt_out boolean not null default false;

notify pgrst, 'reload schema';
