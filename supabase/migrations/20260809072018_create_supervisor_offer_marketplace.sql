begin;

alter table public.customer_service_projects
  add column if not exists city text;

create table if not exists public.supervisor_project_offers (
  id uuid primary key default gen_random_uuid(),
  supervisor_user_id uuid not null references public.supervisor_profiles(id) on delete cascade,
  financed_customer_file_id uuid references public.customer_files(id) on delete cascade,
  service_project_id uuid references public.customer_service_projects(id) on delete cascade,
  offer_price numeric(14,2) not null check (offer_price > 0),
  offer_note text,
  status text not null default 'submitted' check (status in ('submitted','customer_selected','admin_rejected','fee_pending','active','withdrawn','expired','cancelled')),
  customer_selected_at timestamptz,
  customer_selected_by_user_id uuid references auth.users(id) on delete set null,
  admin_decided_at timestamptz,
  admin_decided_by_user_id uuid references auth.users(id) on delete set null,
  admin_note text,
  fee_rate numeric(6,5) not null default 0.02 check (fee_rate >= 0 and fee_rate <= 1),
  fee_amount numeric(14,2),
  fee_status text not null default 'not_due' check (fee_status in ('not_due','pending','paid','waived','refunded')),
  fee_paid_at timestamptz,
  fee_confirmed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supervisor_project_offer_one_project check (
    (financed_customer_file_id is not null and service_project_id is null)
    or (financed_customer_file_id is null and service_project_id is not null)
  )
);

create index if not exists supervisor_project_offers_supervisor_idx
  on public.supervisor_project_offers(supervisor_user_id, created_at desc);
create index if not exists supervisor_project_offers_financed_idx
  on public.supervisor_project_offers(financed_customer_file_id, created_at desc)
  where financed_customer_file_id is not null;
create index if not exists supervisor_project_offers_service_idx
  on public.supervisor_project_offers(service_project_id, created_at desc)
  where service_project_id is not null;
create unique index if not exists supervisor_project_offer_one_live_financed_per_supervisor
  on public.supervisor_project_offers(supervisor_user_id, financed_customer_file_id)
  where financed_customer_file_id is not null and status in ('submitted','customer_selected','fee_pending','active');
create unique index if not exists supervisor_project_offer_one_live_service_per_supervisor
  on public.supervisor_project_offers(supervisor_user_id, service_project_id)
  where service_project_id is not null and status in ('submitted','customer_selected','fee_pending','active');
create unique index if not exists supervisor_project_offer_one_selected_financed
  on public.supervisor_project_offers(financed_customer_file_id)
  where financed_customer_file_id is not null and status in ('customer_selected','fee_pending','active');
create unique index if not exists supervisor_project_offer_one_selected_service
  on public.supervisor_project_offers(service_project_id)
  where service_project_id is not null and status in ('customer_selected','fee_pending','active');

alter table public.supervisor_project_offers enable row level security;

create or replace function public.set_supervisor_offer_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists supervisor_project_offer_updated_at
  on public.supervisor_project_offers;
create trigger supervisor_project_offer_updated_at
before update on public.supervisor_project_offers
for each row execute function public.set_supervisor_offer_updated_at();

create or replace function public.supervisor_list_available_projects()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  profile public.supervisor_profiles%rowtype;
  result jsonb;
