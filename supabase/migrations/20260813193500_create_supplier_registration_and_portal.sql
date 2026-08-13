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

-- RPC definitions are applied in production migration create_supplier_registration_and_portal.
commit;
