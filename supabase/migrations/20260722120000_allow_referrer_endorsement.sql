-- Allow the professor / club / career-center referral & endorsement intake to
-- share the private submissions inbox. Adds the referrer_endorsement type and
-- the REF- reference prefix, alongside the existing five audiences (incl. the
-- student_quick / SQ- quick-join added just before this).
-- Idempotent (drop-if-exists then add); RLS / grants / consent unchanged.
alter table public.submissions
  drop constraint if exists submissions_type_allowed,
  add constraint submissions_type_allowed
    check (submission_type in ('employer_intake', 'student_interest', 'call_request', 'university_partner', 'student_quick', 'referrer_endorsement')) not valid;

alter table public.submissions
  drop constraint if exists submissions_reference_format,
  add constraint submissions_reference_format
    check (reference ~ '^(EMP|STU|CALL|UNI|SQ|REF)-[A-Z0-9]{6,20}$') not valid;

comment on constraint submissions_type_allowed on public.submissions is
  'Server-defined intake types, including founder-led referrer endorsements.';

-- Refresh the Data API so the new type is accepted immediately.
notify pgrst, 'reload schema';
