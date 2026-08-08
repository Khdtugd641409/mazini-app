begin;

create table if not exists public.supervisor_applications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  applicant_type text not null default 'individual',
  full_name text not null,
  mobile_number text not null,
  organization_name text,
  commercial_registration_number text,
  professional_title text not null,
  professional_license_number text,
  city text not null,
  service_areas text[] not null default '{}'::text[],
  experience_years integer not null default 0,
  completed_projects_count integer not null default 0,
  profile_summary text not null,
  maps_url text,
  initial_service_title text not null,
  initial_service_description text,
  pricing_model text not null default 'flexible',
  service_price numeric,
  status text not null default 'under_review',
  admin_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supervisor_application_type_check check (applicant_type in ('individual','organization')),
  constraint supervisor_application_name_check check (length(trim(full_name)) >= 3),
  constraint supervisor_application_mobile_check check (mobile_number ~ '^05[0-9]{8}$'),
  constraint supervisor_application_professional_title_check check (length(trim(professional_title)) >= 2),
  constraint supervisor_application_city_check check (length(trim(city)) >= 2),
  constraint supervisor_application_experience_check check (experience_years >= 0 and experience_years <= 80),
  constraint supervisor_application_projects_check check (completed_projects_count >= 0),
  constraint supervisor_application_summary_check check (length(trim(profile_summary)) >= 10),
  constraint supervisor_application_service_title_check check (length(trim(initial_service_title)) >= 2),
  constraint supervisor_application_pricing_check check (pricing_model in ('fixed','monthly','percentage','flexible')),
  constraint supervisor_application_price_check check (service_price is null or service_price >= 0),
  constraint supervisor_application_status_check check (status in ('under_review','needs_completion','approved','rejected'))
);

create table if not exists public.supervisor_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.supervisor_applications(id) on delete cascade,
  document_type text not null,
  storage_bucket text not null default 'supervisor-documents',
  storage_path text not null,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint supervisor_application_document_type_check check (document_type in ('professional_license','qualification','commercial_registration','portfolio','other')),
  constraint supervisor_application_document_size_check check (size_bytes > 0 and size_bytes <= 20971520)
);

create table if not exists public.supervisor_services (
  id uuid primary key default gen_random_uuid(),
  supervisor_user_id uuid not null references public.supervisor_profiles(id) on delete cascade,
  title text not null,
  description text,
  pricing_model text not null default 'flexible',
  price numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supervisor_service_title_check check (length(trim(title)) >= 2),
  constraint supervisor_service_pricing_check check (pricing_model in ('fixed','monthly','percentage','flexible')),
  constraint supervisor_service_price_check check (price is null or price >= 0)
);

