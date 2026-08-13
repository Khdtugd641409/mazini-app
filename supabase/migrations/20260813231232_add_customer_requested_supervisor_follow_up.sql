begin;

alter table public.supervisor_project_offers
  alter column offer_price drop not null,
  add column if not exists customer_requested_at timestamptz,
  add column if not exists customer_requested_by_user_id uuid
    references auth.users(id) on delete set null,
  add column if not exists customer_request_note text;

revoke all on table public.supervisor_project_offers
  from public, anon, authenticated;

alter table public.supervisor_project_offers
  drop constraint if exists supervisor_project_offers_offer_price_check,
  drop constraint if exists supervisor_project_offers_status_check;

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
        'withdrawn',
        'expired',
        'cancelled'
      )
    );

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

create index if not exists supervisor_project_offers_admin_queue_idx
  on public.supervisor_project_offers(customer_selected_at, created_at)
  where status in ('customer_selected', 'fee_pending');

comment on column public.supervisor_project_offers.customer_requested_at is
  'وقت إرسال العميل طلب تسعير الإشراف إلى المشرف.';
comment on column public.supervisor_project_offers.customer_request_note is
  'ملاحظة العميل المرسلة مع طلب تسعير الإشراف.';

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
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if public.customer_owns_financed_file(p_project_id) then
    project_type := 'financed';

    select land.city
      into project_city
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

    select service_project.city
      into project_city
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

    perform 1
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

    select service_project.city
      into project_city
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
    where selected_offer.status in ('customer_selected', 'fee_pending', 'active')
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
    and profile.status = 'active';

  if not found then
    raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED';
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
      and selected_offer.status in ('customer_selected', 'fee_pending', 'active')
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
        'feeStatus', offer.fee_status,
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

    perform 1
    from public.customer_files customer_file
    where customer_file.id = offer_row.financed_customer_file_id
    for update;
  else
    perform 1
    from public.customer_service_projects service_project
    where service_project.id = offer_row.service_project_id
      and service_project.customer_user_id = current_user_id
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
        and selected_offer.status in ('customer_selected', 'fee_pending', 'active')
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
        and selected_offer.status in ('customer_selected', 'fee_pending', 'active')
    ) then
      raise exception 'ANOTHER_OFFER_ALREADY_SELECTED';
    end if;
  end if;

  update public.supervisor_project_offers
  set status = 'customer_selected',
      customer_selected_at = now(),
      customer_selected_by_user_id = current_user_id
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
        'feeAmount', offer.fee_amount,
        'feeStatus', offer.fee_status,
        'selectedAt', offer.customer_selected_at,
        'adminDecidedAt', offer.admin_decided_at,
        'adminNote', offer.admin_note
      )
      order by
        case offer.status
          when 'customer_selected' then 0
          when 'fee_pending' then 1
          when 'active' then 2
          else 3
        end,
        coalesce(offer.customer_selected_at, offer.created_at) asc
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
  where offer.status in ('customer_selected', 'fee_pending', 'active', 'admin_rejected');

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
  assignment_id uuid;
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

  if offer_row.status <> 'fee_pending' or offer_row.fee_status <> 'pending' then
    raise exception 'FEE_NOT_PENDING';
  end if;

  if offer_row.financed_customer_file_id is not null then
    assignment_id := public.admin_assign_supervisor_to_project(
      offer_row.financed_customer_file_id,
      offer_row.supervisor_user_id
    );

    update public.supervisor_project_offers
    set status = 'expired'
    where financed_customer_file_id = offer_row.financed_customer_file_id
      and id <> offer_row.id
      and status in ('requested', 'submitted');
  else
    assignment_id := public.admin_assign_supervisor_to_project(
      offer_row.service_project_id,
      offer_row.supervisor_user_id
    );

    update public.supervisor_project_offers
    set status = 'expired'
    where service_project_id = offer_row.service_project_id
      and id <> offer_row.id
      and status in ('requested', 'submitted');
  end if;

  update public.supervisor_project_offers
  set status = 'active',
      fee_status = 'paid',
      fee_paid_at = now(),
      fee_confirmed_by_user_id = auth.uid()
  where id = offer_row.id;

  return assignment_id;
end;
$$;

revoke all on function public.customer_list_available_supervisors_for_project(uuid)
  from public, anon;
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

grant execute on function public.customer_list_available_supervisors_for_project(uuid)
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

commit;
