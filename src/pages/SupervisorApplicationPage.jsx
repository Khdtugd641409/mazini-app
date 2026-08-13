import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase.js";

const SESSION_KEY = "nm_supervisor_session_started_at";
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const INITIAL_FORM = {
  applicantType: "individual",
  fullName: "",
  email: "",
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
};

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

export default function SupervisorApplicationPage({ onBack, onOpenSupervisor }) {
  const [step, setStep] = useState("form");
  const [form, setForm] = useState(INITIAL_FORM);
  const [otp, setOtp] = useState("");
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [documents, setDocuments] = useState({
    qualification: null,
    professional_license: null,
    commercial_registration: null,
    portfolio: null,
  });

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  useEffect(() => {
    let active = true;

    async function restoreExistingApplication() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!active || !sessionData?.session) return;

        const { data, error } = await supabase.rpc("supervisor_get_my_application");
        if (error || !data || !active) return;

        setApplication(data);
        setForm({
          applicantType: data.applicantType || "individual",
          fullName: data.fullName || "",
          email: sessionData.session.user?.email || "",
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
      } catch {
        // التسجيل الجديد لا يعتمد على وجود جلسة سابقة.
      }
    }

    restoreExistingApplication();
    return () => {
      active = false;
    };
  }, []);

  function validateForm() {
    if (form.fullName.trim().length < 3) throw new Error("اكتب الاسم الكامل للمشرف.");
    if (!form.email.trim().includes("@")) throw new Error("أدخل بريدًا إلكترونيًا صحيحًا.");
    if (!/^05\d{8}$/.test(form.mobileNumber.trim())) throw new Error("رقم الجوال يجب أن يبدأ بـ05 ويتكون من 10 أرقام.");
    if (!form.professionalTitle.trim()) throw new Error("اكتب المسمى المهني.");
    if (!form.city.trim()) throw new Error("اكتب المدينة.");
    if (form.profileSummary.trim().length < 10) throw new Error("اكتب نبذة مهنية أوضح عن خبرتك.");
    if (!form.initialServiceTitle.trim()) throw new Error("اكتب اسم الخدمة التي ستعرضها.");
  }

  async function sendRegistrationCode(event) {
    event.preventDefault();
    if (loading) return;

    try {
      validateForm();
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      const normalizedEmail = form.email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setForm((current) => ({ ...current, email: normalizedEmail }));
      setOtp("");
      setStep("otp");
      setSuccessMessage("تم إرسال رمز التحقق إلى بريدك الإلكتروني.");
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إرسال رمز التحقق.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadDocument(documentType, file, userId) {
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) throw new Error(`نوع الملف ${file.name} غير مدعوم.`);
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error(`حجم الملف ${file.name} يجب ألا يتجاوز 20 ميجابايت.`);

    const uniquePart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const storagePath = `${userId}/${documentType}/${uniquePart}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("supervisor-documents")
      .upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;

    const { error: registerError } = await supabase.rpc("supervisor_register_application_document", {
      p_document_type: documentType,
      p_storage_path: storagePath,
      p_original_name: file.name,
      p_content_type: file.type,
      p_size_bytes: file.size,
    });
    if (registerError) {
      await supabase.storage.from("supervisor-documents").remove([storagePath]);
      throw registerError;
    }
  }

  async function verifyAndSubmit(event) {
    event.preventDefault();
    if (loading) return;

    const normalizedOtp = normalizeOtp(otp);
    if (!/^\d{8}$/.test(normalizedOtp)) {
      setErrorMessage("أدخل رمز التحقق المكوّن من 8 أرقام.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      const { data, error } = await supabase.auth.verifyOtp({ email: form.email, token: normalizedOtp, type: "email" });
      if (error) throw error;
      if (!data?.session) throw new Error("لم تُنشأ جلسة دخول صالحة.");

      const serviceAreas = form.serviceAreas.split(/[،,]/).map((value) => value.trim()).filter(Boolean);
      const { error: submitError } = await supabase.rpc("supervisor_submit_application", {
        p_applicant_type: form.applicantType,
        p_full_name: form.fullName.trim(),
        p_mobile_number: form.mobileNumber.trim(),
        p_organization_name: form.organizationName.trim() || null,
        p_commercial_registration_number: form.commercialRegistrationNumber.trim() || null,
        p_professional_title: form.professionalTitle.trim(),
        p_professional_license_number: form.professionalLicenseNumber.trim() || null,
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
      if (submitError) throw submitError;

      const userId = data.user?.id;
      if (!userId) throw new Error("تعذر تحديد حساب المشرف.");
      for (const [documentType, file] of Object.entries(documents)) {
        if (file) await uploadDocument(documentType, file, userId);
      }

      localStorage.setItem(SESSION_KEY, String(Date.now()));
      setApplication({ status: "under_review" });
      setStep("success");
      setSuccessMessage("تم إرسال طلب تسجيل المشرف إلى إدارة المنصة.");
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
    setForm(INITIAL_FORM);
    setOtp("");
    setStep("form");
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

  const statusLabels = {
    under_review: "بانتظار مراجعة الإدارة",
    needs_completion: "مطلوب استكمال",
    approved: "مقبول",
    rejected: "مرفوض",
  };

  if (step === "success") {
    return (
      <main style={shellStyle}>
        <section style={{ ...cardStyle, maxWidth: 650, margin: "50px auto", display: "grid", gap: 14 }}>
          <h1>تم إرسال طلب التسجيل</h1>
          <p>{successMessage}</p>
          <p>بعد قبول الإدارة، ادخل من «مشرف ← تسجيل الدخول» باستخدام البريد نفسه.</p>
          <button type="button" onClick={onBack}>العودة للرئيسية</button>
        </section>
      </main>
    );
  }

  if (step === "otp") {
    return (
      <main style={shellStyle}>
        <section style={{ ...cardStyle, maxWidth: 560, margin: "50px auto" }}>
          <button type="button" onClick={() => setStep("form")} disabled={loading}>العودة للبيانات</button>
          <h1>التحقق من البريد الإلكتروني</h1>
          <p>أرسلنا رمزًا من 8 أرقام إلى <strong>{form.email}</strong>.</p>
          {errorMessage && <p style={{ color: "#991b1b" }}>{errorMessage}</p>}
          {successMessage && <p>{successMessage}</p>}
          <form onSubmit={verifyAndSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 7 }}>
              <strong>رمز التحقق من 8 أرقام</strong>
              <input inputMode="numeric" value={otp} onChange={(event) => setOtp(normalizeOtp(event.target.value))} maxLength={8} style={fieldStyle} required disabled={loading} />
            </label>
            <button type="submit" disabled={loading || normalizeOtp(otp).length !== 8} style={{ minHeight: 48 }}>
              {loading ? "جاري الإرسال..." : "تحقق وإرسال الطلب للإدارة"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0 }}>منصة نايف المزيني</p>
            <h1 style={{ marginBottom: 0 }}>طلب تسجيل مشرف</h1>
            <p>أكمل بياناتك أولًا، ثم نتحقق من بريدك الإلكتروني قبل إرسال الطلب للإدارة.</p>
          </div>
          <button type="button" onClick={onBack}>العودة</button>
        </header>

        {errorMessage && <div style={{ ...cardStyle, color: "#991b1b" }}>{errorMessage}</div>}
        {successMessage && <div style={cardStyle}>{successMessage}</div>}

        {application && (
          <section style={cardStyle}>
            <strong>حالة الطلب السابقة: {statusLabels[application.status] || application.status}</strong>
            {application.adminNote && <p>ملاحظة الإدارة: {application.adminNote}</p>}
            {application.status === "approved" && <button type="button" onClick={onOpenSupervisor}>فتح حساب المشرف</button>}
          </section>
        )}

        {application?.status !== "approved" && (
          <form onSubmit={sendRegistrationCode} style={{ ...cardStyle, display: "grid", gap: 16 }}>
            <label style={{ display: "grid", gap: 7 }}>
              <strong>صفة مقدم الخدمة</strong>
              <select value={form.applicantType} onChange={(event) => updateField("applicantType", event.target.value)} style={fieldStyle} disabled={loading}>
                <option value="individual">فرد يعمل لحسابه الخاص</option>
                <option value="organization">مكتب أو منشأة هندسية</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 7 }}><strong>الاسم الكامل</strong><input value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} style={fieldStyle} required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>البريد الإلكتروني</strong><input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} style={fieldStyle} required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>رقم الجوال</strong><input inputMode="numeric" value={form.mobileNumber} onChange={(event) => updateField("mobileNumber", event.target.value.replace(/\D/g, "").slice(0, 10))} style={fieldStyle} placeholder="05xxxxxxxx" required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>المسمى المهني</strong><input value={form.professionalTitle} onChange={(event) => updateField("professionalTitle", event.target.value)} style={fieldStyle} placeholder="مثال: مهندس مدني / مهندس معماري" required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>المدينة</strong><input value={form.city} onChange={(event) => updateField("city", event.target.value)} style={fieldStyle} required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>مناطق تقديم الخدمة</strong><input value={form.serviceAreas} onChange={(event) => updateField("serviceAreas", event.target.value)} style={fieldStyle} placeholder="الرياض، الخرج، المزاحمية" /></label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 7 }}><strong>سنوات الخبرة</strong><input type="number" min="0" max="80" value={form.experienceYears} onChange={(event) => updateField("experienceYears", event.target.value)} style={fieldStyle} /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>عدد المشاريع السابقة</strong><input type="number" min="0" value={form.completedProjectsCount} onChange={(event) => updateField("completedProjectsCount", event.target.value)} style={fieldStyle} /></label>
            </div>

            <label style={{ display: "grid", gap: 7 }}><strong>نبذة مهنية</strong><textarea rows="5" value={form.profileSummary} onChange={(event) => updateField("profileSummary", event.target.value)} style={{ ...fieldStyle, padding: 12, resize: "vertical" }} required /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>رقم الترخيص المهني — اختياري</strong><input value={form.professionalLicenseNumber} onChange={(event) => updateField("professionalLicenseNumber", event.target.value)} style={fieldStyle} /></label>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>بيانات المكتب أو المنشأة — اختيارية</h2>
              <p style={{ margin: 0 }}>يمكن تركها فارغة إذا كان المشرف يعمل كفرد.</p>
              <label style={{ display: "grid", gap: 7 }}><strong>اسم المكتب / المنشأة</strong><input value={form.organizationName} onChange={(event) => updateField("organizationName", event.target.value)} style={fieldStyle} /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>رقم السجل التجاري</strong><input value={form.commercialRegistrationNumber} onChange={(event) => updateField("commercialRegistrationNumber", event.target.value)} style={fieldStyle} /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>رابط الموقع في Google Maps — اختياري</strong><input type="url" value={form.mapsUrl} onChange={(event) => updateField("mapsUrl", event.target.value)} style={fieldStyle} /></label>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>الخدمة التي ستعرضها</h2>
              <label style={{ display: "grid", gap: 7 }}><strong>اسم الخدمة</strong><input value={form.initialServiceTitle} onChange={(event) => updateField("initialServiceTitle", event.target.value)} style={fieldStyle} required /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>وصف الخدمة</strong><textarea rows="4" value={form.initialServiceDescription} onChange={(event) => updateField("initialServiceDescription", event.target.value)} style={{ ...fieldStyle, padding: 12, resize: "vertical" }} /></label>
              <label style={{ display: "grid", gap: 7 }}><strong>طريقة التسعير</strong><select value={form.pricingModel} onChange={(event) => updateField("pricingModel", event.target.value)} style={fieldStyle}><option value="flexible">حسب الاتفاق</option><option value="fixed">مبلغ ثابت</option><option value="monthly">شهري</option><option value="percentage">نسبة من المشروع</option></select></label>
              <label style={{ display: "grid", gap: 7 }}><strong>السعر / القيمة — اختياري</strong><input type="number" min="0" step="0.01" value={form.servicePrice} onChange={(event) => updateField("servicePrice", event.target.value)} style={fieldStyle} /></label>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>المستندات — اختيارية</h2>
              <label>المؤهل أو الشهادة<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setDocuments((current) => ({ ...current, qualification: event.target.files?.[0] || null }))} /></label>
              <label>الترخيص المهني<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setDocuments((current) => ({ ...current, professional_license: event.target.files?.[0] || null }))} /></label>
              <label>السجل التجاري<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setDocuments((current) => ({ ...current, commercial_registration: event.target.files?.[0] || null }))} /></label>
              <label>نماذج أعمال سابقة<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setDocuments((current) => ({ ...current, portfolio: event.target.files?.[0] || null }))} /></label>
            </div>

            <button type="submit" disabled={loading} style={{ minHeight: 50, fontWeight: 800 }}>
              {loading ? "جاري الإرسال..." : "متابعة والتحقق من البريد"}
            </button>
          </form>
        )}

        {application && <button type="button" onClick={signOut}>بدء تسجيل جديد ببريد آخر</button>}
      </div>
    </main>
  );
}
