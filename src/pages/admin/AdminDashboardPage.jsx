import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import "./AdminDashboardPage.css";

const ACTION_TYPE_LABELS = {
  new_customer_application: "طلبات عملاء جديدة",
  customer_needs_completion: "طلبات تحتاج استكمال",
  land_review: "أراضٍ بانتظار المراجعة",
  land_transfer: "طلبات إفراغ تحتاج اعتماد",
  supervisor_report: "تقارير مشرفين تحتاج مراجعة",
  investor_application: "طلبات مستثمرين",
};

const ACTION_TYPE_ICONS = {
  new_customer_application: "👤",
  customer_needs_completion: "📝",
  land_review: "📍",
  land_transfer: "🏠",
  supervisor_report: "🏗️",
  investor_application: "📈",
};

const SECTION_LABELS = {
  customers: "العملاء",
  supervisors: "مشرفو المشاريع",
  investors: "المستثمرون",
  contractors: "المقاولون",
  suppliers: "الموردون",
  contracts: "العقود",
  settings: "الإعدادات",
};

const SECTION_ICONS = {
  customers: "👥",
  supervisors: "🏗️",
  investors: "📊",
  contractors: "🧱",
  suppliers: "🚚",
  contracts: "📄",
  settings: "⚙️",
};

const ALLOWED_STANDARD_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_STANDARD_FILE_SIZE = 20 * 1024 * 1024;

function sanitizeFileName(fileName) {
  const original = String(fileName || "standard").trim();
  const extensionMatch = original.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch?.[1]?.toLowerCase() || "";
  const base = original
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "standard";
  return extension ? `${base}.${extension}` : base;
}

