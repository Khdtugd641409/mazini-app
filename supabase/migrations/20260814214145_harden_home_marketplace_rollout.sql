begin;

revoke all on function public.marketplace_get_catalog()
  from public, anon, authenticated;
revoke all on function public.marketplace_checkout(jsonb, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.marketplace_list_my_orders()
  from public, anon, authenticated;
revoke all on function public.supplier_save_product(text, text, numeric, text, text, text, uuid)
  from public, anon, authenticated;

commit;
