-- Proof Connector Framework (patch to the Compatibility Engine).
-- 1) evidence_meta on skill_claim: the ownership + timestamp-forensics signal each connector
--    attaches to a claim. Within a tier this meta moves WEIGHT (ownership-verified + longitudinal
--    > pasted one-shot); the verification_tier enum itself is unchanged.
-- 2) connector_accounts: a student's OAuth connections. Student-initiated, read-only, REVOCABLE.
--    We store only that a connection exists + derived-feature bookkeeping — never raw dumps and
--    never third-party tokens in plaintext (tokens live in Vercel env / a secret store, keyed by
--    the provider, not here). Disconnecting flips revoked_at and stops future reads.
-- Idempotent; service-role only (the API is the sole gatekeeper); RLS posture unchanged.

alter table if exists public.skill_claim
  add column if not exists evidence_meta jsonb;

create table if not exists public.connector_accounts (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  connector_id text not null,
  external_login text,                    -- e.g. the GitHub login of the connected account (display only)
  ownership_verified boolean not null default false,
  scopes text[] not null default '{}',    -- the read-only scopes granted, for the audit trail
  last_synced_at timestamptz,
  revoked_at timestamptz,                 -- set on disconnect; a revoked row stops all future reads
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connector_accounts_connector_length check (char_length(connector_id) between 1 and 60),
  constraint connector_accounts_unique unique (student_user_id, connector_id)
);
create index if not exists connector_accounts_student_idx on public.connector_accounts (student_user_id);

alter table public.connector_accounts enable row level security;
revoke all on table public.connector_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.connector_accounts to service_role;

notify pgrst, 'reload schema';
