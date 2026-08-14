begin;

alter table public.supplier_products
  add column if not exists category_code text,
  add column if not exists unit_code text,
  add column if not exists image_path text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'supplier_products_category_code_check'
      and conrelid = 'public.supplier_products'::regclass
  ) then
    alter table public.supplier_products
      add constraint supplier_products_category_code_check
      check (
        category_code is null
        or category_code in (
          'steel', 'concrete', 'blocks', 'insulation', 'plumbing',
          'electrical', 'finishes', 'doors_windows', 'tiles_stone', 'other'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'supplier_products_unit_code_check'
      and conrelid = 'public.supplier_products'::regclass
  ) then
    alter table public.supplier_products
      add constraint supplier_products_unit_code_check
      check (
        unit_code is null
        or unit_code in (
          'unit', 'piece', 'meter', 'square_meter', 'cubic_meter',
          'kilogram', 'ton', 'bag', 'carton', 'roll', 'sheet',
          'pallet', 'package'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'supplier_products_image_path_check'
      and conrelid = 'public.supplier_products'::regclass
  ) then
    alter table public.supplier_products
      add constraint supplier_products_image_path_check
      check (image_path is null or length(trim(image_path)) > 0);
  end if;
end;
$$;

create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  order_sequence bigint generated always as identity unique,
  supplier_user_id uuid not null references public.supplier_profiles(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  buyer_role text not null check (buyer_role in ('customer', 'supervisor', 'admin')),
  buyer_name text not null check (length(trim(buyer_name)) >= 2),
  buyer_mobile text not null check (buyer_mobile ~ '^05[0-9]{8}$'),
  delivery_address text not null check (length(trim(delivery_address)) >= 3),
  delivery_maps_url text check (delivery_maps_url is null or delivery_maps_url ~* '^https?://'),
  buyer_note text check (buyer_note is null or length(buyer_note) <= 2000),
  status text not null default 'submitted' check (
    status in (
      'submitted', 'contacted', 'confirmed', 'preparing',
      'out_for_delivery', 'completed', 'cancelled'
    )
  ),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  submitted_at timestamptz not null default now(),
  contacted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.supplier_orders(id) on delete cascade,
  product_id uuid not null references public.supplier_products(id) on delete restrict,
  product_name_snapshot text not null,
  category_code_snapshot text not null,
  unit_code_snapshot text not null,
  image_path_snapshot text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 1000000),
  line_total numeric(14, 2) not null check (line_total > 0),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create index if not exists supplier_products_marketplace_catalog_idx
  on public.supplier_products(category_code, created_at desc)
  where is_active = true
    and price > 0
    and unit_code is not null
    and category_code is not null
    and image_path is not null;

create index if not exists supplier_orders_supplier_status_idx
  on public.supplier_orders(supplier_user_id, status, submitted_at desc);

create index if not exists supplier_orders_buyer_idx
  on public.supplier_orders(buyer_user_id, submitted_at desc);

create index if not exists supplier_order_items_order_idx
  on public.supplier_order_items(order_id);

create index if not exists supplier_order_items_product_idx
  on public.supplier_order_items(product_id);

alter table public.supplier_orders enable row level security;
alter table public.supplier_order_items enable row level security;

revoke all on table public.supplier_orders from public, anon, authenticated;
revoke all on table public.supplier_order_items from public, anon, authenticated;
revoke all on table public.supplier_products from public, anon, authenticated;
revoke all on sequence public.supplier_orders_order_sequence_seq from public, anon, authenticated;

create or replace function public.supplier_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.supplier_profiles profile
    where profile.id = auth.uid()
      and profile.status = 'active'
  );
$$;

create or replace function public.marketplace_current_buyer()
returns table (
  buyer_role text,
  buyer_name text,
  buyer_mobile text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return;
  end if;

  return query
  select
    'admin'::text,
    admin_user.full_name,
    null::text
  from public.admin_users admin_user
  where admin_user.id = current_user_id
    and admin_user.is_active = true
  limit 1;
  if found then return; end if;

  return query
  select
    'supervisor'::text,
    supervisor.full_name,
    supervisor.mobile_number
  from public.supervisor_profiles supervisor
  where supervisor.id = current_user_id
    and supervisor.status = 'active'
  limit 1;
  if found then return; end if;

  return query
  select
    'customer'::text,
    coalesce(nullif(trim(account.full_name), ''), 'عميل المنصة'),
    account.mobile_number
  from public.customer_accounts account
  where account.auth_user_id = current_user_id
    and account.status = 'active'
  order by account.updated_at desc
  limit 1;
  if found then return; end if;

  if exists (
    select 1
    from public.customer_accounts account
    where account.auth_user_id = current_user_id
  ) then
    return;
  end if;

  return query
  select
    'customer'::text,
    project.customer_name,
    project.customer_mobile
  from public.customer_service_projects project
  where project.customer_user_id = current_user_id
  order by project.updated_at desc
  limit 1;
  if found then return; end if;

  return query
  select
    'customer'::text,
    coalesce(nullif(trim(customer_file.customer_name), ''), 'عميل المنصة'),
    customer_file.mobile_number
  from public.customer_files customer_file
  left join public.customer_accounts account
    on account.id = customer_file.customer_account_id
  where customer_file.auth_user_id = current_user_id
     or account.auth_user_id = current_user_id
  order by customer_file.updated_at desc
  limit 1;
end;
$$;

create or replace function public.marketplace_get_catalog()
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
          'supplierName', supplier.organization_name
        )
        order by product.created_at desc
      ) filter (where product.id is not null),
      '[]'::jsonb
    )
  )
    into result
  from public.supplier_products product
  join public.supplier_profiles supplier
    on supplier.id = product.supplier_user_id
   and supplier.status = 'active'
  where product.is_active = true
    and product.price > 0
    and product.unit_code is not null
    and product.category_code is not null
    and product.image_path is not null;

  return result;
