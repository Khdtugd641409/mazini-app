import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  CONSTRUCTION_PHASE_CATEGORIES,
  STRUCTURAL_LISTING_TYPES,
  STRUCTURAL_MATERIAL_CATEGORIES,
  STRUCTURAL_CONTRACTOR_CATEGORIES,
  SUPPLIER_MARKETPLACE_ROOT_CATEGORIES,
  getSupplierCategoryPathLabel,
} from "../utils/supplierMarketplace.js";
import {
  SUPPLIER_PLATFORM_FEE_IBAN_DISPLAY,
  SUPPLIER_PLATFORM_FEE_TERMS_TEXT,
  SUPPLIER_PLATFORM_FEE_TERMS_VERSION,
} from "../utils/supplierPlatformFee.js";

const initialForm = {
  organizationName: "",
  commercialRegistrationNumber: "",
  email: "",
  mobileNumber: "",
  mapsUrl: "",
  productCategory: "",
  acceptPlatformFeeTerms: false,
};

function normalizeOtp(value) {
  return String(value || "").replace(/[^\d٠-٩۰-۹]/g, "").slice(0, 8);
}

function getSubmitErrorMessage(error) {
  const message = String(error?.message || "");
  if (message.includes("SUPPLIER_PLATFORM_FEE_TERMS_REQUIRED")) return "يجب قبول تعهّد عمولة المنصة قبل إرسال الطلب.";
  if (message.includes("SUPPLIER_PLATFORM_FEE_TERMS_VERSION_MISMATCH")) return "تم تحديث نص التعهّد. ارجع إلى نموذج التسجيل واقرأ النسخة الجديدة ثم وافق عليها.";
  if (message.includes("INVALID_PRODUCT_CATEGORY")) return "اختر تصنيف المنتج من القوائم المعتمدة.";
  return message || "تعذر إرسال طلب المورد.";
}

function getCategoryPath(form) {
  if (!form.productCategory) return "";
  return getSupplierCategoryPathLabel(form.productCategory);
}

