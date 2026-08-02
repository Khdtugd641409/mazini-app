import { useMemo, useState } from "react";
import {
  formatPercentage,
  formatSaudiRiyal,
  formatSquareMeters,
} from "../../utils/projectCalculations.js";
import "./AdminCustomerWorkspace.css";

const STATUS_LABELS = {
  under_review: "تحت المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبول",
  rejected: "مرفوض",
  waiting_land: "بانتظار تقديم الأرض",
  land_under_review: "الأرض تحت المراجعة",
  land_approved: "تم قبول الأرض",
  land_rejected: "تم رفض الأرض",
  waiting_transfer: "بانتظار الإفراغ",
  transfer_in_progress: "إجراءات الإفراغ جارية",
  active_project: "المشروع قيد التنفيذ",
  closed: "ملف مغلق",
};

const STAGE_LABELS = {
  application_review: "مراجعة طلب العميل",
  waiting_land: "انتظار تقديم الأرض",
  land_review: "فحص الأرض",
  land_transfer: "إفراغ الأرض",
  project_execution: "تنفيذ المشروع",
  project_closure: "إغلاق المشروع",
};

const DECISION_LABELS = {
  approve: "قبول العميل",
  needs_completion: "طلب استكمال",
  reject: "رفض الطلب",
};

const NOTE_TYPE_LABELS = {
  admin_note: "ملاحظة إدارية",
  approval_note: "ملاحظة القبول",
  completion_request: "طلب استكمال",
  rejection_note: "سبب الرفض",
  system_note: "ملاحظة النظام",
};

const EVENT_TYPE_LABELS = {
  customer_file_created: "إنشاء الملف",
  status_changed: "تغيير الحالة",
  stage_changed: "تغيير المرحلة",
  current_state_snapshot: "الحالة الحالية",
};

const PROJECT_STAGES = [
  "تقديم الطلب",
  "مراجعة الإدارة",
  "قبول العميل",
  "تقديم الأرض",
  "فحص الأرض",
  "إفراغ الأرض",
  "تعيين مشرف المشروع",
  "التنفيذ",
  "الإغلاق",
];