begin
  if uid is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into profile
  from public.supervisor_profiles sp
  where sp.id = uid and sp.status = 'active';

  if not found then raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED'; end if;

  select coalesce(jsonb_agg(item order by item->>'city', item->>'projectNumber'), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'projectType','financed',
      'projectId',cf.id,
      'projectNumber',cf.file_number,
      'projectTitle','مشروع بناء ممول',
      'city',ls.city,
      'district',ls.district,
      'locationUrl',ls.google_maps_url,
      'landArea',cf.land_area,
      'floors',cf.floors,
      'currentStage',cf.current_stage,
      'myOfferStatus',myo.status,
      'myOfferPrice',myo.offer_price
    ) as item
    from public.customer_files cf
    join lateral (
      select cls.city, cls.district, cls.google_maps_url
      from public.customer_land_submissions cls
      where cls.customer_file_id = cf.id and cls.status = 'approved'
      order by cls.approved_at desc nulls last, cls.created_at desc
      limit 1
    ) ls on true
    left join lateral (
      select spo.status, spo.offer_price
      from public.supervisor_project_offers spo
      where spo.supervisor_user_id = uid
        and spo.financed_customer_file_id = cf.id
        and spo.status in ('submitted','customer_selected','fee_pending','active')
      order by spo.created_at desc
      limit 1
    ) myo on true
    where cf.status in ('land_approved','waiting_transfer','transfer_in_progress','active_project')
      and not exists (
        select 1 from public.project_supervisor_assignments psa
        where psa.financed_customer_file_id = cf.id and psa.status = 'active'
      )
      and not exists (
        select 1 from public.supervisor_project_offers sel
        where sel.financed_customer_file_id = cf.id
          and sel.status in ('customer_selected','fee_pending','active')
          and sel.supervisor_user_id <> uid
      )
      and (
        lower(trim(ls.city)) = lower(trim(coalesce(profile.city,'')))
        or exists (
          select 1 from unnest(coalesce(profile.service_areas,'{}'::text[])) area
          where lower(trim(area)) = lower(trim(ls.city))
        )
      )

    union all

    select jsonb_build_object(
      'projectType','services',
      'projectId',csp.id,
      'projectNumber',csp.project_number,
      'projectTitle',csp.project_title,
      'city',csp.city,
      'district',null,
      'locationUrl',csp.property_location_url,
      'landArea',csp.land_area,
      'floors',csp.floors,
      'currentStage',coalesce(bs.stage_name,csp.current_custom_stage_name),
      'myOfferStatus',myo.status,
      'myOfferPrice',myo.offer_price
    ) as item
    from public.customer_service_projects csp
    left join public.building_stages bs on bs.id = csp.current_stage_id
    left join lateral (
      select spo.status, spo.offer_price
      from public.supervisor_project_offers spo
      where spo.supervisor_user_id = uid
        and spo.service_project_id = csp.id
        and spo.status in ('submitted','customer_selected','fee_pending','active')
      order by spo.created_at desc
      limit 1
    ) myo on true
    where csp.status = 'active'
      and csp.city is not null
      and not exists (
        select 1 from public.project_supervisor_assignments psa
        where psa.service_project_id = csp.id and psa.status = 'active'
      )
      and not exists (
        select 1 from public.supervisor_project_offers sel
        where sel.service_project_id = csp.id
          and sel.status in ('customer_selected','fee_pending','active')
          and sel.supervisor_user_id <> uid
      )
      and (
        lower(trim(csp.city)) = lower(trim(coalesce(profile.city,'')))
        or exists (
          select 1 from unnest(coalesce(profile.service_areas,'{}'::text[])) area
          where lower(trim(area)) = lower(trim(csp.city))
        )
      )
  ) q;

  return result;
end;
$$;

