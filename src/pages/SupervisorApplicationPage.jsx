import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase.js";

const SESSION_KEY = "nm_supervisor_session_started_at";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function normalizeOtp(value) {
  return String(value || "")
    .replace(/[^\d٠-٩۰-۹]/g, "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .slice(0, 8);
}

function sanitizeFileName(fileName) {
  const original = String(fileName || "document").trim();
  const extensionMatch = original.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch?.[1]?.toLowerCase() || "";
  const base = original
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "document";
  return extension ? `${base}.${extension}` : base;
}

function isSupervisorSessionFresh() {
  const startedAt = Number(localStorage.getItem(SESSION_KEY) || 0);
  return startedAt > 0 && Date.now() - startedAt < THIRTY_DAYS_MS;
}

function startSupervisorSession() {
  localStorage.setItem(SESSION_KEY, String(Date.now()));
}

const fieldStyle = {
  minHeight: 46,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "0 12px",
  font: "inherit",
  boxSizing: "border-box",
  width: "100%",
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #e3e0d7",
  borderRadius: 18,
  padding: 20,
};

function SupervisorApplicationPage({ onBack, onOpenSupervisor }) {
  const [step, setStep] = useState("checking");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState({
    applicantType: "individual",
    fullName: "",
    mobileNumber: "",
    organizationName: "",
    commercialRegistrationNumber: "",
    professionalTitle: "",
    professionalLicenseNumber: "",
    city: "",
    serviceAreas: "",
    experienceYears: "0",
    completedProjectsCount: "0",
    profileSummary: "",
    mapsUrl: "",
    initialServiceTitle: "إشراف على مشروع بناء",
    initialServiceDescription: "",
    pricingModel: "flexible",
    servicePrice: "",
  });
  const [documents, setDocuments] = useState({
    qualification: null,
    professional_license: null,
    commercial_registration: null,
    portfolio: null,
  });

  async function loadApplication() {
    const { data, error } = await supabase.rpc("supervisor_get_my_application");
    if (error) throw error;

    setApplication(data || null);

    if (data) {
      setForm({
        applicantType: data.applicantType || "individual",
        fullName: data.fullName || "",
        mobileNumber: data.mobileNumber || "",
        organizationName: data.organizationName || "",
        commercialRegistrationNumber: data.commercialRegistrationNumber || "",
        professionalTitle: data.professionalTitle || "",
        professionalLicenseNumber: data.professionalLicenseNumber || "",
        city: data.city || "",
        serviceAreas: Array.isArray(data.serviceAreas) ? data.serviceAreas.join("، ") : "",
        experienceYears: String(data.experienceYears ?? 0),
        completedProjectsCount: String(data.completedProjectsCount ?? 0),
        profileSummary: data.profileSummary || "",
        mapsUrl: data.mapsUrl || "",
        initialServiceTitle: data.initialServiceTitle || "إشراف على مشروع بناء",
        initialServiceDescription: data.initialServiceDescription || "",
        pricingModel: data.pricingModel || "flexible",
        servicePrice: data.servicePrice == null ? "" : String(data.servicePrice),
      });
    }

    setStep("form");
  }

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;

        if (!data?.session) {
          localStorage.removeItem(SESSION_KEY);
          setStep("email");
          return;
        }

        if (!isSupervisorSessionFresh()) {
          await supabase.auth.signOut();
          localStorage.removeItem(SESSION_KEY);
          if (active) setStep("email");
          return;
        }

        await loadApplication();
      } catch (error) {
        if (active) {
          setErrorMessage(error?.message || "تعذر التحقق من جلسة المشرف.");
          setStep("email");
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function sendCode(event) {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setErrorMessage("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;

      setEmail(normalizedEmail);
      setOtp("");
      setStep("otp");
      setSuccessMessage("تم إرسال رمز الدخول إلى بريدك الإلكتروني.");
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إرسال رمز الدخول.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (loading) return;

    const normalizedOtp = normalizeOtp(otp);
    if (!/^\d{8}$/.test(normalizedOtp)) {
      setErrorMessage("أدخل رمز الدخول المكوّن من 8 أرقام.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: normalizedOtp,
        type: "email",
      });
      if (error) throw error;
      if (!data?.session) throw new Error("لم تُنشأ جلسة دخول صالحة.");

      startSupervisorSession();
      await loadApplication();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر التحقق من رمز الدخول.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function uploadDocument(documentType, file, userId) {
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new Error(`نوع الملف ${file.name} غير مدعوم.`);
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw new Error(`حجم الملف ${file.name} يجب ألا يتجاوز 20 ميجابايت.`);
    }

    const uniquePart =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const storagePath = `${userId}/${documentType}/${uniquePart}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("supervisor-documents")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
    if (uploadError) throw uploadError;

    const { error: registerError } = await supabase.rpc(
      "supervisor_register_application_document",
      {
        p_document_type: documentType,
        p_storage_path: storagePath,
        p_original_name: file.name,
        p_content_type: file.type,
        p_size_bytes: file.size,
      }
    );

    if (registerError) {
      await supabase.storage.from("supervisor-documents").remove([storagePath]);
      throw registerError;
    }
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (loading) return;

    if (!/^05\d{8}$/.test(form.mobileNumber.trim())) {
      setErrorMessage("رقم الجوال يجب أن يبدأ بـ05 ويتكون من 10 أرقام.");
      return;
    }

    if (form.profileSummary.trim().length < 10) {
      setErrorMessage("اكتب نبذة مهنية أوضح عن خبرتك.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const serviceAreas = form.serviceAreas
        .split(/[،,]/)
        .map((value) => value.trim())
        .filter(Boolean);

      const { error } = await supabase.rpc("supervisor_submit_application", {
        p_applicant_type: form.applicantType,
        p_full_name: form.fullName.trim(),
        p_mobile_number: form.mobileNumber.trim(),
        p_organization_name: form.organizationName.trim() || null,
        p_commercial_registration_number:
          form.commercialRegistrationNumber.trim() || null,
        p_professional_title: form.professionalTitle.trim(),
        p_professional_license_number:
          form.professionalLicenseNumber.trim() || null,
        p_city: form.city.trim(),
        p_service_areas: serviceAreas,
        p_experience_years: Number(form.experienceYears || 0),
        p_completed_projects_count: Number(form.completedProjectsCount || 0),
        p_profile_summary: form.profileSummary.trim(),
        p_maps_url: form.mapsUrl.trim() || null,
        p_initial_service_title: form.initialServiceTitle.trim(),
        p_initial_service_description: form.initialServiceDescription.trim() || null,
        p_pricing_model: form.pricingModel,
        p_service_price: form.servicePrice === "" ? null : Number(form.servicePrice),
      });
      if (error) throw error;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData?.user?.id;
      if (!userId) throw new Error("تعذر تحديد حساب المشرف.");

      for (const [documentType, file] of Object.entries(documents)) {
        if (file) await uploadDocument(documentType, file, userId);
      }

      setDocuments({
        qualification: null,
        professional_license: null,
        commercial_registration: null,
        portfolio: null,
      });
      setSuccessMessage("تم إرسال طلب التسجيل إلى الإدارة.");
      await loadApplication();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إرسال طلب المشرف.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    setApplication(null);
    setStep("email");
    setSuccessMessage("");
    setErrorMessage("");
  }

  const shellStyle = {
    minHeight: "100vh",
    background: "#f5f3ee",
    color: "#173f36",
    padding: "24px 16px 60px",
    boxSizing: "border-box",
    direction: "rtl",
  };

  if (step === "checking") {
    return <main style={shellStyle}><div style={{ ...cardStyle, maxWidth: 560, margin: "70px auto" }}>جاري التحقق من الحساب...</div></main>;
  }

  if (step === "email" || step === "otp") {
    return (
      <main style={shellStyle}>
        <section style={{ ...cardStyle, maxWidth: 560, margin: "50px auto" }}>
          <button type="button" onClick={onBack}>العودة</button>
          <h1>طلب تسجيل مشرف</h1>
          <p>الدخول بالبريد الإلكتروني. بعد التحقق تبقى جلسة هذا الجهاز مفتوحة لمدة 30 يومًا.</p>
          {errorMessage && <p style={{ color: "#991b1b" }}>{errorMessage}</p>}
          {successMessage && <p>{successMessage}</p>}

          {step === "email" ? (
            <form onSubmit={sendCode} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 7 }}>
                <strong>البريد الإلكتروني</strong>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} required disabled={loading} />
              </label>
              <button type="submit" disabled={loading} style={{ minHeight: 46 }}>إرسال رمز الدخول</button>
            </form>
          ) : (
            <form onSubmit={verifyCode} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 7 }}>
                <strong>رمز الدخول من 8 أرقام</strong>
                <input inputMode="numeric" value={otp} onChange={(e) => setOtp(normalizeOtp(e.target.value))} maxLength={8} style={fieldStyle} required disabled={loading} />
              </label>
              <button type="submit" disabled={loading}>تحقق ودخول</button>
              <button type="button" onClick={() => setStep("email")} disabled={loading}>تغيير البريد</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  const statusLabels = {
    under_review: "بانتظار مراجعة الإدارة",
    needs_completion: "مطلوب استكمال",
    approved: "مقبول",
    rejected: "مرفوض",
  };

  return (
    <main style={shellStyle}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0 }}>منصة نايف المزيني</p>
            <h1 style={{ marginBottom: 0 }}>طلب تسجيل مشرف</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onBack}>الرئيسية</button>
            <button type="button" onClick={signOut}>تسجيل الخروج</button>
          </div>
        </header>

        {errorMessage && <div style={{ ...cardStyle, color: "#991b1b" }}>{errorMessage}</div>}
        {successMessage && <div style={cardStyle}>{successMessage}</div>}

        {application && (
          <section style={cardStyle}>
            <strong>حالة الطلب: {statusLabels[application.status] || application.status}</strong>
            {application.adminNote && <p>ملاحظة الإدارة: {application.adminNote}</p>}
            {application.status === "approved" && (
              <button type="button" onClick={onOpenSupervisor}>فتح حساب المشرف</button>
            )}
          </section>
        )}

        {application?.status !== "approved" && (
          <form onSubmit={submitApplication} style={{ ...cardStyle, display: "grid", gap: 16 }}>
            <label style={{ display: "grid", gap: 7 }}>
              <strong>صفة مقدم الخدمة</strong>
              <select value={form.applicantType} onChange={(e) => updateField("applicantType", e.target.value)} style={fieldStyle} disabled={loading}>
                <option value="individual">فرد يعمل لحسابه الخاص</option>
                <option value="organization">مكتب أو منشأة هندسية</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 7 }}><strong>الاسم الكامل</strong><input value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} style={fieldStyle} required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>الجوال</strong><input inputMode="numeric" value={form.mobileNumber} onChange={(e) => updateField("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))} style={fieldStyle} placeholder="05xxxxxxxx" required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>المسمى المهني</strong><input value={form.professionalTitle} onChange={(e) => updateField("professionalTitle", e.target.value)} style={fieldStyle} placeholder="مثال: مهندس مدني / مهندس معماري" required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>المدينة</strong><input value={form.city} onChange={(e) => updateField("city", e.target.value)} style={fieldStyle} required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>مناطق تقديم الخدمة</strong><input value={form.serviceAreas} onChange={(e) => updateField("serviceAreas", e.target.value)} style={fieldStyle} placeholder="الرياض، الخرج، المزاحمية" /></label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 7 }}><strong>سنوات الخبرة</strong><input type="number" min="0" max="80" value={form.experienceYears} onChange={(e) => updateField("experienceYears", e.target.value)} style={fieldStyle} /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>عدد المشاريع السابقة</strong><input type="number" min="0" value={form.completedProjectsCount} onChange={(e) => updateField("completedProjectsCount", e.target.value)} style={fieldStyle} /></label>
            </div>

            <label style={{ display: "grid", gap: 7 }}><strong>نبذة مهنية</strong><textarea rows="5" value={form.profileSummary} onChange={(e) => updateField("profileSummary", e.target.value)} style={{ ...fieldStyle, padding: 12, resize: "vertical" }} required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>رقم الترخيص المهني — اختياري</strong><input value={form.professionalLicenseNumber} onChange={(e) => updateField("professionalLicenseNumber", e.target.value)} style={fieldStyle} /></label>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>بيانات المكتب أو المنشأة — اختيارية</h2>
              <p style={{ margin: 0 }}>يمكن تركها فارغة بالكامل إذا كنت تعمل كفرد لحسابك الخاص.</p>
              <label style={{ display: "grid", gap: 7 }}><strong>اسم المكتب / المنشأة</strong><input value={form.organizationName} onChange={(e) => updateField("organizationName", e.target.value)} style={fieldStyle} /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>رقم السجل التجاري</strong><input value={form.commercialRegistrationNumber} onChange={(e) => updateField("commercialRegistrationNumber", e.target.value)} style={fieldStyle} /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>رابط الموقع في الخرائط — اختياري</strong><input type="url" value={form.mapsUrl} onChange={(e) => updateField("mapsUrl", e.target.value)} style={fieldStyle} /></label>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>الخدمة التي ستعرضها</h2>
              <label style={{ display: "grid", gap: 7 }}><strong>اسم الخدمة</strong><input value={form.initialServiceTitle} onChange={(e) => updateField("initialServiceTitle", e.target.value)} style={fieldStyle} required /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>وصف الخدمة</strong><textarea rows="4" value={form.initialServiceDescription} onChange={(e) => updateField("initialServiceDescription", e.target.value)} style={{ ...fieldStyle, padding: 12, resize: "vertical" }} /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>طريقة التسعير</strong><select value={form.pricingModel} onChange={(e) => updateField("pricingModel", e.target.value)} style={fieldStyle}><option value="flexible">حسب الاتفاق</option><option value="fixed">مبلغ ثابت</option><option value="monthly">شهري</option><option value="percentage">نسبة من المشروع</option></select></label>
              <label style={{ display: "grid", gap: 7 }}><strong>السعر / القيمة — اختياري</strong><input type="number" min="0" step="0.01" value={form.servicePrice} onChange={(e) => updateField("servicePrice", e.target.value)} style={fieldStyle} /></label>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>المستندات — اختيارية وتساعد الإدارة في التحقق</h2>
              <label>المؤهل أو الشهادة<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setDocuments((c) => ({ ...c, qualification: e.target.files?.[0] || null }))} /></label>
              <label>الترخيص المهني<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setDocuments((c) => ({ ...c, professional_license: e.target.files?.[0] || null }))} /></label>
              <label>السجل التجاري — اختياري<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setDocuments((c) => ({ ...c, commercial_registration: e.target.files?.[0] || null }))} /></label>
              <label>نماذج أعمال سابقة<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setDocuments((c) => ({ ...c, portfolio: e.target.files?.[0] || null }))} /></label>
            </div>

            <button type="submit" disabled={loading} style={{ minHeight: 50, fontWeight: 800 }}>
              {loading ? "جاري الإرسال..." : application ? "إعادة إرسال الطلب بعد التحديث" : "إرسال طلب التسجيل"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default SupervisorApplicationPage;