function formatDate(value) {
  if (!value) return "غير متوفر";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StageStandards({ title, items = [] }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {items.length === 0 ? (
        <p style={{ margin: 0 }}>لا توجد معايير.</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
            }}
          >
            <input type="checkbox" checked={Boolean(item.checked)} readOnly disabled />
            <div>
              <strong>{item.text}</strong>
              {item.required && <small style={{ display: "block" }}>إلزامي</small>}
              {item.checkedAt && (
                <small style={{ display: "block" }}>
                  تم الاعتماد: {formatDate(item.checkedAt)}
                </small>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AdminDashboardPage({
  adminProfile,
  pendingActions = [],
  sectionCounts = {},
  isLoading = false,
  errorMessage = "",
  onOpenAction,
  onOpenSection,
  onSignOut,
}) {
  const [standardStages, setStandardStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [newStandardText, setNewStandardText] = useState("");
  const [newStandardRequired, setNewStandardRequired] = useState(true);
  const [standardFile, setStandardFile] = useState(null);
  const [standardsLoading, setStandardsLoading] = useState(false);
  const [standardsSaving, setStandardsSaving] = useState(false);
  const [standardsMessage, setStandardsMessage] = useState("");
  const [standardsError, setStandardsError] = useState("");

  const [supervisorCandidates, setSupervisorCandidates] = useState([]);
  const [activeSupervisors, setActiveSupervisors] = useState([]);
  const [supervisorProjects, setSupervisorProjects] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [supervisorFullName, setSupervisorFullName] = useState("");
  const [supervisorOrganization, setSupervisorOrganization] = useState("");
  const [supervisorMobile, setSupervisorMobile] = useState("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [selectedSupervisorProjectId, setSelectedSupervisorProjectId] = useState("");
  const [supervisorsLoading, setSupervisorsLoading] = useState(false);
  const [supervisorsSaving, setSupervisorsSaving] = useState(false);
  const [supervisorsMessage, setSupervisorsMessage] = useState("");
  const [supervisorsError, setSupervisorsError] = useState("");
  const [supervisorOfferReviews, setSupervisorOfferReviews] = useState([]);

  const [adminStageWorkspace, setAdminStageWorkspace] = useState(null);
  const [adminStageLoading, setAdminStageLoading] = useState(false);

  const totalPendingActions = pendingActions.reduce(
    (total, action) => total + Number(action.count || 0),
    0
  );

  const selectedStage = useMemo(
    () => standardStages.find((stage) => stage.id === selectedStageId) || null,
    [standardStages, selectedStageId]
  );

  const pendingSupervisorCandidates = useMemo(
    () => supervisorCandidates.filter((candidate) => !candidate.isSupervisor),
    [supervisorCandidates]
  );

  async function reloadStandards() {
    const { data, error } = await supabase.rpc(
      "admin_get_construction_standards_workspace"
    );
    if (error) throw error;
    const stages = Array.isArray(data) ? data : [];
    setStandardStages(stages);
    setSelectedStageId((current) =>
      current && stages.some((stage) => stage.id === current)
        ? current
        : stages[0]?.id || ""
    );
  }

  async function reloadSupervisors() {
    const [candidatesResult, assignmentsResult, offersResult] = await Promise.all([
      supabase.rpc("admin_list_supervisor_candidates"),
      supabase.rpc("admin_list_supervisor_assignment_options"),
      supabase.rpc("admin_list_selected_supervisor_offers"),
    ]);
    if (candidatesResult.error) throw candidatesResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (offersResult.error) throw offersResult.error;

    const candidates = Array.isArray(candidatesResult.data)
      ? candidatesResult.data
      : [];
    const supervisors = Array.isArray(assignmentsResult.data?.supervisors)
      ? assignmentsResult.data.supervisors
      : [];
    const projects = Array.isArray(assignmentsResult.data?.projects)
      ? assignmentsResult.data.projects
      : [];

    setSupervisorCandidates(candidates);
    setSupervisorOfferReviews(Array.isArray(offersResult.data) ? offersResult.data : []);
    setActiveSupervisors(supervisors);
    setSupervisorProjects(projects);
    setSelectedSupervisorId((current) =>
      current && supervisors.some((item) => item.userId === current)
        ? current
        : supervisors[0]?.userId || ""
    );
    setSelectedSupervisorProjectId((current) =>
      current && projects.some((item) => item.projectId === current)
        ? current
        : projects[0]?.projectId || ""
    );
  }

  useEffect(() => {
    if (!adminProfile) return;
    let active = true;

    async function loadInitialData() {
      try {
        setStandardsLoading(true);
        setSupervisorsLoading(true);
        setStandardsError("");
        setSupervisorsError("");
        await Promise.all([reloadStandards(), reloadSupervisors()]);
      } catch (error) {
        if (active) {
          const message = error?.message || "تعذر تحميل بيانات مراحل البناء.";
          setStandardsError(message);
          setSupervisorsError(message);
        }
      } finally {
        if (active) {
          setStandardsLoading(false);
          setSupervisorsLoading(false);
        }
      }
    }

    loadInitialData();
    return () => {
      active = false;
    };
  }, [adminProfile]);

  async function handleAddStandardItem(event) {
    event.preventDefault();
    if (!selectedStageId || standardsSaving) return;
    const text = newStandardText.trim();
    if (text.length < 2) {
      setStandardsError("اكتب معيارًا واضحًا قبل الإضافة.");
      return;
    }
    try {
      setStandardsSaving(true);
      setStandardsError("");
      setStandardsMessage("");
      const { error } = await supabase.rpc(
        "admin_add_general_construction_standard_item",
        {
          p_building_stage_id: selectedStageId,
          p_item_text: text,
          p_is_required: newStandardRequired,
        }
      );
      if (error) throw error;
      setNewStandardText("");
      setNewStandardRequired(true);
      setStandardsMessage("تمت إضافة المعيار العام.");
      await reloadStandards();
    } catch (error) {
      setStandardsError(error?.message || "تعذر إضافة المعيار.");
    } finally {
      setStandardsSaving(false);
    }
  }

  async function handleDeleteStandardItem(itemId) {
    if (!itemId || standardsSaving) return;
    try {
      setStandardsSaving(true);
      setStandardsError("");
      const { error } = await supabase.rpc(
        "admin_delete_general_construction_standard_item",
        { p_standard_item_id: itemId }
      );
      if (error) throw error;
      setStandardsMessage("تم حذف المعيار العام.");
      await reloadStandards();
    } catch (error) {
      setStandardsError(error?.message || "تعذر حذف المعيار.");
    } finally {
      setStandardsSaving(false);
    }
  }

  async function handleUploadStandardDocument() {
    if (!selectedStageId || !standardFile || standardsSaving) return;
    if (!ALLOWED_STANDARD_FILE_TYPES.includes(standardFile.type)) {
      setStandardsError("الملف يجب أن يكون PDF أو JPG أو PNG أو WEBP.");
      return;
    }
    if (standardFile.size <= 0 || standardFile.size > MAX_STANDARD_FILE_SIZE) {
      setStandardsError("حجم ملف المعايير يجب ألا يتجاوز 20 ميجابايت.");
      return;
    }

    let storagePath = "";
    try {
      setStandardsSaving(true);
      setStandardsError("");
      setStandardsMessage("");
      const safeName = sanitizeFileName(standardFile.name);
      const uniquePart =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      storagePath = `general/${selectedStageId}/${uniquePart}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("construction-standards")
        .upload(storagePath, standardFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: standardFile.type,
        });
      if (uploadError) throw uploadError;

      const { error: registerError } = await supabase.rpc(
        "admin_register_general_construction_standard_document",
        {
          p_building_stage_id: selectedStageId,
          p_storage_path: storagePath,
          p_original_name: standardFile.name,
          p_content_type: standardFile.type,
          p_size_bytes: standardFile.size,
        }
      );
      if (registerError) throw registerError;
      setStandardFile(null);
      setStandardsMessage("تم رفع ملف المعايير العامة.");
      await reloadStandards();
    } catch (error) {
      if (storagePath) {
        await supabase.storage.from("construction-standards").remove([storagePath]);
      }
      setStandardsError(error?.message || "تعذر رفع ملف المعايير.");
    } finally {
      setStandardsSaving(false);
    }
  }

  async function handleOpenStandardDocument(document) {
    try {
      setStandardsError("");
      const { data, error } = await supabase.storage
        .from(document.storageBucket || "construction-standards")
        .createSignedUrl(document.storagePath, 300);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("تعذر إنشاء رابط الملف.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setStandardsError(error?.message || "تعذر فتح ملف المعايير.");
    }
  }

  function handleCandidateChange(userId) {
    setSelectedCandidateId(userId);
    const candidate = supervisorCandidates.find((item) => item.userId === userId);
    setSupervisorFullName(candidate?.fullName || "");
    setSupervisorOrganization(candidate?.organizationName || "");
    setSupervisorMobile(candidate?.mobileNumber || "");
    setSupervisorsError("");
    setSupervisorsMessage("");
  }

  async function handleActivateSupervisor(event) {
    event.preventDefault();
    if (!selectedCandidateId || supervisorsSaving) return;
    if (supervisorFullName.trim().length < 3) {
      setSupervisorsError("اكتب اسم المشرف قبل الاعتماد.");
      return;
    }
    try {
      setSupervisorsSaving(true);
      setSupervisorsError("");
      const { error } = await supabase.rpc("admin_activate_supervisor_account", {
        p_user_id: selectedCandidateId,
        p_full_name: supervisorFullName.trim(),
        p_organization_name: supervisorOrganization.trim() || null,
        p_mobile_number: supervisorMobile.trim() || null,
      });
      if (error) throw error;
      setSelectedCandidateId("");
      setSupervisorFullName("");
      setSupervisorOrganization("");
      setSupervisorMobile("");
      setSupervisorsMessage("تم اعتماد الحساب كمشرف نشط.");
      await reloadSupervisors();
    } catch (error) {
      setSupervisorsError(error?.message || "تعذر اعتماد المشرف.");
    } finally {
      setSupervisorsSaving(false);
    }
  }

  async function handleAssignSupervisor(event) {
    event.preventDefault();
    if (!selectedSupervisorId || !selectedSupervisorProjectId || supervisorsSaving) return;
    try {
      setSupervisorsSaving(true);
      setSupervisorsError("");
      const { error } = await supabase.rpc("admin_assign_supervisor_to_project", {
        p_project_id: selectedSupervisorProjectId,
        p_supervisor_user_id: selectedSupervisorId,
      });
      if (error) throw error;
      setSupervisorsMessage("تم تعيين المشرف على المشروع.");
      await reloadSupervisors();
    } catch (error) {
      setSupervisorsError(error?.message || "تعذر تعيين المشرف على المشروع.");
    } finally {
      setSupervisorsSaving(false);
    }
  }

  async function handleDecideSupervisorOffer(offerId, approve) {
    if (!offerId || supervisorsSaving) return;
    const note = approve ? "" : (window.prompt("سبب عدم الاعتماد (اختياري):") || "");
    try {
      setSupervisorsSaving(true);
      setSupervisorsError("");
      const { error } = await supabase.rpc("admin_decide_supervisor_offer", {
        p_offer_id: offerId, p_approve: Boolean(approve), p_note: note || null,
      });
      if (error) throw error;
      setSupervisorsMessage(approve ? "تم اعتماد اختيار العميل، وأصبحت رسوم 2٪ مستحقة على المشرف." : "تم رفض اختيار المشرف ويمكن للعميل اختيار عرض آخر.");
      await reloadSupervisors();
    } catch (error) {
      setSupervisorsError(error?.message || "تعذر تنفيذ قرار العرض.");
    } finally { setSupervisorsSaving(false); }
  }

  async function handleConfirmSupervisorFee(offerId) {
    if (!offerId || supervisorsSaving) return;
    try {
      setSupervisorsSaving(true);
      setSupervisorsError("");
      const { error } = await supabase.rpc("admin_confirm_supervisor_offer_fee_paid", { p_offer_id: offerId });
      if (error) throw error;
      setSupervisorsMessage("تم تأكيد سداد الرسوم وتفعيل المشرف على المشروع.");
      await reloadSupervisors();
    } catch (error) {
      setSupervisorsError(error?.message || "تعذر تأكيد السداد.");
    } finally { setSupervisorsSaving(false); }
  }

  async function handleViewProjectStage(projectId) {
    if (!projectId || adminStageLoading) return;
    try {
      setAdminStageLoading(true);
      setSupervisorsError("");
      const { data, error } = await supabase.rpc(
        "admin_get_construction_stage_workspace",
        { p_project_id: projectId }
      );
      if (error) throw error;
      if (!data?.stage) {
        setAdminStageWorkspace(null);
        setSupervisorsMessage("لا توجد مرحلة بناء مهيأة لهذا المشروع بعد.");
        return;
      }

      const photos = Array.isArray(data.photos) ? data.photos : [];
      const photosWithUrls = await Promise.all(
        photos.map(async (photo) => {
          if (!photo?.storagePath) return photo;
          const { data: signedData } = await supabase.storage
            .from(photo.storageBucket || "construction-stage-photos")
            .createSignedUrl(photo.storagePath, 300);
          return { ...photo, signedUrl: signedData?.signedUrl || null };
        })
      );

      setAdminStageWorkspace({ ...data, photos: photosWithUrls });
      setSupervisorsMessage("");
      requestAnimationFrame(() => {
        document.getElementById("admin-stage-viewer")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (error) {
      setSupervisorsError(error?.message || "تعذر عرض مرحلة المشروع.");
    } finally {
      setAdminStageLoading(false);
    }
  }

  function handleOpenAction(actionType) {
    if (actionType === "land_review") {
      window.location.href = "/admin/customers?status=land_under_review";
      return;
    }
    if (typeof onOpenAction === "function") onOpenAction(actionType);
  }

  function handleOpenSection(sectionKey) {
    if (sectionKey === "supervisors") {
      document.getElementById("admin-supervisors")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    if (typeof onOpenSection === "function") onOpenSection(sectionKey);
  }

  return (
    <main className="admin-dashboard-page">
      <div className="admin-dashboard-container">
        <header className="admin-dashboard-header">
          <div>
            <p>إدارة منصة نايف المزيني</p>
            <h1>لوحة الإدارة</h1>
            <p className="admin-dashboard-welcome">
              مرحبًا <strong>{adminProfile?.full_name || "مدير المنصة"}</strong>
            </p>
          </div>
          <button
            type="button"
            className="admin-dashboard-signout"
            onClick={() => typeof onSignOut === "function" && onSignOut()}
            disabled={isLoading}
          >
            تسجيل الخروج
          </button>
        </header>

        {isLoading && <p className="admin-dashboard-status">جاري تحميل بيانات لوحة الإدارة...</p>}
        {errorMessage && <p className="admin-dashboard-status is-error"><strong>{errorMessage}</strong></p>}

        {!isLoading && !errorMessage && (
          <>
            <section className="admin-dashboard-card">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2>إجراءات تحتاج متابعة</h2>
                  <p>كل إجراء يفتح ملف العميل أو القائمة المرتبطة به.</p>
                </div>
                <span className="admin-dashboard-total-pending">{totalPendingActions}</span>
              </header>

              {pendingActions.length === 0 ? (
                <div className="admin-dashboard-empty">
                  <h3>لا توجد إجراءات معلقة</h3>
                  <p>جميع الأعمال الحالية تمت مراجعتها.</p>
                </div>
              ) : (
                <div className="admin-action-grid">
                  {pendingActions.map((action) => (
                    <button
                      key={action.type}
                      type="button"
                      className="admin-action-button"
                      onClick={() => handleOpenAction(action.type)}
                    >
                      <span>
                        <span style={{ display: "block", marginBottom: 8, fontSize: 28 }}>
                          {ACTION_TYPE_ICONS[action.type] || "🔔"}
                        </span>
                        <span className="admin-action-label">
                          {ACTION_TYPE_LABELS[action.type] || action.label || "إجراء مطلوب"}
                        </span>
                      </span>
                      <strong className="admin-action-count">{Number(action.count || 0)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-dashboard-card">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2>المعايير العامة لمراحل البناء</h2>
                  <p>تضعها الإدارة وتظهر لكل مشروع يمر بالمرحلة نفسها.</p>
                </div>
              </header>

              {standardsError && <p className="admin-dashboard-status is-error"><strong>{standardsError}</strong></p>}
              {standardsMessage && <p className="admin-dashboard-status"><strong>{standardsMessage}</strong></p>}

              {standardsLoading ? (
                <p>جاري تحميل مراحل البناء...</p>
              ) : standardStages.length === 0 ? (
                <p>لا توجد مراحل بناء متاحة.</p>
              ) : (
                <div style={{ display: "grid", gap: 18 }}>
                  <label style={{ display: "grid", gap: 8 }}>
                    <strong>المرحلة التفصيلية</strong>
                    <select
                      value={selectedStageId}
                      onChange={(event) => setSelectedStageId(event.target.value)}
                      disabled={standardsSaving}
                    >
                      {standardStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.mainStageName} — {stage.detailedStageName}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedStage && (
                    <>
                      <div>
                        <strong style={{ display: "block", fontSize: 20 }}>
                          {selectedStage.mainStageName}
                        </strong>
                        <span>{selectedStage.detailedStageName}</span>
                      </div>

                      <form onSubmit={handleAddStandardItem} style={{ display: "grid", gap: 10 }}>
                        <textarea
                          rows="3"
                          value={newStandardText}
                          onChange={(event) => setNewStandardText(event.target.value)}
                          disabled={standardsSaving}
                          placeholder="أضف معيارًا عامًا لهذه المرحلة"
                        />
                        <label>
                          <input
                            type="checkbox"
                            checked={newStandardRequired}
                            onChange={(event) => setNewStandardRequired(event.target.checked)}
                          />{" "}
                          معيار إلزامي
                        </label>
                        <button type="submit" disabled={standardsSaving || !newStandardText.trim()}>
                          إضافة المعيار
                        </button>
                      </form>

                      <div style={{ display: "grid", gap: 8 }}>
                        {(selectedStage.items || []).map((item) => (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span>☐ {item.text}{item.required ? " — إلزامي" : ""}</span>
                            <button type="button" onClick={() => handleDeleteStandardItem(item.id)} disabled={standardsSaving}>
                              حذف
                            </button>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        <strong>ملف المعايير العامة</strong>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(event) => setStandardFile(event.target.files?.[0] || null)}
                          disabled={standardsSaving}
                        />
                        <button type="button" onClick={handleUploadStandardDocument} disabled={standardsSaving || !standardFile}>
                          رفع الملف
                        </button>
                        {(selectedStage.documents || []).map((document) => (
                          <button key={document.id} type="button" onClick={() => handleOpenStandardDocument(document)}>
                            📄 {document.originalName}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            <section id="admin-supervisors" className="admin-dashboard-card">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2>المشرفون والموردون</h2>
                  <p>سجلات المتقدمين والحسابات المعتمدة في المنصة.</p>
                </div>
              </header>

              <div className="admin-partner-directory-grid">
                <button type="button" className="admin-partner-directory-card" onClick={() => { window.location.href = "/admin/supervisor-applications?view=applicants"; }}>
                  <span className="admin-partner-directory-icon">📝</span>
                  <span className="admin-partner-directory-title">المشرفون المتقدمون</span>
                  <span className="admin-partner-directory-note">عرض طلبات التسجيل وسجلات المشرفين المتقدمين</span>
                </button>

                <button type="button" className="admin-partner-directory-card" onClick={() => { window.location.href = "/admin/supervisor-applications?view=approved"; }}>
                  <span className="admin-partner-directory-icon">✅</span>
                  <span className="admin-partner-directory-title">المشرفون المعتمدون</span>
                  <span className="admin-partner-directory-note">عرض سجلات المشرفين المقبولين في المنصة</span>
                </button>

                <button type="button" className="admin-partner-directory-card" onClick={() => { window.location.href = "/admin/supplier-applications?view=applicants"; }}>
                  <span className="admin-partner-directory-icon">📝</span>
                  <span className="admin-partner-directory-title">الموردون المتقدمون</span>
                  <span className="admin-partner-directory-note">عرض طلبات التسجيل وسجلات الموردين المتقدمين</span>
                </button>

                <button type="button" className="admin-partner-directory-card" onClick={() => { window.location.href = "/admin/supplier-applications?view=approved"; }}>
                  <span className="admin-partner-directory-icon">✅</span>
                  <span className="admin-partner-directory-title">الموردون المعتمدون</span>
                  <span className="admin-partner-directory-note">عرض سجلات الموردين المقبولين في المنصة</span>
                </button>
              </div>
            </section>

            {adminStageWorkspace?.stage && (
              <section id="admin-stage-viewer" className="admin-dashboard-card">
                <header style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 12, marginBottom: 18 }}>
                  <h2 style={{ margin: 0, fontWeight: 950 }}>{adminStageWorkspace.stage.mainStageName}</h2>
                  <p style={{ margin: "6px 0 0", fontSize: 18 }}>{adminStageWorkspace.stage.detailedStageName}</p>
                </header>

                <div style={{ display: "grid", gap: 22 }}>
                  <div>
                    <h3>صور المرحلة</h3>
                    {(adminStageWorkspace.photos || []).length === 0 ? (
                      <p>لا توجد صور بعد.</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                        {adminStageWorkspace.photos.map((photo) => (
                          <figure key={photo.id} style={{ margin: 0, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                            {photo.signedUrl ? (
                              <img src={photo.signedUrl} alt={photo.caption || "صورة المرحلة"} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                            ) : (
                              <div style={{ padding: 20 }}>📷 {photo.originalName}</div>
                            )}
                            {photo.caption && <figcaption style={{ padding: 9 }}>{photo.caption}</figcaption>}
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>

                  <StageStandards title="المعايير الخاصة بالمشروع" items={adminStageWorkspace.projectStandards || []} />
                  <StageStandards title="المعايير العامة" items={adminStageWorkspace.generalStandards || []} />
                </div>
              </section>
            )}

            <section className="admin-dashboard-card">
              <h2>أقسام إدارة المنصة</h2>
              <div className="admin-section-grid">
                {Object.entries(SECTION_LABELS).map(([sectionKey, sectionLabel]) => (
                  <button key={sectionKey} type="button" className="admin-section-button" onClick={() => handleOpenSection(sectionKey)}>
                    <span className="admin-section-icon">{SECTION_ICONS[sectionKey] || "📁"}</span>
                    <span className="admin-section-label">{sectionLabel}</span>
                    {sectionKey !== "settings" && (
                      <strong className="admin-section-count">{Number(sectionCounts[sectionKey] || 0)}</strong>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="admin-dashboard-card">
              <h2>ملخص التشغيل</h2>
              <dl className="admin-summary-grid">
                <div className="admin-summary-item"><dt>طلبات العملاء الجديدة</dt><dd>{Number(sectionCounts.newCustomers || 0)}</dd></div>
                <div className="admin-summary-item is-highlight"><dt>العملاء المقبولون</dt><dd>{Number(sectionCounts.approvedCustomers || 0)}</dd></div>
                <div className="admin-summary-item"><dt>الملفات قيد التنفيذ</dt><dd>{Number(sectionCounts.activeProjects || 0)}</dd></div>
                <div className="admin-summary-item"><dt>الملفات المغلقة</dt><dd>{Number(sectionCounts.closedFiles || 0)}</dd></div>
              </dl>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default AdminDashboardPage;