export default function SupplierApplicationPage() {
  const [form, setForm] = useState(initialForm);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("form");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rootCategory, setRootCategory] = useState("");
  const [constructionPhase, setConstructionPhase] = useState("");
  const [structuralType, setStructuralType] = useState("");

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetFrom(level, value) {
    if (level === "root") {
      setRootCategory(value);
      setConstructionPhase("");
      setStructuralType("");
      updateField("productCategory", "");
      return;
    }
    if (level === "phase") {
      setConstructionPhase(value);
      setStructuralType("");
      updateField("productCategory", "");
      return;
    }
    setStructuralType(value);
    updateField("productCategory", "");
  }

  const phaseOptions = rootCategory === "construction" ? CONSTRUCTION_PHASE_CATEGORIES : [];
  const typeOptions = constructionPhase === "structure" ? STRUCTURAL_LISTING_TYPES : [];
  const finalOptions = structuralType === "materials"
    ? STRUCTURAL_MATERIAL_CATEGORIES
    : structuralType === "contractors"
      ? STRUCTURAL_CONTRACTOR_CATEGORIES
      : [];

  function selectFinalCategory(value) {
    updateField("productCategory", value);
  }

  function validate() {
    if (!form.organizationName.trim()) throw new Error("أدخل اسم المؤسسة.");
    if (!form.commercialRegistrationNumber.trim()) throw new Error("أدخل رقم السجل التجاري.");
    if (!form.email.trim().includes("@")) throw new Error("أدخل بريدًا إلكترونيًا صحيحًا.");
    if (!/^05\d{8}$/.test(form.mobileNumber.trim())) throw new Error("أدخل رقم جوال صحيحًا يبدأ بـ05.");
    if (!/^https?:\/\//i.test(form.mapsUrl.trim())) throw new Error("أدخل رابط موقع المؤسسة في Google Maps.");
    if (!form.productCategory) throw new Error("اختر التصنيف النهائي للمنتج من القوائم.");
    if (!form.acceptPlatformFeeTerms) throw new Error("يجب قبول تعهّد عمولة المنصة قبل المتابعة.");
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
      const categoryPath = getCategoryPath(form);
      const { error: submitError } = await supabase.rpc("supplier_submit_application", {
        p_organization_name: form.organizationName.trim(),
        p_commercial_registration_number: form.commercialRegistrationNumber.trim(),
        p_mobile_number: form.mobileNumber.trim(),
        p_maps_url: form.mapsUrl.trim(),
        p_product_name: categoryPath,
        p_product_category: form.productCategory,
        p_accept_platform_fee_terms: form.acceptPlatformFeeTerms,
        p_platform_fee_terms_version: SUPPLIER_PLATFORM_FEE_TERMS_VERSION,
      });
      if (submitError) throw submitError;
      setStep("success");
      setMessage("تم إرسال طلب تسجيل المورد إلى إدارة المنصة.");
    } catch (error) {
      setErrorMessage(getSubmitErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const shell = { minHeight: "100vh", background: "#f5f3ee", direction: "rtl", padding: "28px 16px", color: "#173f36" };
  const card = { maxWidth: 720, margin: "0 auto", background: "#fff", border: "1px solid #e3e0d7", borderRadius: 20, padding: 24, display: "grid", gap: 16 };
  const input = { minHeight: 46, border: "1px solid #d1d5db", borderRadius: 10, padding: "0 12px", font: "inherit" };
  const select = { ...input, background: "#fff", width: "100%" };

  if (step === "success") {
    return <main style={shell}><section style={card}><h1>تم إرسال الطلب</h1><p>{message}</p><p>تم حفظ التصنيف الذي اخترته ضمن طلب المورد.</p><p>يمكنك العودة لاحقًا والدخول من أيقونة «مورد» بنفس البريد لمتابعة حالة الطلب.</p><button type="button" onClick={() => window.location.href = "/"}>العودة للرئيسية</button></section></main>;
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

            <section style={{ border: "1px solid #d7c58f", background: "#fffbeb", borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>المنتج الذي تقدمه المؤسسة</h2>
                <p style={{ margin: 0, lineHeight: 1.8 }}>اختر التصنيف من القوائم. لا يمكن كتابة التصنيف يدويًا.</p>
              </div>

              <label style={{ display: "grid", gap: 6 }}><strong>التصنيف الرئيسي</strong><select style={select} value={rootCategory} onChange={(e) => resetFrom("root", e.target.value)} required><option value="">اختر التصنيف الرئيسي</option>{SUPPLIER_MARKETPLACE_ROOT_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>

              {rootCategory === "home" && <p style={{ margin: 0, color: "#7c5b13" }}>تصنيفات الأدوات المنزلية الفرعية لم تُحدد بعد، لذلك لا يمكن اختيار منتج منها حاليًا.</p>}

              {rootCategory === "construction" && <label style={{ display: "grid", gap: 6 }}><strong>مرحلة البناء</strong><select style={select} value={constructionPhase} onChange={(e) => resetFrom("phase", e.target.value)} required><option value="">اختر المرحلة</option>{phaseOptions.map((option) => <option key={option.value} value={option.value} disabled={option.enabled === false}>{option.label}{option.enabled === false ? " — قريبًا" : ""}</option>)}</select></label>}

              {constructionPhase === "structure" && <label style={{ display: "grid", gap: 6 }}><strong>نوع النشاط</strong><select style={select} value={structuralType} onChange={(e) => resetFrom("type", e.target.value)} required><option value="">اختر النوع</option>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}

              {structuralType && <label style={{ display: "grid", gap: 6 }}><strong>التصنيف النهائي</strong><select style={select} value={form.productCategory} onChange={(e) => selectFinalCategory(e.target.value)} required><option value="">اختر التصنيف النهائي</option>{finalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}

              {form.productCategory && <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #e6e0d0" }}><strong>التصنيف المختار:</strong><div style={{ marginTop: 5 }}>{getCategoryPath(form)}</div></div>}
            </section>

            <section style={{ border: "1px solid #d7c58f", background: "#fffbeb", borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>تعهّد عمولة المنصة</h2>
                <p style={{ margin: 0, lineHeight: 1.9 }}>{SUPPLIER_PLATFORM_FEE_TERMS_TEXT}</p>
              </div>
              <div style={{ display: "grid", gap: 5 }}><strong>آيبان حساب المنصة</strong><code dir="ltr" style={{ display: "block", fontSize: 17, overflowWrap: "anywhere" }}>{SUPPLIER_PLATFORM_FEE_IBAN_DISPLAY}</code></div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, lineHeight: 1.7 }}><input type="checkbox" checked={form.acceptPlatformFeeTerms} onChange={(event) => updateField("acceptPlatformFeeTerms", event.target.checked)} required style={{ marginTop: 6 }} /><strong>قرأت التعهّد وأوافق عليه، وأقر بأن عمولة 1٪ تبقى في ذمتي حتى سدادها.</strong></label>
            </section>
            <button type="submit" disabled={loading} style={{ minHeight: 48 }}>إرسال رمز التحقق</button>
          </form>
        ) : (
          <form onSubmit={verifyAndSubmit} style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, lineHeight: 1.8 }}>بإدخال رمز البريد وإرسال الطلب، تؤكد هويتك وقبولك تعهّد عمولة المنصة والتصنيف المختار في نموذج التسجيل.</p>
            <label style={{ display: "grid", gap: 6 }}><strong>رمز التحقق من 8 أرقام</strong><input style={input} inputMode="numeric" maxLength={8} value={otp} onChange={(e) => setOtp(normalizeOtp(e.target.value))} required /></label>
            <button type="submit" disabled={loading || normalizeOtp(otp).length !== 8} style={{ minHeight: 48 }}>تحقق وإرسال الطلب</button>
            <button type="button" onClick={() => setStep("form")} disabled={loading}>تعديل البيانات</button>
          </form>
        )}
      </section>
    </main>
  );
}
