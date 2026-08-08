begin;

create or replace function public.admin_assign_supervisor_to_project(
  p_project_id uuid,
  p_supervisor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_id uuid;
  financed_id uuid;
  service_id uuid;
  selected_building_stage public.building_stages%rowtype;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  if not exists (
    select 1 from public.supervisor_profiles
    where id = p_supervisor_user_id and status = 'active'
  ) then
    raise exception 'SUPERVISOR_NOT_FOUND';
  end if;

  select id into financed_id from public.customer_files where id = p_project_id;
  if financed_id is null then
    select id into service_id from public.customer_service_projects where id = p_project_id;
  end if;

  if financed_id is null and service_id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  update public.project_supervisor_assignments
  set status = 'ended', ended_at = now(), updated_at = now()
  where status = 'active'
    and (
      (financed_id is not null and financed_customer_file_id = financed_id)
      or
      (service_id is not null and service_project_id = service_id)
    );

  insert into public.project_supervisor_assignments (
    supervisor_user_id,
    financed_customer_file_id,
    service_project_id,
    status,
    assigned_by_user_id
  ) values (
    p_supervisor_user_id,
    financed_id,
    service_id,
    'active',
    auth.uid()
  ) returning id into new_id;

  if financed_id is not null
    and not exists (
      select 1 from public.project_construction_stages
      where financed_customer_file_id = financed_id and status <> 'cancelled'
    ) then
    select * into selected_building_stage
    from public.building_stages
    where is_active = true
    order by stage_order
    limit 1;

    if selected_building_stage.id is not null then
      insert into public.project_construction_stages (
        financed_customer_file_id,
        building_stage_id,
        main_stage_name,
        detailed_stage_name,
        is_custom,
        status
      ) values (
        financed_id,
        selected_building_stage.id,
        selected_building_stage.main_stage_name,
        selected_building_stage.stage_name,
        false,
        'planned'
      );
    end if;
  end if;

  if service_id is not null
    and not exists (
      select 1 from public.project_construction_stages
      where service_project_id = service_id and status <> 'cancelled'
    ) then
    select bs.* into selected_building_stage
    from public.customer_service_projects csp
    join public.building_stages bs on bs.id = csp.current_stage_id
    where csp.id = service_id and bs.is_active = true
    limit 1;

    if selected_building_stage.id is null then
      select * into selected_building_stage
      from public.building_stages
      where is_active = true
      order by stage_order
      limit 1;
    end if;

    if selected_building_stage.id is not null then
      insert into public.project_construction_stages (
        service_project_id,
        building_stage_id,
        main_stage_name,
        detailed_stage_name,
        is_custom,
        status
      ) values (
        service_id,
        selected_building_stage.id,
        selected_building_stage.main_stage_name,
        selected_building_stage.stage_name,
        false,
        'planned'
      );
    end if;
  end if;

  return new_id;
end;
$$;

commit;
