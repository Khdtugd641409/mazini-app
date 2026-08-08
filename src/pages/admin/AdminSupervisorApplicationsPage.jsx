import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase.js";
import { getCurrentAdmin } from "../../services/adminAuthService.js";

const STATUS_LABELS = {
  under_review: "بانتظار المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبول",
  rejected: "مرفوض",
};

const APPLICANT_TYPE_LABELS = {
  individual: "فرد يعمل لحسابه الخاص",
  organization: "مكتب أو منشأة هندسية",
};

const PRICING_LABELS = {
  fixed: "مبلغ ثابت",
  monthly: "شهري",
  percentage: "نسبة",
  flexible: "حسب الاتفاق",
};

const DOCUMENT_LABELS = {
  qualification: "المؤهل أو الشهادة",
  professional_license: "الترخيص المهني",
  commercial_registration: "السجل التجاري",
  portfolio: "أعمال سابقة",
  other: "مستند آخر",
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #e3e0d7",
  borderRadius: 18,
  padding: 20,
};

function formatDate(value) {
  if (!value) return "غير متوفر";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function AdminSupervisorApplicationsPage() {
  const [admin, setAdmin] = useState(null);
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selected = applications.find((item) => item.id === selectedId) || null;

  async function loadApplications() {
    const { data, error } = await supabase.rpc("admin_list_supervisor_applications");
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    setApplications(rows);
    setSelectedId((current) =>
      current && rows.some((row) => row.id === current)
        ? current
        : rows[0]?.id || ""
    );
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setLoading(true);
        setErrorMessage("");
        const currentAdmin = await getCurrentAdmin();
        if (!currentAdmin) {
          window.location.href = "/admin/login";
          return;
        }
        if (!active) return;
        setAdmin(currentAdmin);
        await loadApplications();
      } catch (error) {
        if (active) setErrorMessage(error?.message || "تعذر تحميل طلبات المشرفين.");
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setNote(selected?.adminNote || "");
  }, [selectedId]);

  async function decide(decision) {
    if (!selected || saving) return;

    if ((decision === "needs_completion" || decision === "reject") && note.trim().length < 3) {
      setErrorMessage("اكتب ملاحظة واضحة للمتقدم قبل هذا القرار.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("admin_decide_supervisor_application", {
        p_application_id: selected.id,
        p_decision: decision,
        p_note: note.trim() || null,
      });
      if (error) throw error;

      setSuccessMessage(
        decision === "approve"
          ? "تم قبول المشرف وتفعيل حسابه وخدمته الأولى."
          : decision === "needs_completion"
            ? "تم طلب الاستكمال من المتقدم."
            : "تم رفض الطلب."
      );
      await loadApplications();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر تنفيذ قرار الإدارة.");
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(document) {
    try {
      setErrorMessage("");
      const { data, error } = await supabase.storage
        .from(document.storageBucket || "supervisor-documents")
        .createSignedUrl(document.storagePath, 300);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("تعذر إنشاء رابط المستند.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(error?.message || "تعذر فتح المستند.");
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f5f3ee", padding: 24, direction: "rtl" }}>
        <div style={{ ...cardStyle, maxWidth: 900, margin: "60px auto" }}>جاري تحميل طلبات المشرفين...</div>
      </main>
    );
  }

  if (!admin) return null;

  return (
    <main style={{ minHeight: "100vh", background: "#f5f3ee", color: "#173f36", padding: "24px 16px 60px", direction: "rtl" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0 }}>إدارة منصة نايف المزيني</p>
            <h1 style={{ marginBottom: 0 }}>طلبات تسجيل المشرفين</h1>
          </div>
          <button type="button" onClick={() => { window.location.href = "/admin/dashboard"; }}>العودة للوحة الإدارة</button>
        </header>

        {errorMessage && <div style={{ ...cardStyle, color: "#991b1b" }}>{errorMessage}</div>}
        {successMessage && <div style={cardStyle}>{successMessage}</div>}

        {applications.length === 0 ? (
          <section style={cardStyle}><p>لا توجد طلبات مشرفين حتى الآن.</p></section>
        ) : (
          <>
            <section style={cardStyle}>
              <label style={{ display: "grid", gap: 8 }}>
                <strong>اختر الطلب</strong>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ minHeight: 46, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", font: "inherit" }}>
                  {applications.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName} — {STATUS_LABELS[item.status] || item.status}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            {selected && (
              <section style={{ ...cardStyle, display: "grid", gap: 18 }}>
                <div>
                  <h2 style={{ marginBottom: 5 }}>{selected.fullName}</h2>
                  <strong>{STATUS_LABELS[selected.status] || selected.status}</strong>
                  <p>تاريخ التقديم: {formatDate(selected.submittedAt)}</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                  <div><strong>الصفة</strong><p>{APPLICANT_TYPE_LABELS[selected.applicantType] || selected.applicantType}</p></div>
                  <div><strong>البريد</strong><p>{selected.email}</p></div>
                  <div><strong>الجوال</strong><p>{selected.mobileNumber}</p></div>
                  <div><strong>المسمى المهني</strong><p>{selected.professionalTitle}</p></div>
                  <div><strong>المدينة</strong><p>{selected.city}</p></div>
                  <div><strong>سنوات الخبرة</strong><p>{selected.experienceYears}</p></div>
                  <div><strong>المشاريع السابقة</strong><p>{selected.completedProjectsCount}</p></div>
                  <div><strong>مناطق الخدمة</strong><p>{(selected.serviceAreas || []).join("، ") || "غير محدد"}</p></div>
                </div>

                <div>
                  <strong>النبذة المهنية</strong>
                  <p>{selected.profileSummary}</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                  <div><strong>اسم المكتب / المنشأة</strong><p>{selected.organizationName || "فرد — لا يوجد"}</p></div>
                  <div><strong>السجل التجاري</strong><p>{selected.commercialRegistrationNumber || "غير مطلوب / غير مرفق"}</p></div>
                  <div><strong>رقم الترخيص المهني</strong><p>{selected.professionalLicenseNumber || "غير مذكور"}</p></div>
                </div>

                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
                  <h3>الخدمة المعروضة</h3>
                  <strong>{selected.initialServiceTitle}</strong>
                  {selected.initialServiceDescription && <p>{selected.initialServiceDescription}</p>}
                  <p>التسعير: {PRICING_LABELS[selected.pricingModel] || selected.pricingModel}{selected.servicePrice != null ? ` — ${selected.servicePrice}` : ""}</p>
                </div>

                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
                  <h3>المستندات</h3>
                  {(selected.documents || []).length === 0 ? (
                    <p>لم يرفع المتقدم مستندات.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {selected.documents.map((document) => (
                        <button key={document.id} type="button" onClick={() => openDocument(document)} style={{ textAlign: "right", padding: 12 }}>
                          📄 {DOCUMENT_LABELS[document.documentType] || document.documentType} — {document.originalName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <label style={{ display: "grid", gap: 8 }}>
                  <strong>ملاحظة الإدارة</strong>
                  <textarea rows="4" value={note} onChange={(e) => setNote(e.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 10, padding: 12, font: "inherit" }} placeholder="تظهر للمتقدم عند طلب الاستكمال أو الرفض." />
                </label>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" disabled={saving} onClick={() => decide("approve")}>قبول المشرف</button>
                  <button type="button" disabled={saving} onClick={() => decide("needs_completion")}>طلب استكمال</button>
                  <button type="button" disabled={saving} onClick={() => decide("reject")}>رفض الطلب</button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default AdminSupervisorApplicationsPage;
