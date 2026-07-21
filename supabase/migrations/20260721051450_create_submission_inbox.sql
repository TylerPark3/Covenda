create table public.submissions (
  id bigint generated always as identity primary key,
  reference text not null unique,
  submission_type text not null,
  status text not null default 'received',
  source text not null default 'covenda-web',
  revision_of text,
  submitter_name text not null,
  submitter_email text not null,
  organization_name text,
  summary text not null,
  ready_count smallint,
  readiness_total smallint,
  details jsonb not null,
  readiness jsonb,
  consent boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submissions_reference_format check (reference ~ '^(EMP|STU|CALL)-[A-Z0-9]{6,20}$'),
  constraint submissions_type_allowed check (submission_type in ('employer_intake', 'student_interest', 'call_request')),
  constraint submissions_status_allowed check (status in ('received', 'reviewing', 'needs_information', 'packet_proposed', 'approval_pending', 'approved', 'declined', 'archived')),
  constraint submissions_source_allowed check (source = 'covenda-web'),
  constraint submissions_readiness_pair check (
    (ready_count is null and readiness_total is null)
    or (ready_count between 0 and readiness_total and readiness_total > 0)
  ),
  constraint submissions_consent_required check (consent = true),
  constraint submissions_revision_reference_format check (revision_of is null or revision_of ~ '^EMP-[A-Z0-9]{6,20}$'),
  constraint submissions_revision_parent foreign key (revision_of) references public.submissions(reference)
);

comment on table public.submissions is 'Private Covenda intake inbox. Access is server-only until authenticated operator policies are introduced.';
comment on column public.submissions.details is 'Sanitized structured intake data produced by the Covenda submission API.';
comment on column public.submissions.revision_of is 'Immutable parent receipt reference for company packet revisions.';

create index submissions_type_created_at_idx
  on public.submissions (submission_type, created_at desc);

create index submissions_status_created_at_idx
  on public.submissions (status, created_at desc);

create index submissions_revision_of_idx
  on public.submissions (revision_of)
  where revision_of is not null;

alter table public.submissions enable row level security;
alter table public.submissions force row level security;

revoke all on table public.submissions from public, anon, authenticated;
revoke all on sequence public.submissions_id_seq from public, anon, authenticated;

grant select, insert, update on table public.submissions to service_role;
grant usage, select on sequence public.submissions_id_seq to service_role;
