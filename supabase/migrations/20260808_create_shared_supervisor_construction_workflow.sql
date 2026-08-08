begin;

create table if not exists public.supervisor_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  organization_name text,
  mobile_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supervisor_profile_name check (length(trim(full_name)) >= 3),
  constraint supervisor_profile_status check (status in ('active','suspended','closed'))
);

create table if not exists public.project_supervisor_assignments (
  id uuid primary key default gen_random_uuid(),
  supervisor_user_id uuid not null references public.supervisor_profiles(id) on delete restrict,
  financed_customer_file_id uuid references public.customer_files(id) on delete cascade,
  service_project_id uuid references public.customer_service_projects(id) on delete cascade,
  status text not null default 'active',
  assigned_by_user_id uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supervisor_assignment_one_project check (
    (financed_customer_file_id is not null and service_project_id is null)
    or
    (financed_customer_file_id is null and service_project_id is not null)
  ),
  constraint supervisor_assignment_status check (status in ('active','ended','cancelled'))
);

create unique index if not exists one_active_supervisor_per_financed_project
  on public.project_supervisor_assignments(financed_customer_file_id)
  where financed_customer_file_id is not null and status = 'active';

create unique index if not exists one_active_supervisor_per_service_project
  on public.project_supervisor_assignments(service_project_id)
  where service_project_id is not null and status = 'active';

create index if not exists supervisor_assignment_user_idx
  on public.project_supervisor_assignments(supervisor_user_id, status, assigned_at desc);

alter table public.supervisor_profiles enable row level security;
alter table public.project_supervisor_assignments enable row level security;

create or replace function public.is_active_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.supervisor_profiles sp
    where sp.id = auth.uid()
      and sp.status = 'active'
  );
$$;

create or replace function public.supervisor_is_assigned_to_project_stage(
  p_project_stage_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.project_construction_stages pcs
    join public.project_supervisor_assignments psa
      on psa.status = 'active'
     and psa.supervisor_user_id = auth.uid()
     and (
       (pcs.financed_customer_file_id is not null and psa.financed_customer_file_id = pcs.financed_customer_file_id)
       or
       (pcs.service_project_id is not null and psa.service_project_id = pcs.service_project_id)
     )
    where pcs.id = p_project_stage_id
  );
$$;

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

  return new_id;
end;
$$;

