import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.js";

const LABELS = {
  under_review: "تحت المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبول",
  rejected: "مرفوض",
};

const cardStyle = {
  background: "linear-gradient(145deg, #ffffff 0%, #fbfaf6 100%)",
  border: "1px solid #e3e0d7",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 10px 30px rgba(40,48,42,.055)",
};

const softCardStyle = {
  background: "#f7f4ec",
  border: "1px solid #dfd7c7",
  borderRadius: 18,
  padding: 18,
};

function initialView() {
  const value = new URLSearchParams(window.location.search).get("view");
  return value === "applicants" || value === "approved" ? value : "home";
}

export default function AdminSupplierApplicationsPage() {
  const [items, setItems] = useState([]);
  const [view, setView] = useState(initialView);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  const applicants = useMemo(
    () => items.filter((item) => item.status !== "approved"),
    [items]
  );
  const approved = useMemo(
    () => items.filter((item) => item.status === "approved"),
    [items]
  );
  const visibleItems = view === "approved" ? approved : applicants;
  const selected = items.find((item) => item.id === selectedId) || null;

  async function reload() {
    setLoading(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.rpc("admin_list_supplier_applications");
      if (error) throw error;
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorMessage(error?.message || "تعذر تحميل طلبات الموردين.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  function openView(nextView) {
    setView(nextView);
    setSelectedId("");
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    window.history.replaceState({}, "", url);
  }

  function backToHome() {
    setView("home");
    setSelectedId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  }

  async function decide(id, decision) {
    if (busyId) return;
    try {
      setBusyId(id);
      setErrorMessage("");
      const { error } = await supabase.rpc("admin_decide_supplier_application", {
        p_application_id: id,
        p_decision: decision,
        p_note: String(notes[id] || "").trim() || null,
      });
      if (error) throw error;
      setSelectedId("");
      await reload();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر تنفيذ قرار الإدارة.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top right, rgba(205,166,77,.12), transparent 32%), #f7f5ef", color: "#173f36", direction: "rtl", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 1050, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><p style={{ margin: 0, color: "#6d7c76" }}>إدارة منصة نايف المزيني</p><h1 style={{ marginBottom: 0 }}>إدارة الموردين</h1></div>
          <button type="button" onClick={() => { window.location.href = "/admin/dashboard"; }}>لوحة الإدارة</button>
        </header>

        {errorMessage && <p style={{ ...cardStyle, color: "#991b1b" }}>{errorMessage}</p>}

        {loading ? (
          <section style={cardStyle}>جاري التحميل...</section>
        ) : view === "home" ? (
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>سجلات الموردين</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 18 }}>
              <button type="button" onClick={() => openView("applicants")} style={{ ...softCardStyle, minHeight: 150, textAlign: "right", cursor: "pointer", color: "#173f36", font: "inherit" }}>
                <span style={{ display: "block", fontSize: 34, marginBottom: 10 }}>📝</span>
                <strong style={{ display: "block", fontSize: 22 }}>الموردون المتقدمون</strong>
                <span style={{ display: "block", marginTop: 8, color: "#6d7c76" }}>طلبات التسجيل التي لم تعتمد بعد</span>
                <strong style={{ display: "block", marginTop: 12, fontSize: 26 }}>{applicants.length}</strong>
              </button>
              <button type="button" onClick={() => openView("approved")} style={{ ...softCardStyle, minHeight: 150, textAlign: "right", cursor: "pointer", color: "#173f36", font: "inherit" }}>
                <span style={{ display: "block", fontSize: 34, marginBottom: 10 }}>✅</span>
                <strong style={{ display: "block", fontSize: 22 }}>الموردون المعتمدون</strong>
                <span style={{ display: "block", marginTop: 8, color: "#6d7c76" }}>الموردون المقبولون في المنصة</span>
                <strong style={{ display: "block", marginTop: 12, fontSize: 26 }}>{approved.length}</strong>
              </button>
            </div>
          </section>
        ) : !selected ? (
          <>
            <section style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><h2 style={{ margin: 0 }}>{view === "approved" ? "الموردون المعتمدون" : "الموردون المتقدمون"}</h2><p style={{ marginBottom: 0, color: "#687872" }}>اضغط «عرض السجل» لمراجعة بيانات المورد.</p></div>
              <button type="button" onClick={backToHome}>العودة إلى قوائم الموردين</button>
            </section>
            {visibleItems.length === 0 ? (
              <section style={cardStyle}>لا توجد سجلات في هذه القائمة حاليًا.</section>
            ) : (
              <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
                {visibleItems.map((item) => (
                  <article key={item.id} style={{ ...softCardStyle, display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
                    <div><h3 style={{ margin: "0 0 6px" }}>{item.organizationName}</h3><strong>{LABELS[item.status] || item.status}</strong><div style={{ marginTop: 7, color: "#687872" }}>{item.initialProductName}</div></div>
                    <button type="button" onClick={() => setSelectedId(item.id)}>عرض السجل</button>
                  </article>
                ))}
              </section>
            )}
          </>
        ) : (
          <>
            <section style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><h2 style={{ margin: 0 }}>سجل المورد</h2><p style={{ marginBottom: 0 }}>{selected.organizationName}</p></div>
              <button type="button" onClick={() => setSelectedId("")}>العودة إلى القائمة</button>
            </section>
            <article style={{ ...cardStyle, display: "grid", gap: 14 }}>
              <div><h2 style={{ margin: 0 }}>{selected.organizationName}</h2><strong>{LABELS[selected.status] || selected.status}</strong></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                <div style={softCardStyle}><strong>السجل التجاري</strong><p>{selected.commercialRegistrationNumber}</p></div>
                <div style={softCardStyle}><strong>البريد</strong><p>{selected.email}</p></div>
                <div style={softCardStyle}><strong>الجوال</strong><p>{selected.mobileNumber}</p></div>
                <div style={softCardStyle}><strong>المنتج</strong><p>{selected.initialProductName}</p></div>
              </div>
              <a href={selected.mapsUrl} target="_blank" rel="noreferrer">فتح الموقع على الخرائط</a>
              {selected.status !== "approved" && (
                <>
                  <textarea rows="3" placeholder="ملاحظة الإدارة" value={notes[selected.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [selected.id]: event.target.value }))} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" disabled={busyId === selected.id} onClick={() => decide(selected.id, "approved")}>قبول</button>
                    <button type="button" disabled={busyId === selected.id} onClick={() => decide(selected.id, "needs_completion")}>طلب استكمال</button>
                    <button type="button" disabled={busyId === selected.id} onClick={() => decide(selected.id, "rejected")}>رفض</button>
                  </div>
                </>
              )}
            </article>
          </>
        )}
      </div>
    </main>
  );
}
