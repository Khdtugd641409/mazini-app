begin;

alter table public.platform_tasks
  add column if not exists project_stage_id uuid references public.project_construction_stages(id) on delete cascade,
  add column if not exists service_project_id uuid references public.customer_service_projects(id) on delete cascade,
  add column if not exists created_scope text,
  add column if not exists read_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_tasks_created_scope_check'
      and conrelid = 'public.platform_tasks'::regclass
  ) then
    alter table public.platform_tasks
      add constraint platform_tasks_created_scope_check
      check (created_scope is null or created_scope in ('admin','customer','supervisor','investor','contractor','supplier','system'));
  end if;
end $$;

create index if not exists platform_tasks_project_stage_idx
  on public.platform_tasks(project_stage_id, created_at desc);
create index if not exists platform_tasks_assigned_user_open_idx
  on public.platform_tasks(assigned_user_id, status, due_at)
  where assigned_user_id is not null;

create or replace function public.construction_stage_request_actor_role(p_project_stage_id uuid)
returns text language plpgsql security definer set search_path = public, auth as $$
declare current_user_id uuid := auth.uid(); stage_row public.project_construction_stages%rowtype;
begin
  if current_user_id is null then return null; end if;
  select * into stage_row from public.project_construction_stages where id = p_project_stage_id;
  if not found then return null; end if;
  if stage_row.financed_customer_file_id is not null and public.customer_owns_financed_file(stage_row.financed_customer_file_id) then return 'customer'; end if;
  if stage_row.service_project_id is not null and exists(select 1 from public.customer_service_projects csp where csp.id=stage_row.service_project_id and csp.customer_user_id=current_user_id) then return 'customer'; end if;
  if exists(select 1 from public.project_supervisor_assignments psa where psa.supervisor_user_id=current_user_id and psa.status='active' and ((stage_row.financed_customer_file_id is not null and psa.financed_customer_file_id=stage_row.financed_customer_file_id) or (stage_row.service_project_id is not null and psa.service_project_id=stage_row.service_project_id))) then return 'supervisor'; end if;
  if public.is_active_platform_admin() then return 'admin'; end if;
  return null;
end;$$;

create or replace function public.construction_stage_get_requests_workspace(p_project_stage_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  current_user_id uuid := auth.uid(); actor_role text; stage_row public.project_construction_stages%rowtype;
  customer_user_id uuid; customer_name text; supervisor_user_id uuid; supervisor_name text; result jsonb;
begin
  if current_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  actor_role := public.construction_stage_request_actor_role(p_project_stage_id);
  if actor_role is null then raise exception 'PROJECT_STAGE_ACCESS_DENIED'; end if;
  select * into stage_row from public.project_construction_stages where id=p_project_stage_id;
  if stage_row.financed_customer_file_id is not null then
    select coalesce(cf.auth_user_id,ca.auth_user_id),coalesce(cf.customer_name,ca.full_name,'العميل') into customer_user_id,customer_name
    from public.customer_files cf left join public.customer_accounts ca on ca.id=cf.customer_account_id where cf.id=stage_row.financed_customer_file_id;
  else
    select csp.customer_user_id,csp.customer_name into customer_user_id,customer_name from public.customer_service_projects csp where csp.id=stage_row.service_project_id;
  end if;
  select psa.supervisor_user_id,sp.full_name into supervisor_user_id,supervisor_name
  from public.project_supervisor_assignments psa join public.supervisor_profiles sp on sp.id=psa.supervisor_user_id
  where psa.status='active' and ((stage_row.financed_customer_file_id is not null and psa.financed_customer_file_id=stage_row.financed_customer_file_id) or (stage_row.service_project_id is not null and psa.service_project_id=stage_row.service_project_id))
  order by psa.assigned_at desc limit 1;
  select jsonb_build_object(
    'actorRole',actor_role,'currentUserId',current_user_id,
    'recipients',coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('userId',customer_user_id,'role','customer','name',coalesce(customer_name,'العميل')) x where customer_user_id is not null and customer_user_id<>current_user_id
      union all
      select jsonb_build_object('userId',supervisor_user_id,'role','supervisor','name',coalesce(supervisor_name,'المشرف')) where supervisor_user_id is not null and supervisor_user_id<>current_user_id
    ) r),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'body',coalesce(t.description,t.title),'title',t.title,'senderRole',t.created_scope,'senderUserId',t.created_by,
      'senderName',case when t.created_scope='supervisor' then coalesce((select sp.full_name from public.supervisor_profiles sp where sp.id=t.created_by),'المشرف') when t.created_scope='customer' then coalesce(customer_name,'العميل') else coalesce(t.created_scope,'مستخدم') end,
      'recipientRole',t.assigned_scope,'recipientUserId',t.assigned_user_id,
      'recipientName',case when t.assigned_scope='supervisor' then coalesce((select sp.full_name from public.supervisor_profiles sp where sp.id=t.assigned_user_id),'المشرف') when t.assigned_scope='customer' then coalesce(customer_name,'العميل') else t.assigned_scope end,
      'status',t.status,'dueAt',t.due_at,'readAt',t.read_at,'createdAt',t.created_at,'completedAt',t.completed_at,
      'isMine',t.assigned_user_id=current_user_id,'isUnread',t.assigned_user_id=current_user_id and t.read_at is null
    ) order by t.created_at desc) from public.platform_tasks t where t.project_stage_id=p_project_stage_id and t.task_type='construction_stage_request'),'[]'::jsonb)
  ) into result;
  return result;
