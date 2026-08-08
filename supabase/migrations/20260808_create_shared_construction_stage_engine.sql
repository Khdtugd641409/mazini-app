begin;

create extension if not exists pgcrypto;

-- =========================================================
-- محرك مراحل البناء المشترك
-- يبني فوق public.building_stages الموجود أصلًا ولا ينشئ مسارًا موازيًا.
-- المشروع المرتبط بالمرحلة يكون أحد نوعين فقط:
-- 1) customer_files لعميل التمويل
-- 2) customer_service_projects لعميل الخدمات
-- =========================================================

-- 1. تصنيف المرحلة الأساسية فوق المرحلة التفصيلية الموجودة أصلًا
alter table public.building_stages
  add column if not exists main_stage_name text;

update public.building_stages
set main_stage_name = case
  when stage_order between 1 and 2 then 'الرخص والتجهيز'
  when stage_order between 3 and 11 then 'الأعمال الإنشائية'
  when stage_order between 12 and 16 then 'أعمال التأسيس والإغلاق'
  when stage_order between 17 and 23 then 'أعمال التشطيب'
  when stage_order between 24 and 26 then 'الاستلام والإتمام'
  else coalesce(main_stage_name, 'مراحل البناء')
end
where main_stage_name is null;

alter table public.building_stages
  alter column main_stage_name set not null;

-- 2. نسخة المرحلة داخل المشروع
create table if not exists public.project_construction_stages (
  id uuid primary key default gen_random_uuid(),

  financed_customer_file_id uuid
    references public.customer_files(id)
    on delete cascade,

  service_project_id uuid
    references public.customer_service_projects(id)
    on delete cascade,

  building_stage_id uuid
    references public.building_stages(id)
    on delete restrict,

  main_stage_name text not null,
  detailed_stage_name text not null,

  is_custom boolean not null default false,
  custom_created_by_user_id uuid
    references auth.users(id)
    on delete set null,

  status text not null default 'planned',
  planned_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_construction_stage_one_project
    check (
      (financed_customer_file_id is not null and service_project_id is null)
      or
      (financed_customer_file_id is null and service_project_id is not null)
    ),

  constraint project_construction_stage_source
    check (
      (is_custom = false and building_stage_id is not null)
      or
      (is_custom = true and building_stage_id is null)
    ),

  constraint project_construction_stage_status
    check (status in ('planned', 'in_progress', 'completed', 'cancelled')),

  constraint project_construction_stage_names
    check (
      length(trim(main_stage_name)) >= 2
      and length(trim(detailed_stage_name)) >= 2
    )
);

create index if not exists pcs_financed_project_idx
  on public.project_construction_stages(financed_customer_file_id, created_at);

create index if not exists pcs_service_project_idx
  on public.project_construction_stages(service_project_id, created_at);

-- 3. صور المرحلة
create table if not exists public.project_construction_stage_photos (
  id uuid primary key default gen_random_uuid(),
  project_stage_id uuid not null
    references public.project_construction_stages(id)
    on delete cascade,
  storage_bucket text not null default 'construction-stage-photos',
  storage_path text not null,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  caption text,
  uploaded_by_user_id uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  constraint construction_photo_size check (size_bytes > 0 and size_bytes <= 20971520),
  constraint construction_photo_type check (content_type in ('image/jpeg','image/png','image/webp'))
);

-- 4. وثائق المعايير: عامة من الإدارة، وخاصة بالمشروع من العميل
create table if not exists public.construction_standard_documents (
  id uuid primary key default gen_random_uuid(),
  standard_scope text not null,
  building_stage_id uuid
    references public.building_stages(id)
    on delete cascade,
  project_stage_id uuid
    references public.project_construction_stages(id)
    on delete cascade,
  storage_bucket text not null default 'construction-standards',
  storage_path text not null,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by_user_id uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  constraint construction_standard_scope check (standard_scope in ('general','project')),
  constraint construction_standard_owner check (
    (standard_scope = 'general' and building_stage_id is not null and project_stage_id is null)
    or
    (standard_scope = 'project' and building_stage_id is null and project_stage_id is not null)
  ),
  constraint construction_standard_file_size check (size_bytes > 0 and size_bytes <= 20971520)
);

-- 5. بنود المعايير التي تظهر تحت الصور وبجانب كل منها مربع استلام
create table if not exists public.construction_standard_items (
  id uuid primary key default gen_random_uuid(),
  standard_scope text not null,
  building_stage_id uuid
    references public.building_stages(id)
    on delete cascade,
  project_stage_id uuid
    references public.project_construction_stages(id)
    on delete cascade,
  item_text text not null,
  item_order integer not null default 1,
  is_required boolean not null default true,
  created_by_user_id uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_item_scope check (standard_scope in ('general','project')),
  constraint construction_item_owner check (
    (standard_scope = 'general' and building_stage_id is not null and project_stage_id is null)
    or
    (standard_scope = 'project' and building_stage_id is null and project_stage_id is not null)
  ),
  constraint construction_item_text check (length(trim(item_text)) >= 2),
  constraint construction_item_order check (item_order > 0)
);

