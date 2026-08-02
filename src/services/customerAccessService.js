import { supabase } from "../lib/supabase.js";

export async function getCustomerFileByAccess({
  fileNumber,
  mobileNumber,
}) {
  const normalizedFileNumber = fileNumber
    .trim()
    .toUpperCase();

  const normalizedMobileNumber =
    mobileNumber.trim();

  if (!normalizedFileNumber) {
    throw new Error("أدخل رقم الملف.");
  }

  if (!/^05\d{8}$/.test(normalizedMobileNumber)) {
    throw new Error("رقم الجوال غير صحيح.");
  }

  const { data, error } = await supabase.rpc(
    "get_customer_file_by_access",
    {
      p_file_number: normalizedFileNumber,
      p_mobile_number: normalizedMobileNumber,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "تعذر فتح ملف العميل."
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "رقم الملف أو رقم الجوال غير مطابق."
    );
  }

  return data[0];
}