end;$$;

create or replace function public.construction_stage_create_request(p_project_stage_id uuid,p_recipient_user_id uuid,p_body text,p_due_at timestamptz)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  current_user_id uuid:=auth.uid(); actor_role text; stage_row public.project_construction_stages%rowtype; recipient_role text;
  customer_user_id uuid; supervisor_user_id uuid; new_id uuid; clean_body text:=trim(coalesce(p_body,''));
begin
  if current_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if length(clean_body)<2 then raise exception 'REQUEST_BODY_REQUIRED'; end if;
  if p_due_at is null then raise exception 'REQUEST_DUE_AT_REQUIRED'; end if;
  if p_recipient_user_id is null or p_recipient_user_id=current_user_id then raise exception 'INVALID_RECIPIENT'; end if;
  actor_role:=public.construction_stage_request_actor_role(p_project_stage_id);
  if actor_role not in ('customer','supervisor') then raise exception 'REQUEST_SENDER_NOT_ALLOWED'; end if;
  select * into stage_row from public.project_construction_stages where id=p_project_stage_id;
  if not found then raise exception 'PROJECT_STAGE_NOT_FOUND'; end if;
  if stage_row.financed_customer_file_id is not null then
    select coalesce(cf.auth_user_id,ca.auth_user_id) into customer_user_id from public.customer_files cf left join public.customer_accounts ca on ca.id=cf.customer_account_id where cf.id=stage_row.financed_customer_file_id;
  else
    select csp.customer_user_id into customer_user_id from public.customer_service_projects csp where csp.id=stage_row.service_project_id;
  end if;
  select psa.supervisor_user_id into supervisor_user_id from public.project_supervisor_assignments psa
  where psa.status='active' and ((stage_row.financed_customer_file_id is not null and psa.financed_customer_file_id=stage_row.financed_customer_file_id) or (stage_row.service_project_id is not null and psa.service_project_id=stage_row.service_project_id)) order by psa.assigned_at desc limit 1;
  if p_recipient_user_id=customer_user_id then recipient_role:='customer'; elsif p_recipient_user_id=supervisor_user_id then recipient_role:='supervisor'; else raise exception 'RECIPIENT_NOT_ASSIGNED_TO_PROJECT'; end if;
  insert into public.platform_tasks(customer_file_id,service_project_id,project_stage_id,task_type,title,description,assigned_scope,assigned_user_id,status,priority,due_at,created_by,created_scope,read_at)
  values(stage_row.financed_customer_file_id,stage_row.service_project_id,stage_row.id,'construction_stage_request',left(clean_body,120),clean_body,recipient_role,p_recipient_user_id,'open','normal',p_due_at,current_user_id,actor_role,null)
  returning id into new_id;
  return new_id;
end;$$;

create or replace function public.construction_stage_mark_request_read(p_task_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  update public.platform_tasks set read_at=coalesce(read_at,now()),updated_at=now() where id=p_task_id and task_type='construction_stage_request' and assigned_user_id=auth.uid();
  if not found then raise exception 'REQUEST_NOT_FOUND_OR_FORBIDDEN'; end if;
end;$$;

create or replace function public.construction_stage_complete_request(p_task_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  update public.platform_tasks set status='completed',completed_at=now(),read_at=coalesce(read_at,now()),updated_at=now()
  where id=p_task_id and task_type='construction_stage_request' and assigned_user_id=auth.uid() and status in ('open','in_progress');
  if not found then raise exception 'REQUEST_NOT_FOUND_OR_FORBIDDEN'; end if;
end;$$;

revoke all on function public.construction_stage_request_actor_role(uuid) from public,anon;
revoke all on function public.construction_stage_get_requests_workspace(uuid) from public,anon;
revoke all on function public.construction_stage_create_request(uuid,uuid,text,timestamptz) from public,anon;
revoke all on function public.construction_stage_mark_request_read(uuid) from public,anon;
revoke all on function public.construction_stage_complete_request(uuid) from public,anon;
grant execute on function public.construction_stage_get_requests_workspace(uuid) to authenticated;
grant execute on function public.construction_stage_create_request(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.construction_stage_mark_request_read(uuid) to authenticated;
grant execute on function public.construction_stage_complete_request(uuid) to authenticated;

commit;
