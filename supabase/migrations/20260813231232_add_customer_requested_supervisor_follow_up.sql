begin;

alter table public.supervisor_project_offers
  alter column offer_price drop not null,
  add column if not exists customer_requested_at timestamptz,
  add column if not exists customer_requested_by_user_id uuid
    references auth.users(id) on delete set null,
  add column if not exists customer_request_note text,
  add column if not exists fee_basis_area numeric(12, 2),
  add column if not exists fee_unit_rate numeric(6, 2),
  add column if not exists fee_calculated_at timestamptz,
  add column if not exists fee_due_at timestamptz;

alter table public.customer_service_projects
  add column if not exists built_up_area numeric(12, 2);

revoke all on table public.supervisor_project_offers
  from public, anon, authenticated;

alter table public.supervisor_project_offers
  drop constraint if exists supervisor_project_offers_offer_price_check,
  drop constraint if exists supervisor_project_offers_status_check,
  drop constraint if exists supervisor_project_offers_fee_basis_area_check,
  drop constraint if exists supervisor_project_offers_fee_unit_rate_check;

alter table public.customer_service_projects
  drop constraint if exists customer_service_projects_built_up_area_check;

alter table public.customer_service_projects
  add constraint customer_service_projects_built_up_area_check
    check (built_up_area is null or built_up_area > 0);

alter table public.supervisor_project_offers
  add constraint supervisor_project_offers_offer_price_check
    check (
      (status = 'requested' and offer_price is null)
      or (
        status in (
          'submitted',
          'customer_selected',
          'admin_rejected',
          'fee_pending',
          'active',
          'completed',
          'withdrawn'
        )
        and offer_price > 0
      )
      or (
        status in ('expired', 'cancelled')
        and (offer_price is null or offer_price > 0)
      )
    ),
  add constraint supervisor_project_offers_status_check
    check (
      status in (
        'requested',
        'submitted',
        'customer_selected',
        'admin_rejected',
        'fee_pending',
        'active',
        'completed',
        'withdrawn',
        'expired',
        'cancelled'
      )
    ),
  add constraint supervisor_project_offers_fee_basis_area_check
    check (fee_basis_area is null or fee_basis_area > 0),
  add constraint supervisor_project_offers_fee_unit_rate_check
    check (fee_unit_rate is null or fee_unit_rate in (0.80, 1.00, 1.50));

drop index if exists public.supervisor_project_offer_one_live_financed_per_supervisor;
create unique index supervisor_project_offer_one_live_financed_per_supervisor
  on public.supervisor_project_offers(supervisor_user_id, financed_customer_file_id)
  where financed_customer_file_id is not null
    and status in ('requested', 'submitted', 'customer_selected', 'fee_pending', 'active');

drop index if exists public.supervisor_project_offer_one_live_service_per_supervisor;
create unique index supervisor_project_offer_one_live_service_per_supervisor
  on public.supervisor_project_offers(supervisor_user_id, service_project_id)
  where service_project_id is not null
    and status in ('requested', 'submitted', 'customer_selected', 'fee_pending', 'active');

create index if not exists supervisor_project_offers_customer_requester_idx
  on public.supervisor_project_offers(customer_requested_by_user_id)
  where customer_requested_by_user_id is not null;

drop index if exists public.supervisor_project_offers_admin_queue_idx;
create index supervisor_project_offers_admin_queue_idx
  on public.supervisor_project_offers(fee_due_at, created_at)
  where fee_status = 'pending';

create index if not exists supervisor_project_offers_pending_debt_idx
  on public.supervisor_project_offers(supervisor_user_id, fee_due_at)
  where fee_status = 'pending';

comment on column public.supervisor_project_offers.customer_requested_at is
  'وقت إرسال العميل طلب تسعير الإشراف إلى المشرف.';
comment on column public.supervisor_project_offers.customer_request_note is
  'ملاحظة العميل المرسلة مع طلب تسعير الإشراف.';
comment on column public.customer_service_projects.built_up_area is
  'إجمالي المسطح المبني الفعلي بالمتر المربع، ولا يمثل مساحة الأرض.';
comment on column public.supervisor_project_offers.fee_basis_area is
  'المسطح المبني المثبت عند قبول العميل لعرض المشرف.';
comment on column public.supervisor_project_offers.fee_unit_rate is
  'رسوم المنصة لكل متر مسطح وفق عدد أدوار المشروع.';
comment on column public.supervisor_project_offers.fee_due_at is
  'وقت اكتمال مراحل المشروع وتحول رسوم المنصة إلى مديونية مستحقة.';

revoke all on function public.customer_create_service_project(
  text, text, text, numeric, text, integer, text, uuid, text, text
)
  from public, anon, authenticated;

