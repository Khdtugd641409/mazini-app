begin;

create or replace function public.is_active_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.id = auth.uid()
      and au.is_active = true
  );
$$;

revoke all on function public.is_active_platform_admin() from public;
grant execute on function public.is_active_platform_admin() to authenticated;

create or replace function public.admin_get_construction_standards_workspace()
returns jsonb
language plpgsql
stable
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
      'id', bs.id,
      'mainStageName', bs.main_stage_name,
      'detailedStageName', bs.stage_name,
      'stageOrder', bs.stage_order,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'text', i.item_text,
            'order', i.item_order,
            'required', i.is_required,
            'createdAt', i.created_at
          ) order by i.item_order, i.created_at
        )
        from public.construction_standard_items i
        where i.standard_scope = 'general'
          and i.building_stage_id = bs.id
      ), '[]'::jsonb),
      'documents', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'storageBucket', d.storage_bucket,
            'storagePath', d.storage_path,
            'originalName', d.original_name,
            'contentType', d.content_type,
            'sizeBytes', d.size_bytes,
            'createdAt', d.created_at
          ) order by d.created_at desc
        )
        from public.construction_standard_documents d
        where d.standard_scope = 'general'
          and d.building_stage_id = bs.id
      ), '[]'::jsonb)
    ) order by bs.stage_order
  ), '[]'::jsonb)
  into result
  from public.building_stages bs
  where bs.is_active = true;

  return result;
end;
$$;

create or replace function public.admin_add_general_construction_standard_item(
  p_building_stage_id uuid,
  p_item_text text,
  p_is_required boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_id uuid;
  next_order integer;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  if not exists (
    select 1 from public.building_stages
    where id = p_building_stage_id and is_active = true
  ) then
    raise exception 'INVALID_BUILDING_STAGE';
  end if;

  if length(trim(coalesce(p_item_text, ''))) < 2 then
    raise exception 'STANDARD_ITEM_REQUIRED';
  end if;

  select coalesce(max(item_order), 0) + 1
  into next_order
  from public.construction_standard_items
  where standard_scope = 'general'
    and building_stage_id = p_building_stage_id;

  insert into public.construction_standard_items (
    standard_scope,
    building_stage_id,
    item_text,
    item_order,
    is_required,
    created_by_user_id
  ) values (
    'general',
    p_building_stage_id,
    trim(p_item_text),
    next_order,
    coalesce(p_is_required, true),
    auth.uid()
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.admin_delete_general_construction_standard_item(
  p_standard_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  delete from public.construction_standard_items
  where id = p_standard_item_id
    and standard_scope = 'general';

  return found;
end;
$$;

create or replace function public.admin_register_general_construction_standard_document(
  p_building_stage_id uuid,
  p_storage_path text,
  p_original_name text,
  p_content_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_id uuid;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  if not exists (
    select 1 from public.building_stages
    where id = p_building_stage_id and is_active = true
  ) then
    raise exception 'INVALID_BUILDING_STAGE';
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'INVALID_STANDARD_FILE_SIZE';
  end if;

  if p_content_type not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'INVALID_STANDARD_FILE_TYPE';
  end if;

  insert into public.construction_standard_documents (
    standard_scope,
    building_stage_id,
    storage_bucket,
    storage_path,
    original_name,
    content_type,
    size_bytes,
    uploaded_by_user_id
  ) values (
    'general',
    p_building_stage_id,
    'construction-standards',
    trim(p_storage_path),
    trim(p_original_name),
    p_content_type,
    p_size_bytes,
    auth.uid()
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.admin_delete_general_construction_standard_document(
  p_document_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deleted_path text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  delete from public.construction_standard_documents
  where id = p_document_id
    and standard_scope = 'general'
  returning storage_path into deleted_path;

  return deleted_path;
end;
$$;

revoke all on function public.admin_get_construction_standards_workspace() from public;
revoke all on function public.admin_add_general_construction_standard_item(uuid,text,boolean) from public;
revoke all on function public.admin_delete_general_construction_standard_item(uuid) from public;
revoke all on function public.admin_register_general_construction_standard_document(uuid,text,text,text,bigint) from public;
revoke all on function public.admin_delete_general_construction_standard_document(uuid) from public;

grant execute on function public.admin_get_construction_standards_workspace() to authenticated;
grant execute on function public.admin_add_general_construction_standard_item(uuid,text,boolean) to authenticated;
grant execute on function public.admin_delete_general_construction_standard_item(uuid) to authenticated;
grant execute on function public.admin_register_general_construction_standard_document(uuid,text,text,text,bigint) to authenticated;
grant execute on function public.admin_delete_general_construction_standard_document(uuid) to authenticated;

drop policy if exists "admins upload construction standards" on storage.objects;
create policy "admins upload construction standards"
on storage.objects for insert to authenticated
with check (bucket_id = 'construction-standards' and public.is_active_platform_admin());

drop policy if exists "admins update construction standards" on storage.objects;
create policy "admins update construction standards"
on storage.objects for update to authenticated
using (bucket_id = 'construction-standards' and public.is_active_platform_admin())
with check (bucket_id = 'construction-standards' and public.is_active_platform_admin());

drop policy if exists "admins delete construction standards" on storage.objects;
create policy "admins delete construction standards"
on storage.objects for delete to authenticated
using (bucket_id = 'construction-standards' and public.is_active_platform_admin());

drop policy if exists "admins read construction standards" on storage.objects;
create policy "admins read construction standards"
on storage.objects for select to authenticated
using (bucket_id = 'construction-standards' and public.is_active_platform_admin());

commit;
