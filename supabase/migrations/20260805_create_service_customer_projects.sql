begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1. أنواع مشروع الخدمات
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'service_project_status'
  ) then
    create type public.service_project_status as enum (
      'active',
      'completed',
      'closed'
    );
  end if;
end
$$;

-- =========================================================
-- 2. جدول مراحل البناء الرسمية
-- =========================================================

create table if not exists public.building_stages (
  id uuid primary key default gen_random_uuid(),

  stage_key text not null unique,

  stage_name text not null,

  stage_order integer not null unique,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint building_stages_stage_key_format
    check (
      stage_key ~ '^[a-z0-9_]+$'
    ),

  constraint building_stages_name_not_empty
    check (
      length(trim(stage_name)) >= 2
    ),

  constraint building_stages_order_positive
    check (
      stage_order > 0
    )
);

-- =========================================================
-- 3. إضافة المراحل الرسمية
-- =========================================================

insert into public.building_stages (
  stage_key,
  stage_name,
  stage_order
)
values
  (
    'building_permit_request',
    'طلب إصدار رخصة البناء',
    1
  ),
  (
    'building_permit_issued',
    'إصدار رخصة البناء',
    2
  ),
  (
    'site_preparation',
    'تجهيز الموقع',
    3
  ),
  (
    'excavation',
    'الحفر',
    4
  ),
  (
    'foundations',
    'القواعد',
    5
  ),
  (
    'column_necks',
    'الرقاب',
    6
  ),
  (
    'grade_beams',
    'الميدات',
    7
  ),
  (
    'columns',
    'الأعمدة',
    8
  ),
  (
    'first_floor_slab',
    'السقف الأول',
    9
  ),
  (
    'second_floor_slab',
    'السقف الثاني',
    10
  ),
  (
    'third_floor_slab',
    'السقف الثالث',
    11
  ),
  (
    'masonry',
    'المباني',
    12
  ),
  (
    'electrical_plumbing_rough_in',
    'الكهرباء والسباكة - التأسيس',
    13
  ),
  (
    'plastering',
    'اللياسة',
    14
  ),
  (
    'waterproofing',
    'العزل',
    15
  ),
  (
    'gypsum_ceilings',
    'الأسقف الجبسية',
    16
  ),
  (
    'flooring_and_tiles',
    'الأرضيات والسيراميك',
    17
  ),
  (
    'painting',
    'الدهانات',
    18
  ),
  (
    'doors_and_windows',
    'الأبواب والنوافذ',
    19
  ),
  (
    'electrical_fixtures',
    'التركيبات الكهربائية',
    20
  ),
  (
    'sanitary_fixtures',
    'التركيبات الصحية',
    21
  ),
  (
    'facades',
    'الواجهات',
    22
  ),
  (
    'external_works',
    'أعمال الموقع العام',
    23
  ),
  (
    'cleaning_and_initial_handover',
    'التنظيف والاستلام الابتدائي',
    24
  ),
  (
    'completion_certificate_request',
    'طلب شهادة إتمام البناء',
    25
  ),
  (
    'completion_certificate_issued',
    'إصدار شهادة إتمام البناء',
    26
  )
on conflict (stage_key)
do update set
  stage_name =
    excluded.stage_name,

  stage_order =
    excluded.stage_order,

  is_active = true,

  updated_at = now();

-- =========================================================
-- 4. جدول مشاريع عميل الخدمات
-- =========================================================

create table if not exists public.customer_service_projects (
  id uuid primary key default gen_random_uuid(),

  project_number text unique,

  customer_user_id uuid not null
    references auth.users(id)
    on delete restrict,

  customer_name text not null,

  customer_mobile text not null,

  customer_email text not null,

  property_location_url text not null,

  land_area numeric(12, 2) not null,

  project_title text not null,

  floors integer not null,

  current_stage_id uuid
    references public.building_stages(id)
    on delete restrict,

  current_custom_stage_name text,

  current_custom_stage_description text,

  status public.service_project_status
    not null
    default 'active',

  project_type text not null
    default 'services',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  completed_at timestamptz,

  closed_at timestamptz,

  constraint service_project_type_fixed
    check (
      project_type = 'services'
    ),

  constraint service_project_customer_name
    check (
      length(trim(customer_name)) >= 3
    ),

  constraint service_project_mobile
    check (
      customer_mobile ~ '^05[0-9]{8}$'
    ),

  constraint service_project_email
    check (
      length(trim(customer_email)) >= 5
    ),

  constraint service_project_location_url
    check (
      length(trim(property_location_url)) >= 8
    ),

  constraint service_project_land_area
    check (
      land_area > 0
    ),

  constraint service_project_title
    check (
      project_title in (
        'دور',
        'شقق',
        'فيلا'
      )
    ),

  constraint service_project_floors
    check (
      floors >= 1
      and floors <= 100
    ),

  constraint service_project_stage_required
    check (
      (
        current_stage_id is not null
        and current_custom_stage_name is null
      )
      or
      (
        current_stage_id is null
        and length(
          trim(
            coalesce(
              current_custom_stage_name,
              ''
            )
          )
        ) >= 2
      )
    )
);