create or replace function public.customer_create_service_project(
  p_customer_name text,
  p_customer_mobile text,
  p_property_location_url text,
  p_land_area numeric,
  p_built_up_area numeric,
  p_project_title text,
  p_floors integer,
  p_city text,
  p_stage_id uuid default null,
  p_custom_stage_name text default null,
  p_custom_stage_description text default null
)
returns table(
  id uuid,
  project_number text,
  project_type text,
  status text,
  current_stage_id uuid,
  current_stage_name text,
  custom_stage_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  created_project public.customer_service_projects%rowtype;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select lower(trim(app_user.email))
    into current_user_email
  from auth.users app_user
  where app_user.id = current_user_id;

  if current_user_email is null then
    raise exception 'CUSTOMER_EMAIL_NOT_FOUND';
  end if;

  if length(trim(coalesce(p_customer_name, ''))) < 3 then
    raise exception 'INVALID_CUSTOMER_NAME';
  end if;

  if trim(coalesce(p_customer_mobile, '')) !~ '^05[0-9]{8}$' then
    raise exception 'INVALID_CUSTOMER_MOBILE';
  end if;

  if length(trim(coalesce(p_property_location_url, ''))) < 8 then
    raise exception 'INVALID_PROPERTY_LOCATION';
  end if;

  if length(trim(coalesce(p_city, ''))) < 2 then
    raise exception 'INVALID_PROJECT_CITY';
  end if;

  if p_land_area is null or p_land_area <= 0 then
    raise exception 'INVALID_LAND_AREA';
  end if;

  if p_built_up_area is null or p_built_up_area <= 0 then
    raise exception 'INVALID_BUILT_UP_AREA';
  end if;

  if p_project_title not in ('دور', 'شقق', 'فيلا') then
    raise exception 'INVALID_PROJECT_TITLE';
  end if;

  if p_floors is null or p_floors < 1 or p_floors > 100 then
    raise exception 'INVALID_FLOORS';
  end if;

  if p_stage_id is not null then
    if not exists (
      select 1
      from public.building_stages building_stage
      where building_stage.id = p_stage_id
        and building_stage.is_active = true
    ) then
      raise exception 'INVALID_BUILDING_STAGE';
    end if;
  elsif length(trim(coalesce(p_custom_stage_name, ''))) < 2 then
    raise exception 'CUSTOM_STAGE_NAME_REQUIRED';
  end if;

  insert into public.customer_service_projects (
    customer_user_id,
    customer_name,
    customer_mobile,
    customer_email,
    property_location_url,
    city,
    land_area,
    built_up_area,
    project_title,
    floors,
    current_stage_id,
    current_custom_stage_name,
    current_custom_stage_description,
    status
  ) values (
    current_user_id,
    trim(p_customer_name),
    trim(p_customer_mobile),
    current_user_email,
    trim(p_property_location_url),
    trim(p_city),
    p_land_area,
    p_built_up_area,
    p_project_title,
    p_floors,
    p_stage_id,
    case when p_stage_id is null then trim(p_custom_stage_name) else null end,
    case
      when p_stage_id is null
        then nullif(trim(coalesce(p_custom_stage_description, '')), '')
      else null
    end,
    'active'
  )
  returning * into created_project;

  return query
  select
    created_project.id,
    created_project.project_number,
    created_project.project_type,
    created_project.status::text,
    created_project.current_stage_id,
    building_stage.stage_name,
    created_project.current_custom_stage_name,
    created_project.created_at
  from (select 1) placeholder
  left join public.building_stages building_stage
    on building_stage.id = created_project.current_stage_id;
end;
$$;

create or replace function public.customer_set_service_project_built_up_area(
  p_project_id uuid,
  p_built_up_area numeric
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_area numeric;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if p_built_up_area is null or p_built_up_area <= 0 then
    raise exception 'INVALID_BUILT_UP_AREA';
  end if;

  perform 1
  from public.customer_service_projects service_project
  where service_project.id = p_project_id
    and service_project.customer_user_id = current_user_id
    and service_project.status = 'active'
  for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if exists (
    select 1
    from public.supervisor_project_offers offer
    where offer.service_project_id = p_project_id
      and offer.status in (
        'requested',
        'submitted',
        'customer_selected',
        'fee_pending',
        'active',
        'completed'
      )
  ) then
    raise exception 'BUILT_UP_AREA_LOCKED_AFTER_SUPERVISION_REQUEST';
  end if;

  update public.customer_service_projects service_project
  set built_up_area = round(p_built_up_area, 2)
  where service_project.id = p_project_id
  returning service_project.built_up_area into saved_area;

  return saved_area;
end;
$$;

drop function if exists public.customer_get_my_service_projects();

create function public.customer_get_my_service_projects()
returns table (
  id uuid,
  project_number text,
  project_type text,
  status text,
  current_stage_id uuid,
  current_stage text,
  project_title text,
  land_area numeric,
  built_up_area numeric,
  floors integer,
  property_location_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    service_project.id,
    service_project.project_number,
    service_project.project_type,
    service_project.status::text,
    service_project.current_stage_id,
    coalesce(
      building_stage.stage_name,
      service_project.current_custom_stage_name,
      'غير محددة'
    ) as current_stage,
    service_project.project_title,
    service_project.land_area,
    service_project.built_up_area,
    service_project.floors,
    service_project.property_location_url,
    service_project.created_at,
    service_project.updated_at
  from public.customer_service_projects service_project
  left join public.building_stages building_stage
    on building_stage.id = service_project.current_stage_id
  where service_project.customer_user_id = auth.uid()
  order by service_project.created_at desc;
$$;

create or replace function public.customer_list_available_supervisors_for_project(
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  project_type text;
  project_city text;
  project_floors integer;
  project_built_up_area numeric;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if public.customer_owns_financed_file(p_project_id) then
    project_type := 'financed';

    select
      land.city,
      customer_file.floors,
      customer_file.total_building_area
      into project_city, project_floors, project_built_up_area
    from public.customer_files customer_file
    join lateral (
      select submission.city
      from public.customer_land_submissions submission
      where submission.customer_file_id = customer_file.id
        and submission.status = 'approved'
      order by submission.approved_at desc nulls last, submission.created_at desc
      limit 1
    ) land on true
    where customer_file.id = p_project_id
      and customer_file.status in (
        'land_approved',
        'waiting_transfer',
        'transfer_in_progress',
        'active_project'
      );
  elsif exists (
    select 1
    from public.customer_service_projects service_project
    where service_project.id = p_project_id
      and service_project.customer_user_id = current_user_id
  ) then
    project_type := 'services';

    select
      service_project.city,
      service_project.floors,
      service_project.built_up_area
      into project_city, project_floors, project_built_up_area
    from public.customer_service_projects service_project
    where service_project.id = p_project_id
      and service_project.customer_user_id = current_user_id
      and service_project.status = 'active';
  else
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if project_city is null or length(trim(project_city)) < 2 then
    raise exception 'PROJECT_NOT_AVAILABLE_FOR_SUPERVISION';
  end if;

  if project_floors not in (1, 2, 3) then
    raise exception 'UNSUPPORTED_FLOOR_COUNT_FOR_PLATFORM_FEE';
  end if;

  if project_built_up_area is null or project_built_up_area <= 0 then
    raise exception 'PROJECT_BUILT_UP_AREA_REQUIRED';
  end if;

  if exists (
    select 1
    from public.supervisor_project_offers completed_offer
    where completed_offer.status = 'completed'
      and (
        (project_type = 'financed' and completed_offer.financed_customer_file_id = p_project_id)
        or (project_type = 'services' and completed_offer.service_project_id = p_project_id)
      )
  ) then
    raise exception 'PROJECT_SUPERVISION_COMPLETED';
  end if;

  if exists (
    select 1
    from public.project_supervisor_assignments assignment
    where assignment.status = 'active'
      and (
        (project_type = 'financed' and assignment.financed_customer_file_id = p_project_id)
        or (project_type = 'services' and assignment.service_project_id = p_project_id)
      )
  ) then
    raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', profile.id,
        'name', profile.full_name,
        'organizationName', profile.organization_name,
        'professionalTitle', profile.professional_title,
        'city', profile.city,
        'serviceAreas', profile.service_areas,
        'experienceYears', profile.experience_years,
        'completedProjectsCount', profile.completed_projects_count,
        'summary', profile.profile_summary,
        'requestId', live_offer.id,
        'requestStatus', live_offer.status,
        'requestedAt', live_offer.customer_requested_at
      )
      order by profile.full_name
    ),
    '[]'::jsonb
  )
    into result
  from public.supervisor_profiles profile
  left join lateral (
    select offer.id, offer.status, offer.customer_requested_at
    from public.supervisor_project_offers offer
    where offer.supervisor_user_id = profile.id
      and (
        (project_type = 'financed' and offer.financed_customer_file_id = p_project_id)
        or (project_type = 'services' and offer.service_project_id = p_project_id)
      )
      and offer.status in ('requested', 'submitted', 'customer_selected', 'fee_pending', 'active')
    order by offer.created_at desc
    limit 1
  ) live_offer on true
  where profile.status = 'active'
    and not exists (
      select 1
      from public.supervisor_project_offers debt
      where debt.supervisor_user_id = profile.id
        and debt.fee_status = 'pending'
    )
    and (
      lower(trim(coalesce(profile.city, ''))) = lower(trim(project_city))
      or exists (
        select 1
        from unnest(coalesce(profile.service_areas, '{}'::text[])) service_area
        where lower(trim(service_area)) = lower(trim(project_city))
      )
    );

  return result;
end;
$$;

create or replace function public.customer_request_supervisor_offer(
  p_project_id uuid,
  p_supervisor_user_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  project_type text;
  project_city text;
  project_floors integer;
  project_built_up_area numeric;
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
  supervisor_profile public.supervisor_profiles%rowtype;
  new_request_id uuid;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if p_supervisor_user_id is null then
    raise exception 'SUPERVISOR_REQUIRED';
  end if;

  if length(coalesce(clean_note, '')) > 1000 then
    raise exception 'REQUEST_NOTE_TOO_LONG';
  end if;

  if public.customer_owns_financed_file(p_project_id) then
    project_type := 'financed';

    select customer_file.floors, customer_file.total_building_area
      into project_floors, project_built_up_area
    from public.customer_files customer_file
    where customer_file.id = p_project_id
      and customer_file.status in (
        'land_approved',
        'waiting_transfer',
        'transfer_in_progress',
        'active_project'
      )
    for update;

    if not found then
      raise exception 'PROJECT_NOT_AVAILABLE_FOR_SUPERVISION';
    end if;

    select submission.city
      into project_city
    from public.customer_land_submissions submission
    where submission.customer_file_id = p_project_id
      and submission.status = 'approved'
    order by submission.approved_at desc nulls last, submission.created_at desc
    limit 1;
  elsif exists (
    select 1
    from public.customer_service_projects service_project
    where service_project.id = p_project_id
      and service_project.customer_user_id = current_user_id
  ) then
    project_type := 'services';

    select
      service_project.city,
      service_project.floors,
      service_project.built_up_area
      into project_city, project_floors, project_built_up_area
    from public.customer_service_projects service_project
    where service_project.id = p_project_id
      and service_project.customer_user_id = current_user_id
      and service_project.status = 'active'
    for update;

    if not found then
      raise exception 'PROJECT_NOT_AVAILABLE_FOR_SUPERVISION';
    end if;
  else
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if project_city is null or length(trim(project_city)) < 2 then
    raise exception 'PROJECT_NOT_AVAILABLE_FOR_SUPERVISION';
  end if;

  if project_floors not in (1, 2, 3) then
    raise exception 'UNSUPPORTED_FLOOR_COUNT_FOR_PLATFORM_FEE';
  end if;

  if project_built_up_area is null or project_built_up_area <= 0 then
    raise exception 'PROJECT_BUILT_UP_AREA_REQUIRED';
  end if;

  if exists (
    select 1
    from public.project_supervisor_assignments assignment
    where assignment.status = 'active'
      and (
        (project_type = 'financed' and assignment.financed_customer_file_id = p_project_id)
        or (project_type = 'services' and assignment.service_project_id = p_project_id)
      )
  ) then
    raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR';
  end if;

  if exists (
    select 1
    from public.supervisor_project_offers selected_offer
    where selected_offer.status in ('customer_selected', 'fee_pending', 'active', 'completed')
      and (
        (project_type = 'financed' and selected_offer.financed_customer_file_id = p_project_id)
        or (project_type = 'services' and selected_offer.service_project_id = p_project_id)
      )
  ) then
    raise exception 'PROJECT_OFFERING_CLOSED';
  end if;

  select *
    into supervisor_profile
  from public.supervisor_profiles profile
  where profile.id = p_supervisor_user_id
    and profile.status = 'active'
  for share;

  if not found then
    raise exception 'SUPERVISOR_NOT_AVAILABLE';
  end if;

  if exists (
    select 1
    from public.supervisor_project_offers debt
    where debt.supervisor_user_id = p_supervisor_user_id
      and debt.fee_status = 'pending'
  ) then
    raise exception 'SUPERVISOR_HAS_OUTSTANDING_PLATFORM_DEBT';
  end if;

  if not (
    lower(trim(coalesce(supervisor_profile.city, ''))) = lower(trim(project_city))
    or exists (
      select 1
      from unnest(coalesce(supervisor_profile.service_areas, '{}'::text[])) service_area
      where lower(trim(service_area)) = lower(trim(project_city))
    )
  ) then
    raise exception 'SUPERVISOR_OUTSIDE_PROJECT_AREA';
  end if;

  insert into public.supervisor_project_offers (
    supervisor_user_id,
    financed_customer_file_id,
    service_project_id,
    offer_price,
    offer_note,
    status,
    customer_requested_at,
    customer_requested_by_user_id,
    customer_request_note
  ) values (
    p_supervisor_user_id,
    case when project_type = 'financed' then p_project_id else null end,
    case when project_type = 'services' then p_project_id else null end,
    null,
    null,
    'requested',
    now(),
    current_user_id,
    clean_note
  )
  returning id into new_request_id;

  return new_request_id;
exception
  when unique_violation then
    raise exception 'LIVE_REQUEST_OR_OFFER_ALREADY_EXISTS';
end;
$$;

create or replace function public.supervisor_list_available_projects()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.supervisor_profiles profile
    where profile.id = current_user_id
      and profile.status = 'active'
  ) then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  if exists (
    select 1
    from public.supervisor_project_offers debt
    where debt.supervisor_user_id = current_user_id
      and debt.fee_status = 'pending'
  ) then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(item order by item->>'requestedAt', item->>'projectNumber'),
    '[]'::jsonb
  )
    into result
  from (
    select jsonb_build_object(
      'requestId', request.id,
      'projectType', 'financed',
      'projectId', customer_file.id,
      'projectNumber', customer_file.file_number,
      'projectTitle', 'مشروع بناء ممول',
      'city', land.city,
      'district', land.district,
      'locationUrl', land.google_maps_url,
      'landArea', customer_file.land_area,
      'builtUpArea', customer_file.total_building_area,
      'floors', customer_file.floors,
      'currentStage', customer_file.current_stage,
      'customerRequestNote', request.customer_request_note,
      'requestedAt', request.customer_requested_at,
      'myOfferStatus', request.status,
      'myOfferPrice', request.offer_price
    ) as item
    from public.supervisor_project_offers request
    join public.customer_files customer_file
      on customer_file.id = request.financed_customer_file_id
    join lateral (
      select submission.city, submission.district, submission.google_maps_url
      from public.customer_land_submissions submission
      where submission.customer_file_id = customer_file.id
        and submission.status = 'approved'
      order by submission.approved_at desc nulls last, submission.created_at desc
      limit 1
    ) land on true
    where request.supervisor_user_id = current_user_id
      and request.status = 'requested'
      and customer_file.status in (
        'land_approved',
        'waiting_transfer',
        'transfer_in_progress',
        'active_project'
      )
      and not exists (
        select 1
        from public.project_supervisor_assignments assignment
        where assignment.financed_customer_file_id = customer_file.id
          and assignment.status = 'active'
      )

    union all

    select jsonb_build_object(
      'requestId', request.id,
      'projectType', 'services',
      'projectId', service_project.id,
      'projectNumber', service_project.project_number,
      'projectTitle', service_project.project_title,
      'city', service_project.city,
      'district', null,
      'locationUrl', service_project.property_location_url,
      'landArea', service_project.land_area,
      'builtUpArea', service_project.built_up_area,
      'floors', service_project.floors,
      'currentStage', coalesce(building_stage.stage_name, service_project.current_custom_stage_name),
      'customerRequestNote', request.customer_request_note,
      'requestedAt', request.customer_requested_at,
      'myOfferStatus', request.status,
      'myOfferPrice', request.offer_price
    ) as item
    from public.supervisor_project_offers request
    join public.customer_service_projects service_project
      on service_project.id = request.service_project_id
    left join public.building_stages building_stage
      on building_stage.id = service_project.current_stage_id
    where request.supervisor_user_id = current_user_id
      and request.status = 'requested'
      and service_project.status = 'active'
      and not exists (
        select 1
        from public.project_supervisor_assignments assignment
        where assignment.service_project_id = service_project.id
          and assignment.status = 'active'
      )
  ) requested_projects;

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
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  supervisor_profile public.supervisor_profiles%rowtype;
  request_row public.supervisor_project_offers%rowtype;
  project_city text;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if p_offer_price is null or p_offer_price <= 0 then
    raise exception 'INVALID_OFFER_PRICE';
  end if;

  select *
    into supervisor_profile
  from public.supervisor_profiles profile
  where profile.id = current_user_id
    and profile.status = 'active'
  for share;

  if not found then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  if exists (
    select 1
    from public.supervisor_project_offers debt
    where debt.supervisor_user_id = current_user_id
      and debt.fee_status = 'pending'
  ) then
    raise exception 'SUPERVISOR_HAS_OUTSTANDING_PLATFORM_DEBT';
  end if;

  if p_project_type = 'financed' then
    select *
      into request_row
    from public.supervisor_project_offers request
    where request.supervisor_user_id = current_user_id
      and request.financed_customer_file_id = p_project_id
      and request.status = 'requested'
    order by request.created_at desc
    limit 1
    for update;

    select submission.city
      into project_city
    from public.customer_files customer_file
    join lateral (
      select land.city
      from public.customer_land_submissions land
      where land.customer_file_id = customer_file.id
        and land.status = 'approved'
      order by land.approved_at desc nulls last, land.created_at desc
      limit 1
    ) submission on true
    where customer_file.id = p_project_id
      and customer_file.status in (
        'land_approved',
        'waiting_transfer',
        'transfer_in_progress',
        'active_project'
      );
  elsif p_project_type = 'services' then
    select *
      into request_row
    from public.supervisor_project_offers request
    where request.supervisor_user_id = current_user_id
      and request.service_project_id = p_project_id
      and request.status = 'requested'
    order by request.created_at desc
    limit 1
    for update;

    select service_project.city
      into project_city
    from public.customer_service_projects service_project
    where service_project.id = p_project_id
      and service_project.status = 'active';
  else
    raise exception 'INVALID_PROJECT_TYPE';
  end if;

  if request_row.id is null then
    raise exception 'SUPERVISION_REQUEST_REQUIRED';
  end if;

  if project_city is null then
    raise exception 'PROJECT_NOT_AVAILABLE';
  end if;

  if exists (
    select 1
    from public.project_supervisor_assignments assignment
    where assignment.status = 'active'
      and (
        (p_project_type = 'financed' and assignment.financed_customer_file_id = p_project_id)
        or (p_project_type = 'services' and assignment.service_project_id = p_project_id)
      )
  ) then
    raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR';
  end if;

  if exists (
    select 1
    from public.supervisor_project_offers selected_offer
    where selected_offer.id <> request_row.id
      and selected_offer.status in ('customer_selected', 'fee_pending', 'active', 'completed')
      and (
        (p_project_type = 'financed' and selected_offer.financed_customer_file_id = p_project_id)
        or (p_project_type = 'services' and selected_offer.service_project_id = p_project_id)
      )
  ) then
    raise exception 'PROJECT_OFFERING_CLOSED';
  end if;

  if not (
    lower(trim(project_city)) = lower(trim(coalesce(supervisor_profile.city, '')))
    or exists (
      select 1
      from unnest(coalesce(supervisor_profile.service_areas, '{}'::text[])) service_area
      where lower(trim(service_area)) = lower(trim(project_city))
    )
  ) then
    raise exception 'PROJECT_OUTSIDE_SERVICE_AREA';
  end if;

  update public.supervisor_project_offers
  set offer_price = round(p_offer_price, 2),
      offer_note = nullif(trim(coalesce(p_offer_note, '')), ''),
      status = 'submitted'
  where id = request_row.id;

  return request_row.id;