alter table public.supervisor_profiles
  add column if not exists applicant_type text,
  add column if not exists commercial_registration_number text,
  add column if not exists professional_title text,
  add column if not exists professional_license_number text,
  add column if not exists city text,
  add column if not exists service_areas text[] not null default '{}'::text[],
  add column if not exists experience_years integer not null default 0,
  add column if not exists completed_projects_count integer not null default 0,
  add column if not exists profile_summary text,
  add column if not exists maps_url text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_user_id uuid references auth.users(id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('supervisor-documents','supervisor-documents',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.supervisor_applications enable row level security;
alter table public.supervisor_application_documents enable row level security;
alter table public.supervisor_services enable row level security;

create or replace function public.supervisor_submit_application(
  p_applicant_type text,p_full_name text,p_mobile_number text,p_organization_name text,
  p_commercial_registration_number text,p_professional_title text,p_professional_license_number text,
  p_city text,p_service_areas text[],p_experience_years integer,p_completed_projects_count integer,
  p_profile_summary text,p_maps_url text,p_initial_service_title text,p_initial_service_description text,
  p_pricing_model text,p_service_price numeric
)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare current_user_id uuid:=auth.uid(); current_email text; application_id uuid;
begin
  if current_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select lower(coalesce(u.email,'')) into current_email from auth.users u where u.id=current_user_id;
  if current_email='' then raise exception 'EMAIL_REQUIRED'; end if;
  if exists(select 1 from public.supervisor_applications sa where sa.auth_user_id=current_user_id and sa.status='approved') then raise exception 'SUPERVISOR_ALREADY_APPROVED'; end if;

  insert into public.supervisor_applications(
    auth_user_id,email,applicant_type,full_name,mobile_number,organization_name,commercial_registration_number,
    professional_title,professional_license_number,city,service_areas,experience_years,completed_projects_count,
    profile_summary,maps_url,initial_service_title,initial_service_description,pricing_model,service_price,status,
    admin_note,submitted_at,reviewed_at,reviewed_by_user_id
  ) values(
    current_user_id,current_email,p_applicant_type,trim(p_full_name),trim(p_mobile_number),
    nullif(trim(coalesce(p_organization_name,'')),''),nullif(trim(coalesce(p_commercial_registration_number,'')),''),
    trim(p_professional_title),nullif(trim(coalesce(p_professional_license_number,'')),''),trim(p_city),
    coalesce(p_service_areas,'{}'::text[]),coalesce(p_experience_years,0),coalesce(p_completed_projects_count,0),
    trim(p_profile_summary),nullif(trim(coalesce(p_maps_url,'')),''),trim(p_initial_service_title),
    nullif(trim(coalesce(p_initial_service_description,'')),''),p_pricing_model,p_service_price,'under_review',null,now(),null,null
  ) on conflict(auth_user_id) do update set
    applicant_type=excluded.applicant_type,full_name=excluded.full_name,mobile_number=excluded.mobile_number,
    organization_name=excluded.organization_name,commercial_registration_number=excluded.commercial_registration_number,
    professional_title=excluded.professional_title,professional_license_number=excluded.professional_license_number,
    city=excluded.city,service_areas=excluded.service_areas,experience_years=excluded.experience_years,
    completed_projects_count=excluded.completed_projects_count,profile_summary=excluded.profile_summary,maps_url=excluded.maps_url,
    initial_service_title=excluded.initial_service_title,initial_service_description=excluded.initial_service_description,
    pricing_model=excluded.pricing_model,service_price=excluded.service_price,status='under_review',admin_note=null,
    submitted_at=now(),reviewed_at=null,reviewed_by_user_id=null,updated_at=now()
  returning id into application_id;
  return application_id;
end;$$;

create or replace function public.supervisor_get_my_application()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare current_user_id uuid:=auth.uid(); result jsonb;
begin
  if current_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select jsonb_build_object(
    'id',sa.id,'email',sa.email,'applicantType',sa.applicant_type,'fullName',sa.full_name,'mobileNumber',sa.mobile_number,
    'organizationName',sa.organization_name,'commercialRegistrationNumber',sa.commercial_registration_number,
    'professionalTitle',sa.professional_title,'professionalLicenseNumber',sa.professional_license_number,'city',sa.city,
    'serviceAreas',sa.service_areas,'experienceYears',sa.experience_years,'completedProjectsCount',sa.completed_projects_count,
    'profileSummary',sa.profile_summary,'mapsUrl',sa.maps_url,'initialServiceTitle',sa.initial_service_title,
    'initialServiceDescription',sa.initial_service_description,'pricingModel',sa.pricing_model,'servicePrice',sa.service_price,
    'status',sa.status,'adminNote',sa.admin_note,'submittedAt',sa.submitted_at,'reviewedAt',sa.reviewed_at,
    'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'documentType',d.document_type,
      'storageBucket',d.storage_bucket,'storagePath',d.storage_path,'originalName',d.original_name,'contentType',d.content_type,
      'sizeBytes',d.size_bytes,'createdAt',d.created_at) order by d.created_at desc)
      from public.supervisor_application_documents d where d.application_id=sa.id),'[]'::jsonb)
  ) into result from public.supervisor_applications sa where sa.auth_user_id=current_user_id;
  return result;
end;$$;