create index if not exists
  customer_service_projects_user_index
on public.customer_service_projects (
  customer_user_id,
  created_at desc
);

create index if not exists
  customer_service_projects_stage_index
on public.customer_service_projects (
  current_stage_id
);

create index if not exists
  customer_service_projects_status_index
on public.customer_service_projects (
  status
);

-- =========================================================
-- 5. سجل تغييرات مراحل مشروع الخدمات
-- =========================================================

create table if not exists public.customer_service_project_stage_history (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.customer_service_projects(id)
    on delete cascade,

  changed_by_user_id uuid
    references auth.users(id)
    on delete set null,

  previous_stage_id uuid
    references public.building_stages(id)
    on delete set null,

  previous_custom_stage_name text,

  new_stage_id uuid
    references public.building_stages(id)
    on delete set null,

  new_custom_stage_name text,

  new_custom_stage_description text,

  change_source text not null
    default 'customer',

  created_at timestamptz not null
    default now(),

  constraint service_stage_history_source
    check (
      change_source in (
        'customer',
        'supervisor',
        'admin'
      )
    ),

  constraint service_stage_history_new_stage
    check (
      new_stage_id is not null
      or length(
        trim(
          coalesce(
            new_custom_stage_name,
            ''
          )
        )
      ) >= 2
    )
);

create index if not exists
  service_stage_history_project_index
on public.customer_service_project_stage_history (
  project_id,
  created_at desc
);

-- =========================================================
-- 6. توليد رقم مشروع الخدمات تلقائيًا
-- =========================================================

create or replace function public.generate_service_project_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_number text;
begin
  if new.project_number is not null then
    return new;
  end if;

  generated_number :=
    'NS-'
    || to_char(now(), 'YYYY')
    || '-'
    || upper(
      substr(
        replace(
          new.id::text,
          '-',
          ''
        ),
        1,
        8
      )
    );

  new.project_number :=
    generated_number;

  return new;
end;
$$;

drop trigger if exists
  set_service_project_number
on public.customer_service_projects;

create trigger set_service_project_number
before insert
on public.customer_service_projects
for each row
execute function
  public.generate_service_project_number();

-- =========================================================
-- 7. تحديث updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists
  update_building_stages_updated_at
on public.building_stages;

create trigger update_building_stages_updated_at
before update
on public.building_stages
for each row
execute function public.set_updated_at();

drop trigger if exists
  update_service_projects_updated_at
on public.customer_service_projects;

create trigger update_service_projects_updated_at
before update
on public.customer_service_projects
for each row
execute function public.set_updated_at();

-- =========================================================
-- 8. تسجيل المرحلة الأولى عند إنشاء المشروع
-- =========================================================

create or replace function
public.log_initial_service_project_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into
    public.customer_service_project_stage_history (
      project_id,
      changed_by_user_id,
      new_stage_id,
      new_custom_stage_name,
      new_custom_stage_description,
      change_source
    )
  values (
    new.id,
    new.customer_user_id,
    new.current_stage_id,
    new.current_custom_stage_name,
    new.current_custom_stage_description,
    'customer'
  );

  return new;
end;
$$;

drop trigger if exists
  log_initial_service_project_stage
on public.customer_service_projects;

create trigger
  log_initial_service_project_stage
after insert
on public.customer_service_projects
for each row
execute function
  public.log_initial_service_project_stage();

-- =========================================================
-- 9. دالة عرض مراحل البناء
-- =========================================================

