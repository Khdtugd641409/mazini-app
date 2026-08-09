-- City is required for new service projects so supervisors can see projects only in their service area.
-- Applied to Supabase production as require_service_project_city_for_supervisor_market.

alter table public.customer_service_projects
  add column if not exists city text;

-- The live database RPC customer_create_service_project now accepts p_city text,
-- validates it, and writes it to customer_service_projects.city.
-- The existing frontend call was updated in the same branch to send p_city.

revoke all on function public.customer_create_service_project(text,text,text,numeric,text,integer,text,uuid,text,text) from public, anon;
grant execute on function public.customer_create_service_project(text,text,text,numeric,text,integer,text,uuid,text,text) to authenticated;