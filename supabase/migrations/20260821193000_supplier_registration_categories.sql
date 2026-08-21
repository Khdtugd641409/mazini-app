begin;

alter table public.supplier_applications
  add column if not exists initial_product_category text;

alter table public.supplier_applications
  drop constraint if exists supplier_applications_initial_product_category_check;

alter table public.supplier_applications
  add constraint supplier_applications_initial_product_category_check
  check (
    initial_product_category is null
    or initial_product_category in (
      'concrete',
      'steel',
      'blocks',
      'backfill_material',
      'plumbing',
      'electrical',
      'cement',
      'sand',
      'engineering_office',
      'excavation',
      'backfilling',
      'carpenter',
      'blacksmith',
      'electrician',
      'plumber',
      'mason',
      'plasterer'
    )
  );

drop function if exists public.supplier_submit_application(text, text, text, text, text, boolean, text);

drop function if exists public.supplier_submit_application(text, text, text, text, text);

create or replace function public.supplier_submit_application(
  p_organization_name text,
  p_commercial_registration_number text,
  p_mobile_number text,
  p_maps_url text,
  p_product_category text,
  p_accept_platform_fee_terms boolean,
  p_platform_fee_terms_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_id uuid;
  v_product_name text;
  v_platform_fee_rate constant numeric(5, 4) := 0.0100;
  v_platform_fee_iban constant text := 'SA8680000218608010163952';
  v_platform_fee_terms_version constant text := 'supplier-platform-fee-v1';
  v_platform_fee_terms_text constant text := 'أتعهد بسداد عمولة لمنصة نايف المزيني للبناء الذاتي قدرها 1٪ من إجمالي قيمة التعاقد مع كل عميل وصل إليّ عن طريق المنصة، وتبقى هذه العمولة في ذمتي حتى سدادها إلى حساب المنصة الموضح أدناه.';
begin
  if v_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select lower(trim(auth_user.email))
    into v_email
  from auth.users auth_user
  where auth_user.id = v_uid;

  if v_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if p_accept_platform_fee_terms is distinct from true then
    raise exception 'SUPPLIER_PLATFORM_FEE_TERMS_REQUIRED';
  end if;

  if trim(coalesce(p_platform_fee_terms_version, '')) <> v_platform_fee_terms_version then
    raise exception 'SUPPLIER_PLATFORM_FEE_TERMS_VERSION_MISMATCH';
  end if;

  if length(trim(coalesce(p_organization_name, ''))) < 2 then
    raise exception 'INVALID_ORGANIZATION_NAME';
  end if;

  if length(trim(coalesce(p_commercial_registration_number, ''))) < 3 then
    raise exception 'INVALID_COMMERCIAL_REGISTRATION';
  end if;

  if trim(coalesce(p_mobile_number, '')) !~ '^05[0-9]{8}$' then
    raise exception 'INVALID_MOBILE';
  end if;

  if trim(coalesce(p_maps_url, '')) !~* '^https?://' then
    raise exception 'INVALID_MAPS_URL';
  end if;

  if trim(coalesce(p_product_category, '')) not in (
    'concrete',
    'steel',
    'blocks',
    'backfill_material',
    'plumbing',
    'electrical',
    'cement',
    'sand',
    'engineering_office',
    'excavation',
    'backfilling',
    'carpenter',
    'blacksmith',
    'electrician',
    'plumber',
    'mason',
    'plasterer'
  ) then
    raise exception 'INVALID_PRODUCT_CATEGORY';
  end if;

  v_product_name := case trim(p_product_category)
    when 'concrete' then 'مواد بناء ← عظم ← مواد ← خرسانة'
    when 'steel' then 'مواد بناء ← عظم ← مواد ← حديد'
    when 'blocks' then 'مواد بناء ← عظم ← مواد ← طوب'
    when 'backfill_material' then 'مواد بناء ← عظم ← مواد ← ردمية'
    when 'plumbing' then 'مواد بناء ← عظم ← مواد ← سباكة'
    when 'electrical' then 'مواد بناء ← عظم ← مواد ← كهرباء'
    when 'cement' then 'مواد بناء ← عظم ← مواد ← أسمنت'
    when 'sand' then 'مواد بناء ← عظم ← مواد ← رمل'
    when 'engineering_office' then 'مواد بناء ← عظم ← مقاول ← مكتب هندسي'
    when 'excavation' then 'مواد بناء ← عظم ← مقاول ← حفر'
    when 'backfilling' then 'مواد بناء ← عظم ← مقاول ← دفن'
    when 'carpenter' then 'مواد بناء ← عظم ← مقاول ← نجار'
    when 'blacksmith' then 'مواد بناء ← عظم ← مقاول ← حداد'
    when 'electrician' then 'مواد بناء ← عظم ← مقاول ← كهربائي'
    when 'plumber' then 'مواد بناء ← عظم ← مقاول ← سباك'
    when 'mason' then 'مواد بناء ← عظم ← مقاول ← بناء'
    when 'plasterer' then 'مواد بناء ← عظم ← مقاول ← مليس'
    else null
  end;

  insert into public.supplier_applications (
    auth_user_id,
    organization_name,
    commercial_registration_number,
    email,
    mobile_number,
    maps_url,
    initial_product_name,
    initial_product_category,
    status,
    admin_note,
    submitted_at,
    reviewed_at,
    reviewed_by_user_id,
    platform_fee_rate,
    platform_fee_iban,
    platform_fee_terms_version,
    platform_fee_terms_text,
    platform_fee_accepted_at,
    updated_at
  ) values (
    v_uid,
    trim(p_organization_name),
    trim(p_commercial_registration_number),
    v_email,
    trim(p_mobile_number),
    trim(p_maps_url),
    v_product_name,
    trim(p_product_category),
    'under_review',
    null,
    now(),
    null,
    null,
    v_platform_fee_rate,
    v_platform_fee_iban,
    v_platform_fee_terms_version,
    v_platform_fee_terms_text,
    now(),
    now()
  )
  on conflict (auth_user_id) do update set
    organization_name = excluded.organization_name,
    commercial_registration_number = excluded.commercial_registration_number,
    email = excluded.email,
    mobile_number = excluded.mobile_number,
    maps_url = excluded.maps_url,
    initial_product_name = excluded.initial_product_name,
    initial_product_category = excluded.initial_product_category,
    status = 'under_review',
    admin_note = null,
    submitted_at = now(),
    reviewed_at = null,
    reviewed_by_user_id = null,
    platform_fee_rate = excluded.platform_fee_rate,
    platform_fee_iban = excluded.platform_fee_iban,
    platform_fee_terms_version = excluded.platform_fee_terms_version,
    platform_fee_terms_text = excluded.platform_fee_terms_text,
    platform_fee_accepted_at = now(),
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
set search_path = ''
as $$
  select to_jsonb(application_record)
  from (
    select
      application.id,
      application.organization_name as "organizationName",
      application.commercial_registration_number as "commercialRegistrationNumber",
      application.email,
      application.mobile_number as "mobileNumber",
      application.maps_url as "mapsUrl",
      application.initial_product_name as "initialProductName",
      application.initial_product_category as "initialProductCategory",
      application.status,
      application.admin_note as "adminNote",
      application.submitted_at as "submittedAt",
      application.platform_fee_rate as "platformFeeRate",
      application.platform_fee_iban as "platformFeeIban",
      application.platform_fee_terms_version as "platformFeeTermsVersion",
      application.platform_fee_accepted_at as "platformFeeAcceptedAt"
    from public.supplier_applications application
    where application.auth_user_id = auth.uid()
    limit 1
  ) application_record;
$$;

create or replace function public.admin_list_supplier_applications()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_active_platform_admin() then coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', application.id,
          'organizationName', application.organization_name,
          'commercialRegistrationNumber', application.commercial_registration_number,
          'email', application.email,
          'mobileNumber', application.mobile_number,
          'mapsUrl', application.maps_url,
          'initialProductName', application.initial_product_name,
          'initialProductCategory', application.initial_product_category,
          'status', application.status,
          'adminNote', application.admin_note,
          'submittedAt', application.submitted_at,
          'platformFeeRate', application.platform_fee_rate,
          'platformFeeIban', application.platform_fee_iban,
          'platformFeeTermsVersion', application.platform_fee_terms_version,
          'platformFeeAcceptedAt', application.platform_fee_accepted_at
        )
        order by application.submitted_at desc
      ),
      '[]'::jsonb
    )
    else '[]'::jsonb
  end
  from public.supplier_applications application;