create or replace function public.supervisor_create_custom_construction_stage(
  p_reference_stage_id uuid,
  p_detailed_stage_name text,
  p_planned_for timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  reference_stage public.project_construction_stages%rowtype;
  new_id uuid;
begin
  if not public.is_active_supervisor() then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  if not public.supervisor_is_assigned_to_project_stage(p_reference_stage_id) then
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if length(trim(coalesce(p_detailed_stage_name,''))) < 2 then
    raise exception 'CUSTOM_STAGE_NAME_REQUIRED';
  end if;

  select * into reference_stage
  from public.project_construction_stages
  where id = p_reference_stage_id;

  insert into public.project_construction_stages (
    financed_customer_file_id,
    service_project_id,
    building_stage_id,
    main_stage_name,
    detailed_stage_name,
    is_custom,
    custom_created_by_user_id,
    status,
    planned_for
  ) values (
    reference_stage.financed_customer_file_id,
    reference_stage.service_project_id,
    null,
    reference_stage.main_stage_name,
    trim(p_detailed_stage_name),
    true,
    auth.uid(),
    'planned',
    p_planned_for
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.supervisor_create_construction_stage_reminder(
  p_project_stage_id uuid,
  p_title text,
  p_reminder_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_id uuid;
begin
  if not public.is_active_supervisor()
    or not public.supervisor_is_assigned_to_project_stage(p_project_stage_id) then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  if length(trim(coalesce(p_title,''))) < 2 then
    raise exception 'REMINDER_TITLE_REQUIRED';
  end if;

  if p_reminder_at is null then
    raise exception 'REMINDER_DATE_REQUIRED';
  end if;

  insert into public.project_construction_stage_reminders (
    project_stage_id,
    supervisor_user_id,
    title,
    reminder_at,
    note
  ) values (
    p_project_stage_id,
    auth.uid(),
    trim(p_title),
    p_reminder_at,
    nullif(trim(coalesce(p_note,'')), '')
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.supervisor_set_construction_standard_check(
  p_project_stage_id uuid,
  p_standard_item_id uuid,
  p_is_checked boolean,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_stage public.project_construction_stages%rowtype;
  target_item public.construction_standard_items%rowtype;
begin
  if not public.is_active_supervisor()
    or not public.supervisor_is_assigned_to_project_stage(p_project_stage_id) then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  select * into target_stage from public.project_construction_stages where id = p_project_stage_id;
  select * into target_item from public.construction_standard_items where id = p_standard_item_id;

  if target_item.id is null then
    raise exception 'STANDARD_ITEM_NOT_FOUND';
  end if;

  if not (
    (target_item.standard_scope = 'project' and target_item.project_stage_id = target_stage.id)
    or
    (target_item.standard_scope = 'general' and target_stage.building_stage_id is not null and target_item.building_stage_id = target_stage.building_stage_id)
  ) then
    raise exception 'STANDARD_ITEM_NOT_IN_STAGE';
  end if;

  if coalesce(p_is_checked,false) then
    insert into public.project_construction_item_checks (
      project_stage_id,
      standard_item_id,
      is_checked,
      checked_by_user_id,
      checked_at,
      note
    ) values (
      p_project_stage_id,
      p_standard_item_id,
      true,
      auth.uid(),
      now(),
      nullif(trim(coalesce(p_note,'')), '')
    )
    on conflict (project_stage_id, standard_item_id)
    do update set
      is_checked = true,
      checked_by_user_id = auth.uid(),
      checked_at = now(),
      note = excluded.note,
      updated_at = now();
  else
    delete from public.project_construction_item_checks
    where project_stage_id = p_project_stage_id
      and standard_item_id = p_standard_item_id;
  end if;

  return true;
end;
$$;

create or replace function public.supervisor_register_construction_stage_photo(
  p_project_stage_id uuid,
  p_storage_path text,
  p_original_name text,
  p_content_type text,
  p_size_bytes bigint,
  p_caption text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_id uuid;
begin
  if not public.is_active_supervisor()
    or not public.supervisor_is_assigned_to_project_stage(p_project_stage_id) then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  if p_content_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'INVALID_PHOTO_TYPE';
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'INVALID_PHOTO_SIZE';
  end if;

  insert into public.project_construction_stage_photos (
    project_stage_id,
    storage_bucket,
    storage_path,
    original_name,
    content_type,
    size_bytes,
    caption,
    uploaded_by_user_id
  ) values (
    p_project_stage_id,
    'construction-stage-photos',
    trim(p_storage_path),
    trim(p_original_name),
    p_content_type,
    p_size_bytes,
    nullif(trim(coalesce(p_caption,'')), ''),
    auth.uid()
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.supervisor_get_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_active_supervisor() then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  select jsonb_build_object(
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'assignmentId', psa.id,
          'projectId', coalesce(psa.financed_customer_file_id, psa.service_project_id),
          'projectType', case when psa.financed_customer_file_id is not null then 'financed' else 'services' end,
          'projectNumber', coalesce(cf.file_number, csp.project_number),
          'customerName', coalesce(cf.customer_name, csp.customer_name),
          'currentStage', (
            select jsonb_build_object(
              'id', pcs.id,
              'mainStageName', pcs.main_stage_name,
              'detailedStageName', pcs.detailed_stage_name,
              'status', pcs.status,
              'plannedFor', pcs.planned_for
            )
            from public.project_construction_stages pcs
            where (psa.financed_customer_file_id is not null and pcs.financed_customer_file_id = psa.financed_customer_file_id)
               or (psa.service_project_id is not null and pcs.service_project_id = psa.service_project_id)
            order by case pcs.status when 'in_progress' then 1 when 'planned' then 2 else 3 end, pcs.created_at desc
            limit 1
          )
        ) order by psa.assigned_at desc
      )
      from public.project_supervisor_assignments psa
      left join public.customer_files cf on cf.id = psa.financed_customer_file_id
      left join public.customer_service_projects csp on csp.id = psa.service_project_id
      where psa.supervisor_user_id = auth.uid()
        and psa.status = 'active'
    ), '[]'::jsonb),
    'reminders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'projectStageId', r.project_stage_id,
          'title', r.title,
          'reminderAt', r.reminder_at,
          'note', r.note,
          'isDone', r.is_done,
          'mainStageName', pcs.main_stage_name,
          'detailedStageName', pcs.detailed_stage_name,
          'projectNumber', coalesce(cf.file_number, csp.project_number)
        ) order by r.reminder_at asc
      )
      from public.project_construction_stage_reminders r
      join public.project_construction_stages pcs on pcs.id = r.project_stage_id
      left join public.customer_files cf on cf.id = pcs.financed_customer_file_id
      left join public.customer_service_projects csp on csp.id = pcs.service_project_id
      where r.supervisor_user_id = auth.uid()
        and r.is_done = false
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.is_active_supervisor() from public;
revoke all on function public.supervisor_is_assigned_to_project_stage(uuid) from public;
revoke all on function public.admin_assign_supervisor_to_project(uuid,uuid) from public;
revoke all on function public.supervisor_create_custom_construction_stage(uuid,text,timestamptz) from public;
revoke all on function public.supervisor_create_construction_stage_reminder(uuid,text,timestamptz,text) from public;
revoke all on function public.supervisor_set_construction_standard_check(uuid,uuid,boolean,text) from public;
revoke all on function public.supervisor_register_construction_stage_photo(uuid,text,text,text,bigint,text) from public;
revoke all on function public.supervisor_get_dashboard() from public;

grant execute on function public.is_active_supervisor() to authenticated;
grant execute on function public.supervisor_is_assigned_to_project_stage(uuid) to authenticated;
grant execute on function public.admin_assign_supervisor_to_project(uuid,uuid) to authenticated;
grant execute on function public.supervisor_create_custom_construction_stage(uuid,text,timestamptz) to authenticated;
grant execute on function public.supervisor_create_construction_stage_reminder(uuid,text,timestamptz,text) to authenticated;
grant execute on function public.supervisor_set_construction_standard_check(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.supervisor_register_construction_stage_photo(uuid,text,text,text,bigint,text) to authenticated;
grant execute on function public.supervisor_get_dashboard() to authenticated;

drop policy if exists "supervisors upload construction stage photos" on storage.objects;
create policy "supervisors upload construction stage photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'construction-stage-photos'
  and (storage.foldername(name))[1] = 'stage'
  and public.supervisor_is_assigned_to_project_stage(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "supervisors read construction stage photos" on storage.objects;
create policy "supervisors read construction stage photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'construction-stage-photos'
  and (storage.foldername(name))[1] = 'stage'
  and public.supervisor_is_assigned_to_project_stage(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "customers read own construction stage photos" on storage.objects;
create policy "customers read own construction stage photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'construction-stage-photos'
  and (storage.foldername(name))[1] = 'stage'
  and public.customer_owns_construction_project_stage(((storage.foldername(name))[2])::uuid)
);

create or replace function public.set_supervisor_workflow_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists supervisor_profiles_updated_at on public.supervisor_profiles;
create trigger supervisor_profiles_updated_at
before update on public.supervisor_profiles
for each row execute function public.set_supervisor_workflow_updated_at();

drop trigger if exists supervisor_assignments_updated_at on public.project_supervisor_assignments;
create trigger supervisor_assignments_updated_at
before update on public.project_supervisor_assignments
for each row execute function public.set_supervisor_workflow_updated_at();

commit;