function formatDate(value) {
  if (!value) {
    return "غير متوفر";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusClass(status) {
  if (status === "under_review") {
    return "is-under-review";
  }

  if (
    status === "approved" ||
    status === "waiting_land"
  ) {
    return "is-approved";
  }

  if (status === "needs_completion") {
    return "is-needs-completion";
  }

  if (status === "rejected") {
    return "is-rejected";
  }

  return "is-default";
}

function getCurrentRequiredAction(customerFile) {
  if (!customerFile) {
    return "غير محدد";
  }

  if (customerFile.status === "under_review") {
    return "مراجعة الطلب واتخاذ قرار";
  }

  if (customerFile.status === "needs_completion") {
    return "انتظار استكمال العميل للبيانات المطلوبة";
  }

  if (
    customerFile.status === "approved" ||
    customerFile.current_stage === "waiting_land"
  ) {
    return "انتظار تقديم العميل للأرض";
  }

  if (customerFile.status === "rejected") {
    return "لا يوجد إجراء — الطلب مرفوض";
  }

  if (customerFile.status === "closed") {
    return "لا يوجد إجراء — الملف مغلق";
  }

  return (
    STAGE_LABELS[customerFile.current_stage] ||
    customerFile.current_stage ||
    "غير محدد"
  );
}

function AdminCustomerWorkspace({
  customerFile,
  notes = [],
  timeline = [],
  isLoading = false,
  errorMessage = "",
  isSubmittingDecision = false,
  decisionError = "",
  onBack,
  onRefresh,
  onDecision,
}) {
  const [selectedDecision, setSelectedDecision] =
    useState("");

  const [decisionNote, setDecisionNote] =
    useState("");

  const statusLabel =
    STATUS_LABELS[customerFile?.status] ||
    customerFile?.status ||
    "غير محددة";

  const stageLabel =
    STAGE_LABELS[customerFile?.current_stage] ||
    customerFile?.current_stage ||
    "غير محددة";

  const statusClass = getStatusClass(
    customerFile?.status
  );

  const currentRequiredAction =
    getCurrentRequiredAction(customerFile);

  const canDecide = [
    "under_review",
    "needs_completion",
  ].includes(customerFile?.status);

  const requiresDecisionNote =
    selectedDecision === "needs_completion" ||
    selectedDecision === "reject";

  const decisionButtonDisabled =
    !selectedDecision ||
    isSubmittingDecision ||
    (requiresDecisionNote &&
      decisionNote.trim().length === 0);

  const financingRatio = useMemo(() => {
    return Number(
      customerFile?.financing_ratio || 0
    );
  }, [customerFile]);

  const estimatedProjectCost = Number(
    customerFile?.estimated_project_cost || 0
  );

  const platformShare =
    estimatedProjectCost * 0.015;

  const supervisorShare =
    estimatedProjectCost * 0.015;

  const investorsShare =
    estimatedProjectCost * 0.09;

  const handleSubmitDecision = async (event) => {
    event.preventDefault();

    if (
      decisionButtonDisabled ||
      typeof onDecision !== "function"
    ) {
      return;
    }

    try {
      await onDecision({
        customerFileId: customerFile.id,
        decision: selectedDecision,
        note: decisionNote,
      });

      setSelectedDecision("");
      setDecisionNote("");
    } catch {
      // App.jsx يعرض الخطأ من خلال decisionError.
    }
  };

  if (isLoading) {
    return (
      <main className="workspace-loading">
        <p role="status">
          جاري تحميل ملف العميل...
        </p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="workspace-error-state">
        <h1>تعذر فتح ملف العميل</h1>

        <p role="alert">
          <strong>{errorMessage}</strong>
        </p>

        <button
          type="button"
          className="workspace-button"
          onClick={onBack}
        >
          العودة إلى ملفات العملاء
        </button>
      </main>
    );
  }

  if (!customerFile) {
    return (
      <main className="workspace-missing-state">
        <h1>ملف العميل غير موجود</h1>

        <button
          type="button"
          className="workspace-button"
          onClick={onBack}
        >
          العودة إلى ملفات العملاء
        </button>
      </main>
    );
  }

  return (
    <main className="admin-customer-workspace">
      <div className="workspace-container">
        <header className="workspace-header">
          <div>
            <p>إدارة منصة نايف المزيني</p>

            <h1>
              ملف العميل{" "}
              {customerFile.file_number}
            </h1>

            <p>
              آخر تحديث:{" "}
              <strong>
                {formatDate(
                  customerFile.updated_at
                )}
              </strong>
            </p>
          </div>

          <div className="workspace-header-actions">
            <button
              type="button"
              className="workspace-button is-secondary"
              onClick={onRefresh}
              disabled={isSubmittingDecision}
            >
              تحديث الملف
            </button>

            <button
              type="button"
              className="workspace-button"
              onClick={onBack}
              disabled={isSubmittingDecision}
            >
              العودة إلى ملفات العملاء
            </button>
          </div>
        </header>

        <section
          className="workspace-card workspace-required-action"
          aria-labelledby="required-action-title"
        >
          <h2 id="required-action-title">
            الإجراء الحالي المطلوب
          </h2>

          <p>{currentRequiredAction}</p>
        </section>

        <section
          className="workspace-card"
          aria-labelledby="file-status-title"
        >
          <h2 id="file-status-title">
            الحالة التشغيلية
          </h2>

          <dl className="workspace-status-grid">
            <div className="workspace-data-item">
              <dt>رقم الملف</dt>

              <dd>
                {customerFile.file_number}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>الحالة الحالية</dt>

              <dd>
                <span
                  className={`workspace-status-badge ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>المرحلة الحالية</dt>

              <dd>{stageLabel}</dd>
            </div>

            <div className="workspace-data-item">
              <dt>تاريخ التقديم</dt>

              <dd>
                {formatDate(
                  customerFile.submitted_at
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>تاريخ القبول</dt>

              <dd>
                {formatDate(
                  customerFile.approved_at
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>تاريخ الرفض</dt>

              <dd>
                {formatDate(
                  customerFile.rejected_at
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="workspace-card"
          aria-labelledby="customer-data-title"
        >
          <h2 id="customer-data-title">
            بيانات العميل
          </h2>

          <dl className="workspace-data-grid">
            <div className="workspace-data-item">
              <dt>الاسم الكامل</dt>

              <dd>
                {customerFile.customer_name ||
                  "غير متوفر"}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>رقم الجوال</dt>

              <dd>
                {customerFile.mobile_number ||
                  "غير متوفر"}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>البريد الإلكتروني</dt>

              <dd>
                {customerFile.email ||
                  "غير مضاف"}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="workspace-card"
          aria-labelledby="project-data-title"
        >
          <h2 id="project-data-title">
            بيانات المشروع والتمويل
          </h2>

          <dl className="workspace-data-grid">
            <div className="workspace-data-item">
              <dt>مساحة الأرض</dt>

              <dd>
                {formatSquareMeters(
                  customerFile.land_area
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>قيمة الأرض</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .estimated_land_price
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>عدد الأدوار</dt>

              <dd>
                {customerFile.floors ??
                  "غير متوفر"}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>عرض البنك</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile.bank_offer
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>
                المساحة المحتسبة لكل دور
              </dt>

              <dd>
                {formatSquareMeters(
                  customerFile
                    .building_area_per_floor
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>إجمالي مسطح البناء</dt>

              <dd>
                {formatSquareMeters(
                  customerFile
                    .total_building_area
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>سعر متر البناء</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile.meter_rate
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>تكلفة البناء التقديرية</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .estimated_construction_cost
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>إجمالي تكلفة المشروع</dt>

              <dd className="workspace-financial-highlight">
                {formatSaudiRiyal(
                  estimatedProjectCost
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>
                نسبة التكلفة إلى عرض البنك
              </dt>

              <dd>
                {formatPercentage(
                  financingRatio
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="workspace-card"
          aria-labelledby="payment-title"
        >
          <h2 id="payment-title">
            الدفعة المقدمة وتوزيعها
          </h2>

          <dl className="workspace-data-grid">
            <div className="workspace-data-item">
              <dt>
                دفعة العميل الأساسية 12٪
              </dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .base_customer_payment
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>
                فرق التجاوز عن حد 80٪
              </dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile.excess_amount
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>
                إجمالي الدفعة المطلوبة
              </dt>

              <dd className="workspace-financial-highlight">
                {formatSaudiRiyal(
                  customerFile
                    .total_customer_payment
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>حصة المنصة 1.5٪</dt>

              <dd>
                {formatSaudiRiyal(
                  platformShare
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>
                حصة مشرف المشروع 1.5٪
              </dt>

              <dd>
                {formatSaudiRiyal(
                  supervisorShare
                )}
              </dd>
            </div>

            <div className="workspace-data-item">
              <dt>حصة المستثمرين 9٪</dt>

              <dd>
                {formatSaudiRiyal(
                  investorsShare
                )}
              </dd>
            </div>
          </dl>

          {customerFile
            .requires_extra_payment_approval && (
            <p className="workspace-approval-message">
              موافقة العميل على الدفعة
              الإضافية:{" "}
              <strong>
                {customerFile
                  .extra_payment_approved
                  ? "تمت الموافقة"
                  : "لم تتم الموافقة"}
              </strong>
            </p>
          )}
        </section>

        <section
          className="workspace-card"
          aria-labelledby="stages-title"
        >
          <h2 id="stages-title">
            مراحل ملف العميل
          </h2>

          <ol className="workspace-stage-list">
            {PROJECT_STAGES.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>

          <p className="workspace-current-stage">
            المرحلة الحالية:{" "}
            <strong>{stageLabel}</strong>
          </p>
        </section>

        {/* نهاية الجزء الأول — ألصق الجزء الثاني مباشرة هنا */}
                <section
          className="workspace-card"
          aria-labelledby="timeline-title"
        >
          <h2 id="timeline-title">
            السجل الزمني
          </h2>

          {timeline.length === 0 ? (
            <p>
              لا توجد أحداث مسجلة في السجل الزمني.
            </p>
          ) : (
            <ol className="workspace-timeline">
              {timeline.map((eventItem) => {
                const eventLabel =
                  EVENT_TYPE_LABELS[
                    eventItem.event_type
                  ] ||
                  eventItem.event_type ||
                  "حدث";

                return (
                  <li
                    key={eventItem.id}
                    className="workspace-timeline-item"
                  >
                    <article className="workspace-timeline-article">
                      <header className="workspace-timeline-header">
                        <p>
                          <strong>
                            {eventItem.title ||
                              eventLabel}
                          </strong>
                        </p>

                        <time
                          dateTime={
                            eventItem.created_at
                          }
                        >
                          {formatDate(
                            eventItem.created_at
                          )}
                        </time>
                      </header>

                      {eventItem.description && (
                        <p className="workspace-timeline-description">
                          {eventItem.description}
                        </p>
                      )}

                      <p className="workspace-timeline-type">
                        نوع الحدث: {eventLabel}
                      </p>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
                <section
          className="workspace-card"
          aria-labelledby="notes-title"
        >
          <h2 id="notes-title">
            ملاحظات الملف
          </h2>

          {notes.length === 0 ? (
            <p>لا توجد ملاحظات مسجلة.</p>
          ) : (
            <div className="workspace-notes-list">
              {notes.map((noteItem) => {
                const noteLabel =
                  NOTE_TYPE_LABELS[
                    noteItem.note_type
                  ] ||
                  noteItem.note_type ||
                  "ملاحظة";

                return (
                  <article
                    key={noteItem.id}
                    className="workspace-note"
                  >
                    <h3>{noteLabel}</h3>

                    <p>{noteItem.note}</p>

                    <p className="workspace-note-date">
                      {formatDate(
                        noteItem.created_at
                      )}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
                {canDecide ? (
          <section
            className="workspace-card workspace-decision-card"
            aria-labelledby="decision-title"
          >
            <h2 id="decision-title">
              قرار إدارة المنصة
            </h2>

            <form
              className="workspace-decision-form"
              onSubmit={handleSubmitDecision}
            >
              <label htmlFor="adminDecision">
                القرار
              </label>

              <select
                id="adminDecision"
                value={selectedDecision}
                onChange={(event) => {
                  setSelectedDecision(
                    event.target.value
                  );

                  setDecisionNote("");
                }}
                disabled={isSubmittingDecision}
                required
              >
                <option value="">
                  اختر القرار
                </option>

                <option value="approve">
                  قبول العميل
                </option>

                <option value="needs_completion">
                  طلب استكمال
                </option>

                <option value="reject">
                  رفض الطلب
                </option>
              </select>

              <label htmlFor="decisionNote">
                {selectedDecision ===
                "needs_completion"
                  ? "البيانات المطلوب استكمالها"
                  : selectedDecision === "reject"
                    ? "سبب الرفض"
                    : "ملاحظة القبول — اختيارية"}
              </label>

              <textarea
                id="decisionNote"
                value={decisionNote}
                onChange={(event) =>
                  setDecisionNote(
                    event.target.value
                  )
                }
                rows="5"
                disabled={isSubmittingDecision}
                required={requiresDecisionNote}
              />

              {decisionError && (
                <p
                  className="workspace-decision-error"
                  role="alert"
                >
                  <strong>
                    {decisionError}
                  </strong>
                </p>
              )}

              <button
                type="submit"
                className="workspace-decision-submit"
                disabled={decisionButtonDisabled}
              >
                {isSubmittingDecision
                  ? "جاري تنفيذ القرار..."
                  : selectedDecision
                    ? DECISION_LABELS[
                        selectedDecision
                      ]
                    : "تنفيذ القرار"}
              </button>
            </form>
          </section>
        ) : (
          <section
            className="workspace-card workspace-closed-decision"
            aria-labelledby="closed-decision-title"
          >
            <h2 id="closed-decision-title">
              قرار الطلب الأولي
            </h2>

            <p>
              لا يمكن تنفيذ قرار جديد على الطلب في
              حالته الحالية.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

export default AdminCustomerWorkspace;