create or replace function public.supervisor_register_application_document(
  p_document_type text,p_storage_path text,p_original_name text,p_content_type text,p_size_bytes bigint
)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare current_user_id uuid:=auth.uid(); application_id uuid; document_id uuid;
begin
  if current_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select sa.id into application_id from public.supervisor_applications sa where sa.auth_user_id=current_user_id;
  if application_id is null then raise exception 'APPLICATION_REQUIRED'; end if;
  if p_storage_path not like current_user_id::text || '/%' then raise exception 'INVALID_STORAGE_PATH'; end if;
  insert into public.supervisor_application_documents(application_id,document_type,storage_path,original_name,content_type,size_bytes)
  values(application_id,p_document_type,p_storage_path,p_original_name,p_content_type,p_size_bytes)
  returning id into document_id;
  return document_id;
end;$$;

create or replace function public.admin_list_supervisor_applications()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare result jsonb;
begin
  if not public.is_active_platform_admin() then raise exception 'ADMIN_AUTHORIZATION_REQUIRED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',sa.id,'userId',sa.auth_user_id,'email',sa.email,'applicantType',sa.applicant_type,'fullName',sa.full_name,
    'mobileNumber',sa.mobile_number,'organizationName',sa.organization_name,'commercialRegistrationNumber',sa.commercial_registration_number,
    'professionalTitle',sa.professional_title,'professionalLicenseNumber',sa.professional_license_number,'city',sa.city,
    'serviceAreas',sa.service_areas,'experienceYears',sa.experience_years,'completedProjectsCount',sa.completed_projects_count,
    'profileSummary',sa.profile_summary,'mapsUrl',sa.maps_url,'initialServiceTitle',sa.initial_service_title,
    'initialServiceDescription',sa.initial_service_description,'pricingModel',sa.pricing_model,'servicePrice',sa.service_price,
    'status',sa.status,'adminNote',sa.admin_note,'submittedAt',sa.submitted_at,'reviewedAt',sa.reviewed_at,
    'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'documentType',d.document_type,
      'storageBucket',d.storage_bucket,'storagePath',d.storage_path,'originalName',d.original_name,'contentType',d.content_type,
      'sizeBytes',d.size_bytes,'createdAt',d.created_at) order by d.created_at desc)
      from public.supervisor_application_documents d where d.application_id=sa.id),'[]'::jsonb)
  ) order by case sa.status when 'under_review' then 0 when 'needs_completion' then 1 else 2 end,sa.submitted_at desc),'[]'::jsonb)
  into result from public.supervisor_applications sa;
  return result;
end;$$;

create or replace function public.admin_decide_supervisor_application(p_application_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security definer set search_path=public,auth as $$
declare admin_user_id uuid:=auth.uid(); app public.supervisor_applications%rowtype;
begin
  if not public.is_active_platform_admin() then raise exception 'ADMIN_AUTHORIZATION_REQUIRED'; end if;
  if p_decision not in ('approve','needs_completion','reject') then raise exception 'INVALID_DECISION'; end if;
  select * into app from public.supervisor_applications where id=p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if p_decision='approve' then
    insert into public.supervisor_profiles(id,full_name,organization_name,mobile_number,status,applicant_type,
      commercial_registration_number,professional_title,professional_license_number,city,service_areas,
      experience_years,completed_projects_count,profile_summary,maps_url,approved_at,approved_by_user_id)
    values(app.auth_user_id,app.full_name,app.organization_name,app.mobile_number,'active',app.applicant_type,
      app.commercial_registration_number,app.professional_title,app.professional_license_number,app.city,app.service_areas,
      app.experience_years,app.completed_projects_count,app.profile_summary,app.maps_url,now(),admin_user_id)
    on conflict(id) do update set full_name=excluded.full_name,organization_name=excluded.organization_name,
      mobile_number=excluded.mobile_number,status='active',applicant_type=excluded.applicant_type,
      commercial_registration_number=excluded.commercial_registration_number,professional_title=excluded.professional_title,
      professional_license_number=excluded.professional_license_number,city=excluded.city,service_areas=excluded.service_areas,
      experience_years=excluded.experience_years,completed_projects_count=excluded.completed_projects_count,
      profile_summary=excluded.profile_summary,maps_url=excluded.maps_url,approved_at=now(),approved_by_user_id=admin_user_id,updated_at=now();
    if not exists(select 1 from public.supervisor_services s where s.supervisor_user_id=app.auth_user_id) then
      insert into public.supervisor_services(supervisor_user_id,title,description,pricing_model,price)
      values(app.auth_user_id,app.initial_service_title,app.initial_service_description,app.pricing_model,app.service_price);
    end if;
    update public.supervisor_applications set status='approved',admin_note=nullif(trim(coalesce(p_note,'')),''),
      reviewed_at=now(),reviewed_by_user_id=admin_user_id,updated_at=now() where id=p_application_id;
  elsif p_decision='needs_completion' then
    update public.supervisor_applications set status='needs_completion',admin_note=nullif(trim(coalesce(p_note,'')),''),
      reviewed_at=now(),reviewed_by_user_id=admin_user_id,updated_at=now() where id=p_application_id;
  else
    update public.supervisor_applications set status='rejected',admin_note=nullif(trim(coalesce(p_note,'')),''),
      reviewed_at=now(),reviewed_by_user_id=admin_user_id,updated_at=now() where id=p_application_id;
  end if;
end;$$;

create or replace function public.supervisor_get_my_services()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.is_active_supervisor() then raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'description',s.description,
    'pricingModel',s.pricing_model,'price',s.price,'isActive',s.is_active,'createdAt',s.created_at,'updatedAt',s.updated_at)
    order by s.created_at) from public.supervisor_services s where s.supervisor_user_id=auth.uid()),'[]'::jsonb);
