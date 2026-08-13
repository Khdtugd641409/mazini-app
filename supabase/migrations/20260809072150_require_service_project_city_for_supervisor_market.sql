begin;

alter table public.customer_service_projects
  add column if not exists city text;

create or replace function public.customer_create_service_project(
  p_customer_name text,
  p_customer_mobile text,
  p_property_location_url text,
  p_land_area numeric,
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
set search_path = public, auth
as $$
declare
  authenticated_user_id uuid := auth.uid();
  authenticated_email text;
  created_project public.customer_service_projects%rowtype;
begin
  if authenticated_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select lower(trim(u.email)) into authenticated_email
  from auth.users u
  where u.id = authenticated_user_id;

  if authenticated_email is null then raise exception 'CUSTOMER_EMAIL_NOT_FOUND'; end if;
  if length(trim(coalesce(p_customer_name,''))) < 3 then raise exception 'INVALID_CUSTOMER_NAME'; end if;
  if trim(coalesce(p_customer_mobile,'')) !~ '^05[0-9]{8}$' then raise exception 'INVALID_CUSTOMER_MOBILE'; end if;
  if length(trim(coalesce(p_property_location_url,''))) < 8 then raise exception 'INVALID_PROPERTY_LOCATION'; end if;
  if length(trim(coalesce(p_city,''))) < 2 then raise exception 'INVALID_PROJECT_CITY'; end if;
  if p_land_area is null or p_land_area <= 0 then raise exception 'INVALID_LAND_AREA'; end if;
  if p_project_title not in ('دور','شقق','فيلا') then raise exception 'INVALID_PROJECT_TITLE'; end if;
  if p_floors is null or p_floors < 1 or p_floors > 100 then raise exception 'INVALID_FLOORS'; end if;

  if p_stage_id is not null then
    if not exists (
      select 1 from public.building_stages bs
      where bs.id = p_stage_id and bs.is_active = true
    ) then
      raise exception 'INVALID_BUILDING_STAGE';
    end if;
  elsif length(trim(coalesce(p_custom_stage_name,''))) < 2 then
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
    project_title,
    floors,
    current_stage_id,
    current_custom_stage_name,
    current_custom_stage_description,
    status
  ) values (
    authenticated_user_id,
    trim(p_customer_name),
    trim(p_customer_mobile),
    authenticated_email,
    trim(p_property_location_url),
    trim(p_city),
    p_land_area,
    p_project_title,
    p_floors,
    p_stage_id,
    case when p_stage_id is null then trim(p_custom_stage_name) else null end,
    case when p_stage_id is null then nullif(trim(coalesce(p_custom_stage_description,'')),'') else null end,
    'active'
  ) returning * into created_project;

  return query
  select
    created_project.id,
    created_project.project_number,
    created_project.project_type,
    created_project.status::text,
    created_project.current_stage_id,
    bs.stage_name,
    created_project.current_custom_stage_name,
    created_project.created_at
  from (select 1) placeholder
  left join public.building_stages bs on bs.id = created_project.current_stage_id;
end;
$$;

revoke all on function public.customer_create_service_project(text,text,text,numeric,text,integer,text,uuid,text,text) from public, anon;
grant execute on function public.customer_create_service_project(text,text,text,numeric,text,integer,text,uuid,text,text) to authenticated;

commit;
