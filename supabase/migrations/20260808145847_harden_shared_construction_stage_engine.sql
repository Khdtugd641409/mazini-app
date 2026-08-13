begin;

-- إغلاق الدالة الداخلية عن الاستدعاء المباشر من العميل.
revoke all on function public.customer_ensure_construction_stage(uuid, uuid, uuid) from public;
revoke all on function public.customer_ensure_construction_stage(uuid, uuid, uuid) from anon;
revoke all on function public.customer_ensure_construction_stage(uuid, uuid, uuid) from authenticated;

-- مساحة العمل متاحة للمستخدم المسجل فقط، والدالة تتحقق من ملكية المشروع داخليًا.
revoke all on function public.customer_get_construction_stage_workspace(uuid) from public;
revoke all on function public.customer_get_construction_stage_workspace(uuid) from anon;
grant execute on function public.customer_get_construction_stage_workspace(uuid) to authenticated;

-- تثبيت search_path لدالة التحديث لتفادي التحذير الأمني.
alter function public.set_shared_construction_updated_at()
  set search_path = public;

commit;
