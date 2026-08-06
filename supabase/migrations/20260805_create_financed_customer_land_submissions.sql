begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1. جدول تقديمات الأراضي لعملاء التمويل
-- =========================================================

create table if not exists public.customer_land_submissions (
  id uuid primary key default gen_random_uuid(),

  customer_file_id uuid not null
    references public.customer_files(id)
    on delete cascade,

  submission_number text not null unique,

  status text not null default 'under_review',

  city text not null,
  district text not null,

  google_maps_url text not null,

  land_area numeric(12, 2) not null,
  frontage_width numeric(10, 2) not null,
  street_width numeric(10, 2) not null,

  land_use_type text not null,

  has_water boolean not null default false,
  has_electricity boolean not null default false,
  has_fiber boolean not null default false,
  has_public_sewer boolean not null default false,

  net_price numeric(16, 2) not null,
  tax_amount numeric(16, 2) not null default 0,
  brokerage_amount numeric(16, 2) not null default 0,

  total_price numeric(16, 2)
    generated always as (
      net_price
      + tax_amount
      + brokerage_amount
    ) stored,

  land_contact_name text not null,
  land_contact_mobile text not null,

  deed_storage_bucket text not null default 'land-deeds',
  deed_storage_path text not null,
  deed_original_name text not null,
  deed_content_type text not null,
  deed_size_bytes bigint not null,

  customer_note text,

  submitted_by_user_id uuid not null
    references auth.users(id)
    on delete restrict,

  submitted_at timestamptz not null default now(),

  reviewed_by_user_id uuid
    references auth.users(id)
    on delete set null,

  reviewed_at timestamptz,

  admin_decision_note text,

  completion_requested_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_land_submission_status_check
    check (
      status in (
        'under_review',
        'needs_completion',
        'approved',
        'rejected',
        'cancelled'
      )
    ),

  constraint customer_land_submission_city_check
    check (
      length(trim(city)) between 2 and 100
    ),

  constraint customer_land_submission_district_check
    check (
      length(trim(district)) between 2 and 150
    ),

  constraint customer_land_submission_maps_url_check
    check (
      google_maps_url ~* '^https?://'
      and length(trim(google_maps_url)) <= 2000
    ),

  constraint customer_land_submission_area_check
    check (
      land_area > 0
      and land_area <= 1000000
    ),

  constraint customer_land_submission_frontage_check
    check (
      frontage_width > 0
      and frontage_width <= 10000
    ),

  constraint customer_land_submission_street_check
    check (
      street_width > 0
      and street_width <= 1000
    ),

  constraint customer_land_submission_use_check
    check (
      land_use_type in (
        'residential',
        'commercial',
        'agricultural'
      )
    ),

  constraint customer_land_submission_net_price_check
    check (
      net_price > 0
    ),

  constraint customer_land_submission_tax_check
    check (
      tax_amount >= 0
    ),

  constraint customer_land_submission_brokerage_check
    check (
      brokerage_amount >= 0
    ),

  constraint customer_land_submission_contact_name_check
    check (
      length(trim(land_contact_name)) between 2 and 150
    ),

  constraint customer_land_submission_contact_mobile_check
    check (
      land_contact_mobile ~ '^05[0-9]{8}$'
    ),

  constraint customer_land_submission_deed_path_check
    check (
      length(trim(deed_storage_path)) >= 5
    ),

  constraint customer_land_submission_deed_name_check
    check (
      length(trim(deed_original_name)) >= 1
    ),

  constraint customer_land_submission_deed_type_check
    check (
      deed_content_type in (
        'application/pdf',
        'image/jpeg',
        'image/png'
      )
    ),

  constraint customer_land_submission_deed_size_check
    check (
      deed_size_bytes > 0
      and deed_size_bytes <= 15728640
    )
);

create index if not exists
  customer_land_submissions_file_index
on public.customer_land_submissions (
  customer_file_id,
  created_at desc
);

create index if not exists
  customer_land_submissions_status_index
on public.customer_land_submissions (
  status,
  submitted_at desc
);

-- يمنع وجود أكثر من تقديم أرض نشط لنفس الملف.
create unique index if not exists
  customer_land_submissions_one_active_per_file
on public.customer_land_submissions (
  customer_file_id
)
where status in (
  'under_review',
  'needs_completion',
  'approved'
);

