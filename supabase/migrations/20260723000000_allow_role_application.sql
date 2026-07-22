-- Allow the student role-application intake (Step 4 foundation) to share the private
-- submissions inbox. Adds the role_application type and the APP- reference prefix,
-- alongside the existing six types. This is the most recent migration that
-- (re)defines the FULL allowed set — the API/DB type-sync test reads this file.
-- Idempotent (drop-if-exists then add); RLS / grants / consent unchanged.
alter table public.submissions
  drop constraint if exists submissions_type_allowed,
  add constraint submissions_type_allowed
    check (submission_type in ('employer_intake', 'student_interest', 'call_request', 'university_partner', 'student_quick', 'referrer_endorsement', 'role_application')) not valid;

alter table public.submissions
  drop constraint if exists submissions_reference_format,
  add constraint submissions_reference_format
    check (reference ~ '^(EMP|STU|CALL|UNI|SQ|REF|APP)-[A-Z0-9]{6,20}$') not valid;

comment on constraint submissions_type_allowed on public.submissions is
  'Server-defined intake types, including student role applications.';

-- Refresh the Data API so the new type is accepted immediately.
notify pgrst, 'reload schema';