create or replace function
public.customer_list_building_stages()
returns table (
  id uuid,
  stage_key text,
  stage_name text,
  stage_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bs.id,
    bs.stage_key,
    bs.stage_name,
    bs.stage_order
  from public.building_stages bs
  where bs.is_active = true
  order by bs.stage_order asc;
$$;

-- =========================================================
-- 10. دالة إنشاء مشروع خدمات
-- يشترط تسجيل الدخول بالبريد والرمز أولًا
-- =========================================================

create or replace function
public.customer_create_service_project(
  p_customer_name text,
  p_customer_mobile text,
  p_property_location_url text,
  p_land_area numeric,
  p_project_title text,
  p_floors integer,
  p_stage_id uuid default null,
  p_custom_stage_name text default null,
  p_custom_stage_description text default null
)
returns table (
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
  authenticated_user_id uuid;
  authenticated_email text;
  created_project
    public.customer_service_projects%rowtype;
begin
  authenticated_user_id :=
    auth.uid();

  if authenticated_user_id is null then
    raise exception
      'AUTHENTICATION_REQUIRED';
  end if;

  select
    lower(trim(u.email))
  into
    authenticated_email
  from auth.users u
  where u.id =
    authenticated_user_id;

  if authenticated_email is null then
    raise exception
      'CUSTOMER_EMAIL_NOT_FOUND';
  end if;

  if length(trim(coalesce(
    p_customer_name,
    ''
  ))) < 3 then
    raise exception
      'INVALID_CUSTOMER_NAME';
  end if;

  if trim(coalesce(
    p_customer_mobile,
    ''
  )) !~ '^05[0-9]{8}$' then
    raise exception
      'INVALID_CUSTOMER_MOBILE';
  end if;

  if length(trim(coalesce(
    p_property_location_url,
    ''
  ))) < 8 then
    raise exception
      'INVALID_PROPERTY_LOCATION';
  end if;

  if p_land_area is null
    or p_land_area <= 0 then
    raise exception
      'INVALID_LAND_AREA';
  end if;

  if p_project_title not in (
    'دور',
    'شقق',
    'فيلا'
  ) then
    raise exception
      'INVALID_PROJECT_TITLE';
  end if;

  if p_floors is null
    or p_floors < 1
    or p_floors > 100 then
    raise exception
      'INVALID_FLOORS';
  end if;

  if p_stage_id is not null then
    if not exists (
      select 1
      from public.building_stages bs
      where bs.id = p_stage_id
        and bs.is_active = true
    ) then
      raise exception
        'INVALID_BUILDING_STAGE';
    end if;
  elsif length(trim(coalesce(
    p_custom_stage_name,
    ''
  ))) < 2 then
    raise exception
      'CUSTOM_STAGE_NAME_REQUIRED';
  end if;

  insert into
    public.customer_service_projects (
      customer_user_id,
      customer_name,
      customer_mobile,
      customer_email,
      property_location_url,
      land_area,
      project_title,
      floors,
      current_stage_id,
      current_custom_stage_name,
      current_custom_stage_description,
      status
    )
  values (
    authenticated_user_id,
    trim(p_customer_name),
    trim(p_customer_mobile),
    authenticated_email,
    trim(p_property_location_url),
    p_land_area,
    p_project_title,
    p_floors,
    p_stage_id,
    case
      when p_stage_id is null
      then trim(p_custom_stage_name)
      else null
    end,
    case
      when p_stage_id is null
      then nullif(
        trim(
          coalesce(
            p_custom_stage_description,
            ''
          )
        ),
        ''
      )
      else null
    end,
    'active'
  )
  returning *
  into created_project;

  return query
  select
    created_project.id,

    created_project.project_number,

    created_project.project_type,

    created_project.status::text,

    created_project.current_stage_id,

    bs.stage_name,

    created_project
      .current_custom_stage_name,

    created_project.created_at
  from (
    select 1
  ) placeholder
  left join public.building_stages bs
    on bs.id =
      created_project.current_stage_id;
end;
$$;

-- =========================================================
-- 11. دالة عرض مشاريع الخدمات للحساب
-- =========================================================

create or replace function
public.customer_get_my_service_projects()
returns table (
  id uuid,
  project_number text,
  project_type text,
  status text,
  current_stage_id uuid,
  current_stage text,
  project_title text,
  land_area numeric,
  floors integer,
  property_location_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,

    p.project_number,

    p.project_type,

    p.status::text,

    p.current_stage_id,

    coalesce(
      bs.stage_name,
      p.current_custom_stage_name,
      'غير محددة'
    ) as current_stage,

    p.project_title,

    p.land_area,

    p.floors,

    p.property_location_url,

    p.created_at,

    p.updated_at

  from public.customer_service_projects p

  left join public.building_stages bs
    on bs.id =
      p.current_stage_id

  where p.customer_user_id =
    auth.uid()

  order by p.created_at desc;
$$;

-- =========================================================
-- 12. دالة تغيير مرحلة المشروع بواسطة العميل
-- =========================================================

create or replace function
public.customer_update_service_project_stage(
  p_project_id uuid,
  p_stage_id uuid default null,
  p_custom_stage_name text default null,
  p_custom_stage_description text default null
)
returns table (
  id uuid,
  current_stage_id uuid,
  current_stage_name text,
  custom_stage_name text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_project
    public.customer_service_projects%rowtype;

  updated_project
    public.customer_service_projects%rowtype;
begin
  if auth.uid() is null then
    raise exception
      'AUTHENTICATION_REQUIRED';
  end if;

  select *
  into existing_project
  from public.customer_service_projects
  where id = p_project_id
    and customer_user_id = auth.uid();

  if not found then
    raise exception
      'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if p_stage_id is not null then
    if not exists (
      select 1
      from public.building_stages bs
      where bs.id = p_stage_id
        and bs.is_active = true
    ) then
      raise exception
        'INVALID_BUILDING_STAGE';
    end if;
  elsif length(trim(coalesce(
    p_custom_stage_name,
    ''
  ))) < 2 then
    raise exception
      'CUSTOM_STAGE_NAME_REQUIRED';
  end if;

  update public.customer_service_projects
  set
    current_stage_id =
      p_stage_id,

    current_custom_stage_name =
      case
        when p_stage_id is null
        then trim(
          p_custom_stage_name
        )
        else null
      end,

    current_custom_stage_description =
      case
        when p_stage_id is null
        then nullif(
          trim(
            coalesce(
              p_custom_stage_description,
              ''
            )
          ),
          ''
        )
        else null
      end

  where id = p_project_id

  returning *
  into updated_project;

  insert into
    public.customer_service_project_stage_history (
      project_id,
      changed_by_user_id,
      previous_stage_id,
      previous_custom_stage_name,
      new_stage_id,
      new_custom_stage_name,
      new_custom_stage_description,
      change_source
    )
  values (
    updated_project.id,
    auth.uid(),
    existing_project.current_stage_id,
    existing_project
      .current_custom_stage_name,
    updated_project.current_stage_id,
    updated_project
      .current_custom_stage_name,
    updated_project
      .current_custom_stage_description,
    'customer'
  );

  return query
  select
    updated_project.id,

    updated_project.current_stage_id,

    bs.stage_name,

    updated_project
      .current_custom_stage_name,

    updated_project.updated_at

  from (
    select 1
  ) placeholder

  left join public.building_stages bs
    on bs.id =
      updated_project.current_stage_id;
end;
$$;

-- =========================================================
-- 13. سياسات الحماية RLS
-- =========================================================

alter table
  public.building_stages
enable row level security;

alter table
  public.customer_service_projects
enable row level security;

alter table
  public.customer_service_project_stage_history
enable row level security;

drop policy if exists
  building_stages_public_read
on public.building_stages;

create policy
  building_stages_public_read
on public.building_stages
for select
to anon, authenticated
using (
  is_active = true
);

drop policy if exists
  customer_service_projects_owner_read
on public.customer_service_projects;

create policy
  customer_service_projects_owner_read
on public.customer_service_projects
for select
to authenticated
using (
  customer_user_id = auth.uid()
);

drop policy if exists
  customer_service_projects_owner_update
on public.customer_service_projects;

create policy
  customer_service_projects_owner_update
on public.customer_service_projects
for update
to authenticated
using (
  customer_user_id = auth.uid()
)
with check (
  customer_user_id = auth.uid()
);

drop policy if exists
  service_stage_history_owner_read
on public.customer_service_project_stage_history;

create policy
  service_stage_history_owner_read
on public.customer_service_project_stage_history
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_service_projects p
    where p.id = project_id
      and p.customer_user_id =
        auth.uid()
  )
);

-- لا نسمح بالإنشاء المباشر من الواجهة.
-- الإنشاء والتحديث يتمان عبر RPC فقط.

revoke insert, delete
on public.customer_service_projects
from anon, authenticated;

revoke insert, update, delete
on public.customer_service_project_stage_history
from anon, authenticated;

grant select
on public.building_stages
to anon, authenticated;

grant select
on public.customer_service_projects
to authenticated;

grant select
on public.customer_service_project_stage_history
to authenticated;

grant execute
on function
  public.customer_list_building_stages()
to anon, authenticated;

grant execute
on function
  public.customer_create_service_project(
    text,
    text,
    text,
    numeric,
    text,
    integer,
    uuid,
    text,
    text
  )
to authenticated;

grant execute
on function
  public.customer_get_my_service_projects()
to authenticated;

grant execute
on function
  public.customer_update_service_project_stage(
    uuid,
    uuid,
    text,
    text
  )
to authenticated;

commit;
