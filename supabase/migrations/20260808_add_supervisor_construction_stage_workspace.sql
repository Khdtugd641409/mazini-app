begin;

create or replace function public.supervisor_get_construction_stage_workspace(
  p_project_stage_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  stage_row public.project_construction_stages%rowtype;
  result jsonb;
begin
  if not public.is_active_supervisor()
    or not public.supervisor_is_assigned_to_project_stage(p_project_stage_id) then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  select * into stage_row
  from public.project_construction_stages
  where id = p_project_stage_id;

  if stage_row.id is null then
    raise exception 'PROJECT_STAGE_NOT_FOUND';
  end if;

  select jsonb_build_object(
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
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'storageBucket', p.storage_bucket,
          'storagePath', p.storage_path,
          'originalName', p.original_name,
          'caption', p.caption,
          'createdAt', p.created_at
        ) order by p.created_at asc
      )
      from public.project_construction_stage_photos p
      where p.project_stage_id = stage_row.id
    ), '[]'::jsonb),
    'projectStandards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'text', i.item_text,
          'order', i.item_order,
          'required', i.is_required,
          'checked', coalesce(c.is_checked,false),
          'checkedAt', c.checked_at,
          'checkNote', c.note
        ) order by i.item_order, i.created_at
      )
      from public.construction_standard_items i
      left join public.project_construction_item_checks c
        on c.project_stage_id = stage_row.id
       and c.standard_item_id = i.id
      where i.standard_scope = 'project'
        and i.project_stage_id = stage_row.id
    ), '[]'::jsonb),
    'generalStandards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'text', i.item_text,
          'order', i.item_order,
          'required', i.is_required,
          'checked', coalesce(c.is_checked,false),
          'checkedAt', c.checked_at,
          'checkNote', c.note
        ) order by i.item_order, i.created_at
      )
      from public.construction_standard_items i
      left join public.project_construction_item_checks c
        on c.project_stage_id = stage_row.id
       and c.standard_item_id = i.id
      where i.standard_scope = 'general'
        and stage_row.building_stage_id is not null
        and i.building_stage_id = stage_row.building_stage_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.supervisor_get_construction_stage_workspace(uuid) from public;
grant execute on function public.supervisor_get_construction_stage_workspace(uuid) to authenticated;

drop policy if exists "supervisors delete construction stage photos" on storage.objects;
create policy "supervisors delete construction stage photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'construction-stage-photos'
  and (storage.foldername(name))[1] = 'stage'
  and public.supervisor_is_assigned_to_project_stage(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "customers delete own project construction standards" on storage.objects;
create policy "customers delete own project construction standards"
on storage.objects for delete to authenticated
using (
  bucket_id = 'construction-standards'
  and (storage.foldername(name))[1] = 'project'
  and public.customer_owns_construction_project_stage(((storage.foldername(name))[2])::uuid)
);

commit;
