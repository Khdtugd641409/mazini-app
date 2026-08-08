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

  const totalPendingActions = pendingActions.reduce(
    (total, action) => total + Number(action.count || 0),
    0
  );

  const selectedStage = useMemo(
    () => standardStages.find((stage) => stage.id === selectedStageId) || null,
    [standardStages, selectedStageId]
  );

  useEffect(() => {
    if (!adminProfile) return;

    let active = true;

    async function loadStandards() {
      try {
        setStandardsLoading(true);
        setStandardsError("");

        const { data, error } = await supabase.rpc(
          "admin_get_construction_standards_workspace"
        );

        if (error) throw error;
        if (!active) return;

        const stages = Array.isArray(data) ? data : [];
        setStandardStages(stages);
        setSelectedStageId((current) =>
          current && stages.some((stage) => stage.id === current)
            ? current
            : stages[0]?.id || ""
        );
      } catch (error) {
        if (active) {
          setStandardsError(
            error?.message || "تعذر تحميل معايير مراحل البناء."
          );
        }
      } finally {
        if (active) setStandardsLoading(false);
      }
    }

    loadStandards();

    return () => {
      active = false;
    };
  }, [adminProfile]);

  async function reloadStandards(keepMessage = true) {
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

    if (!keepMessage) setStandardsMessage("");
  }

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
      setStandardsMessage("");

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
        await supabase.storage
          .from("construction-standards")
          .remove([storagePath]);
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

  function handleOpenAction(actionType) {
    if (actionType === "land_review") {
      window.location.href = "/admin/customers?status=land_under_review";
      return;
    }

    if (typeof onOpenAction === "function") {
      onOpenAction(actionType);
    }
  }

  function handleOpenSection(sectionKey) {
    if (typeof onOpenSection === "function") {
      onOpenSection(sectionKey);
    }
  }

  function handleSignOut() {
    if (typeof onSignOut === "function") {
      onSignOut();
    }
  }

  return (
    <main className="admin-dashboard-page">
      <div className="admin-dashboard-container">
        <header className="admin-dashboard-header">
          <div>
            <p>إدارة منصة نايف المزيني</p>
            <h1>لوحة الإدارة</h1>
            <p className="admin-dashboard-welcome">
              مرحبًا{" "}
              <strong>{adminProfile?.full_name || "مدير المنصة"}</strong>
            </p>
          </div>

          <button
            type="button"
            className="admin-dashboard-signout"
            onClick={handleSignOut}
            disabled={isLoading}
          >
            تسجيل الخروج
          </button>
        </header>

        {isLoading && (
          <p className="admin-dashboard-status" role="status">
            جاري تحميل بيانات لوحة الإدارة...
          </p>
        )}

        {errorMessage && (
          <p className="admin-dashboard-status is-error" role="alert">
            <strong>{errorMessage}</strong>
          </p>
        )}

        {!isLoading && !errorMessage && (
          <>
            <section className="admin-dashboard-card" aria-labelledby="pending-actions-title">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2 id="pending-actions-title">إجراءات تحتاج متابعة</h2>
                  <p>
                    كل إجراء يفتح ملف العميل أو قائمة العملاء في المرحلة ذات الصلة؛
                    لا توجد مسارات تشغيل موازية للعميل.
                  </p>
                </div>

                <span
                  className="admin-dashboard-total-pending"
                  aria-label={`إجمالي الإجراءات المعلقة ${totalPendingActions}`}
                >
                  {totalPendingActions}
                </span>
              </header>

              {pendingActions.length === 0 ? (
                <div className="admin-dashboard-empty">
                  <h3>لا توجد إجراءات معلقة</h3>
                  <p>جميع الأعمال الحالية تمت مراجعتها.</p>
                </div>
              ) : (
                <div className="admin-action-grid">
                  {pendingActions.map((action) => {
                    const actionLabel =
                      ACTION_TYPE_LABELS[action.type] || action.label || "إجراء مطلوب";
                    const actionIcon = ACTION_TYPE_ICONS[action.type] || "🔔";

                    return (
                      <button
                        key={action.type}
                        type="button"
                        className="admin-action-button"
                        onClick={() => handleOpenAction(action.type)}
                      >
                        <span>
                          <span aria-hidden="true" style={{ display: "block", marginBottom: "8px", fontSize: "28px" }}>
                            {actionIcon}
                          </span>
                          <span className="admin-action-label">{actionLabel}</span>
                        </span>
                        <strong className="admin-action-count">{Number(action.count || 0)}</strong>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="admin-dashboard-card" aria-labelledby="construction-standards-title">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2 id="construction-standards-title">المعايير العامة لمراحل البناء</h2>
                  <p>
                    هذه المعايير تضعها إدارة المنصة وتظهر في كل مشروع يمر بالمرحلة نفسها.
                  </p>
                </div>
              </header>

              {standardsError && (
                <p className="admin-dashboard-status is-error" role="alert">
                  <strong>{standardsError}</strong>
                </p>
              )}

              {standardsMessage && (
                <p className="admin-dashboard-status" role="status">
                  <strong>{standardsMessage}</strong>
                </p>
              )}

              {standardsLoading ? (
                <p>جاري تحميل مراحل البناء...</p>
              ) : standardStages.length === 0 ? (
                <p>لا توجد مراحل بناء متاحة.</p>
              ) : (
                <div style={{ display: "grid", gap: "18px" }}>
                  <label style={{ display: "grid", gap: "8px" }}>
                    <strong>المرحلة التفصيلية</strong>
                    <select
                      value={selectedStageId}
                      onChange={(event) => setSelectedStageId(event.target.value)}
                      disabled={standardsSaving}
                      style={{ minHeight: "46px", padding: "0 12px", borderRadius: "10px", border: "1px solid #d1d5db", font: "inherit" }}
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
                        <strong style={{ display: "block", fontSize: "20px", marginBottom: "4px" }}>
                          {selectedStage.mainStageName}
                        </strong>
                        <span>{selectedStage.detailedStageName}</span>
                      </div>

                      <form onSubmit={handleAddStandardItem} style={{ display: "grid", gap: "10px" }}>
                        <label style={{ display: "grid", gap: "8px" }}>
                          <strong>إضافة معيار عام</strong>
                          <textarea
                            rows="3"
                            value={newStandardText}
                            onChange={(event) => setNewStandardText(event.target.value)}
                            disabled={standardsSaving}
                            placeholder="مثال: التأكد من مطابقة الأبعاد والاشتراطات للكود المعتمد."
                            style={{ padding: "12px", borderRadius: "10px", border: "1px solid #d1d5db", font: "inherit", resize: "vertical" }}
                          />
                        </label>

                        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={newStandardRequired}
                            onChange={(event) => setNewStandardRequired(event.target.checked)}
                            disabled={standardsSaving}
                          />
                          معيار إلزامي لإكمال المرحلة
                        </label>

                        <button type="submit" className="admin-dashboard-signout" disabled={standardsSaving || !newStandardText.trim()}>
                          إضافة المعيار
                        </button>
                      </form>

                      <div>
                        <strong style={{ display: "block", marginBottom: "10px" }}>بنود المعايير العامة</strong>
                        {selectedStage.items?.length ? (
                          <div style={{ display: "grid", gap: "8px" }}>
                            {selectedStage.items.map((item) => (
                              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "11px 12px", border: "1px solid #e5e7eb", borderRadius: "10px" }}>
                                <span>☐ {item.text}{item.required ? " — إلزامي" : ""}</span>
                                <button type="button" onClick={() => handleDeleteStandardItem(item.id)} disabled={standardsSaving} style={{ border: "1px solid #ef4444", color: "#b91c1c", background: "#fff", borderRadius: "8px", padding: "7px 10px", cursor: "pointer" }}>
                                  حذف
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p>لم تضف الإدارة معايير لهذه المرحلة بعد.</p>
                        )}
                      </div>

                      <div style={{ display: "grid", gap: "10px" }}>
                        <strong>ملف المعايير العامة</strong>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(event) => setStandardFile(event.target.files?.[0] || null)}
                          disabled={standardsSaving}
                        />
                        <button
                          type="button"
                          className="admin-dashboard-signout"
                          onClick={handleUploadStandardDocument}
                          disabled={standardsSaving || !standardFile}
                        >
                          رفع الملف
                        </button>

                        {selectedStage.documents?.length ? (
                          <div style={{ display: "grid", gap: "8px" }}>
                            {selectedStage.documents.map((document) => (
                              <button
                                key={document.id}
                                type="button"
                                onClick={() => handleOpenStandardDocument(document)}
                                style={{ textAlign: "right", padding: "11px 12px", border: "1px solid #d1d5db", borderRadius: "10px", background: "#fff", cursor: "pointer", font: "inherit" }}
                              >
                                📄 {document.originalName}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p>لا يوجد ملف معايير مرفوع لهذه المرحلة.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="admin-dashboard-card" aria-labelledby="platform-sections-title">
              <h2 id="platform-sections-title">أقسام إدارة المنصة</h2>

              <div className="admin-section-grid">
                {Object.entries(SECTION_LABELS).map(([sectionKey, sectionLabel]) => {
                  const showCount = sectionKey !== "settings";

                  return (
                    <button
                      key={sectionKey}
                      type="button"
                      className="admin-section-button"
                      onClick={() => handleOpenSection(sectionKey)}
                    >
                      <span className="admin-section-icon" aria-hidden="true">
                        {SECTION_ICONS[sectionKey] || "📁"}
                      </span>
                      <span className="admin-section-label">{sectionLabel}</span>
                      {showCount && (
                        <strong className="admin-section-count">
                          {Number(sectionCounts[sectionKey] || 0)}
                        </strong>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="admin-dashboard-card" aria-labelledby="dashboard-summary-title">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2 id="dashboard-summary-title">ملخص التشغيل</h2>
                  <p>نظرة سريعة على حالة ملفات العملاء والمشاريع.</p>
                </div>
              </header>

              <dl className="admin-summary-grid">
                <div className="admin-summary-item">
                  <dt>طلبات العملاء الجديدة</dt>
                  <dd>{Number(sectionCounts.newCustomers || 0)}</dd>
                </div>
                <div className="admin-summary-item is-highlight">
                  <dt>العملاء المقبولون</dt>
                  <dd>{Number(sectionCounts.approvedCustomers || 0)}</dd>
                </div>
                <div className="admin-summary-item">
                  <dt>الملفات قيد التنفيذ</dt>
                  <dd>{Number(sectionCounts.activeProjects || 0)}</dd>
                </div>
                <div className="admin-summary-item">
                  <dt>الملفات المغلقة</dt>
                  <dd>{Number(sectionCounts.closedFiles || 0)}</dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default AdminDashboardPage;