end;
$$;

create or replace function public.supervisor_list_my_project_offers()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.supervisor_profiles profile
    where profile.id = current_user_id
      and profile.status = 'active'
  ) then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', offer.id,
        'projectType', case when offer.financed_customer_file_id is not null then 'financed' else 'services' end,
        'projectId', coalesce(offer.financed_customer_file_id, offer.service_project_id),
        'projectNumber', coalesce(customer_file.file_number, service_project.project_number),
        'offerPrice', offer.offer_price,
        'offerNote', offer.offer_note,
        'status', offer.status,
        'customerRequestNote', offer.customer_request_note,
        'requestedAt', offer.customer_requested_at,
        'feeAmount', offer.fee_amount,
        'feeBasisArea', offer.fee_basis_area,
        'feeUnitRate', offer.fee_unit_rate,
        'feeStatus', offer.fee_status,
        'feeCalculatedAt', offer.fee_calculated_at,
        'feeDueAt', offer.fee_due_at,
        'feePaidAt', offer.fee_paid_at,
        'createdAt', offer.created_at,
        'customerSelectedAt', offer.customer_selected_at,
        'adminDecidedAt', offer.admin_decided_at
      )
      order by offer.created_at desc
    ),
    '[]'::jsonb
  )
    into result
  from public.supervisor_project_offers offer
  left join public.customer_files customer_file
    on customer_file.id = offer.financed_customer_file_id
  left join public.customer_service_projects service_project
    on service_project.id = offer.service_project_id
  where offer.supervisor_user_id = current_user_id;

  return result;
