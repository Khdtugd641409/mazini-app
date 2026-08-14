import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  History,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase.js";
import {
  checkoutSupplierMarketplace,
  getMySupplierMarketplaceOrders,
  getSupplierMarketplaceCatalog,
} from "../services/supplierMarketplaceService.js";
import {
  MARKETPLACE_ORDER_STATUSES,
  SUPPLIER_PRODUCT_CATEGORIES,
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
  buyerMobile: "",
  deliveryAddress: "",
  deliveryMapsUrl: "",
  buyerNote: "",
};

function parseStoredCart(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.productId === "string" && Number(item.quantity) > 0)
      .slice(0, 50)
      .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }));
  } catch {
    return [];
  }
}

function getAccountPath(role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "supervisor") return "/supervisor";
  return "/customer/projects";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SupplierMarketplacePage() {
  const [sessionUserId, setSessionUserId] = useState("");
  const [actor, setActor] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [view, setView] = useState("catalog");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState(EMPTY_CHECKOUT);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authState, setAuthState] = useState("checking");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadMarketplace() {
    const [catalog, buyerOrders] = await Promise.all([
      getSupplierMarketplaceCatalog(),
      getMySupplierMarketplaceOrders(),
    ]);
    const nextProducts = Array.isArray(catalog?.products) ? catalog.products : [];
    setActor(catalog?.actor || null);
    setProducts(nextProducts);
    setOrders(buyerOrders);
    setCheckoutForm((current) => ({
      ...current,
      buyerName: current.buyerName || catalog?.actor?.name || "",
      buyerMobile: current.buyerMobile || catalog?.actor?.mobile || "",
    }));
    setCart((current) => current.filter((item) => nextProducts.some((product) => product.id === item.productId)));
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setLoading(true);
        setErrorMessage("");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const userId = data?.session?.user?.id;
        if (!userId) {
          if (active) setAuthState("signed_out");
          return;
        }

        if (!active) return;
        setSessionUserId(userId);
        setCart(parseStoredCart(localStorage.getItem(`nm_supplier_marketplace_cart_v1:${userId}`)));
        setCartHydrated(true);
        await loadMarketplace();
        if (active) setAuthState("ready");
      } catch (error) {
        if (!active) return;
        const message = getMarketplaceErrorMessage(error, "تعذر فتح سوق مواد البناء.");
        setErrorMessage(message);
        setAuthState(String(error?.message || "").includes("MARKETPLACE_BUYER_AUTHORIZATION_REQUIRED") ? "unauthorized" : "error");
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionUserId || !cartHydrated) return;
    localStorage.setItem(`nm_supplier_marketplace_cart_v1:${sessionUserId}`, JSON.stringify(cart));
  }, [cart, cartHydrated, sessionUserId]);

  const filteredProducts = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategory === "all" || product.categoryCode === activeCategory;
      const matchesSearch = !query || [product.productName, product.description, product.supplierName]
        .some((value) => String(value || "").toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, searchText]);

  const cartLines = useMemo(() => cart
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return product ? { ...item, product } : null;
    })
    .filter(Boolean), [cart, products]);

  const cartTotal = useMemo(() => cartLines.reduce(
    (total, line) => total + Number(line.product.price) * Number(line.quantity),
    0
  ), [cartLines]);

  const cartCount = cartLines.length;

  function addToCart(product) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) => item.productId === product.id
          ? { ...item, quantity: Number(item.quantity) + 1 }
          : item);
      }
      return [...current, { productId: product.id, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function updateQuantity(product, rawValue) {
    const numericValue = Number(rawValue);
    const quantity = isDiscreteSupplierUnit(product.unitCode)
      ? Math.max(1, Math.round(numericValue || 1))
      : Math.max(0.001, Math.round((numericValue || 0.001) * 1000) / 1000);
    setCart((current) => current.map((item) => item.productId === product.id
      ? { ...item, quantity }
      : item));
  }

  function changeQuantity(product, direction) {
    const line = cart.find((item) => item.productId === product.id);
    const step = isDiscreteSupplierUnit(product.unitCode) ? 1 : 0.1;
    updateQuantity(product, Number(line?.quantity || 0) + direction * step);
  }

  function removeFromCart(productId) {
    setCart((current) => current.filter((item) => item.productId !== productId));
  }

  async function submitCheckout(event) {
    event.preventDefault();
    if (submitting || cartLines.length === 0) return;
    try {
      setSubmitting(true);
      setErrorMessage("");
      const result = await checkoutSupplierMarketplace({
        ...checkoutForm,
        items: cartLines,
      });
      setCheckoutResult(result);
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      await loadMarketplace();
      setView("orders");
    } catch (error) {
      setErrorMessage(getMarketplaceErrorMessage(error, "تعذر إرسال الطلب."));
    } finally {
      setSubmitting(false);
    }
  }

  if (authState === "checking" || loading) {
    return <main className="marketplace-state" dir="rtl"><Store size={34} /><strong>جاري تجهيز السوق...</strong></main>;
  }

  if (authState === "signed_out") {
    return (
      <main className="marketplace-state" dir="rtl">
        <Store size={44} />
        <h1>سوق مواد البناء</h1>
        <p>سجّل الدخول بحساب العميل أو المشرف أو إدارة المنصة للتسوق وإرسال الطلب.</p>
        <div className="marketplace-login-options">
          <a href="/customer/account-login">دخول العميل</a>
          <a href="/supervisor">دخول المشرف</a>
          <a href="/admin/login">دخول الإدارة</a>
        </div>
        <a className="marketplace-quiet-link" href="/">العودة للرئيسية</a>
      </main>
    );
  }

  if (authState === "unauthorized" || authState === "error") {
    return (
      <main className="marketplace-state" dir="rtl">
        <Store size={44} />
        <h1>تعذر فتح السوق</h1>
        <p>{errorMessage}</p>
        <div className="marketplace-login-options">
          <a href="/">العودة للرئيسية</a>
          {authState === "unauthorized" && <a href="/supplier">العودة لحساب المورد</a>}
        </div>
      </main>
    );
  }

  return (
    <main className="supplier-marketplace" dir="rtl">
      <header className="marketplace-header">
        <div className="marketplace-header-inner">
          <a className="marketplace-back" href={getAccountPath(actor?.role)} aria-label="العودة إلى الحساب">
            <ArrowRight size={21} />
          </a>
          <div className="marketplace-brand">
            <span><Store size={24} /></span>
            <div><strong>سوق مواد البناء</strong><small>اختر المنتج، حدّد الكمية، وأرسل الطلب للمورد</small></div>
          </div>
          <button className="marketplace-cart-button" type="button" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={21} />
            <span>السلة</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
        </div>
      </header>

      <nav className="marketplace-view-tabs" aria-label="أقسام السوق">
        <button className={view === "catalog" ? "active" : ""} type="button" onClick={() => setView("catalog")}><Store size={18} /> المنتجات</button>
        <button className={view === "orders" ? "active" : ""} type="button" onClick={() => setView("orders")}><History size={18} /> طلباتي</button>
      </nav>

      {errorMessage && <div className="marketplace-alert" role="alert">{errorMessage}<button type="button" onClick={() => setErrorMessage("")} aria-label="إغلاق"><X size={17} /></button></div>}

      {checkoutResult && (
        <section className="marketplace-success" role="status">
          <PackageCheck size={28} />
          <div>
            <strong>تم إرسال {checkoutResult.orderCount} {checkoutResult.orderCount === 1 ? "طلب" : "طلبات"} بنجاح</strong>
            <p>فُصلت السلة حسب المورد. سيتواصل كل مورد معك لتأكيد التوفر وطريقة الدفع والتسليم.</p>
          </div>
          <button type="button" onClick={() => setCheckoutResult(null)} aria-label="إغلاق"><X size={18} /></button>
        </section>
      )}

      {view === "catalog" ? (
        <div className="marketplace-content">
          <section className="marketplace-hero">
            <div><span>متاح للعملاء والمشرفين والإدارة</span><h1>مواد مشروعك في سلة واحدة</h1><p>لن يتم تحصيل مبلغ داخل المنصة الآن؛ إتمام السلة يرسل طلبًا مؤكدًا، ثم يتواصل المورد معك.</p></div>
            <div className="marketplace-search"><Search size={20} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="ابحث عن منتج أو مورد..." /></div>
          </section>

          <div className="marketplace-categories" role="tablist" aria-label="أقسام المنتجات">
            <button type="button" className={activeCategory === "all" ? "active" : ""} onClick={() => setActiveCategory("all")}><span>🛒</span>الكل</button>
            {SUPPLIER_PRODUCT_CATEGORIES.map((category) => (
              <button key={category.value} type="button" className={activeCategory === category.value ? "active" : ""} onClick={() => setActiveCategory(category.value)}><span>{category.icon}</span>{category.label}</button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <section className="marketplace-empty"><Store size={38} /><h2>لا توجد منتجات مطابقة حاليًا</h2><p>ستظهر هنا منتجات الموردين المكتملة بصورتها وسعرها ووحدة البيع.</p></section>
          ) : (
            <section className="marketplace-product-grid" aria-label="منتجات الموردين">
              {filteredProducts.map((product) => {
                const inCart = cart.find((item) => item.productId === product.id);
                return (
                  <article className="marketplace-product-card" key={product.id}>
                    <div className="marketplace-product-image-wrap"><img src={getSupplierProductImageUrl(product.imagePath)} alt={product.productName} loading="lazy" /></div>
                    <div className="marketplace-product-body">
                      <small>{product.supplierName}</small>
                      <h2>{product.productName}</h2>
                      <div className="marketplace-product-price"><strong>{formatMarketplaceMoney(product.price)}</strong><span>/ {getSupplierUnitLabel(product.unitCode)}</span></div>
                      <button type="button" onClick={() => addToCart(product)}>{inCart ? <><Plus size={17} /> إضافة أخرى ({formatMarketplaceQuantity(inCart.quantity)})</> : <><ShoppingCart size={17} /> أضف للسلة</>}</button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      ) : (
        <section className="marketplace-orders marketplace-content">
          <header><div><span>سجل الشراء</span><h1>طلباتي</h1></div><button type="button" onClick={() => setView("catalog")}>متابعة التسوق</button></header>
          {orders.length === 0 ? (
            <div className="marketplace-empty"><History size={38} /><h2>لم ترسل أي طلب بعد</h2><p>أضف منتجات للسلة ثم أكمل بيانات التسليم.</p></div>
          ) : orders.map((order) => (
            <article className="marketplace-order-card" key={order.id}>
              <header><div><strong>{order.orderNumber}</strong><small>{formatDate(order.submittedAt)}</small></div><span data-status={order.status}>{MARKETPLACE_ORDER_STATUSES[order.status] || order.status}</span></header>
              <div className="marketplace-order-supplier"><strong>{order.supplierName}</strong><a href={`tel:${order.supplierMobile}`}>{order.supplierMobile}</a></div>
              <div className="marketplace-order-items">
                {(order.items || []).map((item) => (
                  <div key={item.id}><img src={getSupplierProductImageUrl(item.imagePath)} alt="" /><span><strong>{item.productName}</strong><small>{formatMarketplaceQuantity(item.quantity)} {getSupplierUnitLabel(item.unitCode)} × {formatMarketplaceMoney(item.unitPrice)}</small></span><b>{formatMarketplaceMoney(item.lineTotal)}</b></div>
                ))}
              </div>
              <footer><span>الإجمالي</span><strong>{formatMarketplaceMoney(order.subtotal)}</strong></footer>
            </article>
          ))}
        </section>
      )}

      <button className="marketplace-mobile-cart" type="button" onClick={() => setCartOpen(true)}><ShoppingCart size={22} /><span>السلة ({cartCount})</span><strong>{formatMarketplaceMoney(cartTotal)}</strong></button>

      {cartOpen && <button className="marketplace-drawer-backdrop" aria-label="إغلاق السلة" onClick={() => setCartOpen(false)} />}
      <aside className={`marketplace-cart-drawer ${cartOpen ? "open" : ""}`} aria-hidden={!cartOpen}>
        <header><div><ShoppingCart size={23} /><strong>سلة المشتريات</strong></div><button type="button" onClick={() => setCartOpen(false)} aria-label="إغلاق"><X size={22} /></button></header>
        {cartLines.length === 0 ? (
          <div className="marketplace-cart-empty"><ShoppingCart size={42} /><strong>السلة فارغة</strong><span>أضف المنتجات التي يحتاجها مشروعك.</span></div>
        ) : (
          <>
            <div className="marketplace-cart-lines">
              {cartLines.map((line) => (
                <article key={line.product.id}>
                  <img src={getSupplierProductImageUrl(line.product.imagePath)} alt={line.product.productName} />
                  <div><strong>{line.product.productName}</strong><small>{line.product.supplierName}</small><span>{formatMarketplaceMoney(line.product.price)} / {getSupplierUnitLabel(line.product.unitCode)}</span>
                    <div className="marketplace-quantity"><button type="button" onClick={() => changeQuantity(line.product, -1)}><Minus size={15} /></button><input type="number" min={isDiscreteSupplierUnit(line.product.unitCode) ? "1" : "0.001"} step={isDiscreteSupplierUnit(line.product.unitCode) ? "1" : "0.001"} value={line.quantity} onChange={(event) => updateQuantity(line.product, event.target.value)} /><button type="button" onClick={() => changeQuantity(line.product, 1)}><Plus size={15} /></button></div>
                  </div>
                  <button className="marketplace-remove-line" type="button" onClick={() => removeFromCart(line.product.id)} aria-label={`حذف ${line.product.productName}`}><X size={18} /></button>
                </article>
              ))}
            </div>
            <footer className="marketplace-cart-footer"><p><span>الإجمالي التقديري</span><strong>{formatMarketplaceMoney(cartTotal)}</strong></p><small>إذا تعدد الموردون، ستُقسم السلة إلى طلب مستقل لكل مورد.</small><button type="button" onClick={() => setCheckoutOpen(true)}>إتمام الطلب</button></footer>
          </>
        )}
      </aside>

      {checkoutOpen && (
        <div className="marketplace-checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <button className="marketplace-drawer-backdrop" aria-label="إغلاق" onClick={() => !submitting && setCheckoutOpen(false)} />
          <form onSubmit={submitCheckout}>
            <header><div><small>لا يوجد دفع إلكتروني في هذه الخطوة</small><h2 id="checkout-title">بيانات التواصل والتسليم</h2></div><button type="button" onClick={() => setCheckoutOpen(false)} disabled={submitting}><X size={21} /></button></header>
            <label><span>اسم المستلم</span><input value={checkoutForm.buyerName} onChange={(event) => setCheckoutForm({ ...checkoutForm, buyerName: event.target.value })} required minLength={2} disabled={submitting} /></label>
            <label><span>رقم الجوال</span><input dir="ltr" inputMode="tel" value={checkoutForm.buyerMobile} onChange={(event) => setCheckoutForm({ ...checkoutForm, buyerMobile: event.target.value.replace(/\D/g, "").slice(0, 10) })} required pattern="05[0-9]{8}" placeholder="05xxxxxxxx" disabled={submitting} /></label>
            <label><span>عنوان التسليم</span><textarea rows="3" value={checkoutForm.deliveryAddress} onChange={(event) => setCheckoutForm({ ...checkoutForm, deliveryAddress: event.target.value })} required minLength={3} placeholder="المدينة، الحي، الشارع، رقم المبنى" disabled={submitting} /></label>
            <label><span>رابط موقع التسليم <small>اختياري</small></span><input dir="ltr" type="url" value={checkoutForm.deliveryMapsUrl} onChange={(event) => setCheckoutForm({ ...checkoutForm, deliveryMapsUrl: event.target.value })} placeholder="https://maps.google.com/..." disabled={submitting} /></label>
            <label><span>ملاحظة للمورد <small>اختياري</small></span><textarea rows="2" maxLength={2000} value={checkoutForm.buyerNote} onChange={(event) => setCheckoutForm({ ...checkoutForm, buyerNote: event.target.value })} disabled={submitting} /></label>
            <div className="marketplace-checkout-summary"><span>{cartCount} منتجات</span><strong>{formatMarketplaceMoney(cartTotal)}</strong></div>
            <button className="marketplace-submit-order" type="submit" disabled={submitting}>{submitting ? "جاري إرسال الطلب..." : "تأكيد وإرسال الطلب للمورد"}</button>
            <p>بعد الإرسال يتواصل المورد معك لتأكيد التوفر والسعر النهائي وطريقة الدفع والتسليم.</p>
          </form>
        </div>
      )}
    </main>
  );
}
