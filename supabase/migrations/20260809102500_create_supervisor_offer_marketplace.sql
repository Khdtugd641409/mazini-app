-- Supervisor offer marketplace. Applied to Supabase production through the connector.
-- Source of truth: migration create_supervisor_offer_marketplace.

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

-- RPCs applied in the same Supabase migration:
-- supervisor_list_available_projects()
-- supervisor_submit_project_offer(text, uuid, numeric, text)
-- supervisor_list_my_project_offers()
-- customer_get_supervisor_offers(uuid)
-- customer_select_supervisor_offer(uuid)
-- admin_list_selected_supervisor_offers()
-- admin_decide_supervisor_offer(uuid, boolean, text)
-- admin_confirm_supervisor_offer_fee_paid(uuid)
-- All are SECURITY DEFINER, anon execution revoked, authenticated only.