end;
$$;

create or replace function public.customer_get_supervisor_offers(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  financed_project boolean := false;
  service_project boolean := false;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  financed_project := public.customer_owns_financed_file(p_project_id);

  if not financed_project then
    select exists (
      select 1
      from public.customer_service_projects project
      where project.id = p_project_id
        and project.customer_user_id = current_user_id
    ) into service_project;
  end if;

  if not financed_project and not service_project then
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', offer.id,
        'price', offer.offer_price,
        'note', offer.offer_note,
        'status', offer.status,
        'createdAt', offer.created_at,
        'requestedAt', offer.customer_requested_at,
        'requestNote', offer.customer_request_note,
        'customerSelectedAt', offer.customer_selected_at,
        'adminNote', case when offer.status = 'admin_rejected' then offer.admin_note else null end,
        'supervisor', jsonb_build_object(
          'id', profile.id,
          'name', profile.full_name,
          'organizationName', profile.organization_name,
          'professionalTitle', profile.professional_title,
          'city', profile.city,
          'experienceYears', profile.experience_years,
          'completedProjectsCount', profile.completed_projects_count,
          'summary', profile.profile_summary
        )
      )
      order by (offer.offer_price is null), offer.offer_price, offer.created_at
    ),
    '[]'::jsonb
  )
    into result
  from public.supervisor_project_offers offer
  join public.supervisor_profiles profile
    on profile.id = offer.supervisor_user_id
  where (
      financed_project
      and offer.financed_customer_file_id = p_project_id
    )
    or (
      service_project
      and offer.service_project_id = p_project_id
    );

  return result;
