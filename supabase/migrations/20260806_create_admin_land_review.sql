begin;

-- =========================================================
-- 1. التحقق من أن المستخدم الحالي من إدارة المنصة
-- يدعم البنى الشائعة الموجودة في المشروع دون افتراض عمود واحد فقط.
-- =========================================================

create or replace function public.admin_is_authorized()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid;
  is_authorized boolean := false;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  -- البنية الأولى المحتملة: admin_profiles.auth_user_id
  if to_regclass('public.admin_profiles') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'admin_profiles'
        and column_name = 'auth_user_id'
    )
  then
    execute
      'select exists (
         select 1
         from public.admin_profiles
         where auth_user_id = $1
       )'
    into is_authorized
    using current_user_id;

    if is_authorized then
      return true;
    end if;
  end if;

  -- البنية الثانية المحتملة: admins.auth_user_id
  if to_regclass('public.admins') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'admins'
        and column_name = 'auth_user_id'
    )
  then
    execute
      'select exists (
         select 1
         from public.admins
         where auth_user_id = $1
       )'
    into is_authorized
    using current_user_id;

    if is_authorized then
      return true;
    end if;
  end if;

  -- البنية الثالثة المحتملة: admin_users.auth_user_id
  if to_regclass('public.admin_users') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'admin_users'
        and column_name = 'auth_user_id'
    )
  then
    execute
      'select exists (
         select 1
         from public.admin_users
         where auth_user_id = $1
       )'
    into is_authorized
    using current_user_id;

    if is_authorized then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- =========================================================
-- 2. دالة داخلية تمنع تنفيذ وظائف الإدارة دون صلاحية
-- =========================================================

create or replace function public.admin_require_authorization()
returns void
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.admin_is_authorized() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;
end;
$$;

-- =========================================================
-- 3. عدادات طلبات الأراضي في لوحة الإدارة
-- =========================================================

create or replace function public.admin_get_land_submission_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  perform public.admin_require_authorization();

  select jsonb_build_object(
    'all',
      count(*),

    'under_review',
      count(*) filter (
        where status = 'under_review'
      ),

    'needs_completion',
      count(*) filter (
        where status = 'needs_completion'
      ),

    'approved',
      count(*) filter (
        where status = 'approved'
      ),

    'rejected',
      count(*) filter (
        where status = 'rejected'
      ),

    'cancelled',
      count(*) filter (
        where status = 'cancelled'
      )
  )
  into result
  from public.customer_land_submissions;

  return result;
end;
$$;

-- =========================================================
-- 4. البحث والترقيم في طلبات الأراضي
-- =========================================================

