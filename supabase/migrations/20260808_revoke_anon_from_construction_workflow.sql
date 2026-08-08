begin;

revoke execute on function public.is_active_platform_admin() from anon;
revoke execute on function public.admin_get_construction_standards_workspace() from anon;
revoke execute on function public.admin_add_general_construction_standard_item(uuid,text,boolean) from anon;
revoke execute on function public.admin_delete_general_construction_standard_item(uuid) from anon;
revoke execute on function public.admin_delete_general_construction_standard_document(uuid) from anon;
revoke execute on function public.admin_register_general_construction_standard_document(uuid,text,text,text,bigint) from anon;
revoke execute on function public.customer_owns_construction_project_stage(uuid) from anon;
revoke execute on function public.customer_add_project_construction_standard_item(uuid,text,boolean) from anon;
revoke execute on function public.customer_delete_project_construction_standard_item(uuid) from anon;
revoke execute on function public.customer_register_project_construction_standard_document(uuid,text,text,text,bigint) from anon;
revoke execute on function public.is_active_supervisor() from anon;
revoke execute on function public.supervisor_is_assigned_to_project_stage(uuid) from anon;
revoke execute on function public.admin_assign_supervisor_to_project(uuid,uuid) from anon;
revoke execute on function public.supervisor_create_custom_construction_stage(uuid,text,timestamptz) from anon;
revoke execute on function public.supervisor_create_construction_stage_reminder(uuid,text,timestamptz,text) from anon;
revoke execute on function public.supervisor_set_construction_standard_check(uuid,uuid,boolean,text) from anon;
revoke execute on function public.supervisor_register_construction_stage_photo(uuid,text,text,text,bigint,text) from anon;
revoke execute on function public.supervisor_get_dashboard() from anon;
revoke execute on function public.supervisor_get_construction_stage_workspace(uuid) from anon;
revoke execute on function public.admin_list_supervisor_candidates() from anon;
revoke execute on function public.admin_activate_supervisor_account(uuid,text,text,text) from anon;
revoke execute on function public.admin_list_supervisor_assignment_options() from anon;
revoke execute on function public.supervisor_complete_construction_stage(uuid) from anon;
revoke execute on function public.admin_get_construction_stage_workspace(uuid) from anon;

commit;
