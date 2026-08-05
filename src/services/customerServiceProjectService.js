import { supabase } from "../lib/supabase.js";

const MOBILE_PATTERN = /^05\d{8}$/;

const PROPERTY_URL_PATTERN =
  /^https?:\/\/\S+$/i;

const ALLOWED_PROJECT_TITLES = [
  "دور",
  "شقق",
  "فيلا",
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMobile(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

function validateCustomerName(value) {
  const customerName =
    normalizeText(value);

  if (customerName.length < 3) {
    throw new Error(
      "أدخل الاسم الكامل للعميل."
    );
  }

  if (customerName.length > 150) {
    throw new Error(
      "اسم العميل أطول من الحد المسموح."
    );
  }

  return customerName;
}

function validateMobileNumber(value) {
  const mobileNumber =
    normalizeMobile(value);

  if (!MOBILE_PATTERN.test(mobileNumber)) {
    throw new Error(
      "رقم الجوال غير صحيح. يجب أن يبدأ بـ 05 ويتكون من 10 أرقام."
    );
  }

  return mobileNumber;
}

function validatePropertyLocationUrl(value) {
  const propertyLocationUrl =
    normalizeText(value);

  if (!propertyLocationUrl) {
    throw new Error(
      "أدخل رابط موقع العقار."
    );
  }

  if (
    propertyLocationUrl.length > 2000 ||
    !PROPERTY_URL_PATTERN.test(
      propertyLocationUrl
    )
  ) {
    throw new Error(
      "أدخل رابطًا صحيحًا لموقع العقار."
    );
  }

  return propertyLocationUrl;
}

function validateLandArea(value) {
  const landArea = Number(value);

  if (
    !Number.isFinite(landArea) ||
    landArea <= 0
  ) {
    throw new Error(
      "أدخل مساحة صحيحة للعقار."
    );
  }

  if (landArea > 1000000) {
    throw new Error(
      "مساحة العقار أكبر من الحد المسموح."
    );
  }

  return landArea;
}

function validateProjectTitle(value) {
  const projectTitle =
    normalizeText(value);

  if (
    !ALLOWED_PROJECT_TITLES.includes(
      projectTitle
    )
  ) {
    throw new Error(
      "اختر مسمى المشروع من القائمة."
    );
  }

  return projectTitle;
}

function validateFloors(value) {
  const floors = Number(value);

  if (
    !Number.isInteger(floors) ||
    floors < 1 ||
    floors > 100
  ) {
    throw new Error(
      "أدخل عدد أدوار صحيحًا."
    );
  }

  return floors;
}

function validateUuid(
  value,
  errorMessage
) {
  const normalizedValue =
    normalizeText(value);

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(normalizedValue)) {
    throw new Error(errorMessage);
  }

  return normalizedValue;
}

function validateStageSelection({
  stageId,
  customStageName,
  customStageDescription,
}) {
  const normalizedStageId =
    normalizeText(stageId);

  const normalizedCustomStageName =
    normalizeText(customStageName);

  const normalizedCustomStageDescription =
    normalizeText(customStageDescription);

  if (normalizedStageId) {
    return {
      stageId: validateUuid(
        normalizedStageId,
        "المرحلة المختارة غير صحيحة."
      ),

      customStageName: null,
      customStageDescription: null,
    };
  }

  if (
    normalizedCustomStageName.length < 2
  ) {
    throw new Error(
      "اكتب اسم المرحلة الأخرى."
    );
  }

  if (
    normalizedCustomStageName.length >
    120
  ) {
    throw new Error(
      "اسم المرحلة الأخرى أطول من الحد المسموح."
    );
  }

  if (
    normalizedCustomStageDescription
      .length > 1000
  ) {
    throw new Error(
      "وصف المرحلة الأخرى أطول من الحد المسموح."
    );
  }

  return {
    stageId: null,

    customStageName:
      normalizedCustomStageName,

    customStageDescription:
      normalizedCustomStageDescription ||
      null,
  };
}

function getArabicServiceProjectError(
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
      "CUSTOMER_EMAIL_NOT_FOUND"
    )
  ) {
    return "لم يُعثر على بريد إلكتروني صالح في حساب العميل.";
  }

  if (
    message.includes(
      "INVALID_CUSTOMER_NAME"
    )
  ) {
    return "اسم العميل غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_CUSTOMER_MOBILE"
    )
  ) {
    return "رقم الجوال غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_PROPERTY_LOCATION"
    )
  ) {
    return "رابط موقع العقار غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_LAND_AREA"
    )
  ) {
    return "مساحة العقار غير صحيحة.";
  }

  if (
    message.includes(
      "INVALID_PROJECT_TITLE"
    )
  ) {
    return "مسمى المشروع غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_FLOORS"
    )
  ) {
    return "عدد الأدوار غير صحيح.";
  }

  if (
    message.includes(
      "INVALID_BUILDING_STAGE"
    )
  ) {
    return "مرحلة البناء المختارة غير صحيحة أو غير متاحة.";
  }

  if (
    message.includes(
      "CUSTOM_STAGE_NAME_REQUIRED"
    )
  ) {
    return "اكتب اسم المرحلة الأخرى.";
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
      "DUPLICATE KEY"
    )
  ) {
    return "تعذر إنشاء رقم مشروع جديد. حاول مرة أخرى.";
  }

  return fallbackMessage;
}