create or replace function public.admin_search_land_submissions(
  p_search text default '',
  p_status text default 'all',
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  normalized_search text;
  normalized_status text;
  normalized_sort text;

  safe_page integer;
  safe_page_size integer;
  row_offset integer;

  total_count bigint;
  total_pages integer;

  rows_result jsonb;
begin
  perform public.admin_require_authorization();

  normalized_search :=
    lower(trim(coalesce(p_search, '')));

  normalized_status :=
    lower(trim(coalesce(p_status, 'all')));

  normalized_sort :=
    lower(trim(coalesce(p_sort, 'newest')));

  if normalized_status not in (
    'all',
    'under_review',
    'needs_completion',
    'approved',
    'rejected',
    'cancelled'
  ) then
    raise exception 'INVALID_LAND_STATUS_FILTER';
  end if;

  if normalized_sort not in (
    'newest',
    'oldest',
    'highest_price',
    'lowest_price',
    'largest_area',
    'smallest_area'
  ) then
    raise exception 'INVALID_LAND_SORT';
  end if;

  safe_page :=
    greatest(coalesce(p_page, 1), 1);

  safe_page_size :=
    least(
      greatest(coalesce(p_page_size, 25), 1),
      100
    );

  row_offset :=
    (safe_page - 1) * safe_page_size;

  select count(*)
  into total_count
  from public.customer_land_submissions cls
  join public.customer_files cf
    on cf.id = cls.customer_file_id
  where
    (
      normalized_status = 'all'
      or cls.status = normalized_status
    )
    and (
      normalized_search = ''
      or lower(coalesce(cls.submission_number, ''))
        like '%' || normalized_search || '%'
      or lower(coalesce(cf.file_number, ''))
        like '%' || normalized_search || '%'
      or lower(coalesce(cf.customer_name, ''))
        like '%' || normalized_search || '%'
      or lower(coalesce(cf.mobile_number, ''))
        like '%' || normalized_search || '%'
      or lower(coalesce(cls.city, ''))
        like '%' || normalized_search || '%'
      or lower(coalesce(cls.district, ''))
        like '%' || normalized_search || '%'
      or lower(coalesce(cls.land_contact_name, ''))
        like '%' || normalized_search || '%'
      or lower(coalesce(cls.land_contact_mobile, ''))
        like '%' || normalized_search || '%'
    );

  total_pages :=
    greatest(
      ceil(
        total_count::numeric /
        safe_page_size::numeric
      )::integer,
      1
    );

  select coalesce(
    jsonb_agg(
      to_jsonb(listed_row)
    ),
    '[]'::jsonb
  )
  into rows_result
  from (
    select
      cls.id,
      cls.customer_file_id,
      cls.submission_number,
      cls.status,

      cf.file_number,
      cf.customer_name,
      cf.mobile_number,
      cf.email,

      cls.city,
      cls.district,
      cls.google_maps_url,

      cls.land_area,
      cls.frontage_width,
      cls.street_width,
      cls.land_use_type,

      cls.total_price,

      cls.land_contact_name,
      cls.land_contact_mobile,

      cls.submitted_at,
      cls.reviewed_at,
      cls.updated_at

    from public.customer_land_submissions cls

    join public.customer_files cf
      on cf.id = cls.customer_file_id

    where
      (
        normalized_status = 'all'
        or cls.status = normalized_status
      )
      and (
        normalized_search = ''
        or lower(coalesce(cls.submission_number, ''))
          like '%' || normalized_search || '%'
        or lower(coalesce(cf.file_number, ''))
          like '%' || normalized_search || '%'
        or lower(coalesce(cf.customer_name, ''))
          like '%' || normalized_search || '%'
        or lower(coalesce(cf.mobile_number, ''))
          like '%' || normalized_search || '%'
        or lower(coalesce(cls.city, ''))
          like '%' || normalized_search || '%'
        or lower(coalesce(cls.district, ''))
          like '%' || normalized_search || '%'
        or lower(coalesce(cls.land_contact_name, ''))
          like '%' || normalized_search || '%'
        or lower(coalesce(cls.land_contact_mobile, ''))
          like '%' || normalized_search || '%'
      )

    order by
      case
        when normalized_sort = 'newest'
        then cls.submitted_at
      end desc nulls last,

      case
        when normalized_sort = 'oldest'
        then cls.submitted_at
      end asc nulls last,

      case
        when normalized_sort = 'highest_price'
        then cls.total_price
      end desc nulls last,

      case
        when normalized_sort = 'lowest_price'
        then cls.total_price
      end asc nulls last,

      case
        when normalized_sort = 'largest_area'
        then cls.land_area
      end desc nulls last,

      case
        when normalized_sort = 'smallest_area'
        then cls.land_area
      end asc nulls last,

      cls.created_at desc

    limit safe_page_size
    offset row_offset
  ) listed_row;

  return jsonb_build_object(
    'submissions',
      rows_result,

    'pagination',
      jsonb_build_object(
        'page',
          safe_page,

        'pageSize',
          safe_page_size,

        'totalCount',
          total_count,

        'totalPages',
          total_pages,

        'hasPreviousPage',
          safe_page > 1,

        'hasNextPage',
          safe_page < total_pages
      )
  );
end;
$$;

-- =========================================================
-- 5. مساحة عمل طلب الأرض للإدارة
-- =========================================================

create or replace function public.admin_get_land_submission_workspace(
  p_land_submission_id uuid
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
  perform public.admin_require_authorization();

  if p_land_submission_id is null then
    raise exception 'LAND_SUBMISSION_ID_REQUIRED';
  end if;

  select jsonb_build_object(
    'landSubmission',
      (
        select jsonb_build_object(
          'id',
            cls.id,

          'customer_file_id',
            cls.customer_file_id,

          'submission_number',
            cls.submission_number,

          'status',
            cls.status,

          'city',
            cls.city,

          'district',
            cls.district,

          'google_maps_url',
            cls.google_maps_url,

          'land_area',
            cls.land_area,

          'frontage_width',
            cls.frontage_width,

          'street_width',
            cls.street_width,

          'land_use_type',
            cls.land_use_type,

          'has_water',
            cls.has_water,

          'has_electricity',
            cls.has_electricity,

          'has_fiber',
            cls.has_fiber,

          'has_public_sewer',
            cls.has_public_sewer,

          'net_price',
            cls.net_price,

          'tax_amount',
            cls.tax_amount,

          'brokerage_amount',
            cls.brokerage_amount,

          'total_price',
            cls.total_price,

          'land_contact_name',
            cls.land_contact_name,

          'land_contact_mobile',
            cls.land_contact_mobile,

          'deed_storage_bucket',
            cls.deed_storage_bucket,

          'deed_storage_path',
            cls.deed_storage_path,

          'deed_original_name',
            cls.deed_original_name,

          'deed_content_type',
            cls.deed_content_type,

          'deed_size_bytes',
            cls.deed_size_bytes,

          'customer_note',
            cls.customer_note,

          'submitted_at',
            cls.submitted_at,

          'reviewed_at',
            cls.reviewed_at,

          'admin_decision_note',
            cls.admin_decision_note,

          'completion_requested_at',
            cls.completion_requested_at,

          'approved_at',
            cls.approved_at,

          'rejected_at',
            cls.rejected_at,

          'created_at',
            cls.created_at,

          'updated_at',
            cls.updated_at
        )
      ),

    'customerFile',
      (
        select jsonb_build_object(
          'id',
            cf.id,

          'file_number',
            cf.file_number,

          'status',
            cf.status,

          'current_stage',
            cf.current_stage,

          'customer_name',
            cf.customer_name,

          'mobile_number',
            cf.mobile_number,

          'email',
            cf.email,

          'land_area',
            cf.land_area,

          'estimated_land_price',
            cf.estimated_land_price,

          'floors',
            cf.floors,

          'bank_offer',
            cf.bank_offer,

          'estimated_construction_cost',
            cf.estimated_construction_cost,

          'estimated_project_cost',
            cf.estimated_project_cost,

          'base_customer_payment',
            cf.base_customer_payment,

          'excess_amount',
            cf.excess_amount,

          'total_customer_payment',
            cf.total_customer_payment,

          'submitted_at',
            cf.submitted_at,

          'approved_at',
            cf.approved_at,

          'updated_at',
            cf.updated_at
        )
        from public.customer_files cf
        where cf.id = cls.customer_file_id
      ),

    'events',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(event_row)
            order by event_row.created_at desc
          )
          from public.customer_land_submission_events event_row
          where event_row.land_submission_id = cls.id
        ),
        '[]'::jsonb
      ),

    'contract',
      (
        select to_jsonb(contract_row)
        from public.customer_land_contracts contract_row
        where contract_row.land_submission_id = cls.id
        limit 1
      ),

    'transfer',
      (
        select to_jsonb(transfer_row)
        from public.customer_land_transfers transfer_row
        where transfer_row.land_submission_id = cls.id
        limit 1
      )

  )
  into result
  from public.customer_land_submissions cls
  where cls.id = p_land_submission_id;

  if result is null then
    raise exception 'LAND_SUBMISSION_NOT_FOUND';
  end if;

  return result;
