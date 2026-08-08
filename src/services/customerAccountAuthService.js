import { supabase } from "../lib/supabase.js";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validateEmail(value) {
  const normalizedEmail =
    normalizeEmail(value);

  if (!normalizedEmail) {
    throw new Error(
      "أدخل البريد الإلكتروني."
    );
  }

  if (
    normalizedEmail.length > 254 ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    throw new Error(
      "أدخل بريدًا إلكترونيًا صحيحًا."
    );
  }

  return normalizedEmail;
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
    return "بلغت خدمة البريد حد الإرسال المؤقت. انتظر قليلًا ثم أعد المحاولة.";
  }

  if (
    message.includes(
      "token has expired"
    ) ||
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

function getArabicProjectSyncError(error) {
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
      "CUSTOMER_ACCOUNT_NOT_FOUND"
    )
  ) {
    return "حساب العميل غير موجود أو غير نشط.";
  }

  return "تعذر ربط المشاريع المطابقة بالبريد الإلكتروني.";
}

function normalizeServiceProjectForAccount(project) {
  return {
    id: project.id,
    file_number:
      project.project_number || "",
    project_type:
      project.project_type || "services",
    status: project.status || "active",
    current_stage:
      project.current_stage ||
      "غير محددة",
    submitted_at:
      project.created_at || null,
    updated_at:
      project.updated_at ||
      project.created_at || null,
  };
}

export async function sendCustomerLoginCode(
  email
) {
  const normalizedEmail =
    validateEmail(email);

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

export async function syncMyCustomerProjects() {
  const { data, error } =
    await supabase.rpc(
      "customer_sync_my_projects"
    );

  if (error) {
    console.error(
      "customer_sync_my_projects:",
      error
    );

    throw new Error(
      getArabicProjectSyncError(error)
    );
  }

  const linkedProjectsCount =
    Number(data);

  return Number.isFinite(
    linkedProjectsCount
  )
    ? linkedProjectsCount
    : 0;
}

export async function verifyCustomerLoginCode(
  email,
  otp
) {
  const normalizedEmail =
    validateEmail(email);

  const normalizedOtp =
    normalizeOtp(otp);

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

  let linkedProjectsCount = 0;
  let projectSyncError = "";

  try {
    linkedProjectsCount =
      await syncMyCustomerProjects();
  } catch (error) {
    console.error(
      "تعذر الربط التلقائي بعد الدخول:",
      error
    );

    projectSyncError =
      error?.message ||
      "تعذر ربط المشاريع تلقائيًا.";
  }

  return {
    user: authData.user,
    session: authData.session,
    account,
    linkedProjectsCount,
    projectSyncError,
  };
}

export async function getMyCustomerProjects() {
  try {
    await syncMyCustomerProjects();
  } catch (error) {
    console.warn(
      "تعذر مزامنة مشاريع التمويل قبل عرض الحساب:",
      error
    );
  }

  const [
    financedResult,
    serviceResult,
  ] = await Promise.all([
    supabase.rpc(
      "customer_get_my_projects"
    ),
    supabase.rpc(
      "customer_get_my_service_projects"
    ),
  ]);

  if (
    financedResult.error &&
    serviceResult.error
  ) {
    console.error(
      "getMyCustomerProjects financed:",
      financedResult.error
    );

    console.error(
      "getMyCustomerProjects services:",
      serviceResult.error
    );

    throw new Error(
      "تعذر تحميل مشاريع الحساب."
    );
  }

  if (financedResult.error) {
    console.warn(
      "تعذر تحميل مشاريع التمويل:",
      financedResult.error
    );
  }

  if (serviceResult.error) {
    console.warn(
      "تعذر تحميل مشاريع الخدمات:",
      serviceResult.error
    );
  }

  const financedProjects = Array.isArray(
    financedResult.data
  )
    ? financedResult.data.map(
        (project) => ({
          ...project,
          project_type:
            project.project_type ||
            "financed",
        })
      )
    : [];

  const serviceProjects = Array.isArray(
    serviceResult.data
  )
    ? serviceResult.data.map(
        normalizeServiceProjectForAccount
      )
    : [];

  return [
    ...financedProjects,
    ...serviceProjects,
  ].sort((firstProject, secondProject) => {
    const firstTime = new Date(
      firstProject.updated_at ||
        firstProject.submitted_at ||
        0
    ).getTime();

    const secondTime = new Date(
      secondProject.updated_at ||
        secondProject.submitted_at ||
        0
    ).getTime();

    return secondTime - firstTime;
  });
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
