import { supabase } from "../lib/supabase.js";

function getErrorMessage(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  const message =
    typeof error.message === "string"
      ? error.message
      : "";

  if (
    message.includes("غير مصرح") ||
    message.includes("not authorized") ||
    message.includes("permission")
  ) {
    return "انتهت الجلسة أو لا تملك صلاحية إدارة المنصة.";
  }

  return message || fallbackMessage;
}

export async function getAdminDashboard() {
  const { data, error } = await supabase.rpc(
    "admin_get_dashboard"
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "تعذر تحميل بيانات لوحة الإدارة."
      )
    );
  }

  return {
    pendingActions: Array.isArray(data?.pending_actions)
      ? data.pending_actions.filter(
          (action) => Number(action.count || 0) > 0
        )
      : [],

    sectionCounts:
      data?.section_counts &&
      typeof data.section_counts === "object"
        ? data.section_counts
        : {},
  };
}

export async function listAdminPendingTasks() {
  const { data, error } = await supabase.rpc(
    "admin_list_pending_tasks"
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "تعذر تحميل الإجراءات المطلوبة."
      )
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function searchAdminCustomerFiles({
  search = "",
  status = "all",
  sort = "newest",
  page = 1,
  pageSize = 25,
} = {}) {
  const safePage = Math.max(Number(page) || 1, 1);

  const safePageSize = Math.min(
    Math.max(Number(pageSize) || 25, 1),
    100
  );

  const { data, error } = await supabase.rpc(
    "admin_search_customer_files",
    {
      p_search: String(search || "").trim(),
      p_status: status || "all",
      p_sort: sort || "newest",
      p_page: safePage,
      p_page_size: safePageSize,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "تعذر البحث في ملفات العملاء."
      )
    );
  }

  const rows = Array.isArray(data) ? data : [];

  const totalCount =
    rows.length > 0
      ? Number(rows[0].total_count || 0)
      : 0;

  const totalPages =
    totalCount > 0
      ? Math.ceil(totalCount / safePageSize)
      : 1;

  return {
    files: rows.map((row) => ({
      id: row.id,
      file_number: row.file_number,
      customer_name: row.customer_name,
      mobile_number: row.mobile_number,
      email: row.email,
      status: row.status,
      current_stage: row.current_stage,
      submitted_at: row.submitted_at,
      updated_at: row.updated_at,
      estimated_project_cost:
        row.estimated_project_cost,
      total_customer_payment:
        row.total_customer_payment,
    })),

    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalCount,
      totalPages,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
  };
}

// تُترك مؤقتًا للتوافق مع أي جزء قديم في التطبيق.
// سنزيلها بعد اكتمال ربط البحث الجديد.
export async function listAdminCustomerFiles() {
  const result = await searchAdminCustomerFiles({
    page: 1,
    pageSize: 25,
  });

  return result.files;
}

export async function getAdminCustomerFile(
  customerFileId
) {
  if (!customerFileId) {
    throw new Error("معرّف ملف العميل غير موجود.");
  }

  const { data, error } = await supabase.rpc(
    "admin_get_customer_file",
    {
      p_customer_file_id: customerFileId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "تعذر فتح ملف العميل."
      )
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("ملف العميل غير موجود.");
  }

  return data[0];
}

export async function listAdminCustomerFileNotes(
  customerFileId
) {
  if (!customerFileId) {
    throw new Error("معرّف ملف العميل غير موجود.");
  }

  const { data, error } = await supabase.rpc(
    "admin_list_customer_file_notes",
    {
      p_customer_file_id: customerFileId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "تعذر تحميل ملاحظات ملف العميل."
      )
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function decideCustomerApplication({
  customerFileId,
  decision,
  note = "",
}) {
  if (!customerFileId) {
    throw new Error("معرّف ملف العميل غير موجود.");
  }

  const allowedDecisions = [
    "approve",
    "needs_completion",
    "reject",
  ];

  if (!allowedDecisions.includes(decision)) {
    throw new Error("قرار الإدارة غير صحيح.");
  }

  const normalizedNote = note.trim();

  if (
    (decision === "needs_completion" ||
      decision === "reject") &&
    !normalizedNote
  ) {
    throw new Error(
      decision === "reject"
        ? "اكتب سبب رفض الطلب."
        : "اكتب البيانات المطلوب استكمالها."
    );
  }

  const { data, error } = await supabase.rpc(
    "admin_decide_customer_application",
    {
      p_customer_file_id: customerFileId,
      p_decision: decision,
      p_note: normalizedNote || null,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "تعذر تنفيذ قرار الإدارة."
      )
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "تم تنفيذ العملية، لكن لم تصل حالة الملف الجديدة."
    );
  }

  return data[0];
}