create or replace function public.supervisor_submit_project_offer(
  p_project_type text,
  p_project_id uuid,
  p_offer_price numeric,
  p_offer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  profile public.supervisor_profiles%rowtype;
  project_city text;
  new_id uuid;
begin
  if uid is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_offer_price is null or p_offer_price <= 0 then raise exception 'INVALID_OFFER_PRICE'; end if;

  select * into profile from public.supervisor_profiles sp
  where sp.id = uid and sp.status = 'active';
  if not found then raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED'; end if;

  if p_project_type = 'financed' then
    select cls.city into project_city
    from public.customer_files cf
    join lateral (
      select city from public.customer_land_submissions
      where customer_file_id = cf.id and status = 'approved'
      order by approved_at desc nulls last, created_at desc limit 1
    ) cls on true
    where cf.id = p_project_id
      and cf.status in ('land_approved','waiting_transfer','transfer_in_progress','active_project');

    if project_city is null then raise exception 'PROJECT_NOT_AVAILABLE'; end if;
    if exists (select 1 from public.project_supervisor_assignments where financed_customer_file_id=p_project_id and status='active') then raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR'; end if;
    if exists (select 1 from public.supervisor_project_offers where financed_customer_file_id=p_project_id and status in ('customer_selected','fee_pending','active')) then raise exception 'PROJECT_OFFERING_CLOSED'; end if;
  elsif p_project_type = 'services' then
    select city into project_city
    from public.customer_service_projects
    where id=p_project_id and status='active';

    if project_city is null then raise exception 'PROJECT_NOT_AVAILABLE'; end if;
    if exists (select 1 from public.project_supervisor_assignments where service_project_id=p_project_id and status='active') then raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR'; end if;
    if exists (select 1 from public.supervisor_project_offers where service_project_id=p_project_id and status in ('customer_selected','fee_pending','active')) then raise exception 'PROJECT_OFFERING_CLOSED'; end if;
  else
    raise exception 'INVALID_PROJECT_TYPE';
  end if;

  if not (
    lower(trim(project_city)) = lower(trim(coalesce(profile.city,'')))
    or exists (
      select 1 from unnest(coalesce(profile.service_areas,'{}'::text[])) area
      where lower(trim(area)) = lower(trim(project_city))
    )
  ) then
    raise exception 'PROJECT_OUTSIDE_SERVICE_AREA';
  end if;

  if p_project_type='financed' and exists (
    select 1 from public.supervisor_project_offers
    where supervisor_user_id=uid and financed_customer_file_id=p_project_id
      and status in ('submitted','customer_selected','fee_pending','active')
  ) then raise exception 'LIVE_OFFER_ALREADY_EXISTS'; end if;

  if p_project_type='services' and exists (
    select 1 from public.supervisor_project_offers
    where supervisor_user_id=uid and service_project_id=p_project_id
      and status in ('submitted','customer_selected','fee_pending','active')
  ) then raise exception 'LIVE_OFFER_ALREADY_EXISTS'; end if;

  insert into public.supervisor_project_offers(
    supervisor_user_id, financed_customer_file_id, service_project_id,
    offer_price, offer_note
  ) values (
    uid,
    case when p_project_type='financed' then p_project_id else null end,
    case when p_project_type='services' then p_project_id else null end,
    round(p_offer_price,2), nullif(trim(coalesce(p_offer_note,'')),'')
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.supervisor_list_my_project_offers()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists (select 1 from public.supervisor_profiles where id=uid and status='active') then raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,
    'projectType',case when o.financed_customer_file_id is not null then 'financed' else 'services' end,
    'projectId',coalesce(o.financed_customer_file_id,o.service_project_id),
    'projectNumber',coalesce(cf.file_number,csp.project_number),
    'offerPrice',o.offer_price,
    'offerNote',o.offer_note,
    'status',o.status,
    'feeAmount',o.fee_amount,
    'feeStatus',o.fee_status,
    'createdAt',o.created_at,
    'customerSelectedAt',o.customer_selected_at,
    'adminDecidedAt',o.admin_decided_at
  ) order by o.created_at desc),'[]'::jsonb)
  into result
  from public.supervisor_project_offers o
  left join public.customer_files cf on cf.id=o.financed_customer_file_id
  left join public.customer_service_projects csp on csp.id=o.service_project_id
  where o.supervisor_user_id=uid;

  return result;
end;
$$;

