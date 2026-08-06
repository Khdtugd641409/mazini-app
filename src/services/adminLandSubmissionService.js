import { supabase } from "../lib/supabase.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES = [
  "all",
  "under_review",
  "needs_completion",
  "approved",
  "rejected",
  "cancelled",
];

const ALLOWED_SORTS = [
  "newest",
  "oldest",
  "highest_price",
  "lowest_price",
  "largest_area",
  "smallest_area",
];

const ALLOWED_DECISIONS = [
  "approve",
  "request_completion",
  "reject",
];

function normalizeText(value) {
  return String(value || "").trim();
}

function validateUuid(value, errorMessage) {
  const normalizedValue =
    normalizeText(value);

  if (!UUID_PATTERN.test(normalizedValue)) {
    throw new Error(errorMessage);
  }

  return normalizedValue;
}

function normalizePositiveInteger(
  value,
  fallbackValue
) {
  const numericValue = Number(value);

  if (
    !Number.isInteger(numericValue) ||
    numericValue < 1
  ) {
    return fallbackValue;
  }

  return numericValue;
}

function getArabicAdminLandError(
  error,
  fallbackMessage
) {
  const message = String(
    error?.message || ""
  ).toUpperCase();

  if (
    message.includes(
      "AUTHENTICATION_REQUIRED"
    )
  ) {
    return "انتهت جلسة الدخول. سجل الدخول مجددًا.";
  }

  if (
    message.includes(
      "ADMIN_AUTHORIZATION_REQUIRED"
    )
  ) {
    return "الحساب الحالي لا يملك صلاحية إدارة المنصة.";
  }

  if (
    message.includes(
      "LAND_SUBMISSION_ID_REQUIRED"
    )
  ) {
    return "معرّف طلب الأرض غير موجود.";
  }

  if (
    message.includes(
      "LAND_SUBMISSION_NOT_FOUND"
    )
  ) {
    return "طلب الأرض غير موجود.";
  }

  if (
    message.includes(
      "INVALID_LAND_STATUS_FILTER"
    )
  ) {
    return "فلتر حالة الأرض غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_LAND_SORT"
    )
  ) {
    return "طريقة فرز طلبات الأراضي غير صحيحة.";
  }

  if (
    message.includes(
      "INVALID_LAND_DECISION"
    )
  ) {
    return "قرار مراجعة الأرض غير صحيح.";
  }

  if (
    message.includes(
      "LAND_DECISION_NOTE_REQUIRED"
    )
  ) {
    return "اكتب سبب طلب الاستكمال أو الرفض.";
  }

  if (
    message.includes(
      "LAND_DECISION_NOT_ALLOWED"
    )
  ) {
    return "لا يمكن اتخاذ قرار جديد على طلب الأرض في حالته الحالية.";
  }

  if (
    message.includes(
      "ROW-LEVEL SECURITY"
    ) ||
    message.includes("RLS")
  ) {
    return "ليس لديك صلاحية للوصول إلى بيانات الأرض.";
  }

  return fallbackMessage;
}

function normalizePagination(value) {
  const page =
    normalizePositiveInteger(
      value?.page,
      1
    );

  const pageSize =
    normalizePositiveInteger(
      value?.pageSize,
      25
    );

  const totalCount = Number(
    value?.totalCount
  );

  const totalPages = Number(
    value?.totalPages
  );

  return {
    page,

    pageSize,

    totalCount:
      Number.isFinite(totalCount) &&
      totalCount >= 0
        ? totalCount
        : 0,

    totalPages:
      Number.isFinite(totalPages) &&
      totalPages >= 1
        ? totalPages
        : 1,

    hasPreviousPage:
      Boolean(
        value?.hasPreviousPage
      ),

    hasNextPage:
      Boolean(
        value?.hasNextPage
      ),
  };
}