$$;

create or replace function public.admin_decide_supplier_application(
  p_application_id uuid,
  p_decision text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.supplier_applications%rowtype;
begin
  if not public.is_active_platform_admin() then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  if p_decision not in ('approved', 'needs_completion', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select application.*
    into application_record
  from public.supplier_applications application
  where application.id = p_application_id
  for update;

  if not found then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;

  if p_decision = 'approved'
    and (
      application_record.platform_fee_accepted_at is null
      or application_record.platform_fee_rate is distinct from 0.0100
      or application_record.platform_fee_iban is distinct from 'SA8680000218608010163952'
      or application_record.platform_fee_terms_version is distinct from 'supplier-platform-fee-v1'
    )
  then
    raise exception 'SUPPLIER_PLATFORM_FEE_TERMS_REQUIRED';
  end if;

  update public.supplier_applications
  set status = p_decision,
      admin_note = nullif(trim(coalesce(p_note, '')), ''),
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
      application_record.auth_user_id,
      application_record.organization_name,
      application_record.commercial_registration_number,
      application_record.mobile_number,
      application_record.maps_url,
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

    if application_record.initial_product_category is null
      and not exists (
        select 1
        from public.supplier_products product
        where product.supplier_user_id = application_record.auth_user_id
          and lower(product.product_name) = lower(application_record.initial_product_name)
      ) then
      insert into public.supplier_products (supplier_user_id, product_name)
      values (application_record.auth_user_id, application_record.initial_product_name);
    end if;
  end if;

  return p_decision;
end;
$$;

revoke all on function public.supplier_submit_application(text, text, text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.supplier_submit_application(text, text, text, text, text, boolean, text)
  to authenticated;

grant execute on function public.supplier_get_my_application() to authenticated;
grant execute on function public.admin_list_supplier_applications() to authenticated;
grant execute on function public.admin_decide_supplier_application(uuid, text, text) to authenticated;

commit;
