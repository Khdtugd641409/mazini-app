begin;

create or replace function public.admin_list_supervisor_candidates()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', u.id,
      'email', u.email,
      'createdAt', u.created_at,
      'lastSignInAt', u.last_sign_in_at,
      'isSupervisor', sp.id is not null,
      'fullName', sp.full_name,
      'organizationName', sp.organization_name,
      'mobileNumber', sp.mobile_number,
      'status', sp.status
    ) order by coalesce(u.last_sign_in_at, u.created_at) desc
  ), '[]'::jsonb)
  into result
  from auth.users u
  left join public.supervisor_profiles sp on sp.id = u.id
  where u.email is not null
    and not exists (
      select 1 from public.admin_users au where au.id = u.id
    )
    and not exists (
      select 1 from public.customer_accounts ca where ca.auth_user_id = u.id
    );

  return result;
end;
$$;

create or replace function public.admin_activate_supervisor_account(
  p_user_id uuid,
  p_full_name text,
  p_organization_name text default null,
  p_mobile_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;

  if length(trim(coalesce(p_full_name,''))) < 3 then
    raise exception 'SUPERVISOR_NAME_REQUIRED';
  end if;

  insert into public.supervisor_profiles (
    id,
    full_name,
    organization_name,
    mobile_number,
    status
  ) values (
    p_user_id,
    trim(p_full_name),
    nullif(trim(coalesce(p_organization_name,'')), ''),
    nullif(trim(coalesce(p_mobile_number,'')), ''),
    'active'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    organization_name = excluded.organization_name,
    mobile_number = excluded.mobile_number,
    status = 'active',
    updated_at = now();

  return p_user_id;
end;
$$;

create or replace function public.admin_list_supervisor_assignment_options()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  select jsonb_build_object(
    'supervisors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', sp.id,
        'fullName', sp.full_name,
        'organizationName', sp.organization_name,
        'mobileNumber', sp.mobile_number,
        'status', sp.status,
        'email', u.email
      ) order by sp.full_name)
      from public.supervisor_profiles sp
      left join auth.users u on u.id = sp.id
      where sp.status = 'active'
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(project_row order by project_row->>'projectNumber')
      from (
        select jsonb_build_object(
          'projectId', cf.id,
          'projectType', 'financed',
          'projectNumber', cf.file_number,
          'customerName', cf.customer_name,
          'status', cf.status,
          'currentStage', cf.current_stage,
          'supervisorUserId', psa.supervisor_user_id,
          'supervisorName', sp.full_name
        ) as project_row
        from public.customer_files cf
        left join public.project_supervisor_assignments psa
          on psa.financed_customer_file_id = cf.id and psa.status = 'active'
        left join public.supervisor_profiles sp on sp.id = psa.supervisor_user_id
        where cf.status not in ('rejected','closed')

        union all

        select jsonb_build_object(
          'projectId', csp.id,
          'projectType', 'services',
          'projectNumber', csp.project_number,
          'customerName', csp.customer_name,
          'status', csp.status::text,
          'currentStage', coalesce(bs.stage_name, csp.current_custom_stage_name),
          'supervisorUserId', psa.supervisor_user_id,
          'supervisorName', sp.full_name
        ) as project_row
        from public.customer_service_projects csp
        left join public.building_stages bs on bs.id = csp.current_stage_id
        left join public.project_supervisor_assignments psa
          on psa.service_project_id = csp.id and psa.status = 'active'
        left join public.supervisor_profiles sp on sp.id = psa.supervisor_user_id
        where csp.status::text <> 'closed'
      ) q
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_list_supervisor_candidates() from public;
revoke all on function public.admin_activate_supervisor_account(uuid,text,text,text) from public;
revoke all on function public.admin_list_supervisor_assignment_options() from public;

grant execute on function public.admin_list_supervisor_candidates() to authenticated;
grant execute on function public.admin_activate_supervisor_account(uuid,text,text,text) to authenticated;
grant execute on function public.admin_list_supervisor_assignment_options() to authenticated;

commit;
