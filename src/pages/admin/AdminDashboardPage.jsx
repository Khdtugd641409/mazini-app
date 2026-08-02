const ACTION_TYPE_LABELS = {
  new_customer_application: "طلبات عملاء جديدة",
  customer_needs_completion: "طلبات تحتاج استكمال",
  land_review: "أراضٍ بانتظار المراجعة",
  land_transfer: "طلبات إفراغ تحتاج اعتماد",
  supervisor_report: "تقارير مشرفين تحتاج مراجعة",
  investor_application: "طلبات مستثمرين",
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

  return (
    <main>
      <header>
        <div>
          <p>نايف المزيني للبناء الذاتي</p>

          <h1>إدارة المنصة</h1>

          <p>
            مرحبًا{" "}
            <strong>
              {adminProfile?.full_name || "مدير المنصة"}
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
        >
          تسجيل الخروج
        </button>
      </header>

      {isLoading && (
        <p role="status">
          جاري تحميل بيانات لوحة الإدارة...
        </p>
      )}

      {errorMessage && (
        <p role="alert">
          <strong>{errorMessage}</strong>
        </p>
      )}

      {!isLoading && !errorMessage && (
        <>
          <section aria-labelledby="pending-actions-title">
            <header>
              <h2 id="pending-actions-title">
                إجراءات تحتاج متابعة
              </h2>

              <p>
                إجمالي الإجراءات المعلقة:{" "}
                <strong>{totalPendingActions}</strong>
              </p>
            </header>

            {pendingActions.length === 0 ? (
              <div>
                <h3>لا توجد إجراءات معلقة</h3>

                <p>
                  جميع الأعمال الحالية تمت مراجعتها.
                </p>
              </div>
            ) : (
              <div>
                {pendingActions.map((action) => {
                  const actionLabel =
                    ACTION_TYPE_LABELS[action.type] ||
                    action.label ||
                    "إجراء مطلوب";

                  return (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() =>
                        onOpenAction(action.type)
                      }
                    >
                      <span>{actionLabel}</span>

                      <strong>
                        {Number(action.count || 0)}
                      </strong>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="platform-sections-title">
            <h2 id="platform-sections-title">
              أقسام إدارة المنصة
            </h2>

            <div>
              {Object.entries(SECTION_LABELS).map(
                ([sectionKey, sectionLabel]) => (
                  <button
                    key={sectionKey}
                    type="button"
                    onClick={() =>
                      onOpenSection(sectionKey)
                    }
                  >
                    <span>{sectionLabel}</span>

                    {sectionKey !== "settings" && (
                      <strong>
                        {Number(
                          sectionCounts[sectionKey] || 0
                        )}
                      </strong>
                    )}
                  </button>
                )
              )}
            </div>
          </section>

          <section aria-labelledby="dashboard-summary-title">
            <h2 id="dashboard-summary-title">
              ملخص التشغيل
            </h2>

            <dl>
              <div>
                <dt>طلبات العملاء الجديدة</dt>
                <dd>
                  {Number(
                    sectionCounts.newCustomers || 0
                  )}
                </dd>
              </div>

              <div>
                <dt>العملاء المقبولون</dt>
                <dd>
                  {Number(
                    sectionCounts.approvedCustomers || 0
                  )}
                </dd>
              </div>

              <div>
                <dt>الملفات قيد التنفيذ</dt>
                <dd>
                  {Number(
                    sectionCounts.activeProjects || 0
                  )}
                </dd>
              </div>

              <div>
                <dt>الملفات المغلقة</dt>
                <dd>
                  {Number(
                    sectionCounts.closedFiles || 0
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </main>
  );
}

export default AdminDashboardPage;
