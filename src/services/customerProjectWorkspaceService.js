import { supabase } from "../lib/supabase.js";

const ALLOWED_DEED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const MAX_DEED_SIZE_BYTES =
  15 * 1024 * 1024;

const MOBILE_PATTERN = /^05\d{8}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_LAND_USE_TYPES = [
  "residential",
  "commercial",
  "agricultural",
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeProjectId(value) {
  const projectId = normalizeText(value);

  if (!UUID_PATTERN.test(projectId)) {
    throw new Error(
      "معرّف المشروع غير صحيح."
    );
  }

  return projectId;
}

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

function getLandErrorMessage(
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
      "PROJECT_NOT_FOUND_OR_FORBIDDEN"
    )
  ) {
    return "المشروع غير موجود أو لا يتبع حسابك.";
  }

  if (
    message.includes(
      "LAND_SUBMISSION_NOT_ALLOWED"
    )
  ) {
    return "لا يمكن تقديم الأرض في حالة المشروع الحالية.";
  }

  if (
    message.includes(
      "ACTIVE_LAND_SUBMISSION_EXISTS"
    )
  ) {
    return "يوجد تقديم أرض قائم لهذا المشروع بالفعل.";
  }

  if (message.includes("INVALID_CITY")) {
    return "المدينة غير صحيحة.";
  }

  if (
    message.includes("INVALID_DISTRICT")
  ) {
    return "الحي غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_GOOGLE_MAPS_URL"
    )
  ) {
    return "رابط موقع الأرض غير صحيح.";
  }

  if (
    message.includes("INVALID_LAND_AREA")
  ) {
    return "مساحة الأرض غير صحيحة.";
  }

  if (
    message.includes(
      "INVALID_FRONTAGE_WIDTH"
    )
  ) {
    return "عرض واجهة الأرض غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_STREET_WIDTH"
    )
  ) {
    return "عرض الشارع غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_LAND_USE_TYPE"
    )
  ) {
    return "نوع الأرض غير صحيح.";
  }

  if (
    message.includes("INVALID_NET_PRICE")
  ) {
    return "السعر الصافي غير صحيح.";
  }

  if (
    message.includes("INVALID_TAX_AMOUNT")
  ) {
    return "قيمة الضريبة غير صحيحة.";
  }

  if (
    message.includes(
      "INVALID_BROKERAGE_AMOUNT"
    )
  ) {
    return "قيمة السعي غير صحيحة.";
  }

  if (
    message.includes(
      "INVALID_LAND_CONTACT_NAME"
    )
  ) {
    return "اسم مسؤول الأرض غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_LAND_CONTACT_MOBILE"
    )
  ) {
    return "رقم جوال مسؤول الأرض غير صحيح.";
  }

  if (
    message.includes("DEED_FILE_REQUIRED")
  ) {
    return "أرفق ملف الصك.";
  }

  if (
    message.includes(
      "INVALID_DEED_FILE_TYPE"
    )
  ) {
    return "صيغة ملف الصك غير مسموحة.";
  }

  if (
    message.includes(
      "INVALID_DEED_FILE_SIZE"
    )
  ) {
    return "حجم ملف الصك غير مسموح.";
  }

  if (
    message.includes("ROW-LEVEL SECURITY") ||
    message.includes("RLS")
  ) {
    return "ليس لديك صلاحية لتنفيذ هذه العملية.";
  }

  return fallbackMessage;
}

function validateRequiredText(
  value,
  {
    fieldName,
    minLength = 2,
    maxLength = 150,
  }
) {
  const normalizedValue =
    normalizeText(value);

  if (
    normalizedValue.length < minLength
  ) {
    throw new Error(`أدخل ${fieldName}.`);
  }

  if (
    normalizedValue.length > maxLength
  ) {
    throw new Error(
      `${fieldName} أطول من الحد المسموح.`
    );
  }

  return normalizedValue;
}

function validateGoogleMapsUrl(value) {
  const url = normalizeText(value);

  if (!url) {
    throw new Error(
      "أدخل رابط موقع الأرض في Google Maps."
    );
  }

  if (url.length > 2000) {
    throw new Error(
      "رابط موقع الأرض أطول من الحد المسموح."
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      "أدخل رابطًا صحيحًا لموقع الأرض."
    );
  }

  if (
    !["http:", "https:"].includes(
      parsedUrl.protocol
    )
  ) {
    throw new Error(
      "رابط موقع الأرض غير صحيح."
    );
  }

  return url;
}