function normalizeLandSubmission(
  submission
) {
  if (!submission) {
    return null;
  }

  return {
    id: submission.id || "",

    customerFileId:
      submission.customer_file_id ||
      "",

    submissionNumber:
      submission.submission_number ||
      "",

    status:
      submission.status ||
      "under_review",

    fileNumber:
      submission.file_number ||
      "",

    customerName:
      submission.customer_name ||
      "غير متوفر",

    mobileNumber:
      submission.mobile_number ||
      "",

    email:
      submission.email ||
      "",

    city:
      submission.city ||
      "",

    district:
      submission.district ||
      "",

    googleMapsUrl:
      submission.google_maps_url ||
      "",

    landArea:
      Number(
        submission.land_area
      ),

    frontageWidth:
      Number(
        submission.frontage_width
      ),

    streetWidth:
      Number(
        submission.street_width
      ),

    landUseType:
      submission.land_use_type ||
      "",

    hasWater:
      Boolean(
        submission.has_water
      ),

    hasElectricity:
      Boolean(
        submission.has_electricity
      ),

    hasFiber:
      Boolean(
        submission.has_fiber
      ),

    hasPublicSewer:
      Boolean(
        submission.has_public_sewer
      ),

    netPrice:
      Number(
        submission.net_price
      ),

    taxAmount:
      Number(
        submission.tax_amount
      ),

    brokerageAmount:
      Number(
        submission.brokerage_amount
      ),

    totalPrice:
      Number(
        submission.total_price
      ),

    landContactName:
      submission.land_contact_name ||
      "",

    landContactMobile:
      submission.land_contact_mobile ||
      "",

    deedStorageBucket:
      submission.deed_storage_bucket ||
      "land-deeds",

    deedStoragePath:
      submission.deed_storage_path ||
      "",

    deedOriginalName:
      submission.deed_original_name ||
      "",

    deedContentType:
      submission.deed_content_type ||
      "",

    deedSizeBytes:
      Number(
        submission.deed_size_bytes
      ),

    customerNote:
      submission.customer_note ||
      "",

    submittedAt:
      submission.submitted_at ||
      null,

    reviewedAt:
      submission.reviewed_at ||
      null,

    adminDecisionNote:
      submission.admin_decision_note ||
      "",

    completionRequestedAt:
      submission.completion_requested_at ||
      null,

    approvedAt:
      submission.approved_at ||
      null,

    rejectedAt:
      submission.rejected_at ||
      null,

    createdAt:
      submission.created_at ||
      null,

    updatedAt:
      submission.updated_at ||
      null,
  };
}

function normalizeCustomerFile(
  customerFile
) {
  if (!customerFile) {
    return null;
  }

  return {
    id:
      customerFile.id || "",

    fileNumber:
      customerFile.file_number ||
      "",

    status:
      customerFile.status ||
      "",

    currentStage:
      customerFile.current_stage ||
      "",

    customerName:
      customerFile.customer_name ||
      "غير متوفر",

    mobileNumber:
      customerFile.mobile_number ||
      "",

    email:
      customerFile.email ||
      "",

    landArea:
      Number(
        customerFile.land_area
      ),

    estimatedLandPrice:
      Number(
        customerFile
          .estimated_land_price
      ),

    floors:
      Number(
        customerFile.floors
      ),

    bankOffer:
      Number(
        customerFile.bank_offer
      ),

    estimatedConstructionCost:
      Number(
        customerFile
          .estimated_construction_cost
      ),

    estimatedProjectCost:
      Number(
        customerFile
          .estimated_project_cost
      ),

    baseCustomerPayment:
      Number(
        customerFile
          .base_customer_payment
      ),

    excessAmount:
      Number(
        customerFile.excess_amount
      ),

    totalCustomerPayment:
      Number(
        customerFile
          .total_customer_payment
      ),

    submittedAt:
      customerFile.submitted_at ||
      null,

    approvedAt:
      customerFile.approved_at ||
      null,

    updatedAt:
      customerFile.updated_at ||
      null,
  };
}

export async function getAdminLandSubmissionCounts() {
  const { data, error } =
    await supabase.rpc(
      "admin_get_land_submission_counts"
    );

  if (error) {
    console.error(
      "admin_get_land_submission_counts:",
      error
    );

    throw new Error(
      getArabicAdminLandError(
        error,
        "تعذر تحميل عدادات طلبات الأراضي."
      )
    );
  }

  return {
    all:
      Number(data?.all) || 0,

    underReview:
      Number(
        data?.under_review
      ) || 0,

    needsCompletion:
      Number(
        data?.needs_completion
      ) || 0,

    approved:
      Number(data?.approved) || 0,

    rejected:
      Number(data?.rejected) || 0,

    cancelled:
      Number(data?.cancelled) || 0,
  };
}