end;
$$;

create or replace function public.marketplace_checkout(
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
  current_user_id uuid := auth.uid();
  actor_role text;
  actor_name text;
  actor_mobile text;
  normalized_name text;
  normalized_mobile text;
  normalized_address text;
  normalized_maps_url text;
  normalized_note text;
  item jsonb;
  product_ids uuid[] := array[]::uuid[];
  quantities numeric[] := array[]::numeric[];
  product_id uuid;
  quantity numeric;
  item_index integer;
  supplier_id uuid;
  order_id uuid;
  order_sequence bigint;
  order_subtotal numeric;
  line_total numeric;
  product_record record;
  orders_result jsonb := '[]'::jsonb;
  grand_total numeric := 0;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select buyer.buyer_role, buyer.buyer_name, buyer.buyer_mobile
    into actor_role, actor_name, actor_mobile
  from public.marketplace_current_buyer() buyer
  limit 1;

  if actor_role is null then
    raise exception 'MARKETPLACE_BUYER_AUTHORIZATION_REQUIRED';
  end if;

  normalized_name := coalesce(nullif(trim(p_buyer_name), ''), actor_name);
  normalized_mobile := coalesce(nullif(trim(p_buyer_mobile), ''), actor_mobile);
  normalized_address := trim(coalesce(p_delivery_address, ''));
  normalized_maps_url := nullif(trim(coalesce(p_delivery_maps_url, '')), '');
  normalized_note := nullif(trim(coalesce(p_buyer_note, '')), '');

  if length(coalesce(normalized_name, '')) < 2 then
    raise exception 'INVALID_BUYER_NAME';
  end if;
  if coalesce(normalized_mobile, '') !~ '^05[0-9]{8}$' then
    raise exception 'INVALID_BUYER_MOBILE';
  end if;
  if length(normalized_address) < 3 then
    raise exception 'INVALID_DELIVERY_ADDRESS';
  end if;
  if normalized_maps_url is not null and normalized_maps_url !~* '^https?://' then
    raise exception 'INVALID_DELIVERY_MAPS_URL';
  end if;
  if length(coalesce(normalized_note, '')) > 2000 then
    raise exception 'BUYER_NOTE_TOO_LONG';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_CART_ITEMS';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    begin
      product_id := nullif(trim(item ->> 'productId'), '')::uuid;
      quantity := (item ->> 'quantity')::numeric;
    exception
      when others then
        raise exception 'INVALID_CART_ITEM';
    end;

    if product_id is null
       or quantity is null
       or quantity <= 0
       or quantity > 1000000
       or scale(quantity) > 3 then
      raise exception 'INVALID_CART_ITEM';
    end if;

    if product_id = any(product_ids) then
      raise exception 'DUPLICATE_CART_PRODUCT';
    end if;

    product_ids := array_append(product_ids, product_id);
    quantities := array_append(quantities, quantity);
  end loop;

  perform product.id
  from public.supplier_products product
  join public.supplier_profiles supplier
    on supplier.id = product.supplier_user_id
   and supplier.status = 'active'
  where product.id = any(product_ids)
    and product.is_active = true
    and product.price > 0
    and product.unit_code is not null
    and product.category_code is not null
    and product.image_path is not null
  order by product.id
  for update of product;

  if (
    select count(*)
    from public.supplier_products product
    join public.supplier_profiles supplier
      on supplier.id = product.supplier_user_id
     and supplier.status = 'active'
    where product.id = any(product_ids)
      and product.is_active = true
      and product.price > 0
      and product.unit_code is not null
      and product.category_code is not null
      and product.image_path is not null
  ) <> cardinality(product_ids) then
    raise exception 'CART_PRODUCT_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from unnest(product_ids, quantities) as cart_item(id, quantity)
    join public.supplier_products product on product.id = cart_item.id
    where product.unit_code in (
      'unit', 'piece', 'bag', 'carton', 'roll', 'sheet', 'pallet', 'package'
    )
      and cart_item.quantity <> trunc(cart_item.quantity)
  ) then
    raise exception 'INVALID_DISCRETE_PRODUCT_QUANTITY';
  end if;

  for supplier_id in
    select distinct product.supplier_user_id
    from public.supplier_products product
    where product.id = any(product_ids)
    order by product.supplier_user_id
  loop
    insert into public.supplier_orders (
      supplier_user_id,
      buyer_user_id,
      buyer_role,
      buyer_name,
      buyer_mobile,
      delivery_address,
      delivery_maps_url,
      buyer_note
    ) values (
      supplier_id,
      current_user_id,
      actor_role,
      normalized_name,
      normalized_mobile,
      normalized_address,
      normalized_maps_url,
      normalized_note
    )
    returning id, supplier_orders.order_sequence
      into order_id, order_sequence;

    order_subtotal := 0;

    for item_index in 1 .. cardinality(product_ids)
    loop
      select
        product.id,
        product.product_name,
        product.category_code,
        product.unit_code,
        product.image_path,
        product.price
        into product_record
      from public.supplier_products product
      where product.id = product_ids[item_index]
        and product.supplier_user_id = supplier_id;

      if found then
        line_total := round(product_record.price * quantities[item_index], 2);

        if line_total < 0.01 or line_total > 999999999999.99 then
          raise exception 'INVALID_CART_LINE_TOTAL';
        end if;

        insert into public.supplier_order_items (
          order_id,
          product_id,
          product_name_snapshot,
          category_code_snapshot,
          unit_code_snapshot,
          image_path_snapshot,
          unit_price,
          quantity,
          line_total
        ) values (
          order_id,
          product_record.id,
          product_record.product_name,
          product_record.category_code,
          product_record.unit_code,
          product_record.image_path,
          product_record.price,
          quantities[item_index],
          line_total
        );

        order_subtotal := order_subtotal + line_total;
        if order_subtotal > 999999999999.99 then
          raise exception 'ORDER_SUBTOTAL_TOO_LARGE';
        end if;
      end if;
    end loop;

    update public.supplier_orders
    set subtotal = order_subtotal,
        updated_at = now()
    where id = order_id;

    grand_total := grand_total + order_subtotal;

    orders_result := orders_result || jsonb_build_array(
      jsonb_build_object(
        'id', order_id,
        'orderNumber', 'NM-SO-' || lpad(order_sequence::text, 6, '0'),
        'supplierUserId', supplier_id,
        'supplierName', (
          select supplier.organization_name
          from public.supplier_profiles supplier
          where supplier.id = supplier_id
        ),
        'subtotal', order_subtotal
      )
    );
  end loop;

  return jsonb_build_object(
    'orders', orders_result,
    'orderCount', jsonb_array_length(orders_result),
    'total', grand_total
  );
