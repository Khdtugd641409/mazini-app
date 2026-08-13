import { useState } from "react";
import { supabase } from "../lib/supabase.js";

const initialForm = {
  organizationName: "",
  commercialRegistrationNumber: "",
  email: "",
  mobileNumber: "",
  mapsUrl: "",
  productName: "",
};

function normalizeOtp(value) {
  return String(value || "").replace(/[^\d٠-٩۰-۹]/g, "").slice(0, 8);
}

export default function SupplierApplicationPage() {
  const [form, setForm] = useState(initialForm);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("form");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    if (!form.organizationName.trim()) throw new Error("أدخل اسم المؤسسة.");
    if (!form.commercialRegistrationNumber.trim()) throw new Error("أدخل رقم السجل التجاري.");
    if (!form.email.trim().includes("@")) throw new Error("أدخل بريدًا إلكترونيًا صحيحًا.");
    if (!/^05\d{8}$/.test(form.mobileNumber.trim())) throw new Error("أدخل رقم جوال صحيحًا يبدأ بـ05.");
    if (!/^https?:\/\//i.test(form.mapsUrl.trim())) throw new Error("أدخل رابط موقع المؤسسة في Google Maps.");
    if (form.productName.trim().length < 2) throw new Error("اكتب المنتج الذي تقدمه المؤسسة.");
  }

  async function sendCode(event) {
    event.preventDefault();
    if (loading) return;
    try {
      validate();
      setLoading(true);
      setErrorMessage("");
      setMessage("");
      const email = form.email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      setForm((current) => ({ ...current, email }));
      setOtp("");
      setStep("otp");
      setMessage("تم إرسال رمز التحقق إلى بريدك الإلكتروني.");
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إرسال رمز التحقق.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndSubmit(event) {
    event.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      setErrorMessage("");
      const { data, error } = await supabase.auth.verifyOtp({ email: form.email, token: normalizeOtp(otp), type: "email" });
      if (error) throw error;
      if (!data?.session) throw new Error("لم يتم إنشاء جلسة دخول صالحة.");
      const { error: submitError } = await supabase.rpc("supplier_submit_application", {
        p_organization_name: form.organizationName.trim(),
        p_commercial_registration_number: form.commercialRegistrationNumber.trim(),
        p_mobile_number: form.mobileNumber.trim(),
        p_maps_url: form.mapsUrl.trim(),
        p_product_name: form.productName.trim(),
      });
      if (submitError) throw submitError;
      setStep("success");
      setMessage("تم إرسال طلب تسجيل المورد إلى إدارة المنصة.");
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إرسال طلب المورد.");
    } finally {
      setLoading(false);
    }
  }

  const shell = { minHeight: "100vh", background: "#f5f3ee", direction: "rtl", padding: "28px 16px", color: "#173f36" };
  const card = { maxWidth: 720, margin: "0 auto", background: "#fff", border: "1px solid #e3e0d7", borderRadius: 20, padding: 24, display: "grid", gap: 16 };
  const input = { minHeight: 46, border: "1px solid #d1d5db", borderRadius: 10, padding: "0 12px", font: "inherit" };

  if (step === "success") {
    return <main style={shell}><section style={card}><h1>تم إرسال الطلب</h1><p>{message}</p><p>يمكنك العودة لاحقًا والدخول من أيقونة «مورد» بنفس البريد لمتابعة حالة الطلب.</p><button type="button" onClick={() => window.location.href = "/"}>العودة للرئيسية</button></section></main>;
  }

  return (
    <main style={shell}>
      <section style={card}>
        <button type="button" onClick={() => window.location.href = "/"}>العودة</button>
        <div><p style={{ margin: 0 }}>نايف المزيني للبناء الذاتي</p><h1 style={{ marginBottom: 6 }}>تسجيل مورد جديد</h1><p>تُراجع الإدارة بيانات المؤسسة قبل تفعيل حساب المورد.</p></div>
        {errorMessage && <p style={{ color: "#991b1b" }}>{errorMessage}</p>}
        {message && <p>{message}</p>}
        {step === "form" ? (
          <form onSubmit={sendCode} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}><strong>اسم المؤسسة</strong><input style={input} value={form.organizationName} onChange={(e) => updateField("organizationName", e.target.value)} required /></label>
            <label style={{ display: "grid", gap: 6 }}><strong>رقم السجل التجاري</strong><input style={input} value={form.commercialRegistrationNumber} onChange={(e) => updateField("commercialRegistrationNumber", e.target.value)} required /></label>
            <label style={{ display: "grid", gap: 6 }}><strong>البريد الإلكتروني</strong><input style={input} type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} required /></label>
            <label style={{ display: "grid", gap: 6 }}><strong>رقم الجوال</strong><input style={input} inputMode="numeric" placeholder="05xxxxxxxx" value={form.mobileNumber} onChange={(e) => updateField("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))} required /></label>
            <label style={{ display: "grid", gap: 6 }}><strong>رابط موقع المؤسسة في Google Maps</strong><input style={input} type="url" value={form.mapsUrl} onChange={(e) => updateField("mapsUrl", e.target.value)} required /></label>
            <label style={{ display: "grid", gap: 6 }}><strong>المنتج الذي تقدمه</strong><input style={input} value={form.productName} onChange={(e) => updateField("productName", e.target.value)} placeholder="مثال: رخام، حديد، خرسانة..." required /></label>
            <button type="submit" disabled={loading} style={{ minHeight: 48 }}>إرسال رمز التحقق</button>
          </form>
        ) : (
          <form onSubmit={verifyAndSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}><strong>رمز التحقق من 8 أرقام</strong><input style={input} inputMode="numeric" maxLength={8} value={otp} onChange={(e) => setOtp(normalizeOtp(e.target.value))} required /></label>
            <button type="submit" disabled={loading || normalizeOtp(otp).length !== 8} style={{ minHeight: 48 }}>تحقق وإرسال الطلب</button>
            <button type="button" onClick={() => setStep("form")} disabled={loading}>تعديل البيانات</button>
          </form>
        )}
      </section>
    </main>
  );
}
