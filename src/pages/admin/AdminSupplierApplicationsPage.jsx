import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";

const LABELS = { under_review: "تحت المراجعة", needs_completion: "مطلوب استكمال", approved: "مقبول", rejected: "مرفوض" };

export default function AdminSupplierApplicationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

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
      await reload();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر تنفيذ قرار الإدارة.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f5f3ee", color: "#173f36", direction: "rtl", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 1050, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ background: "#fff", border: "1px solid #e3e0d7", borderRadius: 18, padding: 20, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><p style={{ margin: 0 }}>إدارة منصة نايف المزيني</p><h1 style={{ marginBottom: 0 }}>طلبات تسجيل الموردين</h1></div>
          <button type="button" onClick={() => { window.location.href = "/admin/dashboard"; }}>لوحة الإدارة</button>
        </header>
        {errorMessage && <p style={{ color: "#991b1b" }}>{errorMessage}</p>}
        {loading ? <section style={{ background: "#fff", padding: 20, borderRadius: 18 }}>جاري التحميل...</section> : items.length === 0 ? <section style={{ background: "#fff", padding: 20, borderRadius: 18 }}>لا توجد طلبات موردين حاليًا.</section> : items.map((item) => (
          <article key={item.id} style={{ background: "#fff", border: "1px solid #e3e0d7", borderRadius: 18, padding: 20, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0 }}>{item.organizationName}</h2><strong>{LABELS[item.status] || item.status}</strong></div><a href={item.mapsUrl} target="_blank" rel="noreferrer">فتح الموقع</a></div>
            <div>السجل التجاري: {item.commercialRegistrationNumber}</div>
            <div>البريد: {item.email}</div>
            <div>الجوال: {item.mobileNumber}</div>
            <div>المنتج: {item.initialProductName}</div>
            <textarea rows="3" placeholder="ملاحظة الإدارة" value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" disabled={busyId === item.id} onClick={() => decide(item.id, "approved")}>قبول</button>
              <button type="button" disabled={busyId === item.id} onClick={() => decide(item.id, "needs_completion")}>طلب استكمال</button>
              <button type="button" disabled={busyId === item.id} onClick={() => decide(item.id, "rejected")}>رفض</button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
