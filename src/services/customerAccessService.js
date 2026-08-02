import { supabase } from "../lib/supabase.js";

function normalizeCustomerAccess({
  fileNumber,
  mobileNumber,
}) {
  const normalizedFileNumber = String(
    fileNumber || ""
  )
    .trim()
    .toUpperCase();

  const normalizedMobileNumber = String(
    mobileNumber || ""
  ).trim();

  if (!normalizedFileNumber) {
    throw new Error("أدخل رقم الملف.");
  }

  if (!/^05\d{8}$/.test(normalizedMobileNumber)) {
    throw new Error("رقم الجوال غير صحيح.");
  }

  return {
    fileNumber: normalizedFileNumber,
    mobileNumber: normalizedMobileNumber,
  };
}

export async function getCustomerFileByAccess({
  fileNumber,
  mobileNumber,
}) {
  const normalized = normalizeCustomerAccess({
    fileNumber,
    mobileNumber,
  });

  const { data, error } = await supabase.rpc(
    "get_customer_file_by_access",
    {
      p_file_number: normalized.fileNumber,
      p_mobile_number: normalized.mobileNumber,
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

export async function getCustomerTimelineByAccess({
  fileNumber,
  mobileNumber,
}) {
  const normalized = normalizeCustomerAccess({
    fileNumber,
    mobileNumber,
  });

  const { data, error } = await supabase.rpc(
    "get_customer_file_timeline_by_access",
    {
      p_file_number: normalized.fileNumber,
      p_mobile_number: normalized.mobileNumber,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "تعذر تحميل السجل الزمني للملف."
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function getCustomerWorkspaceByAccess({
  fileNumber,
  mobileNumber,
}) {
  const [customerFile, timeline] =
    await Promise.all([
      getCustomerFileByAccess({
        fileNumber,
        mobileNumber,
      }),

      getCustomerTimelineByAccess({
        fileNumber,
        mobileNumber,
      }),
    ]);

  return {
    customerFile,
    timeline,
  };
}
