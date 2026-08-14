begin;

alter table public.supplier_products
  add column if not exists marketplace_section text not null default 'construction';

alter table public.supplier_orders
  add column if not exists marketplace_section text not null default 'construction',
  add column if not exists buyer_email text;

alter table public.supplier_products
  drop constraint if exists supplier_products_category_code_check,
  drop constraint if exists supplier_products_marketplace_section_check,
  drop constraint if exists supplier_products_section_category_check;

alter table public.supplier_products
  add constraint supplier_products_marketplace_section_check
    check (marketplace_section in ('construction', 'home')),
  add constraint supplier_products_category_code_check
    check (
      category_code is null
      or category_code in (
        'steel', 'concrete', 'blocks', 'insulation', 'plumbing',
        'electrical', 'finishes', 'doors_windows', 'tiles_stone', 'other',
        'power_tools', 'hand_tools', 'home_maintenance', 'garden_tools',
        'cleaning_tools', 'home_safety', 'other_home'
      )
    ),
  add constraint supplier_products_section_category_check
    check (
      category_code is null
      or (
        marketplace_section = 'construction'
        and category_code in (
          'steel', 'concrete', 'blocks', 'insulation', 'plumbing',
          'electrical', 'finishes', 'doors_windows', 'tiles_stone', 'other'
        )
      )
      or (
        marketplace_section = 'home'
        and category_code in (
          'power_tools', 'hand_tools', 'home_maintenance', 'garden_tools',
          'cleaning_tools', 'home_safety', 'other_home'
        )
      )
    );

alter table public.supplier_orders
  drop constraint if exists supplier_orders_marketplace_section_check,
  drop constraint if exists supplier_orders_buyer_email_check;

alter table public.supplier_orders
  add constraint supplier_orders_marketplace_section_check
    check (marketplace_section in ('construction', 'home')),
  add constraint supplier_orders_buyer_email_check
    check (
      buyer_email is null
      or (
        length(buyer_email) <= 254
        and buyer_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      )
    );

create index if not exists supplier_products_section_catalog_idx
  on public.supplier_products(marketplace_section, category_code, created_at desc)
  where is_active = true
    and price > 0
    and unit_code is not null
    and category_code is not null
    and image_path is not null;

create index if not exists supplier_orders_buyer_section_idx
  on public.supplier_orders(buyer_user_id, marketplace_section, submitted_at desc);

create or replace function public.construction_marketplace_get_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_name text;
  actor_mobile text;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select buyer.buyer_role, buyer.buyer_name, buyer.buyer_mobile
    into actor_role, actor_name, actor_mobile
  from public.marketplace_current_buyer() buyer
  limit 1;

  if actor_role is null then
    raise exception 'MARKETPLACE_BUYER_AUTHORIZATION_REQUIRED';
  end if;

  select jsonb_build_object(
    'actor', jsonb_build_object(
      'role', actor_role,
      'name', actor_name,
      'mobile', actor_mobile
    ),
    'products', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', product.id,
          'productName', product.product_name,
          'description', product.description,
          'price', product.price,
          'unitCode', product.unit_code,
          'categoryCode', product.category_code,
          'imagePath', product.image_path,
          'supplierUserId', product.supplier_user_id,
          'supplierName', supplier.organization_name,
          'marketplaceSection', product.marketplace_section
        ) order by product.created_at desc
      ) filter (where product.id is not null),
      '[]'::jsonb
    )
  ) into result
  from public.supplier_products product
  join public.supplier_profiles supplier
    on supplier.id = product.supplier_user_id
   and supplier.status = 'active'
  where product.marketplace_section = 'construction'
    and product.is_active = true
    and product.price > 0
    and product.unit_code is not null
    and product.category_code is not null
    and product.image_path is not null;

  return result;
end;
$$;

create or replace function public.home_marketplace_get_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'products', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', product.id,
          'productName', product.product_name,
          'description', product.description,
          'price', product.price,
          'unitCode', product.unit_code,
          'categoryCode', product.category_code,
          'imagePath', product.image_path,
          'supplierName', supplier.organization_name,
          'marketplaceSection', product.marketplace_section
        ) order by product.created_at desc
      ) filter (where product.id is not null),
      '[]'::jsonb
    )
  )
  from public.supplier_products product
  join public.supplier_profiles supplier
    on supplier.id = product.supplier_user_id
   and supplier.status = 'active'
  where product.marketplace_section = 'home'
    and product.is_active = true
    and product.price > 0
    and product.unit_code is not null
    and product.category_code is not null
    and product.image_path is not null;
$$;

