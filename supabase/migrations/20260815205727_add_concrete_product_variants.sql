begin;

alter table public.supplier_products
  add column if not exists concrete_grade_code text,
  add column if not exists concrete_resistance_code text;

alter table public.supplier_products
  drop constraint if exists supplier_products_concrete_grade_code_check,
  drop constraint if exists supplier_products_concrete_resistance_code_check,
  drop constraint if exists supplier_products_concrete_classification_check;

alter table public.supplier_products
  add constraint supplier_products_concrete_grade_code_check
    check (
      concrete_grade_code is null
      or concrete_grade_code in (
        'c15_250', 'c20_300', 'c25_350', 'c28_400', 'c30_400',
        'c32_400', 'c35_425', 'c40_450', 'c45_465'
      )
    ),
  add constraint supplier_products_concrete_resistance_code_check
    check (
      concrete_resistance_code is null
      or concrete_resistance_code in ('normal', 'resistant')
    ),
  add constraint supplier_products_concrete_classification_check
    check (
      (
        category_code = 'concrete'
        and concrete_grade_code is not null
        and concrete_resistance_code is not null
        and unit_code = 'cubic_meter'
        and custom_unit_label is null
      )
      or (
        category_code is distinct from 'concrete'
        and concrete_grade_code is null
        and concrete_resistance_code is null
      )
    );

