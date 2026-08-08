import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase.js";

const PRICING_LABELS = {
  fixed: "مبلغ ثابت",
  monthly: "شهري",
  percentage: "نسبة",
  flexible: "حسب الاتفاق",
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #e3e0d7",
  borderRadius: 18,
  padding: 20,
};

function SupervisorServicesPage() {
  const [services, setServices] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricingModel, setPricingModel] = useState("flexible");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadServices() {
    const { data, error } = await supabase.rpc("supervisor_get_my_services");
    if (error) throw error;
    setServices(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setLoading(true);
        setErrorMessage("");

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data?.session) {
          window.location.href = "/supervisor";
          return;
        }

        await loadServices();
      } catch (error) {
        if (!active) return;
        const message = String(error?.message || "");
        if (message.includes("SUPERVISOR_AUTHORIZATION_REQUIRED")) {
          window.location.href = "/supervisor";
          return;
        }
        setErrorMessage(message || "تعذر تحميل خدمات المشرف.");
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => {
      active = false;
    };
  }, []);

  async function addService(event) {
    event.preventDefault();
    if (saving) return;

    const normalizedTitle = title.trim();
    if (normalizedTitle.length < 2) {
      setErrorMessage("اكتب اسم الخدمة.");
      return;
    }

    const numericPrice = price === "" ? null : Number(price);
    if (numericPrice != null && (!Number.isFinite(numericPrice) || numericPrice < 0)) {
      setErrorMessage("أدخل سعرًا صحيحًا أو اترك السعر فارغًا.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("supervisor_add_service", {
        p_title: normalizedTitle,
        p_description: description.trim() || null,
        p_pricing_model: pricingModel,
        p_price: numericPrice,
      });
      if (error) throw error;

      setTitle("");
      setDescription("");
      setPricingModel("flexible");
      setPrice("");
      setSuccessMessage("تمت إضافة الخدمة إلى ملفك.");
      await loadServices();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إضافة الخدمة.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f3ee",
        color: "#173f36",
        padding: "24px 16px 60px",
        direction: "rtl",
      }}
    >
      <div style={{ maxWidth: 950, margin: "0 auto", display: "grid", gap: 18 }}>
        <header
          style={{
            ...cardStyle,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0 }}>حساب المشرف</p>
            <h1 style={{ marginBottom: 0 }}>خدماتي</h1>
          </div>
          <button type="button" onClick={() => { window.location.href = "/supervisor"; }}>
            العودة لحساب المشرف
          </button>
        </header>

        {errorMessage && <div style={{ ...cardStyle, color: "#991b1b" }}>{errorMessage}</div>}
        {successMessage && <div style={cardStyle}>{successMessage}</div>}

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>الخدمات المعروضة</h2>
          {loading ? (
            <p>جاري تحميل الخدمات...</p>
          ) : services.length === 0 ? (
            <p>لا توجد خدمات مضافة بعد.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {services.map((service) => (
                <article
                  key={service.id}
                  style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}
                >
                  <strong style={{ display: "block", fontSize: 18 }}>{service.title}</strong>
                  {service.description && <p>{service.description}</p>}
                  <div>
                    {PRICING_LABELS[service.pricingModel] || service.pricingModel}
                    {service.price != null ? ` — ${service.price}` : ""}
                  </div>
                  <small>{service.isActive ? "نشطة" : "غير نشطة"}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>إضافة خدمة</h2>
          <form onSubmit={addService} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 7 }}>
              <strong>اسم الخدمة</strong>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label style={{ display: "grid", gap: 7 }}>
              <strong>وصف الخدمة</strong>
              <textarea
                rows="4"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={saving}
              />
            </label>

            <label style={{ display: "grid", gap: 7 }}>
              <strong>طريقة التسعير</strong>
              <select
                value={pricingModel}
                onChange={(event) => setPricingModel(event.target.value)}
                disabled={saving}
              >
                <option value="flexible">حسب الاتفاق</option>
                <option value="fixed">مبلغ ثابت</option>
                <option value="monthly">شهري</option>
                <option value="percentage">نسبة</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 7 }}>
              <strong>السعر / النسبة</strong>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                disabled={saving}
                placeholder="اختياري"
              />
            </label>

            <button type="submit" disabled={saving || !title.trim()}>
              {saving ? "جاري الحفظ..." : "إضافة الخدمة"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default SupervisorServicesPage;