function validatePositiveNumber(
  value,
  {
    fieldName,
    maximum,
  }
) {
  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    throw new Error(
      `أدخل ${fieldName} بصورة صحيحة.`
    );
  }

  if (
    Number.isFinite(maximum) &&
    numberValue > maximum
  ) {
    throw new Error(
      `${fieldName} أكبر من الحد المسموح.`
    );
  }

  return numberValue;
}

function validateNonNegativeNumber(
  value,
  fieldName
) {
  const normalizedValue =
    value === "" ||
    value === null ||
    value === undefined
      ? 0
      : Number(value);

  if (
    !Number.isFinite(normalizedValue) ||
    normalizedValue < 0
  ) {
    throw new Error(
      `أدخل ${fieldName} بصورة صحيحة.`
    );
  }

  return normalizedValue;
}

function validateLandUseType(value) {
  const normalizedValue =
    normalizeText(value);

  if (
    !ALLOWED_LAND_USE_TYPES.includes(
      normalizedValue
    )
  ) {
    throw new Error("اختر نوع الأرض.");
  }

  return normalizedValue;
}

function validateContactMobile(value) {
  const mobile = String(value || "")
    .trim()
    .replace(/\s+/g, "");

  if (!MOBILE_PATTERN.test(mobile)) {
    throw new Error(
      "رقم جوال مسؤول الأرض غير صحيح."
    );
  }

  return mobile;
}

function validateDeedFile(file) {
  if (!(file instanceof File)) {
    throw new Error("أرفق ملف الصك.");
  }

  if (
    !ALLOWED_DEED_TYPES.includes(file.type)
  ) {
    throw new Error(
      "ملف الصك يجب أن يكون PDF أو JPG أو PNG."
    );
  }

  if (
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    throw new Error(
      "ملف الصك فارغ أو غير صالح."
    );
  }

  if (file.size > MAX_DEED_SIZE_BYTES) {
    throw new Error(
      "حجم ملف الصك يجب ألا يتجاوز 15 ميجابايت."
    );
  }

  return file;
}

function sanitizeFileName(fileName) {
  const originalName =
    normalizeText(fileName) ||
    "land-deed";

  const extensionMatch =
    originalName.match(/\.([a-z0-9]+)$/i);

  const extension =
    extensionMatch?.[1]?.toLowerCase() ||
    "";

  const baseName = originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const safeBaseName =
    baseName || "land-deed";

  return extension
    ? `${safeBaseName}.${extension}`
    : safeBaseName;
}

async function getAuthenticatedUser() {
  const { data, error } =
    await supabase.auth.getUser();

  if (error) {
    console.error(
      "getAuthenticatedUser:",
      error
    );

    throw new Error(
      "تعذر التحقق من حساب العميل."
    );
  }

  if (!data?.user?.id) {
    throw new Error(
      "انتهت جلسة الدخول. سجل الدخول مجددًا."
    );
  }

  return data.user;
}

async function uploadLandDeed({
  customerFileId,
  deedFile,
}) {
  const validatedCustomerFileId =
    normalizeProjectId(customerFileId);

  const validatedFile =
    validateDeedFile(deedFile);

  const user =
    await getAuthenticatedUser();

  const safeFileName =
    sanitizeFileName(validatedFile.name);

  const uniquePart =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

  const storagePath = [
    user.id,
    validatedCustomerFileId,
    `${uniquePart}-${safeFileName}`,
  ].join("/");

  const { error } =
    await supabase.storage
      .from("land-deeds")
      .upload(
        storagePath,
        validatedFile,
        {
          cacheControl: "3600",
          upsert: false,
          contentType:
            validatedFile.type,
        }
      );

  if (error) {
    console.error("uploadLandDeed:", error);

    throw new Error(
      getLandErrorMessage(
        error,
        "تعذر رفع ملف الصك."
      )
    );
  }

  return {
    storagePath,
    originalName: validatedFile.name,
    contentType: validatedFile.type,
    sizeBytes: validatedFile.size,
  };
}

async function removeUploadedDeed(
  storagePath
) {
  if (!storagePath) {
    return;
  }

  const { error } =
    await supabase.storage
      .from("land-deeds")
      .remove([storagePath]);

  if (error) {
    console.error(
      "removeUploadedDeed:",
      error
    );
  }
}

