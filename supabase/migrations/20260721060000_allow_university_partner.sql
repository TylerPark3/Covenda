-- Allow the university/partner roster intake to share the private submissions
-- inbox. Adds the university_partner type and the UNI- reference prefix.
-- Idempotent: drops each constraint if present, then re-adds it, so this can be
-- re-run safely against the live table (status/source/consent/RLS unchanged).
alter table public.submissions
  drop constraint if exists submissions_type_allowed,
  add constraint submissions_type_allowed
    check (submission_type in ('employer_intake', 'student_interest', 'call_request', 'university_partner'));

alter table public.submissions
  drop constraint if exists submissions_reference_format,
  add constraint submissions_reference_format
    check (reference ~ '^(EMP|STU|CALL|UNI)-[A-Z0-9]{6,20}$');

comment on constraint submissions_type_allowed on public.submissions is
  'Server-defined intake types, including founder-led university/partner rosters.';

-- Refresh the Data API so the new type is accepted immediately.
notify pgrst, 'reload schema';
