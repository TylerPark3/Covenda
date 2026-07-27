-- ATS connections, and the consent that governs them.
--
-- Covenda's pitch is "keep Greenhouse, we improve what enters it". That means pushing a
-- student's profile into a system we cannot reach, update, or delete from — the only
-- irreversible data decision in the product.
--
-- So consent is stored per (student, company), explicitly, revocably, and separately from
-- every other permission. "They opted into discovery" is not consent for this.
--
-- Idempotent: safe to re-run.

create table if not exists public.ats_connections (
  company_user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null,
  -- The key itself lives in the environment, never here. This records only that one is set,
  -- so the UI can say "connected" without the table becoming a credential store.
  api_key_set boolean not null default false,
  external_org text,
  connected_at timestamptz not null default now(),
  last_push_at timestamptz,

  constraint ats_connections_provider_allowed check (provider in ('greenhouse', 'ashby', 'lever'))
);

alter table public.ats_connections enable row level security;
alter table public.ats_connections force row level security;
revoke all on table public.ats_connections from public, anon, authenticated;
grant select, insert, update, delete on table public.ats_connections to service_role;

create table if not exists public.export_consents (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  -- Consent that never expires is consent nobody revisits.
  expires_at timestamptz not null default (now() + interval '180 days'),
  revoked_at timestamptz,

  constraint export_consents_unique unique (student_user_id, company_user_id)
);

create index if not exists export_consents_student_idx on public.export_consents (student_user_id);

alter table public.export_consents enable row level security;
alter table public.export_consents force row level security;
revoke all on table public.export_consents from public, anon, authenticated;
grant select, insert, update on table public.export_consents to service_role;

-- What actually left, so a student can be told the truth about where their data went.
create table if not exists public.export_log (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  external_id text,
  dropped_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists export_log_student_idx on public.export_log (student_user_id, created_at desc);

alter table public.export_log enable row level security;
alter table public.export_log force row level security;
revoke all on table public.export_log from public, anon, authenticated;
grant select, insert on table public.export_log to service_role;

notify pgrst, 'reload schema';
