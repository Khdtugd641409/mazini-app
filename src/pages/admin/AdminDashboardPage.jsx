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
  const totalPendingActions = pendingActions.reduce(
    (total, action) => total + Number(action.count || 0),
    0
  );

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
                      ACTION_TYPE_LABELS[action.type] ||
                      action.label ||
                      "إجراء مطلوب";

                    const actionIcon =
                      ACTION_TYPE_ICONS[action.type] || "🔔";

                    return (
                      <button
                        key={action.type}
                        type="button"
                        className="admin-action-button"
                        onClick={() => handleOpenAction(action.type)}
                      >
                        <span>
                          <span
                            aria-hidden="true"
                            style={{
                              display: "block",
                              marginBottom: "8px",
                              fontSize: "28px",
                            }}
                          >
                            {actionIcon}
                          </span>
                          <span className="admin-action-label">
                            {actionLabel}
                          </span>
                        </span>

                        <strong className="admin-action-count">
                          {Number(action.count || 0)}
                        </strong>
                      </button>
                    );
                  })}
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
