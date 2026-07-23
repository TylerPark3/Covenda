-- Packet-first intake (GTM Move 1): the operator scopes a Project Packet for an existing company;
-- the company Accepts (funds it into a live project) or Declines. Adds the proposed/declined
-- statuses + two packet fields. Idempotent; service-role only like the rest of member_projects.
alter table public.member_projects
  drop constraint if exists member_projects_status_allowed,
  add constraint member_projects_status_allowed
    check (status in ('draft', 'scoping', 'open', 'matched', 'in_progress', 'review', 'complete', 'archived', 'proposed', 'proposal_declined'));

alter table public.member_projects
  add column if not exists acceptance_criteria text,
  add column if not exists proposed_by text;

notify pgrst, 'reload schema';
