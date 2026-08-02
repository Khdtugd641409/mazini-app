import { supabase } from "../lib/supabase.js";

export async function createCustomerFile({
  formData,
  calculation,
  acceptedExtraPayment,
  requestId,
}) {
  const { data, error } = await supabase.rpc(
    "create_customer_file",
    {
      p_customer_name: formData.customerName,
      p_mobile_number: formData.mobileNumber,
      p_email: formData.email || null,

      p_land_area: Number(formData.landArea),

      p_estimated_land_price: Number(
        formData.landPrice
      ),

      p_floors: Number(formData.floors),

      p_bank_offer: Number(
        formData.bankOffer
      ),

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

      p_request_id: requestId,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "تعذر إنشاء ملف العميل في قاعدة البيانات."
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "تم تنفيذ الطلب، لكن لم تصل بيانات ملف العميل."
    );
  }

  const createdFile = data[0];

  const {
    data: fullFileData,
    error: fullFileError,
  } = await supabase.rpc(
    "get_customer_file_by_access",
    {
      p_file_number:
        createdFile.file_number,

      p_mobile_number:
        String(formData.mobileNumber).trim(),
    }
  );

  if (fullFileError) {
    throw new Error(
      fullFileError.message ||
        "تم إنشاء الملف، لكن تعذر تحميل تفاصيله."
    );
  }

  if (
    !Array.isArray(fullFileData) ||
    fullFileData.length === 0
  ) {
    throw new Error(
      "تم إنشاء الملف، لكن لم تصل بياناته التفصيلية."
    );
  }

  return fullFileData[0];
}
