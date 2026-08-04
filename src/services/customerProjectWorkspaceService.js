import { supabase } from "../lib/supabase.js";

function getWorkspaceErrorMessage(error) {
  const message = String(
    error?.message || ""
  ).toUpperCase();

  if (
    message.includes(
      "PROJECT_NOT_FOUND_OR_FORBIDDEN"
    )
  ) {
    return "المشروع غير موجود أو لا يتبع حسابك.";
  }

  if (
    message.includes(
      "AUTHENTICATION_REQUIRED"
    )
  ) {
    return "انتهت جلسة الدخول. سجل الدخول مجددًا.";
  }

  return "تعذر فتح المشروع.";
}

function normalizeProjectId(value) {
  const projectId = String(value || "").trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(projectId)) {
    throw new Error(
      "معرّف المشروع غير صحيح."
    );
  }

  return projectId;
}

export async function getMyCustomerProjectWorkspace(
  customerFileId
) {
  const normalizedProjectId =
    normalizeProjectId(customerFileId);

  const { data, error } =
    await supabase.rpc(
      "customer_get_my_project_workspace",
      {
        p_customer_file_id:
          normalizedProjectId,
      }
    );

  if (error) {
    console.error(
      "getMyCustomerProjectWorkspace:",
      error
    );

    throw new Error(
      getWorkspaceErrorMessage(error)
    );
  }

  const customerFile =
    data?.customerFile || null;

  const timeline = Array.isArray(
    data?.timeline
  )
    ? data.timeline
    : [];

  if (!customerFile) {
    throw new Error(
      "لم تصل بيانات المشروع من قاعدة البيانات."
    );
  }

  return {
    customerFile,
    timeline,
  };
}
