begin;

create or replace function public.admin_get_construction_stage_workspace(
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  stage_row public.project_construction_stages%rowtype;
  project_kind text;
  result jsonb;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  select pcs.* into stage_row
  from public.project_construction_stages pcs
  where pcs.financed_customer_file_id = p_project_id
     or pcs.service_project_id = p_project_id
  order by
    case pcs.status
      when 'in_progress' then 1
      when 'planned' then 2
      when 'completed' then 3
      else 4
    end,
    pcs.created_at desc
  limit 1;

  if stage_row.id is null then
    return null;
  end if;

  project_kind := case
    when stage_row.financed_customer_file_id is not null then 'financed'
    else 'services'
  end;

  select jsonb_build_object(
    'projectType', project_kind,
    'stage', jsonb_build_object(
      'id', stage_row.id,
      'buildingStageId', stage_row.building_stage_id,
      'mainStageName', stage_row.main_stage_name,
      'detailedStageName', stage_row.detailed_stage_name,
      'isCustom', stage_row.is_custom,
      'status', stage_row.status,
      'plannedFor', stage_row.planned_for,
      'startedAt', stage_row.started_at,
      'completedAt', stage_row.completed_at
    ),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'storageBucket', p.storage_bucket,
        'storagePath', p.storage_path,
        'originalName', p.original_name,
        'caption', p.caption,
        'createdAt', p.created_at
      ) order by p.created_at asc)
      from public.project_construction_stage_photos p
      where p.project_stage_id = stage_row.id
    ), '[]'::jsonb),
    'projectStandards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'text', i.item_text,
        'required', i.is_required,
        'checked', coalesce(c.is_checked,false),
        'checkedAt', c.checked_at,
        'checkedByUserId', c.checked_by_user_id
      ) order by i.item_order asc, i.created_at asc)
      from public.construction_standard_items i
      left join public.project_construction_item_checks c
        on c.project_stage_id = stage_row.id and c.standard_item_id = i.id
      where i.standard_scope = 'project'
        and i.project_stage_id = stage_row.id
    ), '[]'::jsonb),
    'generalStandards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'text', i.item_text,
        'required', i.is_required,
        'checked', coalesce(c.is_checked,false),
        'checkedAt', c.checked_at,
        'checkedByUserId', c.checked_by_user_id
      ) order by i.item_order asc, i.created_at asc)
      from public.construction_standard_items i
      left join public.project_construction_item_checks c
        on c.project_stage_id = stage_row.id and c.standard_item_id = i.id
      where i.standard_scope = 'general'
        and stage_row.building_stage_id is not null
        and i.building_stage_id = stage_row.building_stage_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_construction_stage_workspace(uuid) from public;
grant execute on function public.admin_get_construction_stage_workspace(uuid) to authenticated;

commit;
