begin;

create or replace function public.supervisor_complete_construction_stage(
  p_project_stage_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_stage public.project_construction_stages%rowtype;
  next_building_stage public.building_stages%rowtype;
  next_stage_id uuid;
  missing_required_count integer := 0;
begin
  if not public.is_active_supervisor()
    or not public.supervisor_is_assigned_to_project_stage(p_project_stage_id) then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  select * into target_stage
  from public.project_construction_stages
  where id = p_project_stage_id
  for update;

  if target_stage.id is null then
    raise exception 'PROJECT_STAGE_NOT_FOUND';
  end if;

  if target_stage.status = 'completed' then
    return jsonb_build_object(
      'completedStageId', target_stage.id,
      'nextStageId', null,
      'alreadyCompleted', true
    );
  end if;

  select count(*) into missing_required_count
  from public.construction_standard_items i
  where i.is_required = true
    and (
      (i.standard_scope = 'project' and i.project_stage_id = target_stage.id)
      or
      (i.standard_scope = 'general' and target_stage.building_stage_id is not null and i.building_stage_id = target_stage.building_stage_id)
    )
    and not exists (
      select 1
      from public.project_construction_item_checks c
      where c.project_stage_id = target_stage.id
        and c.standard_item_id = i.id
        and c.is_checked = true
    );

  if missing_required_count > 0 then
    raise exception 'REQUIRED_STANDARDS_INCOMPLETE:%', missing_required_count;
  end if;

  update public.project_construction_stages
  set status = 'completed',
      completed_at = now(),
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = target_stage.id;

  if target_stage.is_custom = false and target_stage.building_stage_id is not null then
    select bs2.* into next_building_stage
    from public.building_stages bs1
    join public.building_stages bs2
      on bs2.stage_order > bs1.stage_order and bs2.is_active = true
    where bs1.id = target_stage.building_stage_id
    order by bs2.stage_order
    limit 1;

    if next_building_stage.id is not null then
      select pcs.id into next_stage_id
      from public.project_construction_stages pcs
      where pcs.building_stage_id = next_building_stage.id
        and (
          (target_stage.financed_customer_file_id is not null and pcs.financed_customer_file_id = target_stage.financed_customer_file_id)
          or
          (target_stage.service_project_id is not null and pcs.service_project_id = target_stage.service_project_id)
        )
        and pcs.status <> 'cancelled'
      order by pcs.created_at desc
      limit 1;

      if next_stage_id is null then
        insert into public.project_construction_stages (
          financed_customer_file_id,
          service_project_id,
          building_stage_id,
          main_stage_name,
          detailed_stage_name,
          is_custom,
          status
        ) values (
          target_stage.financed_customer_file_id,
          target_stage.service_project_id,
          next_building_stage.id,
          next_building_stage.main_stage_name,
          next_building_stage.stage_name,
          false,
          'planned'
        ) returning id into next_stage_id;
      end if;

      if target_stage.service_project_id is not null then
        update public.customer_service_projects
        set current_stage_id = next_building_stage.id,
            current_custom_stage_name = null,
            current_custom_stage_description = null,
            updated_at = now()
        where id = target_stage.service_project_id;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'completedStageId', target_stage.id,
    'nextStageId', next_stage_id,
    'alreadyCompleted', false
  );
end;
$$;

revoke all on function public.supervisor_complete_construction_stage(uuid) from public;
grant execute on function public.supervisor_complete_construction_stage(uuid) to authenticated;

commit;