-- =========================================================
-- 2. سجل أحداث ومراجعات تقديم الأرض
-- =========================================================

create table if not exists
  public.customer_land_submission_events (
    id uuid primary key default gen_random_uuid(),

    land_submission_id uuid not null
      references public.customer_land_submissions(id)
      on delete cascade,

    customer_file_id uuid not null
      references public.customer_files(id)
      on delete cascade,

    event_type text not null,

    previous_status text,
    new_status text,

    title text not null,
    description text,

    actor_scope text not null,
    actor_user_id uuid
      references auth.users(id)
      on delete set null,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    constraint customer_land_event_type_check
      check (
        event_type in (
          'land_submitted',
          'land_resubmitted',
          'completion_requested',
          'land_approved',
          'land_rejected',
          'land_cancelled',
          'admin_note_added',
          'deed_replaced'
        )
      ),

    constraint customer_land_event_actor_check
      check (
        actor_scope in (
          'customer',
          'admin',
          'system'
        )
      )
  );

create index if not exists
  customer_land_submission_events_submission_index
on public.customer_land_submission_events (
  land_submission_id,
  created_at desc
);

create index if not exists
  customer_land_submission_events_file_index
on public.customer_land_submission_events (
  customer_file_id,
  created_at desc
);

-- =========================================================
-- 3. جدول مرحلة العقد بعد قبول الأرض
-- =========================================================

create table if not exists
  public.customer_land_contracts (
    id uuid primary key default gen_random_uuid(),

    customer_file_id uuid not null
      references public.customer_files(id)
      on delete cascade,

    land_submission_id uuid not null unique
      references public.customer_land_submissions(id)
      on delete restrict,

    status text not null default 'not_sent',

    contract_storage_bucket text,
    contract_storage_path text,
    contract_original_name text,
    contract_content_type text,
    contract_size_bytes bigint,

    sent_by_user_id uuid
      references auth.users(id)
      on delete set null,

    sent_at timestamptz,

    customer_decided_by_user_id uuid
      references auth.users(id)
      on delete set null,

    customer_decision_at timestamptz,
    customer_rejection_note text,

    expires_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint customer_land_contract_status_check
      check (
        status in (
          'not_sent',
          'sent',
          'accepted',
          'rejected',
          'expired',
          'cancelled'
        )
      ),

    constraint customer_land_contract_file_check
      check (
        (
          status = 'not_sent'
        )
        or
        (
          contract_storage_bucket is not null
          and contract_storage_path is not null
          and contract_original_name is not null
          and contract_content_type = 'application/pdf'
          and contract_size_bytes > 0
          and contract_size_bytes <= 20971520
        )
      )
  );

create index if not exists
  customer_land_contracts_file_index
on public.customer_land_contracts (
  customer_file_id,
  created_at desc
);

-- =========================================================
-- 4. جدول إجراءات الإفراغ
-- =========================================================

create table if not exists
  public.customer_land_transfers (
    id uuid primary key default gen_random_uuid(),

    customer_file_id uuid not null
      references public.customer_files(id)
      on delete cascade,

    land_submission_id uuid not null unique
      references public.customer_land_submissions(id)
      on delete restrict,

    land_contract_id uuid not null unique
      references public.customer_land_contracts(id)
      on delete restrict,

    status text not null default 'not_started',

    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,

    admin_note text,

    updated_by_user_id uuid
      references auth.users(id)
      on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint customer_land_transfer_status_check
      check (
        status in (
          'not_started',
          'in_progress',
          'completed',
          'failed',
          'cancelled'
        )
      )
  );

create index if not exists
  customer_land_transfers_file_index
on public.customer_land_transfers (
  customer_file_id,
  created_at desc
);

-- =========================================================
-- 5. إنشاء مستودعات الملفات الخاصة
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'land-deeds',
  'land-deeds',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]::text[]
)
on conflict (id)
do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'land-contracts',
  'land-contracts',
  false,
  20971520,
  array[
    'application/pdf'
  ]::text[]
)
on conflict (id)
do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =========================================================
-- 6. دوال مساعدة
-- =========================================================

create or replace function
  public.customer_owns_financed_file(
    p_customer_file_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.customer_files cf
    where cf.id = p_customer_file_id
      and (
        cf.auth_user_id = auth.uid()
        or exists (
          select 1
          from public.customer_accounts ca
          where ca.id = cf.customer_account_id
            and ca.auth_user_id = auth.uid()
            and ca.status = 'active'
        )
      )
  );
