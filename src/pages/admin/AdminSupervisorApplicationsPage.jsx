import { useEffect, useMemo, useState } from "react";

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

function formatDate(value) {
  if (!value) return "غير متوفر";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getInitialView() {
  const value = new URLSearchParams(window.location.search).get("view");
  return value === "applicants" || value === "approved" ? value : "home";
}

function AdminSupervisorApplicationsPage() {
  const [admin, setAdmin] = useState(null);
  const [applications, setApplications] = useState([]);
  const [view, setView] = useState(getInitialView);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const applicants = useMemo(
    () => applications.filter((item) => item.status !== "approved"),
    [applications]
  );
  const approved = useMemo(
    () => applications.filter((item) => item.status === "approved"),
    [applications]
  );
  const visibleApplications = view === "approved" ? approved : applicants;
  const selected = applications.find((item) => item.id === selectedId) || null;

  async function loadApplications() {
    const { data, error } = await supabase.rpc("admin_list_supervisor_applications");
    if (error) throw error;
    setApplications(Array.isArray(data) ? data : []);
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
        if (active) setErrorMessage(error?.message || "تعذر تحميل سجلات المشرفين.");
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

  function openView(nextView) {
    setView(nextView);
    setSelectedId("");
    setErrorMessage("");
    setSuccessMessage("");
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    window.history.replaceState({}, "", url);
  }

  function backToCategories() {
    setView("home");
    setSelectedId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  }

  async function decide(decision) {
    if (!selected || saving || selected.status === "approved") return;

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
      setSelectedId("");
      if (decision === "approve") setView("applicants");
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
        <div style={{ ...cardStyle, maxWidth: 900, margin: "60px auto" }}>جاري تحميل سجلات المشرفين...</div>
      </main>
    );
  }

  if (!admin) return null;

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top right, rgba(205,166,77,.12), transparent 32%), #f7f5ef", color: "#173f36", padding: "24px 16px 60px", direction: "rtl" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: "#6d7c76" }}>إدارة منصة نايف المزيني</p>
            <h1 style={{ marginBottom: 0 }}>إدارة المشرفين</h1>
          </div>
          <button type="button" onClick={() => { window.location.href = "/admin/dashboard"; }}>العودة للوحة الإدارة</button>
        </header>

        {errorMessage && <div style={{ ...cardStyle, color: "#991b1b" }}>{errorMessage}</div>}
        {successMessage && <div style={cardStyle}>{successMessage}</div>}

        {view === "home" && (
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>سجلات المشرفين</h2>
            <p style={{ color: "#687872" }}>اختر القائمة التي تريد مراجعتها.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 18 }}>
              <button type="button" onClick={() => openView("applicants")} style={{ ...softCardStyle, minHeight: 150, textAlign: "right", cursor: "pointer", color: "#173f36", font: "inherit" }}>
                <span style={{ display: "block", fontSize: 36, marginBottom: 10 }}>📝</span>
                <strong style={{ display: "block", fontSize: 22 }}>المشرفون المتقدمون</strong>
                <span style={{ display: "block", marginTop: 8, color: "#6d7c76" }}>طلبات التسجيل التي لم تعتمد بعد</span>
                <strong style={{ display: "block", marginTop: 12, fontSize: 26 }}>{applicants.length}</strong>
              </button>

              <button type="button" onClick={() => openView("approved")} style={{ ...softCardStyle, minHeight: 150, textAlign: "right", cursor: "pointer", color: "#173f36", font: "inherit" }}>
                <span style={{ display: "block", fontSize: 36, marginBottom: 10 }}>✅</span>
                <strong style={{ display: "block", fontSize: 22 }}>المشرفون المعتمدون</strong>
                <span style={{ display: "block", marginTop: 8, color: "#6d7c76" }}>المشرفون المقبولون في المنصة</span>
                <strong style={{ display: "block", marginTop: 12, fontSize: 26 }}>{approved.length}</strong>
              </button>
            </div>
          </section>
        )}

        {view !== "home" && !selected && (
          <>
            <section style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0 }}>{view === "approved" ? "المشرفون المعتمدون" : "المشرفون المتقدمون"}</h2>
                <p style={{ marginBottom: 0, color: "#687872" }}>اضغط «عرض السجل» للاطلاع على جميع بيانات المشرف ومستنداته.</p>
              </div>
              <button type="button" onClick={backToCategories}>العودة إلى قوائم المشرفين</button>
            </section>

            {visibleApplications.length === 0 ? (
              <section style={cardStyle}><p>لا توجد سجلات في هذه القائمة حاليًا.</p></section>
            ) : (
              <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
                {visibleApplications.map((item) => (
                  <article key={item.id} style={{ ...softCardStyle, display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: "0 0 6px" }}>{item.fullName}</h3>
                      <strong>{STATUS_LABELS[item.status] || item.status}</strong>
                      <div style={{ marginTop: 7, color: "#687872" }}>{item.professionalTitle || "المسمى غير محدد"} — {item.city || "المدينة غير محددة"}</div>
                      <small style={{ display: "block", marginTop: 6 }}>تاريخ التقديم: {formatDate(item.submittedAt)}</small>
                    </div>
                    <button type="button" onClick={() => setSelectedId(item.id)} style={{ minHeight: 44, padding: "8px 16px" }}>عرض السجل</button>
                  </article>
                ))}
              </section>
            )}
          </>
        )}

        {selected && (
          <>
            <section style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0 }}>سجل المشرف</h2>
                <p style={{ marginBottom: 0 }}>{selected.fullName}</p>
              </div>
              <button type="button" onClick={() => setSelectedId("")}>العودة إلى القائمة</button>
            </section>

            <section style={{ ...cardStyle, display: "grid", gap: 18 }}>
              <div>
                <h2 style={{ marginBottom: 5 }}>{selected.fullName}</h2>
                <strong>{STATUS_LABELS[selected.status] || selected.status}</strong>
                <p>تاريخ التقديم: {formatDate(selected.submittedAt)}</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                <div style={softCardStyle}><strong>الصفة</strong><p>{APPLICANT_TYPE_LABELS[selected.applicantType] || selected.applicantType}</p></div>
                <div style={softCardStyle}><strong>البريد</strong><p>{selected.email}</p></div>
                <div style={softCardStyle}><strong>الجوال</strong><p>{selected.mobileNumber}</p></div>
                <div style={softCardStyle}><strong>المسمى المهني</strong><p>{selected.professionalTitle}</p></div>
                <div style={softCardStyle}><strong>المدينة</strong><p>{selected.city}</p></div>
                <div style={softCardStyle}><strong>سنوات الخبرة</strong><p>{selected.experienceYears}</p></div>
                <div style={softCardStyle}><strong>المشاريع السابقة</strong><p>{selected.completedProjectsCount}</p></div>
                <div style={softCardStyle}><strong>مناطق الخدمة</strong><p>{(selected.serviceAreas || []).join("، ") || "غير محدد"}</p></div>
              </div>

              <div style={softCardStyle}><strong>النبذة المهنية</strong><p>{selected.profileSummary}</p></div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                <div style={softCardStyle}><strong>اسم المكتب / المنشأة</strong><p>{selected.organizationName || "فرد — لا يوجد"}</p></div>
                <div style={softCardStyle}><strong>السجل التجاري</strong><p>{selected.commercialRegistrationNumber || "غير مطلوب / غير مرفق"}</p></div>
                <div style={softCardStyle}><strong>رقم الترخيص المهني</strong><p>{selected.professionalLicenseNumber || "غير مذكور"}</p></div>
              </div>

              <div style={softCardStyle}>
                <h3 style={{ marginTop: 0 }}>الخدمة المعروضة</h3>
                <strong>{selected.initialServiceTitle}</strong>
                {selected.initialServiceDescription && <p>{selected.initialServiceDescription}</p>}
                <p>التسعير: {PRICING_LABELS[selected.pricingModel] || selected.pricingModel}{selected.servicePrice != null ? ` — ${selected.servicePrice}` : ""}</p>
              </div>

              <div style={softCardStyle}>
                <h3 style={{ marginTop: 0 }}>المستندات</h3>
                {(selected.documents || []).length === 0 ? (
                  <p>لم يرفع المتقدم مستندات.</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {selected.documents.map((document) => (
                      <button key={document.id} type="button" onClick={() => openDocument(document)} style={{ textAlign: "right", padding: 12 }}>📄 {DOCUMENT_LABELS[document.documentType] || document.documentType} — {document.originalName}</button>
                    ))}
                  </div>
                )}
              </div>

              {selected.status !== "approved" ? (
                <>
                  <label style={{ display: "grid", gap: 8 }}>
                    <strong>ملاحظة الإدارة</strong>
                    <textarea rows="4" value={note} onChange={(e) => setNote(e.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 10, padding: 12, font: "inherit" }} placeholder="تظهر للمتقدم عند طلب الاستكمال أو الرفض." />
                  </label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" disabled={saving} onClick={() => decide("approve")}>قبول المشرف</button>
                    <button type="button" disabled={saving} onClick={() => decide("needs_completion")}>طلب استكمال</button>
                    <button type="button" disabled={saving} onClick={() => decide("reject")}>رفض الطلب</button>
                  </div>
                </>
              ) : (
                <div style={{ ...softCardStyle, fontWeight: 800 }}>هذا المشرف معتمد في المنصة. السجل متاح للإدارة للاطلاع في أي وقت.</div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default AdminSupervisorApplicationsPage;