create or replace function public.customer_get_supervisor_offers(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  financed boolean := false;
  service boolean := false;
  result jsonb;
begin
  if uid is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  financed := public.customer_owns_financed_file(p_project_id);
  if not financed then
    select exists(select 1 from public.customer_service_projects where id=p_project_id and customer_user_id=uid) into service;
  end if;
  if not financed and not service then raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,
    'price',o.offer_price,
    'note',o.offer_note,
    'status',o.status,
    'createdAt',o.created_at,
    'customerSelectedAt',o.customer_selected_at,
    'adminNote',case when o.status='admin_rejected' then o.admin_note else null end,
    'supervisor',jsonb_build_object(
      'id',sp.id,
      'name',sp.full_name,
      'organizationName',sp.organization_name,
      'professionalTitle',sp.professional_title,
      'city',sp.city,
      'experienceYears',sp.experience_years,
      'completedProjectsCount',sp.completed_projects_count,
      'summary',sp.profile_summary
    )
  ) order by o.offer_price asc, o.created_at asc),'[]'::jsonb)
  into result
  from public.supervisor_project_offers o
  join public.supervisor_profiles sp on sp.id=o.supervisor_user_id and sp.status='active'
  where (financed and o.financed_customer_file_id=p_project_id)
     or (service and o.service_project_id=p_project_id);

  return result;
end;
$$;

create or replace function public.customer_select_supervisor_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  offer_row public.supervisor_project_offers%rowtype;
  owns boolean := false;
begin
  if uid is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into offer_row from public.supervisor_project_offers where id=p_offer_id for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  if offer_row.status <> 'submitted' then raise exception 'OFFER_NOT_SELECTABLE'; end if;

  if offer_row.financed_customer_file_id is not null then
    owns := public.customer_owns_financed_file(offer_row.financed_customer_file_id);
    if exists (select 1 from public.project_supervisor_assignments where financed_customer_file_id=offer_row.financed_customer_file_id and status='active') then raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR'; end if;
    if exists (select 1 from public.supervisor_project_offers where financed_customer_file_id=offer_row.financed_customer_file_id and status in ('customer_selected','fee_pending','active')) then raise exception 'ANOTHER_OFFER_ALREADY_SELECTED'; end if;
  else
    select exists(select 1 from public.customer_service_projects where id=offer_row.service_project_id and customer_user_id=uid) into owns;
    if exists (select 1 from public.project_supervisor_assignments where service_project_id=offer_row.service_project_id and status='active') then raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR'; end if;
    if exists (select 1 from public.supervisor_project_offers where service_project_id=offer_row.service_project_id and status in ('customer_selected','fee_pending','active')) then raise exception 'ANOTHER_OFFER_ALREADY_SELECTED'; end if;
  end if;

  if not owns then raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN'; end if;

  update public.supervisor_project_offers
  set status='customer_selected', customer_selected_at=now(), customer_selected_by_user_id=uid
  where id=p_offer_id;
end;
$$;

create or replace function public.admin_list_selected_supervisor_offers()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare result jsonb;
begin
  if not public.is_active_platform_admin() then raise exception 'ADMIN_AUTHORIZATION_REQUIRED'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,
    'projectType',case when o.financed_customer_file_id is not null then 'financed' else 'services' end,
    'projectId',coalesce(o.financed_customer_file_id,o.service_project_id),
    'projectNumber',coalesce(cf.file_number,csp.project_number),
    'customerName',coalesce(cf.customer_name,csp.customer_name),
    'supervisorId',sp.id,
    'supervisorName',sp.full_name,
    'organizationName',sp.organization_name,
    'offerPrice',o.offer_price,
    'status',o.status,
    'feeAmount',o.fee_amount,
    'feeStatus',o.fee_status,
    'selectedAt',o.customer_selected_at,
    'adminNote',o.admin_note
  ) order by coalesce(o.customer_selected_at,o.created_at) asc),'[]'::jsonb)
  into result
  from public.supervisor_project_offers o
  join public.supervisor_profiles sp on sp.id=o.supervisor_user_id
  left join public.customer_files cf on cf.id=o.financed_customer_file_id
  left join public.customer_service_projects csp on csp.id=o.service_project_id
  where o.status in ('customer_selected','fee_pending','active','admin_rejected');

  return result;
