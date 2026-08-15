import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  History,
  Home,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase.js";
import {
  checkoutSupplierMarketplace,
  getHomeMarketplaceCatalog,
  getMySupplierMarketplaceOrders,
} from "../services/supplierMarketplaceService.js";
import {
  sendCustomerLoginCode,
  verifyCustomerLoginCode,
} from "../services/customerAccountAuthService.js";
import {
  HOME_PRODUCT_CATEGORIES,
  MARKETPLACE_ORDER_STATUSES,
  formatMarketplaceMoney,
  formatMarketplaceQuantity,
  getMarketplaceErrorMessage,
  getSupplierProductImageUrl,
  getSupplierUnitLabel,
  isDiscreteSupplierUnit,
} from "../utils/supplierMarketplace.js";
import "./SupplierMarketplacePage.css";

const EMPTY_CHECKOUT = {
  buyerName: "",
  buyerEmail: "",
  buyerMobile: "",
  deliveryAddress: "",
  deliveryMapsUrl: "",
  buyerNote: "",
};

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem("nm_home_marketplace_cart_v1") || "[]");
    return Array.isArray(value)
      ? value.filter((item) => typeof item?.productId === "string" && Number(item.quantity) > 0).slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function HomeMarketplacePage() {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState(readCart);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [view, setView] = useState("catalog");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState("details");
  const [checkoutForm, setCheckoutForm] = useState(EMPTY_CHECKOUT);
  const [otp, setOtp] = useState("");
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadOrders(activeSession = session) {
    if (!activeSession) {
      setOrders([]);
      return;
    }
    setOrders(await getMySupplierMarketplaceOrders("home"));
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const [{ data: sessionData, error: sessionError }, catalog] = await Promise.all([
          supabase.auth.getSession(),
          getHomeMarketplaceCatalog(),
        ]);
        if (sessionError) throw sessionError;
        if (!active) return;
        const activeSession = sessionData?.session || null;
        setSession(activeSession);
        setProducts(Array.isArray(catalog?.products) ? catalog.products : []);
        setCheckoutForm((current) => ({
          ...current,
          buyerEmail: current.buyerEmail || activeSession?.user?.email || "",
        }));
        if (activeSession) await loadOrders(activeSession);
      } catch (error) {
        if (active) setErrorMessage(getMarketplaceErrorMessage(error, "تعذر فتح متجر المنزل."));
      } finally {
        if (active) setLoading(false);
      }
    }
    initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem("nm_home_marketplace_cart_v1", JSON.stringify(cart));
  }, [cart]);

  const filteredProducts = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return products.filter((product) => (
      (activeCategory === "all" || product.categoryCode === activeCategory)
      && (!query || [product.productName, product.description, product.supplierName]
        .some((value) => String(value || "").toLowerCase().includes(query)))
    ));
  }, [activeCategory, products, searchText]);

  const cartLines = useMemo(() => cart.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? { ...item, product } : null;
  }).filter(Boolean), [cart, products]);

  const cartTotal = useMemo(() => cartLines.reduce(
    (total, line) => total + Number(line.product.price) * Number(line.quantity), 0
  ), [cartLines]);

  function addToCart(product) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      return existing
        ? current.map((item) => item.productId === product.id ? { ...item, quantity: Number(item.quantity) + 1 } : item)
        : [...current, { productId: product.id, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function updateQuantity(product, rawValue) {
    const numericValue = Number(rawValue);
    const quantity = isDiscreteSupplierUnit(product.unitCode)
      ? Math.max(1, Math.round(numericValue || 1))
      : Math.max(0.001, Math.round((numericValue || 0.001) * 1000) / 1000);
    setCart((current) => current.map((item) => item.productId === product.id ? { ...item, quantity } : item));
  }

  async function placeOrder() {
    const result = await checkoutSupplierMarketplace({ ...checkoutForm, items: cartLines, marketplaceSection: "home" });
    const { data } = await supabase.auth.getSession();
    setSession(data?.session || null);
    setCheckoutResult(result);
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    setCheckoutStep("details");
    setOtp("");
    await loadOrders(data?.session || null);
    setView("orders");
  }

  async function submitCheckoutDetails(event) {
    event.preventDefault();
    if (submitting || cartLines.length === 0) return;
    try {
      setSubmitting(true);
      setErrorMessage("");
      const normalizedEmail = checkoutForm.buyerEmail.trim().toLowerCase();
      if (session) {
        if (normalizedEmail !== String(session.user?.email || "").toLowerCase()) {
          throw new Error("استخدم بريد الحساب المسجل، أو سجّل الخروج للدخول ببريد آخر.");
        }
        await placeOrder();
      } else {
        const result = await sendCustomerLoginCode(normalizedEmail);
        setCheckoutForm((current) => ({ ...current, buyerEmail: result.email }));
        setCheckoutStep("otp");
      }
    } catch (error) {
      setErrorMessage(getMarketplaceErrorMessage(error, "تعذر متابعة إتمام الطلب."));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp(event) {
    event.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      setErrorMessage("");
      const result = await verifyCustomerLoginCode(checkoutForm.buyerEmail, otp);
      setSession(result.session);
      await placeOrder();
    } catch (error) {
      setErrorMessage(getMarketplaceErrorMessage(error, "تعذر التحقق من رمز الدخول."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="marketplace-state" dir="rtl"><Home size={38} /><strong>جاري تجهيز متجر المنزل...</strong></main>;
  }

  return (
    <main className="supplier-marketplace home-marketplace" dir="rtl">
      <header className="marketplace-header">
        <div className="marketplace-header-inner">
          <a className="marketplace-back" href="/" aria-label="العودة للرئيسية"><ArrowRight size={21} /></a>
          <div className="marketplace-brand"><span><Home size={24} /></span><div><strong>متجر المنزل</strong><small>عدد وأدوات لصيانة منزلك واستخدامك اليومي</small></div></div>
          <a className="marketplace-account-link" href="/customer/projects"><UserRound size={19} />{session ? "حسابي" : "دخول"}</a>
          <button className="marketplace-cart-button" type="button" onClick={() => setCartOpen(true)}><ShoppingCart size={21} /><span>السلة</span>{cartLines.length > 0 && <b>{cartLines.length}</b>}</button>
        </div>
      </header>

      <nav className="marketplace-view-tabs" aria-label="أقسام متجر المنزل">
        <button className={view === "catalog" ? "active" : ""} type="button" onClick={() => setView("catalog")}><Home size={18} /> المنتجات</button>
        <button className={view === "orders" ? "active" : ""} type="button" onClick={() => setView("orders")}><History size={18} /> مشترياتي</button>
      </nav>

      {errorMessage && <div className="marketplace-alert" role="alert">{errorMessage}<button type="button" onClick={() => setErrorMessage("")} aria-label="إغلاق"><X size={17} /></button></div>}
      {checkoutResult && <section className="marketplace-success" role="status"><PackageCheck size={28} /><div><strong>تم إرسال {checkoutResult.orderCount} {checkoutResult.orderCount === 1 ? "طلب" : "طلبات"}</strong><p>سيتواصل كل تاجر معك لتأكيد التوفر والدفع والتسليم.</p></div><button type="button" onClick={() => setCheckoutResult(null)}><X size={18} /></button></section>}

      {view === "catalog" ? (
        <div className="marketplace-content">
          <section className="marketplace-hero home-marketplace-hero"><div><span>التصفح متاح للجميع</span><h1>أدوات منزلك في مكان واحد</h1><p>أكمل السلة، وثّق بريدك، ثم يتواصل معك التاجر لإتمام الدفع والتسليم.</p></div><div className="marketplace-search"><Search size={20} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="ابحث عن دريل، مطرقة، مفتاح..." /></div></section>
          <div className="marketplace-categories"><button type="button" className={activeCategory === "all" ? "active" : ""} onClick={() => setActiveCategory("all")}><span>🏠</span>الكل</button>{HOME_PRODUCT_CATEGORIES.map((category) => <button key={category.value} type="button" className={activeCategory === category.value ? "active" : ""} onClick={() => setActiveCategory(category.value)}><span>{category.icon}</span>{category.label}</button>)}</div>
          {filteredProducts.length === 0 ? <section className="marketplace-empty"><Home size={38} /><h2>لا توجد منتجات منزلية حاليًا</h2><p>ستظهر هنا المنتجات التي يضيفها الموردون إلى قسم المنزل.</p></section> : (
            <section className="marketplace-product-grid">{filteredProducts.map((product) => {
              const inCart = cart.find((item) => item.productId === product.id);
              return <article className="marketplace-product-card" key={product.id}><div className="marketplace-product-image-wrap"><img src={getSupplierProductImageUrl(product.imagePath)} alt={product.productName} loading="lazy" /></div><div className="marketplace-product-body"><small>{product.supplierName}</small><h2>{product.productName}</h2><div className="marketplace-product-price"><strong>{formatMarketplaceMoney(product.price)}</strong><span>/ {getSupplierUnitLabel(product.unitCode, product.customUnitLabel)}</span></div><button type="button" onClick={() => addToCart(product)}><ShoppingCart size={17} />{inCart ? `إضافة أخرى (${formatMarketplaceQuantity(inCart.quantity)})` : "أضف للسلة"}</button></div></article>;
            })}</section>
          )}
        </div>
      ) : (
        <section className="marketplace-orders marketplace-content"><header><div><span>حساب العميل</span><h1>مشترياتي</h1></div><button type="button" onClick={() => setView("catalog")}>متابعة التسوق</button></header>
          {!session ? <div className="marketplace-empty"><UserRound size={38} /><h2>سجّل الدخول لعرض مشترياتك</h2><p>استخدم البريد نفسه الذي أدخلته عند إتمام الطلب.</p><a className="marketplace-inline-link" href="/customer/account-login">دخول العميل</a></div> : orders.length === 0 ? <div className="marketplace-empty"><History size={38} /><h2>لا توجد مشتريات بعد</h2></div> : orders.map((order) => <article className="marketplace-order-card" key={order.id}><header><div><strong>{order.orderNumber}</strong><small>{formatDate(order.submittedAt)}</small></div><span data-status={order.status}>{MARKETPLACE_ORDER_STATUSES[order.status] || order.status}</span></header><div className="marketplace-order-supplier"><strong>{order.supplierName}</strong><a href={`tel:${order.supplierMobile}`}>{order.supplierMobile}</a></div><div className="marketplace-order-items">{(order.items || []).map((item) => <div key={item.id}><img src={getSupplierProductImageUrl(item.imagePath)} alt="" /><span><strong>{item.productName}</strong><small>{formatMarketplaceQuantity(item.quantity)} {getSupplierUnitLabel(item.unitCode, item.customUnitLabel)} × {formatMarketplaceMoney(item.unitPrice)}</small></span><b>{formatMarketplaceMoney(item.lineTotal)}</b></div>)}</div><footer><span>الإجمالي</span><strong>{formatMarketplaceMoney(order.subtotal)}</strong></footer></article>)}
        </section>
      )}

      <button className="marketplace-mobile-cart" type="button" onClick={() => setCartOpen(true)}><ShoppingCart size={22} /><span>السلة ({cartLines.length})</span><strong>{formatMarketplaceMoney(cartTotal)}</strong></button>
      {cartOpen && <button className="marketplace-drawer-backdrop" aria-label="إغلاق السلة" onClick={() => setCartOpen(false)} />}
      <aside className={`marketplace-cart-drawer ${cartOpen ? "open" : ""}`} aria-hidden={!cartOpen}><header><div><ShoppingCart size={23} /><strong>سلة المنزل</strong></div><button type="button" onClick={() => setCartOpen(false)}><X size={22} /></button></header>{cartLines.length === 0 ? <div className="marketplace-cart-empty"><ShoppingCart size={42} /><strong>السلة فارغة</strong><span>أضف الأدوات التي تحتاجها.</span></div> : <><div className="marketplace-cart-lines">{cartLines.map((line) => <article key={line.product.id}><img src={getSupplierProductImageUrl(line.product.imagePath)} alt={line.product.productName} /><div><strong>{line.product.productName}</strong><small>{line.product.supplierName}</small><span>{formatMarketplaceMoney(line.product.price)} / {getSupplierUnitLabel(line.product.unitCode, line.product.customUnitLabel)}</span><div className="marketplace-quantity"><button type="button" onClick={() => updateQuantity(line.product, Number(line.quantity) - (isDiscreteSupplierUnit(line.product.unitCode) ? 1 : .1))}><Minus size={15} /></button><input type="number" min="1" value={line.quantity} onChange={(event) => updateQuantity(line.product, event.target.value)} /><button type="button" onClick={() => updateQuantity(line.product, Number(line.quantity) + (isDiscreteSupplierUnit(line.product.unitCode) ? 1 : .1))}><Plus size={15} /></button></div></div><button className="marketplace-remove-line" type="button" onClick={() => setCart((current) => current.filter((item) => item.productId !== line.product.id))}><X size={18} /></button></article>)}</div><footer className="marketplace-cart-footer"><p><span>الإجمالي التقديري</span><strong>{formatMarketplaceMoney(cartTotal)}</strong></p><small>إذا تعدد التجار، ستُقسم السلة إلى طلب مستقل لكل تاجر.</small><button type="button" onClick={() => { setCheckoutOpen(true); setCheckoutStep("details"); }}>إتمام الطلب</button></footer></>}</aside>

      {checkoutOpen && <div className="marketplace-checkout-modal" role="dialog" aria-modal="true"><button className="marketplace-drawer-backdrop" aria-label="إغلاق" onClick={() => !submitting && setCheckoutOpen(false)} />
        {checkoutStep === "details" ? <form onSubmit={submitCheckoutDetails}><header><div><small>لا يوجد دفع إلكتروني داخل المنصة</small><h2>بيانات العميل والتسليم</h2></div><button type="button" onClick={() => setCheckoutOpen(false)}><X size={21} /></button></header><label><span>الاسم</span><input value={checkoutForm.buyerName} onChange={(event) => setCheckoutForm({ ...checkoutForm, buyerName: event.target.value })} required minLength={2} /></label><label><span>البريد الإلكتروني</span><input dir="ltr" type="email" value={checkoutForm.buyerEmail} onChange={(event) => setCheckoutForm({ ...checkoutForm, buyerEmail: event.target.value })} required readOnly={Boolean(session)} /></label><label><span>رقم الجوال</span><input dir="ltr" inputMode="tel" value={checkoutForm.buyerMobile} onChange={(event) => setCheckoutForm({ ...checkoutForm, buyerMobile: event.target.value.replace(/\D/g, "").slice(0, 10) })} required pattern="05[0-9]{8}" placeholder="05xxxxxxxx" /></label><label><span>عنوان المنزل للتسليم</span><textarea rows="3" value={checkoutForm.deliveryAddress} onChange={(event) => setCheckoutForm({ ...checkoutForm, deliveryAddress: event.target.value })} required minLength={3} placeholder="المدينة، الحي، الشارع، رقم المبنى" /></label><label><span>رابط موقع المنزل <small>اختياري</small></span><input dir="ltr" type="url" value={checkoutForm.deliveryMapsUrl} onChange={(event) => setCheckoutForm({ ...checkoutForm, deliveryMapsUrl: event.target.value })} placeholder="https://maps.google.com/..." /></label><label><span>ملاحظة للتاجر <small>اختياري</small></span><textarea rows="2" maxLength={2000} value={checkoutForm.buyerNote} onChange={(event) => setCheckoutForm({ ...checkoutForm, buyerNote: event.target.value })} /></label><div className="marketplace-checkout-summary"><span>{cartLines.length} منتجات</span><strong>{formatMarketplaceMoney(cartTotal)}</strong></div><button className="marketplace-submit-order" type="submit" disabled={submitting}>{submitting ? "جاري المتابعة..." : session ? "تأكيد وإرسال الطلب" : "إرسال رمز التحقق للبريد"}</button><p>لن يُنشأ الطلب قبل توثيق البريد الإلكتروني، ثم يتواصل التاجر معك للدفع والتسليم.</p></form> : <form onSubmit={submitOtp}><header><div><small>تأكيد حساب العميل</small><h2>أدخل رمز البريد</h2></div><button type="button" onClick={() => setCheckoutStep("details")}><X size={21} /></button></header><p className="home-marketplace-otp-copy">أرسلنا رمزًا من 8 أرقام إلى <strong dir="ltr">{checkoutForm.buyerEmail}</strong></p><label><span>رمز الدخول</span><input className="home-marketplace-otp" dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} required minLength={8} maxLength={8} /></label><button className="marketplace-submit-order" type="submit" disabled={submitting || otp.length !== 8}>{submitting ? "جاري التحقق وإرسال الطلب..." : "تحقق وأرسل الطلب"}</button><button className="marketplace-checkout-back" type="button" onClick={() => setCheckoutStep("details")} disabled={submitting}>تعديل البيانات</button></form>}
      </div>}
    </main>
  );
}