async function loadConstructionStageWorkspace(
  projectId
) {
  const { data, error } = await supabase.rpc(
    "customer_get_construction_stage_workspace",
    {
      p_project_id: projectId,
    }
  );

  if (error) {
    console.warn(
      "customer_get_construction_stage_workspace:",
      error
    );

    return null;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const photos = Array.isArray(data.photos)
    ? data.photos
    : [];

  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      if (!photo?.storagePath) {
        return photo;
      }

      const bucket =
        photo.storageBucket ||
        "construction-stage-photos";

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from(bucket)
          .createSignedUrl(
            photo.storagePath,
            300
          );

      if (signedError) {
        console.warn(
          "create construction photo signed url:",
          signedError
        );

        return photo;
      }

      return {
        ...photo,
        signedUrl:
          signedData?.signedUrl || null,
      };
    })
  );

  return {
    ...data,
    photos: photosWithUrls,
    projectStandards: Array.isArray(
      data.projectStandards
    )
      ? data.projectStandards
      : [],
    generalStandards: Array.isArray(
      data.generalStandards
    )
      ? data.generalStandards
      : [],
    documents: Array.isArray(data.documents)
      ? data.documents
      : [],
  };
}

function normalizeServiceProjectForWorkspace(
  project
) {
  return {
    id: project.id,
    file_number:
      project.project_number || "",
    project_type: "services",
    status: project.status || "active",
    current_stage:
      project.current_stage ||
      "غير محددة",
    current_stage_id:
      project.current_stage_id || null,
    project_title:
      project.project_title || "",
    land_area: Number(project.land_area),
    built_up_area:
      project.built_up_area == null
        ? null
        : Number(project.built_up_area),
    floors: Number(project.floors),
    property_location_url:
      project.property_location_url || "",
    submitted_at: project.created_at || null,
    approved_at: project.created_at || null,
    rejected_at: null,
    updated_at:
      project.updated_at ||
      project.created_at || null,
    email: "",
  };
}

export async function getMyCustomerProjectWorkspace(
  customerFileId
) {
  const normalizedProjectId =
    normalizeProjectId(customerFileId);

  let customerFile = null;
  let timeline = [];
  let financedWorkspaceError = null;

  const {
    data: financedData,
    error: financedError,
  } = await supabase.rpc(
    "customer_get_my_project_workspace",
    {
      p_customer_file_id:
        normalizedProjectId,
    }
  );

  if (!financedError && financedData?.customerFile) {
    customerFile = {
      ...financedData.customerFile,
      project_type:
        financedData.customerFile.project_type ||
        "financed",
    };

    timeline = Array.isArray(
      financedData.timeline
    )
      ? financedData.timeline
      : [];
  } else {
    financedWorkspaceError = financedError;

    const {
      data: serviceProjects,
      error: serviceProjectsError,
    } = await supabase.rpc(
      "customer_get_my_service_projects"
    );

    if (serviceProjectsError) {
      console.error(
        "customer_get_my_service_projects:",
        serviceProjectsError
      );

      throw new Error(
        getWorkspaceErrorMessage(
          financedWorkspaceError ||
            serviceProjectsError
        )
      );
    }

    const serviceProject = Array.isArray(
      serviceProjects
    )
      ? serviceProjects.find(
          (project) =>
            project?.id === normalizedProjectId
        )
      : null;

    if (!serviceProject) {
      if (financedWorkspaceError) {
        console.error(
          "getMyCustomerProjectWorkspace:",
          financedWorkspaceError
        );
      }

      throw new Error(
        getWorkspaceErrorMessage(
          financedWorkspaceError
        )
      );
    }

    customerFile =
      normalizeServiceProjectForWorkspace(
        serviceProject
      );

    timeline = [];
  }

  if (!customerFile) {
    throw new Error(
      "لم تصل بيانات المشروع من قاعدة البيانات."
    );
  }

  const constructionStageWorkspace =
    await loadConstructionStageWorkspace(
      normalizedProjectId
    );

  customerFile = {
    ...customerFile,
    construction_stage_workspace:
      constructionStageWorkspace,
  };

  return {
    customerFile,
    timeline,
  };
}

export function calculateLandTotalPrice({
  netPrice,
  taxAmount,
  brokerageAmount,
}) {
  return (
    validateNonNegativeNumber(
      netPrice,
      "السعر الصافي"
    ) +
    validateNonNegativeNumber(
      taxAmount,
      "الضريبة"
    ) +
    validateNonNegativeNumber(
      brokerageAmount,
      "السعي"
    )
  );
}

