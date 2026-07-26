-- Scoring Credibility Hardening (Pilot Three, docs/SCORING_CREDIBILITY_HARDENING.md).
-- P3: ownership-defense interview record on the project (jsonb: url, per-question scores,
-- verdict, forensics snapshot). M8: score_appeals — students contest a score with new
-- evidence; every appeal + resolution is retained for adverse-impact/bias audits.
-- Idempotent; service-role only (the API is the sole gatekeeper, RLS posture unchanged).

alter table if exists public.member_projects
  add column if not exists ownership_defense jsonb;

create table if not exists public.score_appeals (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  subject text not null,
  evidence text not null,
  status text not null default 'open',
  resolution text,
  resolved_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint score_appeals_status_allowed check (status in ('open', 'upheld', 'revised', 'dismissed')),
  constraint score_appeals_subject_length check (char_length(subject) between 1 and 160),
  constraint score_appeals_evidence_length check (char_length(evidence) >= 20)
);
create index if not exists score_appeals_student_idx on public.score_appeals (student_user_id, created_at desc);
create index if not exists score_appeals_status_idx on public.score_appeals (status, created_at desc);

alter table public.score_appeals enable row level security;
revoke all on table public.score_appeals from public, anon, authenticated;
grant select, insert, update, delete on table public.score_appeals to service_role;

notify pgrst, 'reload schema';