end;
$$;

create or replace function public.customer_select_supervisor_offer(
  p_offer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  offer_row public.supervisor_project_offers%rowtype;
  owns_project boolean := false;
  project_floors integer;
  project_built_up_area numeric;
  platform_fee_unit_rate numeric(6, 2);
  new_assignment_id uuid;
  selected_building_stage public.building_stages%rowtype;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select *
    into offer_row
  from public.supervisor_project_offers offer
  where offer.id = p_offer_id;

  if not found then
    raise exception 'OFFER_NOT_FOUND';
  end if;

  if offer_row.financed_customer_file_id is not null then
    owns_project := public.customer_owns_financed_file(
      offer_row.financed_customer_file_id
    );

    if not owns_project then
      raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
    end if;

    select
      customer_file.floors,
      customer_file.total_building_area
      into project_floors, project_built_up_area
    from public.customer_files customer_file
    where customer_file.id = offer_row.financed_customer_file_id
      and customer_file.status in (
        'land_approved',
        'waiting_transfer',
        'transfer_in_progress',
        'active_project'
      )
    for update;

    if not found then
      raise exception 'PROJECT_NOT_AVAILABLE_FOR_SUPERVISION';
    end if;
  else
    select
      service_project.floors,
      service_project.built_up_area
      into project_floors, project_built_up_area
    from public.customer_service_projects service_project
    where service_project.id = offer_row.service_project_id
      and service_project.customer_user_id = current_user_id
      and service_project.status = 'active'
    for update;

    owns_project := found;

    if not owns_project then
      raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
    end if;
  end if;

  select *
    into offer_row
  from public.supervisor_project_offers offer
  where offer.id = p_offer_id
  for update;

  if not found then
    raise exception 'OFFER_NOT_FOUND';
  end if;

  if offer_row.status <> 'submitted' then
    raise exception 'OFFER_NOT_SELECTABLE';
  end if;

  perform 1
  from public.supervisor_profiles profile
  where profile.id = offer_row.supervisor_user_id
    and profile.status = 'active'
  for update;

  if not found then
    raise exception 'SUPERVISOR_NOT_AVAILABLE';
  end if;

  if exists (
    select 1
    from public.supervisor_project_offers debt
    where debt.supervisor_user_id = offer_row.supervisor_user_id
      and debt.fee_status = 'pending'
  ) then
    raise exception 'SUPERVISOR_HAS_OUTSTANDING_PLATFORM_DEBT';
  end if;

  if project_floors not in (1, 2, 3) then
    raise exception 'UNSUPPORTED_FLOOR_COUNT_FOR_PLATFORM_FEE';
  end if;

  if project_built_up_area is null or project_built_up_area <= 0 then
    raise exception 'PROJECT_BUILT_UP_AREA_REQUIRED';
  end if;

  platform_fee_unit_rate := case project_floors
    when 1 then 1.50
    when 2 then 1.00
    when 3 then 0.80
  end;

  if offer_row.financed_customer_file_id is not null then
    if exists (
      select 1
      from public.project_supervisor_assignments assignment
      where assignment.financed_customer_file_id = offer_row.financed_customer_file_id
        and assignment.status = 'active'
    ) then
      raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR';
    end if;

    if exists (
      select 1
      from public.supervisor_project_offers selected_offer
      where selected_offer.financed_customer_file_id = offer_row.financed_customer_file_id
        and selected_offer.status in ('customer_selected', 'fee_pending', 'active', 'completed')
    ) then
      raise exception 'ANOTHER_OFFER_ALREADY_SELECTED';
    end if;
  else
    if exists (
      select 1
      from public.project_supervisor_assignments assignment
      where assignment.service_project_id = offer_row.service_project_id
        and assignment.status = 'active'
    ) then
      raise exception 'PROJECT_ALREADY_HAS_SUPERVISOR';
    end if;

    if exists (
      select 1
      from public.supervisor_project_offers selected_offer
      where selected_offer.service_project_id = offer_row.service_project_id
        and selected_offer.status in ('customer_selected', 'fee_pending', 'active', 'completed')
    ) then
      raise exception 'ANOTHER_OFFER_ALREADY_SELECTED';
    end if;
  end if;

  insert into public.project_supervisor_assignments (
    supervisor_user_id,
    financed_customer_file_id,
    service_project_id,
    status,
    assigned_by_user_id
  ) values (
    offer_row.supervisor_user_id,
    offer_row.financed_customer_file_id,
    offer_row.service_project_id,
    'active',
    current_user_id
  )
  returning id into new_assignment_id;

  if offer_row.financed_customer_file_id is not null
    and not exists (
      select 1
      from public.project_construction_stages project_stage
      where project_stage.financed_customer_file_id = offer_row.financed_customer_file_id
        and project_stage.status <> 'cancelled'
    ) then
    select building_stage.*
      into selected_building_stage
    from public.building_stages building_stage
    where building_stage.is_active = true
    order by building_stage.stage_order
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
        offer_row.financed_customer_file_id,
        selected_building_stage.id,
        selected_building_stage.main_stage_name,
        selected_building_stage.stage_name,
        false,
        'planned'
      );
    end if;
  end if;

  if offer_row.service_project_id is not null
    and not exists (
      select 1
      from public.project_construction_stages project_stage
      where project_stage.service_project_id = offer_row.service_project_id
        and project_stage.status <> 'cancelled'
    ) then
    select building_stage.*
      into selected_building_stage
    from public.customer_service_projects service_project
    join public.building_stages building_stage
      on building_stage.id = service_project.current_stage_id
    where service_project.id = offer_row.service_project_id
      and building_stage.is_active = true
    limit 1;

    if selected_building_stage.id is null then
      select building_stage.*
        into selected_building_stage
      from public.building_stages building_stage
      where building_stage.is_active = true
      order by building_stage.stage_order
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
        offer_row.service_project_id,
        selected_building_stage.id,
        selected_building_stage.main_stage_name,
        selected_building_stage.stage_name,
        false,
        'planned'
      );
    end if;
  end if;

  update public.supervisor_project_offers other_offer
  set status = 'expired'
  where other_offer.id <> offer_row.id
    and other_offer.status in ('requested', 'submitted')
    and (
      (
        offer_row.financed_customer_file_id is not null
        and other_offer.financed_customer_file_id = offer_row.financed_customer_file_id
      )
      or (
        offer_row.service_project_id is not null
        and other_offer.service_project_id = offer_row.service_project_id
      )
    );

  update public.supervisor_project_offers
  set status = 'active',
      customer_selected_at = now(),
      customer_selected_by_user_id = current_user_id,
      fee_rate = 0,
      fee_basis_area = round(project_built_up_area, 2),
      fee_unit_rate = platform_fee_unit_rate,
      fee_amount = round(project_built_up_area * platform_fee_unit_rate, 2),
      fee_status = 'not_due',
      fee_calculated_at = now(),
      fee_due_at = null,
      fee_paid_at = null,
      fee_confirmed_by_user_id = null,
      admin_decided_at = null,
      admin_decided_by_user_id = null,
      admin_note = null
  where id = offer_row.id;
