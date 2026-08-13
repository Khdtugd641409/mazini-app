begin;

create table if not exists public.supplier_applications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_name text not null check (length(trim(organization_name)) >= 2),
  commercial_registration_number text not null check (length(trim(commercial_registration_number)) >= 3),
  email text not null,
  mobile_number text not null check (mobile_number ~ '^05[0-9]{8}$'),
  maps_url text not null check (maps_url ~* '^https?://'),
  initial_product_name text not null check (length(trim(initial_product_name)) >= 2),
  status text not null default 'under_review' check (status in ('under_review','needs_completion','approved','rejected')),
  admin_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_name text not null,
  commercial_registration_number text not null,
  mobile_number text not null,
  maps_url text not null,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  approved_at timestamptz,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_user_id uuid not null references public.supplier_profiles(id) on delete cascade,
  product_name text not null check (length(trim(product_name)) >= 2),
  description text,
  price numeric check (price is null or price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_user_id uuid not null references public.supplier_profiles(id) on delete cascade,
  financed_customer_file_id uuid references public.customer_files(id) on delete cascade,
  service_project_id uuid references public.customer_service_projects(id) on delete cascade,
  product_name text not null,
  request_text text,
  requested_quantity text,
  status text not null default 'open' check (status in ('open','accepted','rejected','cancelled','completed')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_purchase_request_one_project check ((financed_customer_file_id is not null and service_project_id is null) or (financed_customer_file_id is null and service_project_id is not null))
);

create table if not exists public.supplier_project_assignments (
  id uuid primary key default gen_random_uuid(),
  supplier_user_id uuid not null references public.supplier_profiles(id) on delete cascade,
  financed_customer_file_id uuid references public.customer_files(id) on delete cascade,
  service_project_id uuid references public.customer_service_projects(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_assignment_one_project check ((financed_customer_file_id is not null and service_project_id is null) or (financed_customer_file_id is null and service_project_id is not null))
);

alter table public.supplier_applications enable row level security;
alter table public.supplier_profiles enable row level security;
alter table public.supplier_products enable row level security;
alter table public.supplier_purchase_requests enable row level security;
alter table public.supplier_project_assignments enable row level security;

create or replace function public.supplier_submit_application(
  p_organization_name text,
  p_commercial_registration_number text,
  p_mobile_number text,
  p_maps_url text,
  p_product_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select lower(trim(email)) into v_email from auth.users where id = v_uid;
  if v_email is null then raise exception 'EMAIL_REQUIRED'; end if;
  if length(trim(coalesce(p_organization_name,''))) < 2 then raise exception 'INVALID_ORGANIZATION_NAME'; end if;
  if length(trim(coalesce(p_commercial_registration_number,''))) < 3 then raise exception 'INVALID_COMMERCIAL_REGISTRATION'; end if;
  if trim(coalesce(p_mobile_number,'')) !~ '^05[0-9]{8}$' then raise exception 'INVALID_MOBILE'; end if;
  if trim(coalesce(p_maps_url,'')) !~* '^https?://' then raise exception 'INVALID_MAPS_URL'; end if;
  if length(trim(coalesce(p_product_name,''))) < 2 then raise exception 'INVALID_PRODUCT'; end if;

  insert into public.supplier_applications (
    auth_user_id,
    organization_name,
    commercial_registration_number,
    email,
    mobile_number,
    maps_url,
    initial_product_name,
    status,
    admin_note,
    submitted_at,
    reviewed_at,
    reviewed_by_user_id,
    updated_at
  ) values (
    v_uid,
    trim(p_organization_name),
    trim(p_commercial_registration_number),
    v_email,
    trim(p_mobile_number),
    trim(p_maps_url),
    trim(p_product_name),
    'under_review',
    null,
    now(),
    null,
    null,
    now()
  )
  on conflict (auth_user_id) do update set
    organization_name = excluded.organization_name,
    commercial_registration_number = excluded.commercial_registration_number,
    email = excluded.email,
    mobile_number = excluded.mobile_number,
    maps_url = excluded.maps_url,
    initial_product_name = excluded.initial_product_name,
    status = 'under_review',
    admin_note = null,
    submitted_at = now(),
    reviewed_at = null,
    reviewed_by_user_id = null,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.supplier_get_my_application()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select to_jsonb(x)
  from (
    select
      id,
      organization_name as "organizationName",
      commercial_registration_number as "commercialRegistrationNumber",
      email,
      mobile_number as "mobileNumber",
      maps_url as "mapsUrl",
      initial_product_name as "initialProductName",
      status,
      admin_note as "adminNote",
      submitted_at as "submittedAt"
    from public.supplier_applications
    where auth_user_id = auth.uid()
    limit 1
  ) x;
$$;

create or replace function public.supplier_get_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  p public.supplier_profiles%rowtype;
  result jsonb;
begin
  if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select * into p from public.supplier_profiles where id = v_uid and status = 'active';
  if not found then raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED'; end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'organizationName',p.organization_name,
      'commercialRegistrationNumber',p.commercial_registration_number,
      'mobileNumber',p.mobile_number,
      'mapsUrl',p.maps_url
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sp.id,
        'productName',sp.product_name,
        'description',sp.description,
        'price',sp.price,
        'isActive',sp.is_active
      ) order by sp.created_at)
      from public.supplier_products sp
      where sp.supplier_user_id = v_uid
    ), '[]'::jsonb),
    'purchaseRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,
        'productName',r.product_name,
        'requestText',r.request_text,
        'requestedQuantity',r.requested_quantity,
        'status',r.status,
        'createdAt',r.created_at,
        'projectId',coalesce(r.financed_customer_file_id,r.service_project_id)
      ) order by r.created_at desc)
      from public.supplier_purchase_requests r
      where r.supplier_user_id = v_uid and r.status = 'open'
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,
        'projectId',coalesce(s.financed_customer_file_id,s.service_project_id),
        'status',s.status,
        'startedAt',s.started_at
      ) order by s.started_at desc)
      from public.supplier_project_assignments s
      where s.supplier_user_id = v_uid and s.status = 'active'
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_list_supplier_applications()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.is_active_platform_admin() then coalesce(
      jsonb_agg(jsonb_build_object(
        'id',a.id,
        'organizationName',a.organization_name,
        'commercialRegistrationNumber',a.commercial_registration_number,
        'email',a.email,
        'mobileNumber',a.mobile_number,
        'mapsUrl',a.maps_url,
        'initialProductName',a.initial_product_name,
        'status',a.status,
        'adminNote',a.admin_note,
        'submittedAt',a.submitted_at
      ) order by a.submitted_at desc),
      '[]'::jsonb
    )
    else '[]'::jsonb
  end
  from public.supplier_applications a;