end;
$$;

create or replace function public.marketplace_list_my_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select buyer.buyer_role
    into actor_role
  from public.marketplace_current_buyer() buyer
  limit 1;

  if actor_role is null then
    raise exception 'MARKETPLACE_BUYER_AUTHORIZATION_REQUIRED';
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
            )
            order by order_item.created_at
          )
          from public.supplier_order_items order_item
          where order_item.order_id = purchase_order.id
        ), '[]'::jsonb)
      )
      order by purchase_order.submitted_at desc
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

create or replace function public.supplier_save_product(
  p_product_name text,
  p_description text,
  p_price numeric,
  p_unit_code text,
  p_category_code text,
  p_image_path text,
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
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.supplier_is_active() then
    raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED';
  end if;
  if length(trim(coalesce(p_product_name, ''))) < 2 then
    raise exception 'INVALID_PRODUCT_NAME';
  end if;
  if p_price is null or p_price <= 0 or p_price > 9999999999.99 or scale(p_price) > 2 then
    raise exception 'INVALID_PRODUCT_PRICE';
  end if;
  if p_unit_code not in (
    'unit', 'piece', 'meter', 'square_meter', 'cubic_meter',
    'kilogram', 'ton', 'bag', 'carton', 'roll', 'sheet', 'pallet', 'package'
  ) then
    raise exception 'INVALID_PRODUCT_UNIT';
  end if;
  if p_category_code not in (
    'steel', 'concrete', 'blocks', 'insulation', 'plumbing',
    'electrical', 'finishes', 'doors_windows', 'tiles_stone', 'other'
  ) then
    raise exception 'INVALID_PRODUCT_CATEGORY';
  end if;
  if p_image_path is null
     or p_image_path !~ ('^' || current_user_id::text || '/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$') then
    raise exception 'INVALID_PRODUCT_IMAGE_PATH';
  end if;
  if length(coalesce(p_description, '')) > 3000 then
    raise exception 'PRODUCT_DESCRIPTION_TOO_LONG';
  end if;

  if p_product_id is null then
    insert into public.supplier_products (
      supplier_user_id,
      product_name,
      description,
      price,
      unit_code,
      category_code,
      image_path,
      is_active
    ) values (
      current_user_id,
      trim(p_product_name),
      nullif(trim(coalesce(p_description, '')), ''),
      round(p_price, 2),
      p_unit_code,
      p_category_code,
      p_image_path,
      true
    )
    returning id into saved_product_id;
  else
    select product.image_path
      into previous_image_path
    from public.supplier_products product
    where product.id = p_product_id
      and product.supplier_user_id = current_user_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    update public.supplier_products
    set product_name = trim(p_product_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        price = round(p_price, 2),
        unit_code = p_unit_code,
        category_code = p_category_code,
        image_path = p_image_path,
        is_active = true,
        updated_at = now()
    where id = p_product_id
      and supplier_user_id = current_user_id
    returning id into saved_product_id;
  end if;

  return jsonb_build_object(
    'id', saved_product_id,
    'previousImagePath', previous_image_path
  );
end;
$$;

create or replace function public.supplier_archive_product(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.supplier_is_active() then
    raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED';
  end if;

  update public.supplier_products
  set is_active = false,
      updated_at = now()
  where id = p_product_id
    and supplier_user_id = auth.uid();

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  return true;
end;
$$;

create or replace function public.supplier_update_marketplace_order_status(
  p_order_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.supplier_is_active() then
    raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED';
  end if;

  select purchase_order.status
    into current_status
  from public.supplier_orders purchase_order
  where purchase_order.id = p_order_id
    and purchase_order.supplier_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if p_status = current_status then
    return current_status;
  end if;

  if not (
    (current_status = 'submitted' and p_status in ('contacted', 'cancelled'))
    or (current_status = 'contacted' and p_status in ('confirmed', 'cancelled'))
    or (current_status = 'confirmed' and p_status in ('preparing', 'cancelled'))
    or (current_status = 'preparing' and p_status in ('out_for_delivery', 'cancelled'))
    or (current_status = 'out_for_delivery' and p_status = 'completed')
  ) then
    raise exception 'INVALID_ORDER_STATUS_TRANSITION';
  end if;

  update public.supplier_orders
  set status = p_status,
      contacted_at = case
        when p_status = 'contacted' then coalesce(contacted_at, now())
        else contacted_at
      end,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      updated_at = now()
  where id = p_order_id;

  return p_status;
end;
$$;

create or replace function public.supplier_get_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  profile_record public.supplier_profiles%rowtype;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select profile.*
    into profile_record
  from public.supplier_profiles profile
  where profile.id = current_user_id
    and profile.status = 'active';

  if not found then
    raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'organizationName', profile_record.organization_name,
      'commercialRegistrationNumber', profile_record.commercial_registration_number,
      'mobileNumber', profile_record.mobile_number,
      'mapsUrl', profile_record.maps_url
    ),
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
          'isActive', product.is_active
        )
        order by product.created_at desc
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
          'buyerMobile', purchase_order.buyer_mobile,
          'deliveryAddress', purchase_order.delivery_address,
          'deliveryMapsUrl', purchase_order.delivery_maps_url,
          'buyerNote', purchase_order.buyer_note,
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
              )
              order by order_item.created_at
            )
            from public.supplier_order_items order_item
            where order_item.order_id = purchase_order.id
          ), '[]'::jsonb)
        )
        order by purchase_order.submitted_at desc
      )
      from public.supplier_orders purchase_order
      where purchase_order.supplier_user_id = current_user_id
    ), '[]'::jsonb),
    'purchaseRequests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', request.id,
          'productName', request.product_name,
          'requestText', request.request_text,
          'requestedQuantity', request.requested_quantity,
          'status', request.status,
          'createdAt', request.created_at,
          'projectId', coalesce(request.financed_customer_file_id, request.service_project_id)
        )
        order by request.created_at desc
      )
      from public.supplier_purchase_requests request
      where request.supplier_user_id = current_user_id
        and request.status = 'open'
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', assignment.id,
          'projectId', coalesce(assignment.financed_customer_file_id, assignment.service_project_id),
          'status', assignment.status,
          'startedAt', assignment.started_at
        )
        order by assignment.started_at desc
      )
      from public.supplier_project_assignments assignment
      where assignment.supplier_user_id = current_user_id
        and assignment.status = 'active'
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'supplier-products',
  'supplier-products',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists supplier_product_images_insert_own on storage.objects;