$$;

create or replace function
  public.generate_land_submission_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.submission_number is null
    or trim(new.submission_number) = '' then
    new.submission_number :=
      'LAND-'
      || to_char(now(), 'YYYY')
      || '-'
      || upper(
        substr(
          replace(new.id::text, '-', ''),
          1,
          10
        )
      );
  end if;

  return new;
end;
$$;

drop trigger if exists
  set_customer_land_submission_number
on public.customer_land_submissions;

create trigger
  set_customer_land_submission_number
before insert
on public.customer_land_submissions
for each row
execute function
  public.generate_land_submission_number();

create or replace function
  public.set_customer_land_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists
  update_customer_land_submissions_updated_at
on public.customer_land_submissions;

create trigger
  update_customer_land_submissions_updated_at
before update
on public.customer_land_submissions
for each row
execute function
  public.set_customer_land_updated_at();

drop trigger if exists
  update_customer_land_contracts_updated_at
on public.customer_land_contracts;

create trigger
  update_customer_land_contracts_updated_at
before update
on public.customer_land_contracts
for each row
execute function
  public.set_customer_land_updated_at();

drop trigger if exists
  update_customer_land_transfers_updated_at
on public.customer_land_transfers;

create trigger
  update_customer_land_transfers_updated_at
before update
on public.customer_land_transfers
for each row
execute function
  public.set_customer_land_updated_at();

-- =========================================================
-- 7. دالة تقديم الأرض بواسطة العميل
-- =========================================================

create or replace function
  public.customer_submit_financed_land(
    p_customer_file_id uuid,
    p_city text,
    p_district text,
    p_google_maps_url text,
    p_land_area numeric,
    p_frontage_width numeric,
    p_street_width numeric,
    p_land_use_type text,
    p_has_water boolean,
    p_has_electricity boolean,
    p_has_fiber boolean,
    p_has_public_sewer boolean,
    p_net_price numeric,
    p_tax_amount numeric,
    p_brokerage_amount numeric,
    p_land_contact_name text,
    p_land_contact_mobile text,
    p_deed_storage_path text,
    p_deed_original_name text,
    p_deed_content_type text,
    p_deed_size_bytes bigint,
    p_customer_note text default null
  )
