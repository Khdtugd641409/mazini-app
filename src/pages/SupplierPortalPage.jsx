import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  SUPPLIER_PLATFORM_FEE_IBAN_DISPLAY,
  SUPPLIER_PLATFORM_FEE_PERCENT,
  SUPPLIER_PLATFORM_FEE_TERMS_TEXT,
} from "../utils/supplierPlatformFee.js";

function normalizeOtp(value) {
  return String(value || "").replace(/[^\d٠-٩۰-۹]/g, "").slice(0, 8);
}

function formatDate(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function SupplierPortalPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("checking");
  const [dashboard, setDashboard] = useState(null);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadPortal() {
    const { data, error } = await supabase.rpc("supplier_get_dashboard");
    if (!error) {
      setDashboard(data || { profile: {}, products: [], purchaseRequests: [], projects: [] });
      setStep("dashboard");
      return;
    }
    if (String(error.message || "").includes("SUPPLIER_AUTHORIZATION_REQUIRED")) {
      const { data: applicationData, error: applicationError } = await supabase.rpc("supplier_get_my_application");
      if (applicationError) throw applicationError;
      setApplication(applicationData || null);
      setStep("pending");
      return;
    }
    throw error;
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      try {
        if (error) throw error;
        if (!data?.session) {
          setStep("email");
          return;
        }
        await loadPortal();
      } catch (error) {
        if (active) {
          setErrorMessage(error?.message || "تعذر فتح حساب المورد.");
          setStep("email");
        }
      }
    });
    return () => { active = false; };
  }, []);

  async function sendCode(event) {
    event.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      setErrorMessage("");
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.includes("@")) throw new Error("أدخل بريدًا إلكترونيًا صحيحًا.");
      const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } });
      if (error) throw error;
      setEmail(normalizedEmail);
      setOtp("");
      setStep("otp");
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إرسال رمز الدخول.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      setErrorMessage("");
      const { data, error } = await supabase.auth.verifyOtp({ email, token: normalizeOtp(otp), type: "email" });
      if (error) throw error;
      if (!data?.session) throw new Error("لم تُنشأ جلسة دخول صالحة.");
      localStorage.setItem("nm_supplier_session_started_at", String(Date.now()));
      await loadPortal();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر التحقق من الرمز.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("nm_supplier_session_started_at");
    setDashboard(null);
    setApplication(null);
    setStep("email");
  }

  const shell = { minHeight: "100vh", background: "#f5f3ee", direction: "rtl", padding: "24px 16px 60px", color: "#173f36" };
  const card = { background: "#fff", border: "1px solid #e3e0d7", borderRadius: 18, padding: 20 };
  const input = { minHeight: 46, border: "1px solid #d1d5db", borderRadius: 10, padding: "0 12px", font: "inherit" };

  if (step === "checking") return <main style={shell}><section style={{ ...card, maxWidth: 520, margin: "70px auto" }}>جاري التحقق من حساب المورد...</section></main>;

  if (step === "email" || step === "otp") {
    return <main style={shell}><section style={{ ...card, maxWidth: 520, margin: "50px auto", display: "grid", gap: 14 }}><button type="button" onClick={() => window.location.href = "/"}>العودة</button><h1>دخول المورد</h1>{errorMessage && <p style={{ color: "#991b1b" }}>{errorMessage}</p>}{step === "email" ? <form onSubmit={sendCode} style={{ display: "grid", gap: 12 }}><label style={{ display: "grid", gap: 6 }}><strong>البريد الإلكتروني</strong><input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><button type="submit" disabled={loading}>إرسال رمز الدخول</button></form> : <form onSubmit={verifyCode} style={{ display: "grid", gap: 12 }}><label style={{ display: "grid", gap: 6 }}><strong>رمز الدخول من 8 أرقام</strong><input style={input} inputMode="numeric" maxLength={8} value={otp} onChange={(e) => setOtp(normalizeOtp(e.target.value))} required /></label><button type="submit" disabled={loading || normalizeOtp(otp).length !== 8}>دخول</button><button type="button" onClick={() => setStep("email")}>تغيير البريد</button></form>}</section></main>;
  }

  if (step === "pending") {
    const labels = { under_review: "طلبك تحت مراجعة الإدارة", needs_completion: "طلبك يحتاج استكمال", rejected: "تم رفض الطلب", approved: "تم قبول الطلب" };
    return <main style={shell}><section style={{ ...card, maxWidth: 650, margin: "40px auto", display: "grid", gap: 12 }}><h1>حساب المورد</h1><strong>{labels[application?.status] || "لم يتم اعتماد الحساب بعد"}</strong>{application?.adminNote && <p>ملاحظة الإدارة: {application.adminNote}</p>}<section style={{ border: "1px solid #d7c58f", background: "#fffbeb", borderRadius: 14, padding: 15 }}><strong>تعهّد عمولة المنصة: {SUPPLIER_PLATFORM_FEE_PERCENT}٪</strong><p style={{ lineHeight: 1.8 }}>{SUPPLIER_PLATFORM_FEE_TERMS_TEXT}</p><div><strong>الآيبان: </strong><code dir="ltr">{SUPPLIER_PLATFORM_FEE_IBAN_DISPLAY}</code></div>{application?.platformFeeAcceptedAt && <small style={{ display: "block", marginTop: 9 }}>تم القبول: {formatDate(application.platformFeeAcceptedAt)}</small>}</section><p>بعد قبول الإدارة سيُفتح لك حساب المورد من نفس البريد.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => window.location.href = "/supplier/application"}>فتح طلب التسجيل</button><button type="button" onClick={signOut}>تسجيل الخروج</button></div></section></main>;
  }

  const purchaseRequests = Array.isArray(dashboard?.purchaseRequests) ? dashboard.purchaseRequests : [];
  const projects = Array.isArray(dashboard?.projects) ? dashboard.projects : [];
  const products = Array.isArray(dashboard?.products) ? dashboard.products : [];

  return (
    <main style={shell}>
      <div style={{ maxWidth: 1050, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><p style={{ margin: 0 }}>نايف المزيني للبناء الذاتي</p><h1 style={{ margin: "5px 0 0" }}>{dashboard?.profile?.organizationName || "حساب المورد"}</h1></div><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => document.getElementById("supplier-account")?.scrollIntoView({ behavior: "smooth" })}>👤 حسابي</button><button type="button" onClick={signOut}>تسجيل الخروج</button></div></header>

        <section style={{ ...card, borderColor: "#d7c58f", background: "#fffbeb" }}><h2 style={{ marginTop: 0 }}>عمولة المنصة</h2><p style={{ lineHeight: 1.8 }}>{SUPPLIER_PLATFORM_FEE_TERMS_TEXT}</p><div><strong>آيبان حساب المنصة: </strong><code dir="ltr">{SUPPLIER_PLATFORM_FEE_IBAN_DISPLAY}</code></div><p style={{ marginBottom: 0 }}>لا تحسب المنصة مبلغ العمولة تلقائيًا لأن قيمة التعاقد لا تمر عبرها، ولا يؤدي عدم تسجيل مبلغ آلي إلى إخفاء حسابك أو إيقاف ظهوره للعملاء.</p></section>

        <section style={card}><h2 style={{ marginTop: 0 }}>طلبات العملاء الراغبين بالشراء</h2>{purchaseRequests.length === 0 ? <p>لا توجد طلبات شراء جديدة حاليًا.</p> : <div style={{ display: "grid", gap: 10 }}>{purchaseRequests.map((request) => <article key={request.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}><strong>{request.productName}</strong>{request.requestText && <p>{request.requestText}</p>}{request.requestedQuantity && <p>الكمية: {request.requestedQuantity}</p>}<small>{formatDate(request.createdAt)}</small></article>)}</div>}</section>

        <section style={card}><h2 style={{ marginTop: 0 }}>المشاريع التي أعمل عليها</h2>{projects.length === 0 ? <p>لا توجد مشاريع مرتبطة بالمورد حاليًا.</p> : <div style={{ display: "grid", gap: 10 }}>{projects.map((project) => <article key={project.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}><strong>المشروع</strong><div dir="ltr">{project.projectId}</div><small>بدأ: {formatDate(project.startedAt)}</small></article>)}</div>}</section>

        <section id="supplier-account" style={card}><h2 style={{ marginTop: 0 }}>حسابي</h2><dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}><div><dt>اسم المؤسسة</dt><dd>{dashboard?.profile?.organizationName}</dd></div><div><dt>السجل التجاري</dt><dd>{dashboard?.profile?.commercialRegistrationNumber}</dd></div><div><dt>الجوال</dt><dd>{dashboard?.profile?.mobileNumber}</dd></div><div><dt>الموقع</dt><dd><a href={dashboard?.profile?.mapsUrl} target="_blank" rel="noreferrer">فتح Google Maps</a></dd></div></dl><h3>المنتجات</h3>{products.length === 0 ? <p>لا توجد منتجات مسجلة.</p> : <div style={{ display: "grid", gap: 8 }}>{products.map((product) => <div key={product.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}><strong>{product.productName}</strong></div>)}</div>}</section>
      </div>
    </main>
  );
}
