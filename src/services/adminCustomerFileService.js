import { supabase } from "../lib/supabase.js";

const LAND_FILE_STATUS_TO_SUBMISSION_STATUS = {
  land_under_review: "under_review",
  land_needs_completion: "needs_completion",
  land_approved: "approved",
  land_rejected: "rejected",
};

function getErrorMessage(error, fallbackMessage) {
  if (!error) return fallbackMessage;

  const message =
    typeof error.message === "string"
      ? error.message
      : "";

  if (
    message.includes("غير مصرح") ||
    message.includes("not authorized") ||
    message.includes("permission") ||
    message.includes("ADMIN_AUTHORIZATION_REQUIRED")
  ) {
    return "انتهت الجلسة أو لا تملك صلاحية إدارة المنصة.";
  }

  return message || fallbackMessage;
}

function normalizeLandSubmission(submission) {
  if (!submission) return null;

  return {
    id: submission.id || "",
    customerFileId: submission.customer_file_id || "",
    submissionNumber: submission.submission_number || "",
    status: submission.status || "under_review",
    fileNumber: submission.file_number || "",
    customerName: submission.customer_name || "غير متوفر",
    mobileNumber: submission.mobile_number || "",
    email: submission.email || "",
    city: submission.city || "",
    district: submission.district || "",
    googleMapsUrl: submission.google_maps_url || "",
    landArea: Number(submission.land_area),
    frontageWidth: Number(submission.frontage_width),
    streetWidth: Number(submission.street_width),
    landUseType: submission.land_use_type || "",
    hasWater: Boolean(submission.has_water),
    hasElectricity: Boolean(submission.has_electricity),
    hasFiber: Boolean(submission.has_fiber),
    hasPublicSewer: Boolean(submission.has_public_sewer),
    netPrice: Number(submission.net_price),
    taxAmount: Number(submission.tax_amount),
    brokerageAmount: Number(submission.brokerage_amount),
    totalPrice: Number(submission.total_price),
    landContactName: submission.land_contact_name || "",
    landContactMobile: submission.land_contact_mobile || "",
    deedStorageBucket: submission.deed_storage_bucket || "land-deeds",
    deedStoragePath: submission.deed_storage_path || "",
    deedOriginalName: submission.deed_original_name || "",
    deedContentType: submission.deed_content_type || "",
    deedSizeBytes: Number(submission.deed_size_bytes),
    customerNote: submission.customer_note || "",
    submittedAt: submission.submitted_at || null,
    reviewedAt: submission.reviewed_at || null,
    adminDecisionNote: submission.admin_decision_note || "",
    completionRequestedAt: submission.completion_requested_at || null,
    approvedAt: submission.approved_at || null,
    rejectedAt: submission.rejected_at || null,
    createdAt: submission.created_at || null,
    updatedAt: submission.updated_at || null,
  };
}

function normalizeLandCustomerFile(customerFile) {
  if (!customerFile) return null;

  return {
    id: customerFile.id || "",
    fileNumber: customerFile.file_number || "",
    status: customerFile.status || "",
    currentStage: customerFile.current_stage || "",
    customerName: customerFile.customer_name || "غير متوفر",
    mobileNumber: customerFile.mobile_number || "",
    email: customerFile.email || "",
    landArea: Number(customerFile.land_area),
    estimatedLandPrice: Number(customerFile.estimated_land_price),
    floors: Number(customerFile.floors),
    bankOffer: Number(customerFile.bank_offer),
    estimatedConstructionCost: Number(customerFile.estimated_construction_cost),
    estimatedProjectCost: Number(customerFile.estimated_project_cost),
    baseCustomerPayment: Number(customerFile.base_customer_payment),
    excessAmount: Number(customerFile.excess_amount),
    totalCustomerPayment: Number(customerFile.total_customer_payment),
    submittedAt: customerFile.submitted_at || null,
    approvedAt: customerFile.approved_at || null,
    updatedAt: customerFile.updated_at || null,
  };
}