returns table (
  id uuid,
  submission_number text,
  status text,
  total_price numeric,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing_file public.customer_files%rowtype;
  created_submission
    public.customer_land_submissions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.customer_owns_financed_file(
    p_customer_file_id
  ) then
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  select *
  into existing_file
  from public.customer_files
  where id = p_customer_file_id
  for update;

  if existing_file.status not in (
    'approved',
    'accepted',
    'waiting_land',
    'needs_completion'
  ) then
    raise exception 'LAND_SUBMISSION_NOT_ALLOWED';
  end if;

  if exists (
    select 1
    from public.customer_land_submissions cls
    where cls.customer_file_id = p_customer_file_id
      and cls.status in (
        'under_review',
        'approved'
      )
  ) then
    raise exception 'ACTIVE_LAND_SUBMISSION_EXISTS';
  end if;

  if length(trim(coalesce(p_city, ''))) < 2 then
    raise exception 'INVALID_CITY';
  end if;

  if length(trim(coalesce(p_district, ''))) < 2 then
    raise exception 'INVALID_DISTRICT';
  end if;

  if trim(coalesce(p_google_maps_url, ''))
    !~* '^https?://' then
    raise exception 'INVALID_GOOGLE_MAPS_URL';
  end if;

  if p_land_area is null or p_land_area <= 0 then
    raise exception 'INVALID_LAND_AREA';
  end if;

  if p_frontage_width is null
    or p_frontage_width <= 0 then
    raise exception 'INVALID_FRONTAGE_WIDTH';
  end if;

  if p_street_width is null
    or p_street_width <= 0 then
    raise exception 'INVALID_STREET_WIDTH';
  end if;

  if p_land_use_type not in (
    'residential',
    'commercial',
    'agricultural'
  ) then
    raise exception 'INVALID_LAND_USE_TYPE';
  end if;

  if p_net_price is null
    or p_net_price <= 0 then
    raise exception 'INVALID_NET_PRICE';
  end if;

  if coalesce(p_tax_amount, 0) < 0 then
    raise exception 'INVALID_TAX_AMOUNT';
  end if;

  if coalesce(p_brokerage_amount, 0) < 0 then
    raise exception 'INVALID_BROKERAGE_AMOUNT';
  end if;

  if length(trim(coalesce(
    p_land_contact_name,
    ''
  ))) < 2 then
    raise exception 'INVALID_LAND_CONTACT_NAME';
  end if;

  if trim(coalesce(
    p_land_contact_mobile,
    ''
  )) !~ '^05[0-9]{8}$' then
    raise exception 'INVALID_LAND_CONTACT_MOBILE';
  end if;

  if length(trim(coalesce(
    p_deed_storage_path,
    ''
  ))) < 5 then
    raise exception 'DEED_FILE_REQUIRED';
  end if;

  if p_deed_content_type not in (
    'application/pdf',
    'image/jpeg',
    'image/png'
  ) then
    raise exception 'INVALID_DEED_FILE_TYPE';
  end if;

  if p_deed_size_bytes is null
    or p_deed_size_bytes <= 0
    or p_deed_size_bytes > 15728640 then
    raise exception 'INVALID_DEED_FILE_SIZE';
  end if;

  insert into
    public.customer_land_submissions (
      customer_file_id,
      submission_number,
      status,
      city,
      district,
      google_maps_url,
      land_area,
      frontage_width,
      street_width,
      land_use_type,
      has_water,
      has_electricity,
      has_fiber,
      has_public_sewer,
      net_price,
      tax_amount,
      brokerage_amount,
      land_contact_name,
      land_contact_mobile,
      deed_storage_path,
      deed_original_name,
      deed_content_type,
      deed_size_bytes,
      customer_note,
      submitted_by_user_id
    )
  values (
    p_customer_file_id,
    'TEMP-' || gen_random_uuid()::text,
    'under_review',
    trim(p_city),
    trim(p_district),
    trim(p_google_maps_url),
    p_land_area,
    p_frontage_width,
    p_street_width,
    p_land_use_type,
    coalesce(p_has_water, false),
    coalesce(p_has_electricity, false),
    coalesce(p_has_fiber, false),
    coalesce(p_has_public_sewer, false),
    p_net_price,
    coalesce(p_tax_amount, 0),
    coalesce(p_brokerage_amount, 0),
    trim(p_land_contact_name),
    trim(p_land_contact_mobile),
    trim(p_deed_storage_path),
    trim(p_deed_original_name),
    p_deed_content_type,
    p_deed_size_bytes,
    nullif(trim(coalesce(p_customer_note, '')), ''),
    auth.uid()
  )
  returning *
  into created_submission;

  update public.customer_files
  set
    status = 'land_under_review',
    current_stage = 'land_review',
    updated_at = now()
  where id = p_customer_file_id;

  insert into
    public.customer_land_submission_events (
      land_submission_id,
      customer_file_id,
      event_type,
      previous_status,
      new_status,
      title,
      description,
      actor_scope,
      actor_user_id,
      metadata
    )
  values (
    created_submission.id,
    p_customer_file_id,
    'land_submitted',
    null,
    'under_review',
    'تقديم الأرض',
    'قدّم العميل بيانات الأرض والصك للمراجعة.',
    'customer',
    auth.uid(),
    jsonb_build_object(
      'submission_number',
      created_submission.submission_number,
      'total_price',
      created_submission.total_price
    )
  );

  insert into
    public.customer_file_timeline (
      customer_file_id,
      event_type,
      title,
      description,
      actor_scope,
      actor_user_id,
      metadata
    )
  values (
    p_customer_file_id,
    'land_submitted',
    'تم تقديم الأرض',
    'أُرسلت بيانات الأرض إلى إدارة المنصة للمراجعة.',
    'customer',
    auth.uid(),
    jsonb_build_object(
      'land_submission_id',
      created_submission.id,
      'submission_number',
      created_submission.submission_number
    )
  );

  return query
  select
    created_submission.id,
    created_submission.submission_number,
    created_submission.status,
    created_submission.total_price,
    created_submission.submitted_at;
end;
$$;

-- =========================================================
-- 8. دالة عرض تقديم الأرض للعميل
-- =========================================================

create or replace function
  public.customer_get_my_financed_land_submission(
    p_customer_file_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.customer_owns_financed_file(
    p_customer_file_id
  ) then
    raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  select jsonb_build_object(
    'submission', to_jsonb(cls),
    'events',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(e)
            order by e.created_at desc
          )
          from public.customer_land_submission_events e
          where e.land_submission_id = cls.id
        ),
        '[]'::jsonb
      ),
    'contract',
      (
        select to_jsonb(c)
        from public.customer_land_contracts c
        where c.land_submission_id = cls.id
        limit 1
      ),
    'transfer',
      (
        select to_jsonb(t)
        from public.customer_land_transfers t
        where t.land_submission_id = cls.id
        limit 1
      )
  )
  into result
  from public.customer_land_submissions cls
  where cls.customer_file_id = p_customer_file_id
  order by cls.created_at desc
  limit 1;

  return coalesce(
    result,
    jsonb_build_object(
      'submission', null,
      'events', '[]'::jsonb,
      'contract', null,
      'transfer', null
    )
  );