export async function submitFinancedCustomerLand({
  customerFileId,
  city,
  district,
  googleMapsUrl,
  landArea,
  frontageWidth,
  streetWidth,
  landUseType,
  services = {},
  netPrice,
  taxAmount = 0,
  brokerageAmount = 0,
  landContactName,
  landContactMobile,
  deedFile,
  customerNote = "",
}) {
  const validatedCustomerFileId =
    normalizeProjectId(customerFileId);

  const validatedCity =
    validateRequiredText(city, {
      fieldName: "المدينة",
      maxLength: 100,
    });

  const validatedDistrict =
    validateRequiredText(district, {
      fieldName: "الحي",
      maxLength: 150,
    });

  const validatedGoogleMapsUrl =
    validateGoogleMapsUrl(
      googleMapsUrl
    );

  const validatedLandArea =
    validatePositiveNumber(
      landArea,
      {
        fieldName: "مساحة الأرض",
        maximum: 1000000,
      }
    );

  const validatedFrontageWidth =
    validatePositiveNumber(
      frontageWidth,
      {
        fieldName: "عرض واجهة الأرض",
        maximum: 10000,
      }
    );

  const validatedStreetWidth =
    validatePositiveNumber(
      streetWidth,
      {
        fieldName: "عرض الشارع",
        maximum: 1000,
      }
    );

  const validatedLandUseType =
    validateLandUseType(landUseType);

  const validatedNetPrice =
    validatePositiveNumber(
      netPrice,
      {
        fieldName: "السعر الصافي",
      }
    );

  const validatedTaxAmount =
    validateNonNegativeNumber(
      taxAmount,
      "الضريبة"
    );

  const validatedBrokerageAmount =
    validateNonNegativeNumber(
      brokerageAmount,
      "السعي"
    );

  const validatedContactName =
    validateRequiredText(
      landContactName,
      {
        fieldName: "اسم مسؤول الأرض",
        maxLength: 150,
      }
    );

  const validatedContactMobile =
    validateContactMobile(
      landContactMobile
    );

  validateDeedFile(deedFile);

  let uploadedDeed = null;

  try {
    uploadedDeed =
      await uploadLandDeed({
        customerFileId:
          validatedCustomerFileId,
        deedFile,
      });

    const { data, error } =
      await supabase.rpc(
        "customer_submit_financed_land",
        {
          p_customer_file_id:
            validatedCustomerFileId,
          p_city: validatedCity,
          p_district:
            validatedDistrict,
          p_google_maps_url:
            validatedGoogleMapsUrl,
          p_land_area:
            validatedLandArea,
          p_frontage_width:
            validatedFrontageWidth,
          p_street_width:
            validatedStreetWidth,
          p_land_use_type:
            validatedLandUseType,
          p_has_water:
            Boolean(services.water),
          p_has_electricity:
            Boolean(
              services.electricity
            ),
          p_has_fiber:
            Boolean(services.fiber),
          p_has_public_sewer:
            Boolean(
              services.publicSewer
            ),
          p_net_price:
            validatedNetPrice,
          p_tax_amount:
            validatedTaxAmount,
          p_brokerage_amount:
            validatedBrokerageAmount,
          p_land_contact_name:
            validatedContactName,
          p_land_contact_mobile:
            validatedContactMobile,
          p_deed_storage_path:
            uploadedDeed.storagePath,
          p_deed_original_name:
            uploadedDeed.originalName,
          p_deed_content_type:
            uploadedDeed.contentType,
          p_deed_size_bytes:
            uploadedDeed.sizeBytes,
          p_customer_note:
            normalizeText(customerNote) ||
            null,
        }
      );

    if (error) {
      console.error(
        "customer_submit_financed_land:",
        error
      );

      throw new Error(
        getLandErrorMessage(
          error,
          "تعذر تقديم الأرض."
        )
      );
    }

    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {
      throw new Error(
        "تم تنفيذ العملية، لكن لم تصل بيانات تقديم الأرض."
      );
    }

    const submission = data[0];

    if (
      !submission?.id ||
      !submission?.submission_number
    ) {
      throw new Error(
        "وصلت بيانات تقديم أرض غير مكتملة."
      );
    }

    return {
      id: submission.id,
      submissionNumber:
        submission.submission_number,
      status:
        submission.status ||
        "under_review",
      totalPrice:
        Number(submission.total_price),
      submittedAt:
        submission.submitted_at || null,
      deedStoragePath:
        uploadedDeed.storagePath,
    };
  } catch (error) {
    if (uploadedDeed?.storagePath) {
      await removeUploadedDeed(
        uploadedDeed.storagePath
      );
    }

    throw error;
  }
}
