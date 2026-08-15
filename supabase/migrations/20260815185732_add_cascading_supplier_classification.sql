begin;

alter table public.supplier_products
  add column if not exists custom_unit_label text;

alter table public.supplier_order_items
  add column if not exists custom_unit_label_snapshot text;

alter table public.supplier_products
  drop constraint if exists supplier_products_category_code_check,
  drop constraint if exists supplier_products_section_category_check,
  drop constraint if exists supplier_products_unit_code_check,
  drop constraint if exists supplier_products_custom_unit_label_check;

alter table public.supplier_products
  add constraint supplier_products_category_code_check
    check (
      category_code is null
      or category_code in (
        'steel', 'concrete', 'blocks', 'backfill_material', 'plumbing',
        'electrical', 'cement', 'sand', 'engineering_office', 'excavation',
        'backfilling', 'carpenter', 'blacksmith', 'electrician', 'plumber',
        'mason', 'plasterer',
        'insulation', 'finishes', 'doors_windows', 'tiles_stone', 'other',
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
          'steel', 'concrete', 'blocks', 'backfill_material', 'plumbing',
          'electrical', 'cement', 'sand', 'engineering_office', 'excavation',
          'backfilling', 'carpenter', 'blacksmith', 'electrician', 'plumber',
          'mason', 'plasterer',
          'insulation', 'finishes', 'doors_windows', 'tiles_stone', 'other'
        )
      )
      or (
        marketplace_section = 'home'
        and category_code in (
          'power_tools', 'hand_tools', 'home_maintenance', 'garden_tools',
          'cleaning_tools', 'home_safety', 'other_home'
        )
      )
    ),
  add constraint supplier_products_unit_code_check
    check (
      unit_code is null
      or unit_code in (
        'linear_meter', 'square_meter', 'flat_meter', 'cubic_meter',
        'ton', 'unit', 'other',
        'piece', 'meter', 'kilogram', 'bag', 'carton', 'roll',
        'sheet', 'pallet', 'package'
      )
    ),
  add constraint supplier_products_custom_unit_label_check
    check (
      (unit_code is null and custom_unit_label is null)
      or (
        unit_code = 'other'
        and custom_unit_label is not null
        and length(trim(custom_unit_label)) between 1 and 40
      )
      or (unit_code <> 'other' and custom_unit_label is null)
    );

alter table public.supplier_order_items
  drop constraint if exists supplier_order_items_custom_unit_label_snapshot_check;

alter table public.supplier_order_items
  add constraint supplier_order_items_custom_unit_label_snapshot_check
    check (
      (
        unit_code_snapshot = 'other'
        and custom_unit_label_snapshot is not null
        and length(trim(custom_unit_label_snapshot)) between 1 and 40
      )
      or (unit_code_snapshot <> 'other' and custom_unit_label_snapshot is null)
    );

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
          'customUnitLabel', product.custom_unit_label,
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
    and product.image_path is not null
    and (product.unit_code <> 'other' or product.custom_unit_label is not null);

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
          'customUnitLabel', product.custom_unit_label,
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
    and product.image_path is not null
    and (product.unit_code <> 'other' or product.custom_unit_label is not null);
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
    and (product.unit_code <> 'other' or product.custom_unit_label is not null)
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
      and (product.unit_code <> 'other' or product.custom_unit_label is not null)
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
        product.custom_unit_label,
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
          custom_unit_label_snapshot,
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
          product_record.custom_unit_label,
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
                'customUnitLabel', order_item.custom_unit_label_snapshot,
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

create or replace function public.supplier_save_marketplace_product_v2(
  p_product_name text,
  p_description text,
  p_price numeric,
  p_unit_code text,
  p_custom_unit_label text,
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
  normalized_custom_unit_label text := nullif(trim(coalesce(p_custom_unit_label, '')), '');
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
    'linear_meter', 'square_meter', 'flat_meter', 'cubic_meter',
    'ton', 'unit', 'other',
    'piece', 'meter', 'kilogram', 'bag', 'carton', 'roll',
    'sheet', 'pallet', 'package'
  ) then
    raise exception 'INVALID_PRODUCT_UNIT';
  end if;
  if p_unit_code = 'other' and (
    normalized_custom_unit_label is null
    or length(normalized_custom_unit_label) > 40
  ) then
    raise exception 'INVALID_CUSTOM_UNIT_LABEL';
  end if;
  if p_unit_code <> 'other' then
    normalized_custom_unit_label := null;
  end if;
  if p_marketplace_section not in ('construction', 'home') then
    raise exception 'INVALID_MARKETPLACE_SECTION';
  end if;
  if (
    p_marketplace_section = 'construction'
    and p_category_code not in (
      'steel', 'concrete', 'blocks', 'backfill_material', 'plumbing',
      'electrical', 'cement', 'sand', 'engineering_office', 'excavation',
      'backfilling', 'carpenter', 'blacksmith', 'electrician', 'plumber',
      'mason', 'plasterer',
      'insulation', 'finishes', 'doors_windows', 'tiles_stone', 'other'
    )
  ) or (
    p_marketplace_section = 'home'
    and p_category_code not in (
      'power_tools', 'hand_tools', 'home_maintenance', 'garden_tools',
      'cleaning_tools', 'home_safety', 'other_home'
    )
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
      custom_unit_label,
      category_code,
      image_path,
      marketplace_section,
      is_active
    ) values (
      current_user_id,
      trim(p_product_name),
      nullif(trim(coalesce(p_description, '')), ''),
      round(p_price, 2),
      p_unit_code,
      normalized_custom_unit_label,
      p_category_code,
      p_image_path,
      p_marketplace_section,
      true
    ) returning id into saved_product_id;
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
        custom_unit_label = normalized_custom_unit_label,
        category_code = p_category_code,
        image_path = p_image_path,
        marketplace_section = p_marketplace_section,
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
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.supplier_is_active() then
    raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED';
  end if;

  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', product.id,
          'productName', product.product_name,
          'description', product.description,
          'price', product.price,
          'unitCode', product.unit_code,
          'customUnitLabel', product.custom_unit_label,
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
                'customUnitLabel', order_item.custom_unit_label_snapshot,
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

revoke all on function public.supplier_save_marketplace_product_v2(
  text, text, numeric, text, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.supplier_save_marketplace_product_v2(
  text, text, numeric, text, text, text, text, text, uuid
) to authenticated;

-- Preserve the least-privilege state after replacing security-definer RPCs.
revoke all on function public.marketplace_checkout(jsonb, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.construction_marketplace_get_catalog()
  from public, anon, authenticated;
revoke all on function public.home_marketplace_get_catalog()
  from public, anon, authenticated;
revoke all on function public.marketplace_list_my_orders_v2()
  from public, anon, authenticated;
revoke all on function public.supplier_get_marketplace_dashboard()
  from public, anon, authenticated;

grant execute on function public.construction_marketplace_get_catalog()
  to authenticated;
grant execute on function public.home_marketplace_get_catalog()
  to anon, authenticated;
grant execute on function public.marketplace_list_my_orders_v2()
  to authenticated;
grant execute on function public.supplier_get_marketplace_dashboard()
  to authenticated;

commit;