end;
$$;

-- =========================================================
-- 9. حماية الصفوف RLS
-- =========================================================

alter table
  public.customer_land_submissions
enable row level security;

alter table
  public.customer_land_submission_events
enable row level security;

alter table
  public.customer_land_contracts
enable row level security;

alter table
  public.customer_land_transfers
enable row level security;

drop policy if exists
  customer_land_submissions_owner_read
on public.customer_land_submissions;

create policy
  customer_land_submissions_owner_read
on public.customer_land_submissions
for select
to authenticated
using (
  public.customer_owns_financed_file(
    customer_file_id
  )
);

drop policy if exists
  customer_land_events_owner_read
on public.customer_land_submission_events;

create policy
  customer_land_events_owner_read
on public.customer_land_submission_events
for select
to authenticated
using (
  public.customer_owns_financed_file(
    customer_file_id
  )
);

drop policy if exists
  customer_land_contracts_owner_read
on public.customer_land_contracts;

create policy
  customer_land_contracts_owner_read
on public.customer_land_contracts
for select
to authenticated
using (
  public.customer_owns_financed_file(
    customer_file_id
  )
);

drop policy if exists
  customer_land_transfers_owner_read
on public.customer_land_transfers;

create policy
  customer_land_transfers_owner_read
on public.customer_land_transfers
for select
to authenticated
using (
  public.customer_owns_financed_file(
    customer_file_id
  )
);

-- =========================================================
-- 10. حماية ملفات الصك في Storage
-- المسار الإلزامي:
-- user-id/customer-file-id/filename
-- =========================================================

drop policy if exists
  land_deeds_customer_insert
on storage.objects;

create policy
  land_deeds_customer_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'land-deeds'
  and (storage.foldername(name))[1] =
    auth.uid()::text
);

drop policy if exists
  land_deeds_customer_read
on storage.objects;

create policy
  land_deeds_customer_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'land-deeds'
  and (storage.foldername(name))[1] =
    auth.uid()::text
);

drop policy if exists
  land_deeds_customer_update
on storage.objects;

create policy
  land_deeds_customer_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'land-deeds'
  and (storage.foldername(name))[1] =
    auth.uid()::text
)
with check (
  bucket_id = 'land-deeds'
  and (storage.foldername(name))[1] =
    auth.uid()::text
);

drop policy if exists
  land_deeds_customer_delete
on storage.objects;

create policy
  land_deeds_customer_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'land-deeds'
  and (storage.foldername(name))[1] =
    auth.uid()::text
);

-- =========================================================
-- 11. منع التعديل المباشر
-- =========================================================

revoke insert, update, delete
on public.customer_land_submissions
from anon, authenticated;

revoke insert, update, delete
on public.customer_land_submission_events
from anon, authenticated;

revoke insert, update, delete
on public.customer_land_contracts
from anon, authenticated;

revoke insert, update, delete
on public.customer_land_transfers
from anon, authenticated;

grant select
on public.customer_land_submissions
to authenticated;

grant select
on public.customer_land_submission_events
to authenticated;

grant select
on public.customer_land_contracts
to authenticated;

grant select
on public.customer_land_transfers
to authenticated;

grant execute
on function public.customer_owns_financed_file(uuid)
to authenticated;

grant execute
on function public.customer_submit_financed_land(
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text
)
to authenticated;

grant execute
on function
  public.customer_get_my_financed_land_submission(uuid)
to authenticated;

commit;