end;
$$;

create or replace function public.admin_list_selected_supervisor_offers()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', offer.id,
        'projectType', case when offer.financed_customer_file_id is not null then 'financed' else 'services' end,
        'projectId', coalesce(offer.financed_customer_file_id, offer.service_project_id),
        'projectNumber', coalesce(customer_file.file_number, service_project.project_number),
        'customerName', coalesce(customer_file.customer_name, service_project.customer_name),
        'supervisorId', profile.id,
        'supervisorName', profile.full_name,
        'organizationName', profile.organization_name,
        'offerPrice', offer.offer_price,
        'requestNote', offer.customer_request_note,
        'requestedAt', offer.customer_requested_at,
        'status', offer.status,
        'floors', coalesce(customer_file.floors, service_project.floors),
        'feeAmount', offer.fee_amount,
        'feeBasisArea', offer.fee_basis_area,
        'feeUnitRate', offer.fee_unit_rate,
        'feeStatus', offer.fee_status,
        'feeCalculatedAt', offer.fee_calculated_at,
        'feeDueAt', offer.fee_due_at,
        'feePaidAt', offer.fee_paid_at,
        'selectedAt', offer.customer_selected_at,
        'adminDecidedAt', offer.admin_decided_at,
        'adminNote', offer.admin_note
      )
      order by
        case offer.fee_status
          when 'pending' then 0
          when 'not_due' then 1
          when 'paid' then 2
          else 3
        end,
        coalesce(offer.fee_due_at, offer.customer_selected_at, offer.created_at) desc
    ),
    '[]'::jsonb
  )
    into result
  from public.supervisor_project_offers offer
  join public.supervisor_profiles profile
    on profile.id = offer.supervisor_user_id
  left join public.customer_files customer_file
    on customer_file.id = offer.financed_customer_file_id
  left join public.customer_service_projects service_project
    on service_project.id = offer.service_project_id
  where offer.status in (
    'customer_selected',
    'fee_pending',
    'active',
    'completed',
    'admin_rejected'
  );

  return result;