export async function getAdminDashboard() {
  const { data, error } = await supabase.rpc("admin_get_dashboard");

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر تحميل بيانات لوحة الإدارة.")
    );
  }

  return {
    pendingActions: Array.isArray(data?.pending_actions)
      ? data.pending_actions.filter((action) => Number(action.count || 0) > 0)
      : [],
    sectionCounts:
      data?.section_counts && typeof data.section_counts === "object"
        ? data.section_counts
        : {},
  };
}

export async function listAdminPendingTasks() {
  const { data, error } = await supabase.rpc("admin_list_pending_tasks");

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر تحميل الإجراءات المطلوبة.")
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
  const landSubmissionStatus =
    LAND_FILE_STATUS_TO_SUBMISSION_STATUS[status];

  if (landSubmissionStatus) {
    const result = await searchAdminLandSubmissions({
      search,
      status: landSubmissionStatus,
      sort: sort === "oldest" ? "oldest" : "newest",
      page,
      pageSize,
    });

    return {
      files: result.submissions.map((submission) => ({
        id: submission.customerFileId,
        file_number: submission.fileNumber,
        customer_name: submission.customerName,
        mobile_number: submission.mobileNumber,
        email: submission.email,
        status,
        current_stage:
          status === "land_approved"
            ? "land_contract"
            : "land_submission",
        submitted_at: submission.submittedAt,
        updated_at: submission.updatedAt || submission.reviewedAt || submission.submittedAt,
        estimated_project_cost: null,
        total_customer_payment: null,
      })),
      pagination: result.pagination,
    };
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100);

  const { data, error } = await supabase.rpc("admin_search_customer_files", {
    p_search: String(search || "").trim(),
    p_status: status || "all",
    p_sort: sort || "newest",
    p_page: safePage,
    p_page_size: safePageSize,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر البحث في ملفات العملاء.")
    );
  }

  const rows = Array.isArray(data) ? data : [];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / safePageSize) : 1;

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
      estimated_project_cost: row.estimated_project_cost,
      total_customer_payment: row.total_customer_payment,
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

export async function listAdminCustomerFiles() {
  const result = await searchAdminCustomerFiles({ page: 1, pageSize: 25 });
  return result.files;
}

