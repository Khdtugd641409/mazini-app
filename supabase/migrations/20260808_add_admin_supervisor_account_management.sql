begin;

create or replace function public.admin_list_supervisor_candidates()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', u.id,
      'email', u.email,
      'createdAt', u.created_at,
      'lastSignInAt', u.last_sign_in_at,
      'isSupervisor', sp.id is not null,
      'fullName', sp.full_name,
      'organizationName', sp.organization_name,
      'mobileNumber', sp.mobile_number,
      'status', sp.status
    ) order by coalesce(u.last_sign_in_at, u.created_at) desc
  ), '[]'::jsonb)
  into result
  from auth.users u
  left join public.supervisor_profiles sp on sp.id = u.id
  where u.email is not null
    and not exists (
      select 1 from public.admin_users au where au.id = u.id
    )
    and not exists (
      select 1 from public.customer_accounts ca where ca.auth_user_id = u.id
    );

  return result;
end;
$$;

create or replace function public.admin_activate_supervisor_account(
  p_user_id uuid,
  p_full_name text,
  p_organization_name text default null,
  p_mobile_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$;
