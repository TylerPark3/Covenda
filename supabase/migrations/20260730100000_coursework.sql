-- Coursework: the courses a student has taken, held at the tier they deserve.
--
-- ── WHY THIS TABLE EXISTS AT ALL ──────────────────────────────────────────────────────
-- A course list is the thing every student already has and the thing this product argues is
-- insufficient. Storing it looks like a contradiction. It is not: the point of holding it is
-- to convert it. api/course-ontology.js turns each course into the specific work that would
-- prove what the course only exposed the student to. The transcript is the input to that,
-- never the output, and never something a company sorts by.
--
-- ── WHY NOT REUSE skill_claim ALONE ───────────────────────────────────────────────────
-- Claims are derived and get rebuilt when a mapping is corrected, so the durable record has
-- to be the course itself. Deriving on read is deliberate and matches finance_evidence: a
-- fix to a competency mapping then applies to rows already written.
--
-- ── WHY THERE IS NO GRADE COLUMN ──────────────────────────────────────────────────────
-- Deliberate and load-bearing. A grade would be self-reported, unverifiable, and would make
-- this sortable, which recreates the resume screen the product exists to replace. The model
-- states that a transcript line cannot separate a top mark from a pass; a grade column would
-- be the database quietly disagreeing with it. Same reason there is no institution column:
-- storing the school makes ranking by school one query away.
--
-- ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────────────────
-- No grade, no GPA, no institution, no term, no credit hours, no score, no readiness number.
-- verification_level is present but constrained to exactly one value, so the constraint
-- carries the rule rather than a comment: coursework is claimed, and nothing else.
--
-- Idempotent: safe to re-run.

create table if not exists public.coursework (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  course_kind text not null,
  course_title text not null,
  source text not null default 'completed_coursework',
  verification_level text not null default 'claimed',
  created_at timestamptz not null default now(),

  -- Mirrors COURSE_KINDS in api/course-ontology.js. A kind the model cannot map is refused
  -- there; this stops a caller that skipped the model from writing one anyway.
  constraint coursework_kind_allowed check (course_kind in (
    'programming_foundations', 'data_structures', 'algorithms', 'systems_programming',
    'operating_systems', 'databases', 'networks', 'software_engineering',
    'machine_learning', 'deep_learning', 'nlp', 'computer_vision', 'statistics',
    'probability', 'data_analysis', 'calculus', 'linear_algebra', 'discrete_mathematics',
    'optimisation', 'accounting', 'corporate_finance', 'investments', 'financial_modelling',
    'econometrics', 'circuits', 'control_systems', 'thermodynamics', 'mechanics',
    'organic_chemistry', 'molecular_biology', 'research_methods', 'technical_communication'
  )),

  -- One value, on purpose. Coursework cannot rise above claimed, and the ceiling in
  -- api/evidence.js is enforced in code; this is the same rule written where a stray insert
  -- cannot route around it.
  constraint coursework_is_claimed check (verification_level = 'claimed'),

  constraint coursework_source_allowed check (source in ('completed_coursework', 'self_reported')),
  constraint coursework_title_present check (length(btrim(course_title)) > 0),

  -- The same course listed twice is a data-entry slip, not two courses.
  constraint coursework_unique_per_student unique (student_user_id, course_kind, course_title)
);

create index if not exists coursework_student_idx
  on public.coursework (student_user_id, created_at desc);

alter table public.coursework enable row level security;

drop policy if exists coursework_owner_read on public.coursework;
create policy coursework_owner_read on public.coursework
  for select using (auth.uid() = student_user_id);

drop policy if exists coursework_owner_write on public.coursework;
create policy coursework_owner_write on public.coursework
  for insert with check (auth.uid() = student_user_id);

drop policy if exists coursework_owner_update on public.coursework;
create policy coursework_owner_update on public.coursework
  for update using (auth.uid() = student_user_id) with check (auth.uid() = student_user_id);

drop policy if exists coursework_owner_delete on public.coursework;
create policy coursework_owner_delete on public.coursework
  for delete using (auth.uid() = student_user_id);

comment on table public.coursework is
  'Courses a student reports taking. Always claimed tier and excluded from matching. Held so api/course-ontology.js can convert each course into the work that would actually prove it. No grade, institution, or score by design.';

notify pgrst, 'reload schema';