export async function getAdminCustomerFile(customerFileId) {
  if (!customerFileId) {
    throw new Error("معرّف ملف العميل غير موجود.");
  }

  const { data, error } = await supabase.rpc("admin_get_customer_file", {
    p_customer_file_id: customerFileId,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر فتح ملف العميل.")
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("ملف العميل غير موجود.");
  }

  return data[0];
}

export async function listAdminCustomerFileNotes(customerFileId) {
  if (!customerFileId) {
    throw new Error("معرّف ملف العميل غير موجود.");
  }

  const { data, error } = await supabase.rpc("admin_list_customer_file_notes", {
    p_customer_file_id: customerFileId,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر تحميل ملاحظات ملف العميل.")
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function listAdminCustomerFileTimeline(customerFileId) {
  if (!customerFileId) {
    throw new Error("معرّف ملف العميل غير موجود.");
  }

  const { data, error } = await supabase.rpc("admin_list_customer_file_timeline", {
    p_customer_file_id: customerFileId,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر تحميل السجل الزمني لملف العميل.")
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

  const allowedDecisions = ["approve", "needs_completion", "reject"];

  if (!allowedDecisions.includes(decision)) {
    throw new Error("قرار الإدارة غير صحيح.");
  }

  const normalizedNote = note.trim();

  if (
    (decision === "needs_completion" || decision === "reject") &&
    !normalizedNote
  ) {
    throw new Error(
      decision === "reject"
        ? "اكتب سبب رفض الطلب."
        : "اكتب البيانات المطلوب استكمالها."
    );
  }

  const { data, error } = await supabase.rpc("admin_decide_customer_application", {
    p_customer_file_id: customerFileId,
    p_decision: decision,
    p_note: normalizedNote || null,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر تنفيذ قرار الإدارة.")
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "تم تنفيذ العملية، لكن لم تصل حالة الملف الجديدة."
    );
  }

  return data[0];
}

export async function getAdminLandSubmissionCounts() {
  const { data, error } = await supabase.rpc("admin_get_land_submission_counts");

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر تحميل عدادات طلبات الأراضي.")
    );
  }

  return {
    all: Number(data?.all) || 0,
    underReview: Number(data?.under_review) || 0,
    needsCompletion: Number(data?.needs_completion) || 0,
    approved: Number(data?.approved) || 0,
    rejected: Number(data?.rejected) || 0,
    cancelled: Number(data?.cancelled) || 0,
  };
}

export async function searchAdminLandSubmissions({
  search = "",
  status = "all",
  sort = "newest",
  page = 1,
  pageSize = 25,
} = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100);

  const { data, error } = await supabase.rpc("admin_search_land_submissions", {
    p_search: String(search || "").trim(),
    p_status: status || "all",
    p_sort: sort || "newest",
    p_page: safePage,
    p_page_size: safePageSize,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر تحميل طلبات الأراضي.")
    );
  }

  return {
    submissions: Array.isArray(data?.submissions)
      ? data.submissions.map(normalizeLandSubmission)
      : [],
    pagination: data?.pagination || {
      page: safePage,
      pageSize: safePageSize,
      totalCount: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  };
}

export async function getAdminLandSubmissionWorkspace(landSubmissionId) {
  if (!landSubmissionId) {
    throw new Error("معرّف طلب الأرض غير موجود.");
  }

  const { data, error } = await supabase.rpc("admin_get_land_submission_workspace", {
    p_land_submission_id: landSubmissionId,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر فتح طلب الأرض.")
    );
  }

  const landSubmission = normalizeLandSubmission(data?.landSubmission);

  if (!landSubmission?.id) {
    throw new Error("لم تصل بيانات طلب الأرض من قاعدة البيانات.");
  }

  return {
    landSubmission,
    customerFile: normalizeLandCustomerFile(data?.customerFile),
    events: Array.isArray(data?.events) ? data.events : [],
    contract: data?.contract || null,
    transfer: data?.transfer || null,
  };
}

export async function decideAdminLandSubmission({
  landSubmissionId,
  decision,
  note = "",
}) {
  if (!landSubmissionId) {
    throw new Error("معرّف طلب الأرض غير موجود.");
  }

  if (!["approve", "request_completion", "reject"].includes(decision)) {
    throw new Error("قرار مراجعة الأرض غير صحيح.");
  }

  const normalizedNote = String(note || "").trim();

  if (
    (decision === "request_completion" || decision === "reject") &&
    !normalizedNote
  ) {
    throw new Error("اكتب سبب طلب الاستكمال أو الرفض.");
  }

  const { data, error } = await supabase.rpc("admin_decide_land_submission", {
    p_land_submission_id: landSubmissionId,
    p_decision: decision,
    p_note: normalizedNote || null,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر تنفيذ قرار مراجعة الأرض.")
    );
  }

  return {
    landSubmission: normalizeLandSubmission(data?.landSubmission),
    customerFile: normalizeLandCustomerFile(data?.customerFile),
    events: Array.isArray(data?.events) ? data.events : [],
    contract: data?.contract || null,
    transfer: data?.transfer || null,
  };
}

export async function createAdminLandDeedSignedUrl(
  storagePath,
  expiresInSeconds = 300
) {
  const path = String(storagePath || "").trim();

  if (!path) {
    throw new Error("مسار ملف الصك غير موجود.");
  }

  const numericExpires = Number(expiresInSeconds);
  const expires =
    Number.isInteger(numericExpires) && numericExpires >= 60 && numericExpires <= 3600
      ? numericExpires
      : 300;

  const { data, error } = await supabase.storage
    .from("land-deeds")
    .createSignedUrl(path, expires);

  if (error) {
    throw new Error(
      getErrorMessage(error, "تعذر فتح ملف الصك.")
    );
  }

  if (!data?.signedUrl) {
    throw new Error("لم يصل رابط صالح لملف الصك.");
  }

  return data.signedUrl;
}
