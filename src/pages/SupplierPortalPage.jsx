import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  archiveSupplierMarketplaceProduct,
  saveSupplierMarketplaceProduct,
  updateSupplierMarketplaceOrderStatus,
} from "../services/supplierMarketplaceService.js";
import {
  MARKETPLACE_ORDER_NEXT_ACTIONS,
  MARKETPLACE_ORDER_STATUSES,
  MARKETPLACE_SECTIONS,
  SUPPLIER_PRODUCT_UNITS,
  formatMarketplaceMoney,
  formatMarketplaceQuantity,
  getMarketplaceErrorMessage,
  getProductCategoriesForSection,
  getSupplierCategoryLabel,
  getSupplierProductImageUrl,
  getSupplierUnitLabel,
} from "../utils/supplierMarketplace.js";
import {
  SUPPLIER_PLATFORM_FEE_IBAN_DISPLAY,
  SUPPLIER_PLATFORM_FEE_PERCENT,
  SUPPLIER_PLATFORM_FEE_TERMS_TEXT,
} from "../utils/supplierPlatformFee.js";
import "./SupplierPortalPage.css";

const EMPTY_PRODUCT = {
  id: "",
  productName: "",
  description: "",
  price: "",
  unitCode: "piece",
  categoryCode: "other",
  marketplaceSection: "construction",
  imagePath: "",
};

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
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [productImageFile, setProductImageFile] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [orderUpdatingId, setOrderUpdatingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadPortal() {
    const [{ data, error }, marketplaceResult] = await Promise.all([
      supabase.rpc("supplier_get_dashboard"),
      supabase.rpc("supplier_get_marketplace_dashboard"),
    ]);
    if (!error) {
      if (marketplaceResult.error) throw marketplaceResult.error;
      setDashboard({ ...(data || {
        profile: {},
        products: [],
        marketplaceOrders: [],
        purchaseRequests: [],
        projects: [],
      }), products: marketplaceResult.data?.products || [], marketplaceOrders: marketplaceResult.data?.marketplaceOrders || [] });
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
      } catch (caughtError) {
        if (active) {
          setErrorMessage(caughtError?.message || "تعذر فتح حساب المورد.");
          setStep("email");
        }
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (productImagePreview.startsWith("blob:")) URL.revokeObjectURL(productImagePreview);
  }, [productImagePreview]);

  async function sendCode(event) {
    event.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      setErrorMessage("");
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.includes("@")) throw new Error("أدخل بريدًا إلكترونيًا صحيحًا.");
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setEmail(normalizedEmail);
      setOtp("");
      setStep("otp");
    } catch (caughtError) {
      setErrorMessage(caughtError?.message || "تعذر إرسال رمز الدخول.");
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
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: normalizeOtp(otp),
        type: "email",
      });
      if (error) throw error;
      if (!data?.session) throw new Error("لم تُنشأ جلسة دخول صالحة.");
      localStorage.setItem("nm_supplier_session_started_at", String(Date.now()));
      await loadPortal();
    } catch (caughtError) {
      setErrorMessage(caughtError?.message || "تعذر التحقق من الرمز.");
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

  function resetProductForm() {
    if (productImagePreview.startsWith("blob:")) URL.revokeObjectURL(productImagePreview);
    setProductForm(EMPTY_PRODUCT);
    setProductImageFile(null);
    setProductImagePreview("");
    setFileInputKey((value) => value + 1);
  }

  function editProduct(product) {
    resetProductForm();
    setProductForm({
      id: product.id,
      productName: product.productName || "",
      description: product.description || "",
      price: product.price ?? "",
      unitCode: product.unitCode || "piece",
      categoryCode: product.categoryCode || "other",
      marketplaceSection: product.marketplaceSection || "construction",
      imagePath: product.imagePath || "",
    });
    setProductImagePreview(getSupplierProductImageUrl(product.imagePath));
    setTimeout(() => document.getElementById("supplier-product-form")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function selectProductImage(event) {
    const file = event.target.files?.[0] || null;
    if (productImagePreview.startsWith("blob:")) URL.revokeObjectURL(productImagePreview);
    setProductImageFile(file);
    setProductImagePreview(file ? URL.createObjectURL(file) : getSupplierProductImageUrl(productForm.imagePath));
  }

  async function submitProduct(event) {
    event.preventDefault();
    if (productSaving) return;
    if (!productImageFile && !productForm.imagePath) {
      setErrorMessage("اختر صورة واضحة للمنتج.");
      return;
    }

    try {
      setProductSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      await saveSupplierMarketplaceProduct(productForm, productImageFile);
      const wasEditing = Boolean(productForm.id);
      resetProductForm();
      await loadPortal();
      setSuccessMessage(wasEditing ? "تم تحديث المنتج ونشره في السوق." : "تمت إضافة المنتج إلى السوق.");
    } catch (caughtError) {
      setErrorMessage(getMarketplaceErrorMessage(caughtError, "تعذر حفظ المنتج."));
    } finally {
      setProductSaving(false);
    }
  }

  async function archiveProduct(product) {
    if (!window.confirm(`هل تريد إيقاف ظهور «${product.productName}» في السوق؟`)) return;
    try {
      setErrorMessage("");
      setSuccessMessage("");
      await archiveSupplierMarketplaceProduct(product.id);
      await loadPortal();
      setSuccessMessage("تم إيقاف ظهور المنتج. بقيت بيانات الطلبات السابقة محفوظة.");
    } catch (caughtError) {
      setErrorMessage(getMarketplaceErrorMessage(caughtError, "تعذر إيقاف المنتج."));
    }
  }

  async function updateOrderStatus(orderId, status) {
    if (orderUpdatingId) return;
    try {
      setOrderUpdatingId(orderId);
      setErrorMessage("");
      setSuccessMessage("");
      await updateSupplierMarketplaceOrderStatus(orderId, status);
      await loadPortal();
      setSuccessMessage("تم تحديث حالة الطلب.");
    } catch (caughtError) {
      setErrorMessage(getMarketplaceErrorMessage(caughtError, "تعذر تحديث حالة الطلب."));
    } finally {
      setOrderUpdatingId("");
    }
  }

  const shell = { minHeight: "100vh", background: "#f5f3ee", direction: "rtl", padding: "24px 16px 60px", color: "#173f36" };
  const card = { background: "#fff", border: "1px solid #e3e0d7", borderRadius: 18, padding: 20 };
  const input = { minHeight: 46, border: "1px solid #d1d5db", borderRadius: 10, padding: "0 12px", font: "inherit" };

  if (step === "checking") return <main style={shell}><section style={{ ...card, maxWidth: 520, margin: "70px auto" }}>جاري التحقق من حساب المورد...</section></main>;

  if (step === "email" || step === "otp") {
    return (
      <main style={shell}>
        <section style={{ ...card, maxWidth: 520, margin: "50px auto", display: "grid", gap: 14 }}>
          <button type="button" onClick={() => { window.location.href = "/"; }}>العودة</button>
          <h1>دخول المورد</h1>
          {errorMessage && <p style={{ color: "#991b1b" }}>{errorMessage}</p>}
          {step === "email" ? (
            <form onSubmit={sendCode} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}><strong>البريد الإلكتروني</strong><input style={input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <button type="submit" disabled={loading}>إرسال رمز الدخول</button>
            </form>
          ) : (
            <form onSubmit={verifyCode} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}><strong>رمز الدخول من 8 أرقام</strong><input style={input} inputMode="numeric" maxLength={8} value={otp} onChange={(event) => setOtp(normalizeOtp(event.target.value))} required /></label>
              <button type="submit" disabled={loading || normalizeOtp(otp).length !== 8}>دخول</button>
              <button type="button" onClick={() => setStep("email")}>تغيير البريد</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  if (step === "pending") {
    const labels = { under_review: "طلبك تحت مراجعة الإدارة", needs_completion: "طلبك يحتاج استكمال", rejected: "تم رفض الطلب", approved: "تم قبول الطلب" };
    return (
      <main style={shell}>
        <section style={{ ...card, maxWidth: 650, margin: "40px auto", display: "grid", gap: 12 }}>
          <h1>حساب المورد</h1><strong>{labels[application?.status] || "لم يتم اعتماد الحساب بعد"}</strong>
          {application?.adminNote && <p>ملاحظة الإدارة: {application.adminNote}</p>}
          <section style={{ border: "1px solid #d7c58f", background: "#fffbeb", borderRadius: 14, padding: 15 }}>
            <strong>تعهّد عمولة المنصة: {SUPPLIER_PLATFORM_FEE_PERCENT}٪</strong><p style={{ lineHeight: 1.8 }}>{SUPPLIER_PLATFORM_FEE_TERMS_TEXT}</p><div><strong>الآيبان: </strong><code dir="ltr">{SUPPLIER_PLATFORM_FEE_IBAN_DISPLAY}</code></div>{application?.platformFeeAcceptedAt && <small style={{ display: "block", marginTop: 9 }}>تم القبول: {formatDate(application.platformFeeAcceptedAt)}</small>}
          </section>
          <p>بعد قبول الإدارة سيُفتح لك حساب المورد من نفس البريد.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => { window.location.href = "/supplier/application"; }}>فتح طلب التسجيل</button><button type="button" onClick={signOut}>تسجيل الخروج</button></div>
        </section>
      </main>
    );
  }

  const purchaseRequests = Array.isArray(dashboard?.purchaseRequests) ? dashboard.purchaseRequests : [];
  const marketplaceOrders = Array.isArray(dashboard?.marketplaceOrders) ? dashboard.marketplaceOrders : [];
  const projects = Array.isArray(dashboard?.projects) ? dashboard.projects : [];
  const products = Array.isArray(dashboard?.products) ? dashboard.products : [];
  const activeProductCategories = getProductCategoriesForSection(productForm.marketplaceSection);

  return (
    <main style={shell} className="supplier-portal">
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div><p style={{ margin: 0 }}>نايف المزيني للبناء الذاتي</p><h1 style={{ margin: "5px 0 0" }}>{dashboard?.profile?.organizationName || "حساب المورد"}</h1></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => document.getElementById("supplier-products")?.scrollIntoView({ behavior: "smooth" })}>📦 منتجاتي</button><button type="button" onClick={() => document.getElementById("supplier-orders")?.scrollIntoView({ behavior: "smooth" })}>🛒 طلبات المتجر</button><button type="button" onClick={() => document.getElementById("supplier-account")?.scrollIntoView({ behavior: "smooth" })}>👤 حسابي</button><button type="button" onClick={signOut}>تسجيل الخروج</button></div>
        </header>

        {errorMessage && <div className="supplier-portal-alert error" role="alert">{errorMessage}</div>}
        {successMessage && <div className="supplier-portal-alert success" role="status">{successMessage}</div>}

        <section style={{ ...card, borderColor: "#d7c58f", background: "#fffbeb" }}><h2 style={{ marginTop: 0 }}>عمولة المنصة</h2><p style={{ lineHeight: 1.8 }}>{SUPPLIER_PLATFORM_FEE_TERMS_TEXT}</p><div><strong>آيبان حساب المنصة: </strong><code dir="ltr">{SUPPLIER_PLATFORM_FEE_IBAN_DISPLAY}</code></div><p style={{ marginBottom: 0 }}>لا تحسب المنصة مبلغ العمولة تلقائيًا لأن قيمة التعاقد لا تمر عبرها، ولا يؤدي عدم تسجيل مبلغ آلي إلى إخفاء حسابك أو إيقاف ظهوره للعملاء.</p></section>

        <section id="supplier-orders" style={card}>
          <div className="supplier-section-heading"><div><small>الطلبات الناتجة عن سلة السوق</small><h2>طلبات المتجر</h2></div><strong>{marketplaceOrders.length}</strong></div>
          {marketplaceOrders.length === 0 ? <p>لا توجد طلبات من سوق المواد حاليًا.</p> : (
            <div className="supplier-market-orders">
              {marketplaceOrders.map((order) => {
                const nextAction = MARKETPLACE_ORDER_NEXT_ACTIONS[order.status];
                const canCancel = ["submitted", "contacted", "confirmed", "preparing"].includes(order.status);
                return (
                  <article key={order.id}>
                    <header><div><strong>{order.orderNumber}</strong><small>{formatDate(order.submittedAt)}</small></div><span data-status={order.status}>{MARKETPLACE_ORDER_STATUSES[order.status] || order.status}</span></header>
                    <div className="supplier-order-market-label">{order.marketplaceSection === "home" ? "متجر المنزل" : "مواد البناء"}</div>
                    <div className="supplier-buyer-details"><div><small>المشتري</small><strong>{order.buyerName}</strong><a dir="ltr" href={`tel:${order.buyerMobile}`}>{order.buyerMobile}</a>{order.buyerEmail && <a dir="ltr" href={`mailto:${order.buyerEmail}`}>{order.buyerEmail}</a>}</div><div><small>عنوان التسليم</small><strong>{order.deliveryAddress}</strong>{order.deliveryMapsUrl && <a href={order.deliveryMapsUrl} target="_blank" rel="noreferrer">فتح الموقع على الخريطة</a>}</div></div>
                    {order.buyerNote && <p className="supplier-buyer-note"><strong>ملاحظة المشتري:</strong> {order.buyerNote}</p>}
                    <div className="supplier-order-lines">{(order.items || []).map((item) => <div key={item.id}><img src={getSupplierProductImageUrl(item.imagePath)} alt="" /><span><strong>{item.productName}</strong><small>{formatMarketplaceQuantity(item.quantity)} {getSupplierUnitLabel(item.unitCode)} × {formatMarketplaceMoney(item.unitPrice)}</small></span><b>{formatMarketplaceMoney(item.lineTotal)}</b></div>)}</div>
                    <footer><div><span>إجمالي الطلب</span><strong>{formatMarketplaceMoney(order.subtotal)}</strong></div><div>{nextAction && <button type="button" disabled={orderUpdatingId === order.id} onClick={() => updateOrderStatus(order.id, nextAction.status)}>{nextAction.label}</button>}{canCancel && <button className="danger" type="button" disabled={orderUpdatingId === order.id} onClick={() => updateOrderStatus(order.id, "cancelled")}>إلغاء الطلب</button>}</div></footer>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section id="supplier-products" style={card}>
          <div className="supplier-section-heading"><div><small>تظهر المنتجات المكتملة فقط للمتسوقين</small><h2>منتجاتي في السوق</h2></div><strong>{products.filter((product) => product.isActive && product.price > 0 && product.unitCode && product.categoryCode && product.imagePath).length}</strong></div>
          <form id="supplier-product-form" className="supplier-product-form" onSubmit={submitProduct}>
            <div className="supplier-product-image-field"><label htmlFor="supplier-product-image">{productImagePreview ? <img src={productImagePreview} alt="معاينة المنتج" /> : <span>📷<strong>إضافة صورة مربعة</strong><small>JPG أو PNG أو WebP — حتى 5 MB</small></span>}</label><input key={fileInputKey} id="supplier-product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectProductImage} disabled={productSaving} /></div>
            <div className="supplier-product-fields">
              <label><span>اسم المنتج</span><input value={productForm.productName} onChange={(event) => setProductForm({ ...productForm, productName: event.target.value })} required minLength={2} disabled={productSaving} /></label>
              <label><span>السوق</span><select value={productForm.marketplaceSection} onChange={(event) => { const marketplaceSection = event.target.value; const categories = getProductCategoriesForSection(marketplaceSection); setProductForm({ ...productForm, marketplaceSection, categoryCode: categories[0].value }); }} disabled={productSaving}>{MARKETPLACE_SECTIONS.map((section) => <option key={section.value} value={section.value}>{section.label}</option>)}</select></label>
              <label><span>القسم</span><select value={productForm.categoryCode} onChange={(event) => setProductForm({ ...productForm, categoryCode: event.target.value })} disabled={productSaving}>{activeProductCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
              <label><span>السعر بالوحدة (ريال)</span><input type="number" min="0.01" max="9999999999.99" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} required disabled={productSaving} /></label>
              <label><span>وحدة البيع</span><select value={productForm.unitCode} onChange={(event) => setProductForm({ ...productForm, unitCode: event.target.value })} disabled={productSaving}>{SUPPLIER_PRODUCT_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></label>
              <label className="wide"><span>وصف مختصر <small>اختياري</small></span><textarea rows="3" maxLength={3000} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} disabled={productSaving} /></label>
              <div className="supplier-product-form-actions wide"><button type="submit" disabled={productSaving}>{productSaving ? "جاري الحفظ..." : productForm.id ? "حفظ ونشر التعديل" : "إضافة المنتج للسوق"}</button>{productForm.id && <button className="secondary" type="button" onClick={resetProductForm} disabled={productSaving}>إلغاء التعديل</button>}</div>
            </div>
          </form>

          {products.length === 0 ? <p>لا توجد منتجات مسجلة.</p> : (
            <div className="supplier-product-grid">
              {products.map((product) => {
                const complete = product.price > 0 && product.unitCode && product.categoryCode && product.imagePath;
                return (
                  <article key={product.id} className={!product.isActive || !complete ? "muted" : ""}>
                    <div className="supplier-product-card-image">{product.imagePath ? <img src={getSupplierProductImageUrl(product.imagePath)} alt={product.productName} /> : <span>لا توجد صورة</span>}</div>
                    <div><small>{product.marketplaceSection === "home" ? "متجر المنزل" : "مواد البناء"} · {complete ? getSupplierCategoryLabel(product.categoryCode) : "منتج يحتاج استكمال"}</small><h3>{product.productName}</h3>{product.price > 0 && <p><strong>{formatMarketplaceMoney(product.price)}</strong> / {getSupplierUnitLabel(product.unitCode)}</p>}<span className="supplier-product-state">{product.isActive && complete ? "ظاهر في السوق" : product.isActive ? "غير ظاهر حتى استكماله" : "متوقف"}</span><div className="supplier-product-actions"><button type="button" onClick={() => editProduct(product)}>تعديل{!product.isActive ? " وإعادة نشر" : ""}</button>{product.isActive && complete && <button className="danger" type="button" onClick={() => archiveProduct(product)}>إيقاف الظهور</button>}</div></div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section style={card}><h2 style={{ marginTop: 0 }}>طلبات شراء مرتبطة بالمشاريع</h2><p className="supplier-section-note">هذا المسار القديم مخصص لطلبات المشاريع، وهو منفصل عن طلبات سلة المتجر أعلاه.</p>{purchaseRequests.length === 0 ? <p>لا توجد طلبات شراء مرتبطة بمشروع حاليًا.</p> : <div style={{ display: "grid", gap: 10 }}>{purchaseRequests.map((request) => <article key={request.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}><strong>{request.productName}</strong>{request.requestText && <p>{request.requestText}</p>}{request.requestedQuantity && <p>الكمية: {request.requestedQuantity}</p>}<small>{formatDate(request.createdAt)}</small></article>)}</div>}</section>

        <section style={card}><h2 style={{ marginTop: 0 }}>المشاريع التي أعمل عليها</h2>{projects.length === 0 ? <p>لا توجد مشاريع مرتبطة بالمورد حاليًا.</p> : <div style={{ display: "grid", gap: 10 }}>{projects.map((project) => <article key={project.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}><strong>المشروع</strong><div dir="ltr">{project.projectId}</div><small>بدأ: {formatDate(project.startedAt)}</small></article>)}</div>}</section>

        <section id="supplier-account" style={card}><h2 style={{ marginTop: 0 }}>حسابي</h2><dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}><div><dt>اسم المؤسسة</dt><dd>{dashboard?.profile?.organizationName}</dd></div><div><dt>السجل التجاري</dt><dd>{dashboard?.profile?.commercialRegistrationNumber}</dd></div><div><dt>الجوال</dt><dd>{dashboard?.profile?.mobileNumber}</dd></div><div><dt>الموقع</dt><dd><a href={dashboard?.profile?.mapsUrl} target="_blank" rel="noreferrer">فتح Google Maps</a></dd></div></dl></section>
      </div>
    </main>
  );
}