-- 6. اعتماد المشرف لكل معيار: نسجل من اعتمد ومتى ولا نخزن checkbox بلا أثر
create table if not exists public.project_construction_item_checks (
  id uuid primary key default gen_random_uuid(),
  project_stage_id uuid not null
    references public.project_construction_stages(id)
    on delete cascade,
  standard_item_id uuid not null
    references public.construction_standard_items(id)
    on delete cascade,
  is_checked boolean not null default true,
  checked_by_user_id uuid not null
    references auth.users(id)
    on delete restrict,
  checked_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_stage_id, standard_item_id)
);

-- 7. تذكيرات المشرف وجدول الأعمال
create table if not exists public.project_construction_stage_reminders (
  id uuid primary key default gen_random_uuid(),
  project_stage_id uuid not null
    references public.project_construction_stages(id)
    on delete cascade,
  supervisor_user_id uuid not null
    references auth.users(id)
    on delete cascade,
  title text not null,
  reminder_at timestamptz not null,
  note text,
  is_done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_reminder_title check (length(trim(title)) >= 2)
);

create index if not exists construction_reminder_supervisor_idx
  on public.project_construction_stage_reminders(supervisor_user_id, reminder_at);

-- 8. RLS: لا قراءة مباشرة للجداول الجديدة. الوصول عبر RPC تتحقق من الصلاحية.
alter table public.project_construction_stages enable row level security;
alter table public.project_construction_stage_photos enable row level security;
alter table public.construction_standard_documents enable row level security;
alter table public.construction_standard_items enable row level security;
alter table public.project_construction_item_checks enable row level security;
alter table public.project_construction_stage_reminders enable row level security;

-- 9. مستودعات خاصة غير عامة
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'construction-stage-photos',
  'construction-stage-photos',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'construction-standards',
  'construction-standards',
  false,
  20971520,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 10. دالة موحدة لإنشاء مرحلة رسمية داخل أي مشروع يملكه العميل.