end;
$$;

-- =========================================================
-- 6. قرار الإدارة على الأرض
-- القيم:
-- approve
-- request_completion
-- reject
-- =========================================================

create or replace function public.admin_decide_land_submission(
  p_land_submission_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_decision text;
  normalized_note text;

  existing_submission
    public.customer_land_submissions%rowtype;

  next_land_status text;
  next_file_status text;
  next_file_stage text;

  event_type_value text;
  event_title_value text;
  event_description_value text;

  decision_time timestamptz := now();
begin
  perform public.admin_require_authorization();

  if p_land_submission_id is null then
    raise exception 'LAND_SUBMISSION_ID_REQUIRED';
  end if;

  normalized_decision :=
    lower(trim(coalesce(p_decision, '')));

  normalized_note :=
    nullif(
      trim(coalesce(p_note, '')),
      ''
    );

  if normalized_decision not in (
    'approve',
    'request_completion',
    'reject'
  ) then
    raise exception 'INVALID_LAND_DECISION';
  end if;

  if normalized_decision in (
    'request_completion',
    'reject'
  )
  and normalized_note is null
  then
    raise exception 'LAND_DECISION_NOTE_REQUIRED';
  end if;

  select *
  into existing_submission
  from public.customer_land_submissions
  where id = p_land_submission_id
  for update;

  if not found then
    raise exception 'LAND_SUBMISSION_NOT_FOUND';
  end if;

  if existing_submission.status not in (
    'under_review',
    'needs_completion'
  ) then
    raise exception 'LAND_DECISION_NOT_ALLOWED';
  end if;

  if normalized_decision = 'approve' then
    next_land_status := 'approved';
    next_file_status := 'land_approved';
    next_file_stage := 'land_contract';

    event_type_value := 'land_approved';
    event_title_value := 'تم قبول الأرض';
    event_description_value :=
      coalesce(
        normalized_note,
        'وافقت إدارة المنصة على الأرض المقدمة.'
      );

  elsif normalized_decision = 'request_completion' then
    next_land_status := 'needs_completion';
    next_file_status := 'land_needs_completion';
    next_file_stage := 'land_submission';

    event_type_value := 'completion_requested';
    event_title_value := 'مطلوب استكمال بيانات الأرض';
    event_description_value := normalized_note;

  else
    next_land_status := 'rejected';
    next_file_status := 'land_rejected';
    next_file_stage := 'land_submission';

    event_type_value := 'land_rejected';
    event_title_value := 'تم رفض الأرض';
    event_description_value := normalized_note;
  end if;

  update public.customer_land_submissions
  set
    status =
      next_land_status,

    reviewed_by_user_id =
      auth.uid(),

    reviewed_at =
      decision_time,

    admin_decision_note =
      normalized_note,

    completion_requested_at =
      case
        when normalized_decision =
          'request_completion'
        then decision_time
        else completion_requested_at
      end,

    approved_at =
      case
        when normalized_decision =
          'approve'
        then decision_time
        else null
      end,

    rejected_at =
      case
        when normalized_decision =
          'reject'
        then decision_time
        else null
      end,

    updated_at =
      decision_time

  where id =
    existing_submission.id;

  update public.customer_files
  set
    status =
      next_file_status,

    current_stage =
      next_file_stage,

    updated_at =
      decision_time

  where id =
    existing_submission.customer_file_id;

  insert into public.customer_land_submission_events (
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
    existing_submission.id,
    existing_submission.customer_file_id,
    event_type_value,
    existing_submission.status,
    next_land_status,
    event_title_value,
    event_description_value,
    'admin',
    auth.uid(),
    jsonb_build_object(
      'decision',
        normalized_decision,

      'reviewed_at',
        decision_time
    )
  );

  insert into public.customer_file_status_history (
    customer_file_id,
    previous_status,
    new_status,
    note,
    changed_by,
    created_at
  )
  select
    cf.id,
    cf.status,
    next_file_status,
    normalized_note,
    auth.uid(),
    decision_time
  from public.customer_files cf
  where cf.id =
    existing_submission.customer_file_id;

  /*
   * أدرج الحدث في السجل الزمني العام للعميل.
   */
  insert into public.customer_file_timeline (
    customer_file_id,
    event_type,
    title,
    description,
    actor_scope,
    actor_user_id,
    metadata,
    created_at
  )
  values (
    existing_submission.customer_file_id,
    event_type_value,
    event_title_value,
    event_description_value,
    'admin',
    auth.uid(),
    jsonb_build_object(
      'land_submission_id',
        existing_submission.id,

      'submission_number',
        existing_submission.submission_number,

      'land_status',
        next_land_status
    ),
    decision_time
  );

  /*
   * عند قبول الأرض ينشأ سجل العقد تلقائيًا،
   * لكن يظل في حالة not_sent حتى ترفع الإدارة ملف العقد.
   */
  if normalized_decision = 'approve' then
    insert into public.customer_land_contracts (
      customer_file_id,
      land_submission_id,
      status
    )
    values (
      existing_submission.customer_file_id,
      existing_submission.id,
      'not_sent'
    )
    on conflict (land_submission_id)
    do nothing;
  end if;

  return public.admin_get_land_submission_workspace(
    existing_submission.id
  );
end;
$$;

-- =========================================================
-- 7. سياسات قراءة الإدارة للجداول
-- =========================================================

drop policy if exists
  customer_land_submissions_admin_read
on public.customer_land_submissions;

create policy
  customer_land_submissions_admin_read
on public.customer_land_submissions
for select
to authenticated
using (
  public.admin_is_authorized()
);

drop policy if exists
  customer_land_events_admin_read
on public.customer_land_submission_events;

create policy
  customer_land_events_admin_read
on public.customer_land_submission_events
for select
to authenticated
using (
  public.admin_is_authorized()
);

drop policy if exists
  customer_land_contracts_admin_read
on public.customer_land_contracts;

create policy
  customer_land_contracts_admin_read
on public.customer_land_contracts
for select
to authenticated
using (
  public.admin_is_authorized()
);

drop policy if exists
  customer_land_transfers_admin_read
on public.customer_land_transfers;

create policy
  customer_land_transfers_admin_read
on public.customer_land_transfers
for select
to authenticated
using (
  public.admin_is_authorized()
);

-- =========================================================
-- 8. السماح للإدارة بفتح الصك من Storage
-- =========================================================

drop policy if exists
  land_deeds_admin_read
on storage.objects;

create policy
  land_deeds_admin_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'land-deeds'
  and public.admin_is_authorized()
);

-- =========================================================
-- 9. الصلاحيات
-- =========================================================

revoke all
on function public.admin_is_authorized()
from public;

revoke all
on function public.admin_require_authorization()
from public;

revoke all
on function public.admin_get_land_submission_counts()
from public;

revoke all
on function public.admin_search_land_submissions(
  text,
  text,
  text,
  integer,
  integer
)
from public;

revoke all
on function public.admin_get_land_submission_workspace(uuid)
from public;

revoke all
on function public.admin_decide_land_submission(
  uuid,
  text,
  text
)
from public;

grant execute
on function public.admin_is_authorized()
to authenticated;

grant execute
on function public.admin_require_authorization()
to authenticated;

grant execute
on function public.admin_get_land_submission_counts()
to authenticated;

grant execute
on function public.admin_search_land_submissions(
  text,
  text,
  text,
  integer,
  integer
)
to authenticated;

grant execute
on function public.admin_get_land_submission_workspace(uuid)
to authenticated;

grant execute
on function public.admin_decide_land_submission(
  uuid,
  text,
  text
)
to authenticated;

commit;
