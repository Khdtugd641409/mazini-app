begin;

create or replace function public.customer_owns_construction_project_stage(
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
    left join public.customer_files cf
      on cf.id = pcs.financed_customer_file_id
    left join public.customer_service_projects csp
      on csp.id = pcs.service_project_id
    where pcs.id = p_project_stage_id
      and (
        (cf.id is not null and public.customer_owns_financed_file(cf.id))
        or
        (csp.id is not null and csp.customer_user_id = auth.uid())
      )
  );
$$;

revoke all on function public.customer_owns_construction_project_stage(uuid) from public;
revoke all on function public.customer_owns_construction_project_stage(uuid) from anon;
grant execute on function public.customer_owns_construction_project_stage(uuid) to authenticated;

create or replace function public.customer_add_project_construction_standard_item(
  p_project_stage_id uuid,
  p_item_text text,
  p_is_required boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  next_order integer;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.customer_owns_construction_project_stage(p_project_stage_id) then
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if length(trim(coalesce(p_item_text, ''))) < 2 then
    raise exception 'STANDARD_ITEM_REQUIRED';
  end if;

  select coalesce(max(item_order), 0) + 1
  into next_order
  from public.construction_standard_items
  where standard_scope = 'project'
    and project_stage_id = p_project_stage_id;

  insert into public.construction_standard_items (
    standard_scope, project_stage_id, item_text, item_order,
    is_required, created_by_user_id
  ) values (
    'project', p_project_stage_id, trim(p_item_text), next_order,
    coalesce(p_is_required, true), auth.uid()
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.customer_delete_project_construction_standard_item(
  p_standard_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_stage_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select project_stage_id into target_stage_id
  from public.construction_standard_items
  where id = p_standard_item_id
    and standard_scope = 'project';

  if target_stage_id is null
    or not public.customer_owns_construction_project_stage(target_stage_id) then
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  delete from public.construction_standard_items
  where id = p_standard_item_id
    and standard_scope = 'project';

  return found;
end;
$$;

create or replace function public.customer_register_project_construction_standard_document(
  p_project_stage_id uuid,
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
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.customer_owns_construction_project_stage(p_project_stage_id) then
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'INVALID_STANDARD_FILE_SIZE';
  end if;
  if p_content_type not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'INVALID_STANDARD_FILE_TYPE';
  end if;

  insert into public.construction_standard_documents (
    standard_scope, project_stage_id, storage_bucket, storage_path,
    original_name, content_type, size_bytes, uploaded_by_user_id
  ) values (
    'project', p_project_stage_id, 'construction-standards', trim(p_storage_path),
    trim(p_original_name), p_content_type, p_size_bytes, auth.uid()
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.customer_add_project_construction_standard_item(uuid,text,boolean) from public;
revoke all on function public.customer_delete_project_construction_standard_item(uuid) from public;
revoke all on function public.customer_register_project_construction_standard_document(uuid,text,text,text,bigint) from public;

grant execute on function public.customer_add_project_construction_standard_item(uuid,text,boolean) to authenticated;
grant execute on function public.customer_delete_project_construction_standard_item(uuid) to authenticated;
grant execute on function public.customer_register_project_construction_standard_document(uuid,text,text,text,bigint) to authenticated;

drop policy if exists "customers upload project construction standards" on storage.objects;
create policy "customers upload project construction standards"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'construction-standards'
  and (storage.foldername(name))[1] = 'project'
  and public.customer_owns_construction_project_stage(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "customers read allowed construction standards" on storage.objects;
create policy "customers read allowed construction standards"
on storage.objects for select to authenticated
using (
  bucket_id = 'construction-standards'
  and (
    (storage.foldername(name))[1] = 'general'
    or (
      (storage.foldername(name))[1] = 'project'
      and public.customer_owns_construction_project_stage(((storage.foldername(name))[2])::uuid)
    )
  )
);

commit;
