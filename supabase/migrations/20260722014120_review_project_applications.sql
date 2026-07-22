create or replace function public.review_project_application(
  p_owner_user_id uuid,
  p_application_id uuid,
  p_status text
)
returns public.project_applications
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_application public.project_applications;
  v_project public.member_projects;
begin
  if p_status is null or p_status not in ('reviewing', 'shortlisted', 'accepted', 'declined') then
    raise exception using
      errcode = '22023',
      message = 'Unsupported application review status.';
  end if;

  select application.*
  into v_application
  from public.project_applications as application
  where application.id = p_application_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Project application not found.';
  end if;

  select project.*
  into v_project
  from public.member_projects as project
  where project.id = v_application.project_id
    and project.owner_user_id = p_owner_user_id
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Project application is not owned by this member.';
  end if;

  select application.*
  into v_application
  from public.project_applications as application
  where application.id = p_application_id
    and application.project_id = v_project.id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Project application not found.';
  end if;

  if v_application.status = 'accepted' and p_status <> 'accepted' then
    raise exception using
      errcode = '22023',
      message = 'Accepted matches cannot be changed from the portal.';
  end if;

  if p_status = 'accepted' then
    if v_project.assigned_student_user_id is not null
      and v_project.assigned_student_user_id <> v_application.student_user_id then
      raise exception using
        errcode = '23505',
        message = 'This project already has a matched student.';
    end if;

    if v_project.status not in ('open', 'matched') then
      raise exception using
        errcode = '22023',
        message = 'This project is not ready for matching.';
    end if;

    update public.member_projects
    set assigned_student_user_id = v_application.student_user_id,
        status = 'matched',
        updated_at = now()
    where id = v_project.id;

    update public.project_applications
    set status = 'declined',
        updated_at = now()
    where project_id = v_project.id
      and id <> v_application.id
      and status in ('submitted', 'reviewing', 'shortlisted');
  end if;

  update public.project_applications
  set status = p_status,
      updated_at = now()
  where id = v_application.id
  returning * into v_application;

  return v_application;
end;
$$;

comment on function public.review_project_application(uuid, uuid, text) is
  'Atomically reviews a student application and creates the project match when accepted. Server-only service role access.';

revoke all on function public.review_project_application(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.review_project_application(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