create or replace function public.supplier_save_marketplace_product_v3(
  p_product_name text,
  p_description text,
  p_price numeric,
  p_unit_code text,
  p_custom_unit_label text,
  p_category_code text,
  p_concrete_grade_code text,
  p_concrete_resistance_code text,
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
  saved_product_name text := trim(coalesce(p_product_name, ''));
  saved_unit_code text := p_unit_code;
  normalized_custom_unit_label text := nullif(trim(coalesce(p_custom_unit_label, '')), '');
  normalized_concrete_grade_code text := nullif(trim(coalesce(p_concrete_grade_code, '')), '');
  normalized_concrete_resistance_code text := nullif(trim(coalesce(p_concrete_resistance_code, '')), '');
  concrete_grade_label text;
  concrete_resistance_label text;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.supplier_is_active() then
    raise exception 'SUPPLIER_AUTHORIZATION_REQUIRED';
  end if;
  if p_marketplace_section is null
     or p_marketplace_section not in ('construction', 'home') then
    raise exception 'INVALID_MARKETPLACE_SECTION';
  end if;
  if (
    p_marketplace_section = 'construction'
    and (
      p_category_code is null
      or p_category_code not in (
        'steel', 'concrete', 'blocks', 'backfill_material', 'plumbing',
        'electrical', 'cement', 'sand', 'engineering_office', 'excavation',
        'backfilling', 'carpenter', 'blacksmith', 'electrician', 'plumber',
        'mason', 'plasterer',
        'insulation', 'finishes', 'doors_windows', 'tiles_stone', 'other'
      )
    )
  ) or (
    p_marketplace_section = 'home'
    and (
      p_category_code is null
      or p_category_code not in (
        'power_tools', 'hand_tools', 'home_maintenance', 'garden_tools',
        'cleaning_tools', 'home_safety', 'other_home'
      )
    )
  ) then
    raise exception 'INVALID_PRODUCT_CATEGORY';
  end if;

  if p_category_code = 'concrete' then
    if normalized_concrete_grade_code is null
       or normalized_concrete_grade_code not in (
         'c15_250', 'c20_300', 'c25_350', 'c28_400', 'c30_400',
         'c32_400', 'c35_425', 'c40_450', 'c45_465'
       ) then
      raise exception 'INVALID_CONCRETE_GRADE';
    end if;
    if normalized_concrete_resistance_code is null
       or normalized_concrete_resistance_code not in ('normal', 'resistant') then
      raise exception 'INVALID_CONCRETE_RESISTANCE';
    end if;

    concrete_grade_label := case normalized_concrete_grade_code
      when 'c15_250' then 'C15 - 250'
      when 'c20_300' then 'C20 - 300'
      when 'c25_350' then 'C25 - 350'
      when 'c28_400' then 'C28 - 400'
      when 'c30_400' then 'C30 - 400'
      when 'c32_400' then 'C32 - 400'
      when 'c35_425' then 'C35 - 425'
      when 'c40_450' then 'C40 - 450'
      when 'c45_465' then 'C45 - 465'
    end;
    concrete_resistance_label := case normalized_concrete_resistance_code
      when 'normal' then 'عادي'
      when 'resistant' then 'مقاوم'
    end;
    saved_product_name := 'خرسانة ' || concrete_grade_label || ' — ' || concrete_resistance_label;
    saved_unit_code := 'cubic_meter';
    normalized_custom_unit_label := null;
  else
    normalized_concrete_grade_code := null;
    normalized_concrete_resistance_code := null;
  end if;

  if length(saved_product_name) < 2 then
    raise exception 'INVALID_PRODUCT_NAME';
  end if;
  if p_price is null or p_price <= 0 or p_price > 9999999999.99 or scale(p_price) > 2 then
    raise exception 'INVALID_PRODUCT_PRICE';
  end if;
  if saved_unit_code is null or saved_unit_code not in (
    'linear_meter', 'square_meter', 'flat_meter', 'cubic_meter',
    'ton', 'unit', 'other',
    'piece', 'meter', 'kilogram', 'bag', 'carton', 'roll',
    'sheet', 'pallet', 'package'
  ) then
    raise exception 'INVALID_PRODUCT_UNIT';
  end if;
  if saved_unit_code = 'other' and (
    normalized_custom_unit_label is null
    or length(normalized_custom_unit_label) > 40
  ) then
    raise exception 'INVALID_CUSTOM_UNIT_LABEL';
  end if;
  if saved_unit_code <> 'other' then
    normalized_custom_unit_label := null;
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
      concrete_grade_code,
      concrete_resistance_code,
      image_path,
      marketplace_section,
      is_active
    ) values (
      current_user_id,
      saved_product_name,
      nullif(trim(coalesce(p_description, '')), ''),
      round(p_price, 2),
      saved_unit_code,
      normalized_custom_unit_label,
      p_category_code,
      normalized_concrete_grade_code,
      normalized_concrete_resistance_code,
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
    set product_name = saved_product_name,
        description = nullif(trim(coalesce(p_description, '')), ''),
        price = round(p_price, 2),
        unit_code = saved_unit_code,
        custom_unit_label = normalized_custom_unit_label,
        category_code = p_category_code,
        concrete_grade_code = normalized_concrete_grade_code,
        concrete_resistance_code = normalized_concrete_resistance_code,
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
          'concreteGradeCode', product.concrete_grade_code,
          'concreteResistanceCode', product.concrete_resistance_code,
          'imagePath', product.image_path,
          'supplierUserId', product.supplier_user_id,
          'supplierName', supplier.organization_name,
          'supplierMobile', supplier.mobile_number,
          'supplierMapsUrl', supplier.maps_url,
          'supplierCommercialRegistrationNumber', supplier.commercial_registration_number,
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
    and (product.unit_code <> 'other' or product.custom_unit_label is not null)
    and (
      product.category_code <> 'concrete'
      or (
        product.concrete_grade_code is not null
        and product.concrete_resistance_code is not null
        and product.unit_code = 'cubic_meter'
      )
    );

  return result;
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
          'concreteGradeCode', product.concrete_grade_code,
          'concreteResistanceCode', product.concrete_resistance_code,
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

revoke all on function public.supplier_save_marketplace_product_v3(
  text, text, numeric, text, text, text, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.supplier_save_marketplace_product_v3(
  text, text, numeric, text, text, text, text, text, text, text, uuid
) to authenticated;

revoke all on function public.construction_marketplace_get_catalog()
  from public, anon, authenticated;
revoke all on function public.supplier_get_marketplace_dashboard()
  from public, anon, authenticated;

grant execute on function public.construction_marketplace_get_catalog()
  to authenticated;
grant execute on function public.supplier_get_marketplace_dashboard()
  to authenticated;

commit;
