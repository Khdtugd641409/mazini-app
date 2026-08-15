begin;

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
    and (product.unit_code <> 'other' or product.custom_unit_label is not null);

  return result;
end;
$$;

revoke all on function public.construction_marketplace_get_catalog()
  from public, anon, authenticated;
grant execute on function public.construction_marketplace_get_catalog()
  to authenticated;

commit;