create or replace function public.construction_marketplace_checkout(
  p_items jsonb,
  p_buyer_name text,
  p_buyer_mobile text,
  p_delivery_address text,
  p_delivery_maps_url text default null,
  p_buyer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  created_order_ids uuid[];
  authenticated_email text;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  result := public.marketplace_checkout(
    p_items,
    p_buyer_name,
    p_buyer_mobile,
    p_delivery_address,
    p_delivery_maps_url,
    p_buyer_note
  );

  select coalesce(array_agg((entry ->> 'id')::uuid), array[]::uuid[])
    into created_order_ids
  from jsonb_array_elements(result -> 'orders') entry;

  if exists (
    select 1
    from public.supplier_order_items item
    join public.supplier_products product on product.id = item.product_id
    where item.order_id = any(created_order_ids)
      and product.marketplace_section <> 'construction'
  ) then
    raise exception 'CART_PRODUCT_SECTION_MISMATCH';
  end if;

  select lower(user_account.email)
    into authenticated_email
  from auth.users user_account
  where user_account.id = auth.uid();

  update public.supplier_orders
  set marketplace_section = 'construction',
      buyer_email = authenticated_email,
      updated_at = now()
  where id = any(created_order_ids)
    and buyer_user_id = auth.uid();

  return result;
end;
$$;

create or replace function public.home_marketplace_checkout(
  p_items jsonb,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_mobile text,
  p_delivery_address text,
  p_delivery_maps_url text default null,
  p_buyer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  created_order_ids uuid[];
  authenticated_email text;
  normalized_email text := lower(trim(coalesce(p_buyer_email, '')));
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select lower(user_account.email)
    into authenticated_email
  from auth.users user_account
  where user_account.id = auth.uid();

  if authenticated_email is null
     or normalized_email <> authenticated_email
     or length(normalized_email) > 254
     or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'BUYER_EMAIL_MISMATCH';
  end if;

  result := public.marketplace_checkout(
    p_items,
    p_buyer_name,
    p_buyer_mobile,
    p_delivery_address,
    p_delivery_maps_url,
    p_buyer_note
  );

  select coalesce(array_agg((entry ->> 'id')::uuid), array[]::uuid[])
    into created_order_ids
  from jsonb_array_elements(result -> 'orders') entry;

  if exists (
    select 1
    from public.supplier_order_items item
    join public.supplier_products product on product.id = item.product_id
    where item.order_id = any(created_order_ids)
      and product.marketplace_section <> 'home'
  ) then
    raise exception 'CART_PRODUCT_SECTION_MISMATCH';
  end if;

  update public.supplier_orders
  set marketplace_section = 'home',
      buyer_email = authenticated_email,
      updated_at = now()
  where id = any(created_order_ids)
    and buyer_user_id = auth.uid();

  return result;
end;
$$;

create or replace function public.marketplace_list_my_orders_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', purchase_order.id,
          'orderNumber', 'NM-SO-' || lpad(purchase_order.order_sequence::text, 6, '0'),
          'supplierName', supplier.organization_name,
          'supplierMobile', supplier.mobile_number,
          'status', purchase_order.status,
          'subtotal', purchase_order.subtotal,
          'deliveryAddress', purchase_order.delivery_address,
          'deliveryMapsUrl', purchase_order.delivery_maps_url,
          'buyerEmail', purchase_order.buyer_email,
          'marketplaceSection', purchase_order.marketplace_section,
          'submittedAt', purchase_order.submitted_at,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', order_item.id,
                'productId', order_item.product_id,
                'productName', order_item.product_name_snapshot,
                'unitCode', order_item.unit_code_snapshot,
                'imagePath', order_item.image_path_snapshot,
                'unitPrice', order_item.unit_price,
                'quantity', order_item.quantity,
                'lineTotal', order_item.line_total
              ) order by order_item.created_at
            )
            from public.supplier_order_items order_item
            where order_item.order_id = purchase_order.id
          ), '[]'::jsonb)
        ) order by purchase_order.submitted_at desc
      ),
      '[]'::jsonb
    )
  into result
  from public.supplier_orders purchase_order
  join public.supplier_profiles supplier
    on supplier.id = purchase_order.supplier_user_id
  where purchase_order.buyer_user_id = auth.uid();

  return result;
end;
$$;