export async function searchAdminLandSubmissions({
  search = "",
  status = "all",
  sort = "newest",
  page = 1,
  pageSize = 25,
} = {}) {
  const normalizedSearch =
    normalizeText(search);

  const normalizedStatus =
    normalizeText(status) || "all";

  const normalizedSort =
    normalizeText(sort) || "newest";

  if (
    !ALLOWED_STATUSES.includes(
      normalizedStatus
    )
  ) {
    throw new Error(
      "فلتر حالة الأرض غير صحيح."
    );
  }

  if (
    !ALLOWED_SORTS.includes(
      normalizedSort
    )
  ) {
    throw new Error(
      "طريقة فرز طلبات الأراضي غير صحيحة."
    );
  }

  const safePage =
    normalizePositiveInteger(
      page,
      1
    );

  const safePageSize = Math.min(
    normalizePositiveInteger(
      pageSize,
      25
    ),
    100
  );

  const { data, error } =
    await supabase.rpc(
      "admin_search_land_submissions",
      {
        p_search:
          normalizedSearch,

        p_status:
          normalizedStatus,

        p_sort:
          normalizedSort,

        p_page:
          safePage,

        p_page_size:
          safePageSize,
      }
    );

  if (error) {
    console.error(
      "admin_search_land_submissions:",
      error
    );

    throw new Error(
      getArabicAdminLandError(
        error,
        "تعذر تحميل طلبات الأراضي."
      )
    );
  }

  const submissions =
    Array.isArray(data?.submissions)
      ? data.submissions.map(
          normalizeLandSubmission
        )
      : [];

  return {
    submissions,

    pagination:
      normalizePagination(
        data?.pagination
      ),
  };
}

export async function getAdminLandSubmissionWorkspace(
  landSubmissionId
) {
  const validatedId =
    validateUuid(
      landSubmissionId,
      "معرّف طلب الأرض غير صحيح."
    );

  const { data, error } =
    await supabase.rpc(
      "admin_get_land_submission_workspace",
      {
        p_land_submission_id:
          validatedId,
      }
    );

  if (error) {
    console.error(
      "admin_get_land_submission_workspace:",
      error
    );

    throw new Error(
      getArabicAdminLandError(
        error,
        "تعذر فتح طلب الأرض."
      )
    );
  }

  const landSubmission =
    normalizeLandSubmission(
      data?.landSubmission
    );

  if (!landSubmission?.id) {
    throw new Error(
      "لم تصل بيانات طلب الأرض من قاعدة البيانات."
    );
  }

  return {
    landSubmission,

    customerFile:
      normalizeCustomerFile(
        data?.customerFile
      ),

    events:
      Array.isArray(data?.events)
        ? data.events
        : [],

    contract:
      data?.contract || null,

    transfer:
      data?.transfer || null,
  };
}

export async function decideAdminLandSubmission({
  landSubmissionId,
  decision,
  note = "",
}) {
  const validatedId =
    validateUuid(
      landSubmissionId,
      "معرّف طلب الأرض غير صحيح."
    );

  const normalizedDecision =
    normalizeText(decision);

  const normalizedNote =
    normalizeText(note);

  if (
    !ALLOWED_DECISIONS.includes(
      normalizedDecision
    )
  ) {
    throw new Error(
      "قرار مراجعة الأرض غير صحيح."
    );
  }

  if (
    (
      normalizedDecision ===
        "request_completion" ||
      normalizedDecision ===
        "reject"
    ) &&
    !normalizedNote
  ) {
    throw new Error(
      "اكتب سبب طلب الاستكمال أو الرفض."
    );
  }

  const { data, error } =
    await supabase.rpc(
      "admin_decide_land_submission",
      {
        p_land_submission_id:
          validatedId,

        p_decision:
          normalizedDecision,

        p_note:
          normalizedNote || null,
      }
    );

  if (error) {
    console.error(
      "admin_decide_land_submission:",
      error
    );

    throw new Error(
      getArabicAdminLandError(
        error,
        "تعذر تنفيذ قرار مراجعة الأرض."
      )
    );
  }

  return {
    landSubmission:
      normalizeLandSubmission(
        data?.landSubmission
      ),

    customerFile:
      normalizeCustomerFile(
        data?.customerFile
      ),

    events:
      Array.isArray(data?.events)
        ? data.events
        : [],

    contract:
      data?.contract || null,

    transfer:
      data?.transfer || null,
  };
}

export async function createAdminLandDeedSignedUrl(
  storagePath,
  expiresInSeconds = 300
) {
  const normalizedStoragePath =
    normalizeText(storagePath);

  if (!normalizedStoragePath) {
    throw new Error(
      "مسار ملف الصك غير موجود."
    );
  }

  const numericExpiresIn =
    Number(expiresInSeconds);

  const safeExpiresIn =
    Number.isInteger(
      numericExpiresIn
    ) &&
    numericExpiresIn >= 60 &&
    numericExpiresIn <= 3600
      ? numericExpiresIn
      : 300;

  const { data, error } =
    await supabase.storage
      .from("land-deeds")
      .createSignedUrl(
        normalizedStoragePath,
        safeExpiresIn
      );

  if (error) {
    console.error(
      "createAdminLandDeedSignedUrl:",
      error
    );

    throw new Error(
      getArabicAdminLandError(
        error,
        "تعذر فتح ملف الصك."
      )
    );
  }

  if (!data?.signedUrl) {
    throw new Error(
      "لم يصل رابط صالح لملف الصك."
    );
  }

  return data.signedUrl;
}