end;$$;

create or replace function public.supervisor_add_service(p_title text,p_description text,p_pricing_model text,p_price numeric)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare new_id uuid;
begin
  if not public.is_active_supervisor() then raise exception 'SUPERVISOR_AUTHORIZATION_REQUIRED'; end if;
  insert into public.supervisor_services(supervisor_user_id,title,description,pricing_model,price)
  values(auth.uid(),trim(p_title),nullif(trim(coalesce(p_description,'')),''),p_pricing_model,p_price)
  returning id into new_id;
  return new_id;
end;$$;

create or replace function public.set_supervisor_application_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;

drop trigger if exists supervisor_application_updated_at on public.supervisor_applications;
create trigger supervisor_application_updated_at before update on public.supervisor_applications for each row execute function public.set_supervisor_application_updated_at();
drop trigger if exists supervisor_service_updated_at on public.supervisor_services;
create trigger supervisor_service_updated_at before update on public.supervisor_services for each row execute function public.set_supervisor_application_updated_at();

drop policy if exists "supervisor documents owner insert" on storage.objects;
create policy "supervisor documents owner insert" on storage.objects for insert to authenticated
with check(bucket_id='supervisor-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "supervisor documents owner select" on storage.objects;
create policy "supervisor documents owner select" on storage.objects for select to authenticated
using(bucket_id='supervisor-documents' and ((storage.foldername(name))[1]=(select auth.uid()::text) or public.is_active_platform_admin()));
drop policy if exists "supervisor documents owner delete" on storage.objects;
create policy "supervisor documents owner delete" on storage.objects for delete to authenticated
using(bucket_id='supervisor-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));

revoke all on function public.supervisor_submit_application(text,text,text,text,text,text,text,text,text[],integer,integer,text,text,text,text,text,numeric) from public,anon;
grant execute on function public.supervisor_submit_application(text,text,text,text,text,text,text,text,text[],integer,integer,text,text,text,text,text,numeric) to authenticated;
revoke all on function public.supervisor_get_my_application() from public,anon;
grant execute on function public.supervisor_get_my_application() to authenticated;
revoke all on function public.supervisor_register_application_document(text,text,text,text,bigint) from public,anon;
grant execute on function public.supervisor_register_application_document(text,text,text,text,bigint) to authenticated;
revoke all on function public.admin_list_supervisor_applications() from public,anon;
grant execute on function public.admin_list_supervisor_applications() to authenticated;
revoke all on function public.admin_decide_supervisor_application(uuid,text,text) from public,anon;
grant execute on function public.admin_decide_supervisor_application(uuid,text,text) to authenticated;
revoke all on function public.supervisor_get_my_services() from public,anon;
grant execute on function public.supervisor_get_my_services() to authenticated;
revoke all on function public.supervisor_add_service(text,text,text,numeric) from public,anon;
grant execute on function public.supervisor_add_service(text,text,text,numeric) to authenticated;

commit;
