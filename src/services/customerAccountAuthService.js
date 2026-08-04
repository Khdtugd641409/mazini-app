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
    message.includes("otp expired")
  ) {
    return "انتهت صلاحية رمز الدخول. اطلب رمزًا جديدًا.";
  }

  if (
    message.includes("invalid token") ||
    message.includes("invalid otp")
  ) {
    return "رمز الدخول غير صحيح.";
  }

  if (message.includes("email")) {
    return "تعذر استخدام البريد الإلكتروني المدخل.";
  }

  return fallbackMessage;
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

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new Error(
      "أدخل رمز الدخول المكوّن من 6 أرقام."
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
