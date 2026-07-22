-- Allow the low-friction "quick join" intake (name + email) to share the private
-- submissions inbox. Adds the student_quick type and the SQ- reference prefix.
-- Idempotent: drops each constraint if present, then re-adds it, so it is safe to
-- run on a database that already applied earlier migrations. Status/source/consent
-- and RLS are unchanged.
alter table public.submissions
  drop constraint if exists submissions_type_allowed,
  add constraint submissions_type_allowed
    check (submission_type in ('employer_intake', 'student_interest', 'call_request', 'university_partner', 'student_quick'));

alter table public.submissions
  drop constraint if exists submissions_reference_format,
  add constraint submissions_reference_format
    check (reference ~ '^(EMP|STU|CALL|UNI|SQ)-[A-Z0-9]{6,20}$');

-- Refresh the Data API so the new type is accepted immediately.
notify pgrst, 'reload schema';
