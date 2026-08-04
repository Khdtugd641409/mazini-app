import { supabase } from "../lib/supabase.js";

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeOtp(value) {
  return String(value || "")
    .trim()
    .replace(
      /[٠-٩]/g,
      (digit) =>
        "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
    )
    .replace(
      /[۰-۹]/g,
      (digit) =>
        "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
    )
    .replace(/\s+/g, "");
}

function getArabicAuthError(
  error,
  fallbackMessage
) {
  const message = String(
    error?.message || ""
  ).toLowerCase();

  if (message.includes("rate limit")) {
    return "تم طلب رموز كثيرة. انتظر قليلًا ثم أعد المحاولة.";
  }

  if (
    message.includes("token has expired") ||
    message.includes("otp expired") ||
    message.includes("invalid token") ||
    message.includes("invalid otp")
  ) {
    return "رمز الدخول غير صالح أو انتهت صلاحيته. اطلب رمزًا جديدًا واستخدم أحدث رسالة.";
  }

  if (message.includes("email")) {
    return "تعذر استخدام البريد الإلكتروني المدخل.";
  }

  return fallbackMessage;
}

function getArabicClaimError(error) {
  const message = String(
    error?.message || ""
  ).toUpperCase();

  if (
    message.includes(
      "PROJECT_VERIFICATION_FAILED"
    )
  ) {
    return "رقم الملف أو رقم الجوال غير صحيح.";
  }

  if (
    message.includes(
      "PROJECT_ALREADY_LINKED"
    )
  ) {
    return "هذا المشروع مرتبط بحساب عميل آخر.";
  }

  if (
    message.includes(
      "ACTIVE_CUSTOMER_ACCOUNT_REQUIRED"
    )
  ) {
    return "حساب العميل غير نشط أو غير مكتمل.";
  }

  if (
    message.includes(
      "AUTHENTICATION_REQUIRED"
    )
  ) {
    return "انتهت جلسة الدخول. سجل الدخول مجددًا.";
  }

  return "تعذر ربط المشروع بالحساب.";
}

export async function sendCustomerLoginCode(
  email
) {
  const normalizedEmail =
    normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error(
      "أدخل البريد الإلكتروني."
    );
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalizedEmail)) {
    throw new Error(
      "أدخل بريدًا إلكترونيًا صحيحًا."
    );
  }

  const { error } =
    await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

  if (error) {
    console.error(
      "sendCustomerLoginCode:",
      error
    );

    throw new Error(
      getArabicAuthError(
        error,
        "تعذر إرسال رمز الدخول. حاول مرة أخرى."
      )
    );
  }

  return {
    email: normalizedEmail,
  };
}

export async function verifyCustomerLoginCode(
  email,
  otp
) {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedOtp =
    normalizeOtp(otp);

  if (!normalizedEmail) {
    throw new Error(
      "البريد الإلكتروني مفقود."
    );
  }

  if (!/^\d{8}$/.test(normalizedOtp)) {
    throw new Error(
      "أدخل رمز الدخول المكوّن من 8 أرقام."
    );
  }

  const {
    data: authData,
    error: verifyError,
  } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedOtp,
    type: "email",
  });

  if (verifyError) {
    console.error(
      "verifyCustomerLoginCode:",
      verifyError
    );

    throw new Error(
      getArabicAuthError(
        verifyError,
        "تعذر التحقق من رمز الدخول."
      )
    );
  }

  if (
    !authData?.session ||
    !authData?.user
  ) {
    await supabase.auth.signOut();

    throw new Error(
      "تم قبول الرمز، لكن لم تُنشأ جلسة دخول صالحة."
    );
  }

  const {
    data: account,
    error: accountError,
  } = await supabase.rpc(
    "customer_ensure_account"
  );

  if (accountError) {
    console.error(
      "customer_ensure_account:",
      accountError
    );

    await supabase.auth.signOut();

    throw new Error(
      "تم التحقق من البريد، لكن تعذر إنشاء حساب العميل."
    );
  }

  return {
    user: authData.user,
    session: authData.session,
    account,
  };
}

export async function getMyCustomerProjects() {
  const { data, error } =
    await supabase.rpc(
      "customer_get_my_projects"
    );

  if (error) {
    console.error(
      "getMyCustomerProjects:",
      error
    );

    throw new Error(
      "تعذر تحميل مشاريع الحساب."
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function claimExistingCustomerProject({
  fileNumber,
  mobileNumber,
}) {
  const normalizedFileNumber =
    String(fileNumber || "").trim();

  const normalizedMobileNumber =
    String(mobileNumber || "").trim();

  if (!normalizedFileNumber) {
    throw new Error("أدخل رقم الملف.");
  }

  if (!normalizedMobileNumber) {
    throw new Error("أدخل رقم الجوال.");
  }

  const { data, error } =
    await supabase.rpc(
      "customer_claim_existing_project",
      {
        p_file_number:
          normalizedFileNumber,
        p_mobile_number:
          normalizedMobileNumber,
      }
    );

  if (error) {
    console.error(
      "claimExistingCustomerProject:",
      error
    );

    throw new Error(
      getArabicClaimError(error)
    );
  }

  const linkedProject =
    Array.isArray(data) ? data[0] : null;

  if (!linkedProject) {
    throw new Error(
      "تم تنفيذ الطلب، لكن لم يُعثر على المشروع المرتبط."
    );
  }

  return linkedProject;
}

export async function getCustomerSession() {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    console.error(
      "getCustomerSession:",
      error
    );

    throw new Error(
      "تعذر التحقق من جلسة الدخول."
    );
  }

  return data?.session || null;
}

export async function signOutCustomerAccount() {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    console.error(
      "signOutCustomerAccount:",
      error
    );

    throw new Error(
      "تعذر تسجيل الخروج."
    );
  }
}