create policy supplier_product_images_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'supplier-products'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (select public.supplier_is_active())
);

drop policy if exists supplier_product_images_select_own on storage.objects;
create policy supplier_product_images_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'supplier-products'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (select public.supplier_is_active())
);

drop policy if exists supplier_product_images_delete_own on storage.objects;
create policy supplier_product_images_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'supplier-products'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (select public.supplier_is_active())
);

revoke all on function public.supplier_is_active() from public, anon, authenticated;
revoke all on function public.marketplace_current_buyer() from public, anon, authenticated;
revoke all on function public.marketplace_get_catalog() from public, anon, authenticated;
revoke all on function public.marketplace_checkout(jsonb, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.marketplace_list_my_orders() from public, anon, authenticated;
revoke all on function public.supplier_save_product(text, text, numeric, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.supplier_archive_product(uuid) from public, anon, authenticated;
revoke all on function public.supplier_update_marketplace_order_status(uuid, text) from public, anon, authenticated;
revoke all on function public.supplier_get_dashboard() from public, anon, authenticated;

grant execute on function public.supplier_is_active() to authenticated;
grant execute on function public.marketplace_get_catalog() to authenticated;
grant execute on function public.marketplace_checkout(jsonb, text, text, text, text, text) to authenticated;
grant execute on function public.marketplace_list_my_orders() to authenticated;
grant execute on function public.supplier_save_product(text, text, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.supplier_archive_product(uuid) to authenticated;
grant execute on function public.supplier_update_marketplace_order_status(uuid, text) to authenticated;
grant execute on function public.supplier_get_dashboard() to authenticated;

commit;