$$;

create or replace function public.admin_decide_supplier_application(
  p_application_id uuid,
  p_decision text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  a public.supplier_applications%rowtype;
begin
  if not public.is_active_platform_admin() then raise exception 'ADMIN_AUTHORIZATION_REQUIRED'; end if;
  if p_decision not in ('approved','needs_completion','rejected') then raise exception 'INVALID_DECISION'; end if;

  select * into a
  from public.supplier_applications
  where id = p_application_id
  for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;

  update public.supplier_applications
  set status = p_decision,
      admin_note = nullif(trim(coalesce(p_note,'')),''),
      reviewed_at = now(),
      reviewed_by_user_id = auth.uid(),
      updated_at = now()
  where id = p_application_id;

  if p_decision = 'approved' then
    insert into public.supplier_profiles (
      id,
      organization_name,
      commercial_registration_number,
      mobile_number,
      maps_url,
      status,
      approved_at,
      approved_by_user_id
    ) values (
      a.auth_user_id,
      a.organization_name,
      a.commercial_registration_number,
      a.mobile_number,
      a.maps_url,
      'active',
      now(),
      auth.uid()
    )
    on conflict (id) do update set
      organization_name = excluded.organization_name,
      commercial_registration_number = excluded.commercial_registration_number,
      mobile_number = excluded.mobile_number,
      maps_url = excluded.maps_url,
      status = 'active',
      approved_at = now(),
      approved_by_user_id = auth.uid(),
      updated_at = now();

    if not exists (
      select 1
      from public.supplier_products
      where supplier_user_id = a.auth_user_id
        and lower(product_name) = lower(a.initial_product_name)
    ) then
      insert into public.supplier_products (supplier_user_id, product_name)
      values (a.auth_user_id, a.initial_product_name);
    end if;
  end if;

  return p_decision;
end;
$$;

revoke all on function public.supplier_submit_application(text,text,text,text,text) from public, anon;
revoke all on function public.supplier_get_my_application() from public, anon;
revoke all on function public.supplier_get_dashboard() from public, anon;
revoke all on function public.admin_list_supplier_applications() from public, anon;
revoke all on function public.admin_decide_supplier_application(uuid,text,text) from public, anon;

grant execute on function public.supplier_submit_application(text,text,text,text,text) to authenticated;
grant execute on function public.supplier_get_my_application() to authenticated;
grant execute on function public.supplier_get_dashboard() to authenticated;
grant execute on function public.admin_list_supplier_applications() to authenticated;
grant execute on function public.admin_decide_supplier_application(uuid,text,text) to authenticated;

commit;
