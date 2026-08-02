import { supabase } from "../lib/supabase.js";

function validateRequestId(requestId) {
  const normalizedRequestId = String(
    requestId || ""
  ).trim();

  if (!normalizedRequestId) {
    throw new Error(
      "معرّف عملية تقديم الطلب غير موجود."
    );
  }

  return normalizedRequestId;
}

async function getFullCustomerFile({
  fileNumber,
  mobileNumber,
}) {
  if (!fileNumber) {
    throw new Error(
      "رقم ملف العميل غير موجود."
    );
  }

  const { data, error } = await supabase.rpc(
    "get_customer_file_by_access",
    {
      p_file_number: String(
        fileNumber
      )
        .trim()
        .toUpperCase(),

      p_mobile_number: String(
        mobileNumber || ""
      ).trim(),
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "تعذر تحميل تفاصيل ملف العميل."
    );
  }

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      "لم تصل بيانات ملف العميل التفصيلية."
    );
  }

  return data[0];
}

export async function createCustomerFile({
  formData,
  calculation,
  acceptedExtraPayment,
  requestId,
  allowSimilarApplication = false,
}) {
  const normalizedRequestId =
    validateRequestId(requestId);

  const mobileNumber = String(
    formData.mobileNumber || ""
  ).trim();

  const { data, error } = await supabase.rpc(
    "create_customer_file",
    {
      p_customer_name:
        formData.customerName,

      p_mobile_number:
        mobileNumber,

      p_email:
        formData.email || null,

      p_land_area:
        Number(formData.landArea),

      p_estimated_land_price:
        Number(formData.landPrice),

      p_floors:
        Number(formData.floors),

      p_bank_offer:
        Number(formData.bankOffer),

      p_building_area_per_floor:
        calculation.buildingAreaPerFloor,

      p_total_building_area:
        calculation.totalBuildingArea,

      p_meter_rate:
        calculation.meterRate,

      p_estimated_construction_cost:
        calculation.constructionCost,

      p_estimated_project_cost:
        calculation.estimatedProjectCost,

      p_financing_ratio:
        calculation.financingRatio,

      p_bank_limit_at_80_percent:
        calculation.bankLimitAt80Percent,

      p_base_customer_payment:
        calculation.baseCustomerPayment,

      p_excess_amount:
        calculation.excessAmount,

      p_total_customer_payment:
        calculation.totalCustomerPayment,

      p_requires_extra_payment_approval:
        calculation.excessAmount > 0,

      p_extra_payment_approved:
        acceptedExtraPayment,

      p_request_id:
        normalizedRequestId,

      p_allow_similar_application:
        Boolean(allowSimilarApplication),
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "تعذر إنشاء ملف العميل في قاعدة البيانات."
    );
  }

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      "تم تنفيذ الطلب، لكن لم تصل نتيجة العملية."
    );
  }

  const result = data[0];

  const allowedResultTypes = [
    "created",
    "same_request",
    "similar_found",
  ];

  if (
    !allowedResultTypes.includes(
      result.result_type
    )
  ) {
    throw new Error(
      "وصلت نتيجة غير معروفة من عملية تقديم الطلب."
    );
  }

  const customerFile =
    await getFullCustomerFile({
      fileNumber: result.file_number,
      mobileNumber,
    });

  return {
    resultType: result.result_type,
    customerFile,
  };
}