-- إنشاء مرحلة غير موجودة محفوظ للمشرف، ولا نفتحه للعميل قبل ربط حساب المشرف الحقيقي.
create or replace function public.customer_ensure_construction_stage(
  p_financed_customer_file_id uuid default null,
  p_service_project_id uuid default null,
  p_building_stage_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  selected_stage public.building_stages%rowtype;
  created_id uuid;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not (
    (p_financed_customer_file_id is not null and p_service_project_id is null)
    or
    (p_financed_customer_file_id is null and p_service_project_id is not null)
  ) then
    raise exception 'EXACTLY_ONE_PROJECT_REQUIRED';
  end if;

  if p_financed_customer_file_id is not null then
    if not public.customer_owns_financed_file(p_financed_customer_file_id) then
      raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
    end if;
  else
    if not exists (
      select 1 from public.customer_service_projects csp
      where csp.id = p_service_project_id
        and csp.customer_user_id = current_user_id
    ) then
      raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
    end if;
  end if;

  select * into selected_stage
  from public.building_stages bs
  where bs.id = p_building_stage_id
    and bs.is_active = true;

  if not found then
    raise exception 'INVALID_BUILDING_STAGE';
  end if;

  select pcs.id into created_id
  from public.project_construction_stages pcs
  where pcs.building_stage_id = selected_stage.id
    and (
      (p_financed_customer_file_id is not null and pcs.financed_customer_file_id = p_financed_customer_file_id)
      or
      (p_service_project_id is not null and pcs.service_project_id = p_service_project_id)
    )
  order by pcs.created_at desc
  limit 1;

  if created_id is not null then
    return created_id;
  end if;

  insert into public.project_construction_stages (
    financed_customer_file_id,
    service_project_id,
    building_stage_id,
    main_stage_name,
    detailed_stage_name,
    is_custom
  ) values (
    p_financed_customer_file_id,
    p_service_project_id,
    selected_stage.id,
    selected_stage.main_stage_name,
    selected_stage.stage_name,
    false
  ) returning id into created_id;

  return created_id;
end;
$$;

-- 11. مساحة عمل المرحلة المشتركة للعميل.
-- ترجع نفس الشكل لعميل التمويل وعميل الخدمات.
create or replace function public.customer_get_construction_stage_workspace(
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  current_user_id uuid := auth.uid();
  project_kind text;
  financed_file_id uuid;
  service_project_id uuid;
  service_stage_id uuid;
  project_stage_id uuid;
  stage_row public.project_construction_stages%rowtype;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if public.customer_owns_financed_file(p_project_id) then
    project_kind := 'financed';
    financed_file_id := p_project_id;

    select pcs.id
    into project_stage_id
    from public.project_construction_stages pcs
    where pcs.financed_customer_file_id = financed_file_id
      and pcs.status <> 'cancelled'
    order by
      case pcs.status
        when 'in_progress' then 1
        when 'planned' then 2
        when 'completed' then 3
        else 4
      end,
      pcs.created_at desc
    limit 1;
  else
    select csp.id, csp.current_stage_id
    into service_project_id, service_stage_id
    from public.customer_service_projects csp
    where csp.id = p_project_id
      and csp.customer_user_id = current_user_id;

    if service_project_id is null then
      raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
    end if;

    project_kind := 'services';

    if service_stage_id is not null then
      project_stage_id := public.customer_ensure_construction_stage(
        null,
        service_project_id,
        service_stage_id
      );
    else
      select pcs.id
      into project_stage_id
      from public.project_construction_stages pcs
      where pcs.service_project_id = service_project_id
        and pcs.status <> 'cancelled'
      order by pcs.created_at desc
      limit 1;
    end if;
  end if;

  if project_stage_id is null then
    return jsonb_build_object(
      'projectType', project_kind,
      'stage', null,
      'photos', '[]'::jsonb,
      'projectStandards', '[]'::jsonb,
      'generalStandards', '[]'::jsonb,
      'documents', '[]'::jsonb
    );
  end if;

  select * into stage_row
  from public.project_construction_stages pcs
  where pcs.id = project_stage_id;

  select jsonb_build_object(
    'projectType', project_kind,
    'stage', jsonb_build_object(
      'id', stage_row.id,
      'buildingStageId', stage_row.building_stage_id,
      'mainStageName', stage_row.main_stage_name,
      'detailedStageName', stage_row.detailed_stage_name,
      'isCustom', stage_row.is_custom,
      'status', stage_row.status,
      'plannedFor', stage_row.planned_for,
      'startedAt', stage_row.started_at,
      'completedAt', stage_row.completed_at
    ),
    'photos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'storageBucket', p.storage_bucket,
          'storagePath', p.storage_path,
          'originalName', p.original_name,
          'caption', p.caption,
          'createdAt', p.created_at
        )
        order by p.created_at asc
      )
      from public.project_construction_stage_photos p
      where p.project_stage_id = stage_row.id
    ), '[]'::jsonb),
    'projectStandards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'text', i.item_text,
          'order', i.item_order,
          'required', i.is_required,
          'checked', coalesce(c.is_checked, false),
          'checkedAt', c.checked_at,
          'checkedByUserId', c.checked_by_user_id,
          'checkNote', c.note
        )
        order by i.item_order asc, i.created_at asc
      )
      from public.construction_standard_items i
      left join public.project_construction_item_checks c
        on c.project_stage_id = stage_row.id
       and c.standard_item_id = i.id
      where i.standard_scope = 'project'
        and i.project_stage_id = stage_row.id
    ), '[]'::jsonb),
    'generalStandards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'text', i.item_text,
          'order', i.item_order,
          'required', i.is_required,
          'checked', coalesce(c.is_checked, false),
          'checkedAt', c.checked_at,
          'checkedByUserId', c.checked_by_user_id,
          'checkNote', c.note
        )
        order by i.item_order asc, i.created_at asc
      )
      from public.construction_standard_items i
      left join public.project_construction_item_checks c
        on c.project_stage_id = stage_row.id
       and c.standard_item_id = i.id
      where i.standard_scope = 'general'
        and stage_row.building_stage_id is not null
        and i.building_stage_id = stage_row.building_stage_id
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'scope', d.standard_scope,
          'storageBucket', d.storage_bucket,
          'storagePath', d.storage_path,
          'originalName', d.original_name,
          'contentType', d.content_type,
          'sizeBytes', d.size_bytes,
          'createdAt', d.created_at
        )
        order by d.created_at desc
      )
      from public.construction_standard_documents d
      where
        (d.standard_scope = 'project' and d.project_stage_id = stage_row.id)
        or
        (
          d.standard_scope = 'general'
          and stage_row.building_stage_id is not null
          and d.building_stage_id = stage_row.building_stage_id
        )
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.customer_ensure_construction_stage(uuid, uuid, uuid) from public;
grant execute on function public.customer_ensure_construction_stage(uuid, uuid, uuid) to authenticated;

revoke all on function public.customer_get_construction_stage_workspace(uuid) from public;
grant execute on function public.customer_get_construction_stage_workspace(uuid) to authenticated;

-- 12. تحديث updated_at
create or replace function public.set_shared_construction_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shared_construction_stage_updated_at on public.project_construction_stages;
create trigger shared_construction_stage_updated_at
  before update on public.project_construction_stages
  for each row execute function public.set_shared_construction_updated_at();

drop trigger if exists shared_construction_item_updated_at on public.construction_standard_items;
create trigger shared_construction_item_updated_at
  before update on public.construction_standard_items
  for each row execute function public.set_shared_construction_updated_at();

drop trigger if exists shared_construction_check_updated_at on public.project_construction_item_checks;
create trigger shared_construction_check_updated_at
  before update on public.project_construction_item_checks
  for each row execute function public.set_shared_construction_updated_at();

drop trigger if exists shared_construction_reminder_updated_at on public.project_construction_stage_reminders;
create trigger shared_construction_reminder_updated_at
  before update on public.project_construction_stage_reminders
  for each row execute function public.set_shared_construction_updated_at();

commit;