end;
$$;

create or replace function public.admin_confirm_supervisor_offer_fee_paid(
  p_offer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer_row public.supervisor_project_offers%rowtype;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  select *
    into offer_row
  from public.supervisor_project_offers offer
  where offer.id = p_offer_id
  for update;

  if not found then
    raise exception 'OFFER_NOT_FOUND';
  end if;

  if offer_row.status <> 'completed' or offer_row.fee_status <> 'pending' then
    raise exception 'FEE_NOT_PENDING';
  end if;

  update public.supervisor_project_offers
  set fee_status = 'paid',
      fee_paid_at = now(),
      fee_confirmed_by_user_id = auth.uid()
  where id = offer_row.id;

  return offer_row.id;
end;
$$;

create or replace function public.supervisor_complete_construction_stage(
  p_project_stage_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_stage public.project_construction_stages%rowtype;
  next_building_stage public.building_stages%rowtype;
  next_stage_id uuid;
  missing_required_count integer := 0;
  project_is_complete boolean := false;
  fee_became_due boolean := false;
  due_fee_amount numeric;
begin
  if current_user_id is null
    or not public.is_active_supervisor()
    or not public.supervisor_is_assigned_to_project_stage(p_project_stage_id) then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  perform 1
  from public.supervisor_profiles profile
  where profile.id = current_user_id
    and profile.status = 'active'
  for update;

  if not found then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
  end if;

  select project_stage.*
    into target_stage
  from public.project_construction_stages project_stage
  where project_stage.id = p_project_stage_id
  for update;

  if target_stage.id is null then
    raise exception 'PROJECT_STAGE_NOT_FOUND';
  end if;

  if target_stage.status = 'completed' then
    return jsonb_build_object(
      'completedStageId', target_stage.id,
      'nextStageId', null,
      'alreadyCompleted', true,
      'projectCompleted', false,
      'feeBecameDue', false
    );
  end if;

  if target_stage.status not in ('planned', 'in_progress') then
    raise exception 'PROJECT_STAGE_NOT_COMPLETABLE';
  end if;

  select count(*)
    into missing_required_count
  from public.construction_standard_items standard_item
  where standard_item.is_required = true
    and (
      (
        standard_item.standard_scope = 'project'
        and standard_item.project_stage_id = target_stage.id
      )
      or (
        standard_item.standard_scope = 'general'
        and target_stage.building_stage_id is not null
        and standard_item.building_stage_id = target_stage.building_stage_id
      )
    )
    and not exists (
      select 1
      from public.project_construction_item_checks item_check
      where item_check.project_stage_id = target_stage.id
        and item_check.standard_item_id = standard_item.id
        and item_check.is_checked = true
    );

  if missing_required_count > 0 then
    raise exception 'REQUIRED_STANDARDS_INCOMPLETE:%', missing_required_count;
  end if;

  update public.project_construction_stages project_stage
  set status = 'completed',
      completed_at = now(),
      started_at = coalesce(project_stage.started_at, now()),
      updated_at = now()
  where project_stage.id = target_stage.id;

  if target_stage.is_custom = false and target_stage.building_stage_id is not null then
    select later_stage.*
      into next_building_stage
    from public.building_stages current_stage
    join public.building_stages later_stage
      on later_stage.stage_order > current_stage.stage_order
     and later_stage.is_active = true
    where current_stage.id = target_stage.building_stage_id
    order by later_stage.stage_order
    limit 1;

    if next_building_stage.id is not null then
      select project_stage.id
        into next_stage_id
      from public.project_construction_stages project_stage
      where project_stage.building_stage_id = next_building_stage.id
        and (
          (
            target_stage.financed_customer_file_id is not null
            and project_stage.financed_customer_file_id = target_stage.financed_customer_file_id
          )
          or (
            target_stage.service_project_id is not null
            and project_stage.service_project_id = target_stage.service_project_id
          )
        )
        and project_stage.status <> 'cancelled'
      order by project_stage.created_at desc
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
        )
        returning id into next_stage_id;
      end if;

      if target_stage.service_project_id is not null then
        update public.customer_service_projects service_project
        set current_stage_id = next_building_stage.id,
            current_custom_stage_name = null,
            current_custom_stage_description = null,
            updated_at = now()
        where service_project.id = target_stage.service_project_id;
      end if;
    end if;
  end if;

  select not exists (
    select 1
    from public.project_construction_stages unfinished_stage
    where unfinished_stage.status in ('planned', 'in_progress')
      and (
        (
          target_stage.financed_customer_file_id is not null
          and unfinished_stage.financed_customer_file_id = target_stage.financed_customer_file_id
        )
        or (
          target_stage.service_project_id is not null
          and unfinished_stage.service_project_id = target_stage.service_project_id
        )
      )
  ) into project_is_complete;

  if project_is_complete then
    update public.supervisor_project_offers offer
    set status = 'completed',
        fee_status = 'pending',
        fee_due_at = now()
    where offer.supervisor_user_id = current_user_id
      and offer.status = 'active'
      and offer.fee_status = 'not_due'
      and (
        (
          target_stage.financed_customer_file_id is not null
          and offer.financed_customer_file_id = target_stage.financed_customer_file_id
        )
        or (
          target_stage.service_project_id is not null
          and offer.service_project_id = target_stage.service_project_id
        )
      )
    returning offer.fee_amount into due_fee_amount;

    fee_became_due := found;

    if not fee_became_due then
      raise exception 'ACTIVE_SUPERVISION_OFFER_NOT_FOUND';
    end if;

    update public.project_supervisor_assignments assignment
    set status = 'ended',
        ended_at = now(),
        updated_at = now()
    where assignment.supervisor_user_id = current_user_id
      and assignment.status = 'active'
      and (
        (
          target_stage.financed_customer_file_id is not null
          and assignment.financed_customer_file_id = target_stage.financed_customer_file_id
        )
        or (
          target_stage.service_project_id is not null
          and assignment.service_project_id = target_stage.service_project_id
        )
      );

    if target_stage.service_project_id is not null then
      update public.customer_service_projects service_project
      set status = 'completed',
          completed_at = coalesce(service_project.completed_at, now()),
          updated_at = now()
      where service_project.id = target_stage.service_project_id;
    end if;
  end if;

  return jsonb_build_object(
    'completedStageId', target_stage.id,
    'nextStageId', next_stage_id,
    'alreadyCompleted', false,
    'projectCompleted', project_is_complete,
    'feeBecameDue', fee_became_due,
    'feeAmount', due_fee_amount
  );
end;
$$;

revoke all on function public.customer_list_available_supervisors_for_project(uuid)
  from public, anon;
revoke all on function public.customer_create_service_project(
  text, text, text, numeric, numeric, text, integer, text, uuid, text, text
)
  from public, anon, authenticated;
revoke all on function public.customer_set_service_project_built_up_area(uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.customer_get_my_service_projects()
  from public, anon, authenticated;
revoke all on function public.customer_request_supervisor_offer(uuid, uuid, text)
  from public, anon;
revoke all on function public.supervisor_list_available_projects()
  from public, anon;
revoke all on function public.supervisor_submit_project_offer(text, uuid, numeric, text)
  from public, anon;
revoke all on function public.supervisor_list_my_project_offers()
  from public, anon;
revoke all on function public.customer_get_supervisor_offers(uuid)
  from public, anon;
revoke all on function public.customer_select_supervisor_offer(uuid)
  from public, anon;
revoke all on function public.admin_list_selected_supervisor_offers()
  from public, anon;
revoke all on function public.admin_confirm_supervisor_offer_fee_paid(uuid)
  from public, anon;
revoke all on function public.admin_decide_supervisor_offer(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.supervisor_complete_construction_stage(uuid)
  from public, anon;

grant execute on function public.customer_list_available_supervisors_for_project(uuid)
  to authenticated;
grant execute on function public.customer_create_service_project(
  text, text, text, numeric, numeric, text, integer, text, uuid, text, text
)
  to authenticated;
grant execute on function public.customer_set_service_project_built_up_area(uuid, numeric)
  to authenticated;
grant execute on function public.customer_get_my_service_projects()
  to authenticated;
grant execute on function public.customer_request_supervisor_offer(uuid, uuid, text)
  to authenticated;
grant execute on function public.supervisor_list_available_projects()
  to authenticated;
grant execute on function public.supervisor_submit_project_offer(text, uuid, numeric, text)
  to authenticated;
grant execute on function public.supervisor_list_my_project_offers()
  to authenticated;
grant execute on function public.customer_get_supervisor_offers(uuid)
  to authenticated;
grant execute on function public.customer_select_supervisor_offer(uuid)
  to authenticated;
grant execute on function public.admin_list_selected_supervisor_offers()
  to authenticated;
grant execute on function public.admin_confirm_supervisor_offer_fee_paid(uuid)
  to authenticated;
grant execute on function public.supervisor_complete_construction_stage(uuid)
  to authenticated;

commit;
