-- The event taxonomy from the V1 spec, §7.
--
-- Specified in full and never built. The spec names ten events and says of every one: "actor,
-- subject, timestamp, request id. No free-text rationale or note in any event payload."
--
-- Why this is a new table rather than an extension of match_events: match_events is scoped to
-- matching and carries fit_score, fit_reasons and features. It answers "how did this match
-- perform". Audit answers "who did what to whom, and when", across briefs, shortlists,
-- introductions and outcomes. Bolting one onto the other would give every audit row four
-- columns that never apply and give match_events a foreign key it does not want.
--
-- The no-free-text rule is enforced in three places, deliberately, because this table will
-- outlive whoever remembers the rule:
--   1. api/audit.js runs every payload through safeDetail() from api/limits.js, which strips
--      keys matching /token|secret|key|password|authorization|cookie|email|phone|rationale|note|need/
--   2. the check constraint below rejects the forbidden keys at the database boundary
--   3. detail is capped, so a payload cannot become a smuggling channel by volume
--
-- Rationale text is the single most sensitive field in this product: it is the operator's
-- written judgment about a named student. It belongs in matches.human_rationale, where it is
-- access-controlled, and nowhere else. An audit log is the wrong place for it precisely because
-- audit logs get exported, shipped to third parties, and read by people who were never granted
-- access to the underlying record.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),

  -- What happened. Constrained rather than free-form so a typo cannot silently create a new
  -- event class that no query knows to look for.
  event_type text not null,

  -- Who did it. Null for system-originated events (a scheduled job, a webhook).
  actor_user_id uuid references auth.users(id) on delete set null,

  -- What it was done to. Kept as a loose (kind, id) pair rather than a foreign key per subject
  -- type: audit rows must survive the deletion of the thing they describe, which is most of the
  -- point of having them.
  subject_kind text,
  subject_id uuid,

  -- Correlates events from one HTTP request, so a shortlist publish that emitted eight
  -- candidate_added rows and one published row can be reassembled.
  request_id text,

  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint audit_events_type_allowed check (event_type in (
    'brief.created', 'brief.opened',
    'shortlist.candidate_added', 'shortlist.published',
    'introduction.requested', 'introduction.accepted', 'introduction.declined',
    'outcome.recorded',
    'evidence.verified',
    'gap_analysis.viewed'
  )),

  constraint audit_events_subject_kind_allowed check (
    subject_kind is null or subject_kind in ('brief', 'shortlist', 'student', 'company', 'introduction', 'outcome')
  ),

  -- Defence in depth for the no-free-text rule. api/audit.js already strips these keys; this
  -- catches the caller that bypasses the helper, which is the caller that will exist eventually.
  constraint audit_events_no_free_text check (
    not (detail ?| array['rationale', 'note', 'notes', 'comment', 'reason', 'email', 'phone', 'token', 'secret', 'password'])
  ),

  -- A payload cannot become a smuggling channel by sheer size.
  constraint audit_events_detail_bounded check (pg_column_size(detail) <= 4096)
);

create index if not exists audit_events_subject_idx
  on public.audit_events (subject_kind, subject_id, created_at desc);

create index if not exists audit_events_actor_idx
  on public.audit_events (actor_user_id, created_at desc);

create index if not exists audit_events_type_time_idx
  on public.audit_events (event_type, created_at desc);

-- Correlating one request's events is the main read pattern after "what happened to X".
create index if not exists audit_events_request_idx
  on public.audit_events (request_id)
  where request_id is not null;

alter table public.audit_events enable row level security;

-- No browser role reads or writes this. Audit is written server-side with the service role and
-- read by operators through the admin API, which applies its own authorization. Granting
-- authenticated any access here would let a signed-in student enumerate which companies were
-- shown which candidates, which is a worse leak than the one closed in 20260730300000.
revoke all on table public.audit_events from public, anon, authenticated;

comment on table public.audit_events is
  'V1 spec section 7 event taxonomy. Actor, subject, timestamp, request id. No free text: enforced by api/audit.js safeDetail, the no_free_text check constraint, and the size bound. Service-role only.';