end;
$$;

create or replace function public.admin_decide_supervisor_offer(
  p_offer_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare o public.supervisor_project_offers%rowtype;
begin
  if not public.is_active_platform_admin() then raise exception 'ADMIN_AUTHORIZATION_REQUIRED'; end if;
  select * into o from public.supervisor_project_offers where id=p_offer_id for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  if o.status <> 'customer_selected' then raise exception 'OFFER_NOT_PENDING_ADMIN'; end if;

  if p_approve then
    update public.supervisor_project_offers
    set status='fee_pending', fee_amount=round(offer_price*fee_rate,2), fee_status='pending',
        admin_decided_at=now(), admin_decided_by_user_id=auth.uid(), admin_note=nullif(trim(coalesce(p_note,'')),'')
    where id=p_offer_id;
  else
    update public.supervisor_project_offers
    set status='admin_rejected', fee_status='not_due', fee_amount=null,
        admin_decided_at=now(), admin_decided_by_user_id=auth.uid(), admin_note=nullif(trim(coalesce(p_note,'')),'')
    where id=p_offer_id;
  end if;
end;
$$;

create or replace function public.admin_confirm_supervisor_offer_fee_paid(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  o public.supervisor_project_offers%rowtype;
  assignment_id uuid;
begin
  if not public.is_active_platform_admin() then raise exception 'ADMIN_AUTHORIZATION_REQUIRED'; end if;
  select * into o from public.supervisor_project_offers where id=p_offer_id for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  if o.status <> 'fee_pending' or o.fee_status <> 'pending' then raise exception 'FEE_NOT_PENDING'; end if;

  if o.financed_customer_file_id is not null then
    assignment_id := public.admin_assign_supervisor_to_project(o.financed_customer_file_id,o.supervisor_user_id);
    update public.supervisor_project_offers
      set status='expired'
      where financed_customer_file_id=o.financed_customer_file_id and id<>o.id and status='submitted';
  else
    assignment_id := public.admin_assign_supervisor_to_project(o.service_project_id,o.supervisor_user_id);
    update public.supervisor_project_offers
      set status='expired'
      where service_project_id=o.service_project_id and id<>o.id and status='submitted';
  end if;

  update public.supervisor_project_offers
  set status='active', fee_status='paid', fee_paid_at=now(), fee_confirmed_by_user_id=auth.uid()
  where id=o.id;

  return assignment_id;
end;
$$;

revoke all on function public.supervisor_list_available_projects() from public, anon;
revoke all on function public.supervisor_submit_project_offer(text,uuid,numeric,text) from public, anon;
revoke all on function public.supervisor_list_my_project_offers() from public, anon;
revoke all on function public.customer_get_supervisor_offers(uuid) from public, anon;
revoke all on function public.customer_select_supervisor_offer(uuid) from public, anon;
revoke all on function public.admin_list_selected_supervisor_offers() from public, anon;
revoke all on function public.admin_decide_supervisor_offer(uuid,boolean,text) from public, anon;
revoke all on function public.admin_confirm_supervisor_offer_fee_paid(uuid) from public, anon;

grant execute on function public.supervisor_list_available_projects() to authenticated;
grant execute on function public.supervisor_submit_project_offer(text,uuid,numeric,text) to authenticated;
grant execute on function public.supervisor_list_my_project_offers() to authenticated;
grant execute on function public.customer_get_supervisor_offers(uuid) to authenticated;
grant execute on function public.customer_select_supervisor_offer(uuid) to authenticated;
grant execute on function public.admin_list_selected_supervisor_offers() to authenticated;
grant execute on function public.admin_decide_supervisor_offer(uuid,boolean,text) to authenticated;
grant execute on function public.admin_confirm_supervisor_offer_fee_paid(uuid) to authenticated;

commit;