export async function listBuildingStages() {
  const { data, error } =
    await supabase.rpc(
      "customer_list_building_stages"
    );

  if (error) {
    console.error(
      "customer_list_building_stages:",
      error
    );

    throw new Error(
      getArabicServiceProjectError(
        error,
        "تعذر تحميل مراحل البناء."
      )
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((stage) => ({
      id: stage.id,

      stageKey:
        stage.stage_key,

      stageName:
        stage.stage_name,

      stageOrder:
        Number(stage.stage_order),
    }))
    .filter(
      (stage) =>
        stage.id &&
        stage.stageName &&
        Number.isFinite(
          stage.stageOrder
        )
    )
    .sort(
      (firstStage, secondStage) =>
        firstStage.stageOrder -
        secondStage.stageOrder
    );
}

export async function createCustomerServiceProject({
  customerName,
  mobileNumber,
  propertyLocationUrl,
  landArea,
  projectTitle,
  floors,
  stageId = null,
  customStageName = "",
  customStageDescription = "",
}) {
  const validatedCustomerName =
    validateCustomerName(customerName);

  const validatedMobileNumber =
    validateMobileNumber(mobileNumber);

  const validatedPropertyLocationUrl =
    validatePropertyLocationUrl(
      propertyLocationUrl
    );

  const validatedLandArea =
    validateLandArea(landArea);

  const validatedProjectTitle =
    validateProjectTitle(projectTitle);

  const validatedFloors =
    validateFloors(floors);

  const stageSelection =
    validateStageSelection({
      stageId,
      customStageName,
      customStageDescription,
    });

  const { data, error } =
    await supabase.rpc(
      "customer_create_service_project",
      {
        p_customer_name:
          validatedCustomerName,

        p_customer_mobile:
          validatedMobileNumber,

        p_property_location_url:
          validatedPropertyLocationUrl,

        p_land_area:
          validatedLandArea,

        p_project_title:
          validatedProjectTitle,

        p_floors:
          validatedFloors,

        p_stage_id:
          stageSelection.stageId,

        p_custom_stage_name:
          stageSelection
            .customStageName,

        p_custom_stage_description:
          stageSelection
            .customStageDescription,
      }
    );

  if (error) {
    console.error(
      "customer_create_service_project:",
      error
    );

    throw new Error(
      getArabicServiceProjectError(
        error,
        "تعذر إنشاء مشروع الخدمات."
      )
    );
  }

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      "تم تنفيذ العملية، لكن لم تصل بيانات المشروع."
    );
  }

  const project = data[0];

  if (
    !project?.id ||
    !project?.project_number
  ) {
    throw new Error(
      "وصلت بيانات مشروع غير مكتملة من قاعدة البيانات."
    );
  }

  return {
    id: project.id,

    projectNumber:
      project.project_number,

    projectType:
      project.project_type ||
      "services",

    status:
      project.status ||
      "active",

    currentStageId:
      project.current_stage_id ||
      null,

    currentStageName:
      project.current_stage_name ||
      project.custom_stage_name ||
      "غير محددة",

    customStageName:
      project.custom_stage_name ||
      null,

    createdAt:
      project.created_at ||
      null,
  };
}

export async function getMyCustomerServiceProjects() {
  const { data, error } =
    await supabase.rpc(
      "customer_get_my_service_projects"
    );

  if (error) {
    console.error(
      "customer_get_my_service_projects:",
      error
    );

    throw new Error(
      getArabicServiceProjectError(
        error,
        "تعذر تحميل مشاريع الخدمات."
      )
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((project) => ({
    id: project.id,

    projectNumber:
      project.project_number,

    projectType:
      project.project_type ||
      "services",

    status:
      project.status ||
      "active",

    currentStageId:
      project.current_stage_id ||
      null,

    currentStage:
      project.current_stage ||
      "غير محددة",

    projectTitle:
      project.project_title ||
      "غير محدد",

    landArea:
      Number(project.land_area),

    floors:
      Number(project.floors),

    propertyLocationUrl:
      project.property_location_url ||
      "",

    createdAt:
      project.created_at ||
      null,

    updatedAt:
      project.updated_at ||
      null,
  }));
}

export async function updateCustomerServiceProjectStage({
  projectId,
  stageId = null,
  customStageName = "",
  customStageDescription = "",
}) {
  const validatedProjectId =
    validateUuid(
      projectId,
      "معرّف المشروع غير صحيح."
    );

  const stageSelection =
    validateStageSelection({
      stageId,
      customStageName,
      customStageDescription,
    });

  const { data, error } =
    await supabase.rpc(
      "customer_update_service_project_stage",
      {
        p_project_id:
          validatedProjectId,

        p_stage_id:
          stageSelection.stageId,

        p_custom_stage_name:
          stageSelection
            .customStageName,

        p_custom_stage_description:
          stageSelection
            .customStageDescription,
      }
    );

  if (error) {
    console.error(
      "customer_update_service_project_stage:",
      error
    );

    throw new Error(
      getArabicServiceProjectError(
        error,
        "تعذر تحديث مرحلة المشروع."
      )
    );
  }

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      "تم تحديث المرحلة، لكن لم تصل بيانات المشروع."
    );
  }

  const result = data[0];

  return {
    id: result.id,

    currentStageId:
      result.current_stage_id ||
      null,

    currentStageName:
      result.current_stage_name ||
      result.custom_stage_name ||
      "غير محددة",

    customStageName:
      result.custom_stage_name ||
      null,

    updatedAt:
      result.updated_at ||
      null,
  };
}