create or replace function public.supplier_save_marketplace_product(
  p_product_name text,
  p_description text,
  p_price numeric,
  p_unit_code text,
  p_category_code text,
  p_image_path text,
  p_marketplace_section text,
  p_product_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_product_id uuid;
  previous_image_path text;
begin
  if current_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.supplier_is_active() then raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED'; end if;
  if length(trim(coalesce(p_product_name, ''))) < 2 then raise exception 'INVALID_PRODUCT_NAME'; end if;
  if p_price is null or p_price <= 0 or p_price > 9999999999.99 or scale(p_price) > 2 then raise exception 'INVALID_PRODUCT_PRICE'; end if;
  if p_unit_code not in (
    'unit', 'piece', 'meter', 'square_meter', 'cubic_meter',
    'kilogram', 'ton', 'bag', 'carton', 'roll', 'sheet', 'pallet', 'package'
  ) then raise exception 'INVALID_PRODUCT_UNIT'; end if;
  if p_marketplace_section not in ('construction', 'home') then raise exception 'INVALID_MARKETPLACE_SECTION'; end if;
  if (
    p_marketplace_section = 'construction'
    and p_category_code not in (
      'steel', 'concrete', 'blocks', 'insulation', 'plumbing',
      'electrical', 'finishes', 'doors_windows', 'tiles_stone', 'other'
    )
  ) or (
    p_marketplace_section = 'home'
    and p_category_code not in (
      'power_tools', 'hand_tools', 'home_maintenance', 'garden_tools',
      'cleaning_tools', 'home_safety', 'other_home'
    )
  ) then raise exception 'INVALID_PRODUCT_CATEGORY'; end if;
  if p_image_path is null
     or p_image_path !~ ('^' || current_user_id::text || '/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$') then
    raise exception 'INVALID_PRODUCT_IMAGE_PATH';
  end if;
  if length(coalesce(p_description, '')) > 3000 then raise exception 'PRODUCT_DESCRIPTION_TOO_LONG'; end if;

  if p_product_id is null then
    insert into public.supplier_products (
      supplier_user_id, product_name, description, price, unit_code,
      category_code, image_path, marketplace_section, is_active
    ) values (
      current_user_id, trim(p_product_name), nullif(trim(coalesce(p_description, '')), ''),
      round(p_price, 2), p_unit_code, p_category_code, p_image_path,
      p_marketplace_section, true
    ) returning id into saved_product_id;
  else
    select product.image_path into previous_image_path
    from public.supplier_products product
    where product.id = p_product_id and product.supplier_user_id = current_user_id
    for update;

    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

    update public.supplier_products
    set product_name = trim(p_product_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        price = round(p_price, 2),
        unit_code = p_unit_code,
        category_code = p_category_code,
        image_path = p_image_path,
        marketplace_section = p_marketplace_section,
        is_active = true,
        updated_at = now()
    where id = p_product_id and supplier_user_id = current_user_id
    returning id into saved_product_id;
  end if;

  return jsonb_build_object('id', saved_product_id, 'previousImagePath', previous_image_path);
end;
$$;

create or replace function public.supplier_get_marketplace_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.supplier_is_active() then raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED'; end if;

  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', product.id,
          'productName', product.product_name,
          'description', product.description,
          'price', product.price,
          'unitCode', product.unit_code,
          'categoryCode', product.category_code,
          'imagePath', product.image_path,
          'marketplaceSection', product.marketplace_section,
          'isActive', product.is_active
        ) order by product.created_at desc
      )
      from public.supplier_products product
      where product.supplier_user_id = current_user_id
    ), '[]'::jsonb),
    'marketplaceOrders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', purchase_order.id,
          'orderNumber', 'NM-SO-' || lpad(purchase_order.order_sequence::text, 6, '0'),
          'buyerRole', purchase_order.buyer_role,
          'buyerName', purchase_order.buyer_name,
          'buyerEmail', purchase_order.buyer_email,
          'buyerMobile', purchase_order.buyer_mobile,
          'deliveryAddress', purchase_order.delivery_address,
          'deliveryMapsUrl', purchase_order.delivery_maps_url,
          'buyerNote', purchase_order.buyer_note,
          'marketplaceSection', purchase_order.marketplace_section,
          'status', purchase_order.status,
          'subtotal', purchase_order.subtotal,
          'submittedAt', purchase_order.submitted_at,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', order_item.id,
                'productName', order_item.product_name_snapshot,
                'unitCode', order_item.unit_code_snapshot,
                'imagePath', order_item.image_path_snapshot,
                'unitPrice', order_item.unit_price,
                'quantity', order_item.quantity,
                'lineTotal', order_item.line_total
              ) order by order_item.created_at
            )
            from public.supplier_order_items order_item
            where order_item.order_id = purchase_order.id
          ), '[]'::jsonb)
        ) order by purchase_order.submitted_at desc
      )
      from public.supplier_orders purchase_order
      where purchase_order.supplier_user_id = current_user_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Keep the authenticated grants on the legacy RPCs during the rollout so the
-- currently deployed frontend remains functional until the new build is live.
-- A follow-up hardening migration can revoke them after deployment verification.

revoke all on function public.construction_marketplace_get_catalog() from public, anon, authenticated;
revoke all on function public.home_marketplace_get_catalog() from public, anon, authenticated;
revoke all on function public.construction_marketplace_checkout(jsonb, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.home_marketplace_checkout(jsonb, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.marketplace_list_my_orders_v2() from public, anon, authenticated;
revoke all on function public.supplier_save_marketplace_product(text, text, numeric, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.supplier_get_marketplace_dashboard() from public, anon, authenticated;

grant execute on function public.construction_marketplace_get_catalog() to authenticated;
grant execute on function public.home_marketplace_get_catalog() to anon, authenticated;
grant execute on function public.construction_marketplace_checkout(jsonb, text, text, text, text, text) to authenticated;
grant execute on function public.home_marketplace_checkout(jsonb, text, text, text, text, text, text) to authenticated;
grant execute on function public.marketplace_list_my_orders_v2() to authenticated;
grant execute on function public.supplier_save_marketplace_product(text, text, numeric, text, text, text, text, uuid) to authenticated;
grant execute on function public.supplier_get_marketplace_dashboard() to authenticated;

commit;
