import { useEffect, useMemo, useState } from "react";

import {
  formatPercentage,
  formatSaudiRiyal,
  formatSquareMeters,
} from "../../utils/projectCalculations.js";

import {
  createAdminLandDeedSignedUrl,
  decideAdminLandSubmission,
  getAdminLandSubmissionWorkspace,
  searchAdminLandSubmissions,
} from "../../services/adminCustomerFileService.js";

import "./AdminCustomerWorkspace.css";

const STATUS_LABELS = {
  under_review: "تحت المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبول",
  accepted: "مقبول",
  rejected: "مرفوض",
  waiting_land: "بانتظار تقديم الأرض",
  land_under_review: "الأرض تحت المراجعة",
  land_needs_completion: "مطلوب استكمال بيانات الأرض",
  land_approved: "تم قبول الأرض",
  land_rejected: "تم رفض الأرض",
  waiting_contract: "بانتظار إرسال العقد",
  contract_sent: "العقد بانتظار موافقة العميل",
  contract_accepted: "تمت الموافقة على العقد",
  contract_rejected: "تم رفض العقد",
  waiting_transfer: "بانتظار الإفراغ",
  transfer_in_progress: "إجراءات الإفراغ جارية",
  transfer_completed: "تم الإفراغ",
  active_project: "المشروع قيد التنفيذ",
  active: "نشط",
  completed: "مكتمل",
  closed: "ملف مغلق",
};

const STAGE_LABELS = {
  initial_application: "التقديم الأولي",
  application_review: "مراجعة طلب العميل",
  waiting_admin_review: "انتظار مراجعة المنصة",
  waiting_land: "انتظار تقديم الأرض",
  waiting_land_submission: "انتظار تقديم الأرض",
  land_submission: "تقديم الأرض",
  land_review: "فحص الأرض",
  land_contract: "العقد",
  land_transfer: "إفراغ الأرض",
  project_execution: "تنفيذ المشروع",
  project_closure: "إغلاق المشروع",
};

const DECISION_LABELS = {
  approve: "قبول العميل",
  needs_completion: "طلب استكمال",
  reject: "رفض الطلب",
};

const LAND_DECISION_LABELS = {
  approve: "قبول الأرض",
  request_completion: "طلب استكمال الأرض",
  reject: "رفض الأرض",
};

const LAND_STATUS_LABELS = {
  under_review: "بانتظار المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبولة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

const LAND_USE_LABELS = {
  residential: "سكني",
  commercial: "تجاري",
  agricultural: "زراعي",
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
  land_submitted: "تقديم الأرض",
  land_resubmitted: "إعادة تقديم الأرض",
  completion_requested: "طلب استكمال الأرض",
  land_approved: "قبول الأرض",
  land_rejected: "رفض الأرض",
  contract_sent: "إرسال العقد",
  contract_accepted: "الموافقة على العقد",
  contract_rejected: "رفض العقد",
  transfer_started: "بدء الإفراغ",
  transfer_completed: "اكتمال الإفراغ",
};

const PROJECT_STAGES = [
  "تقديم الطلب",
  "مراجعة الإدارة",
  "قبول العميل",
  "تقديم الأرض",
  "فحص الأرض",
  "إرسال العقد",
  "موافقة العميل",
  "إفراغ الأرض",
  "تعيين مشرف المشروع",
  "التنفيذ",
  "الإغلاق",
];

function formatDate(value) {
  if (!value) return "غير متوفر";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatNumber(value, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "غير متوفر";
  return `${new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(number)}${suffix}`;
}

function getStatusClass(status) {
  if (
    status === "under_review" ||
    status === "land_under_review" ||
    status === "contract_sent" ||
    status === "transfer_in_progress"
  ) {
    return "is-under-review";
  }

  if (
    status === "approved" ||
    status === "accepted" ||
    status === "waiting_land" ||
    status === "land_approved" ||
    status === "contract_accepted" ||
    status === "transfer_completed" ||
    status === "active_project" ||
    status === "active" ||
    status === "completed"
  ) {
    return "is-approved";
  }

  if (
    status === "needs_completion" ||
    status === "land_needs_completion"
  ) {
    return "is-needs-completion";
  }

  if (
    status === "rejected" ||
    status === "land_rejected" ||
    status === "contract_rejected"
  ) {
    return "is-rejected";
  }

  return "is-default";
}

function getCurrentRequiredAction(customerFile) {
  if (!customerFile) return "غير محدد";

  if (customerFile.status === "under_review") {
    return "مراجعة الطلب واتخاذ قرار";
  }

  if (customerFile.status === "needs_completion") {
    return "انتظار استكمال العميل للبيانات المطلوبة";
  }

  if (
    customerFile.status === "approved" ||
    customerFile.status === "accepted" ||
    customerFile.status === "waiting_land" ||
    customerFile.current_stage === "waiting_land"
  ) {
    return "انتظار تقديم العميل للأرض";
  }

  if (customerFile.status === "land_under_review") {
    return "مراجعة الأرض واتخاذ قرار";
  }

  if (customerFile.status === "land_needs_completion") {
    return "انتظار استكمال العميل لبيانات الأرض";
  }

  if (customerFile.status === "land_approved") {
    return "الأرض مقبولة — الانتقال إلى إعداد العقد";
  }

  if (customerFile.status === "land_rejected") {
    return "انتظار تقديم العميل أرضًا بديلة";
  }

  if (customerFile.status === "waiting_contract") {
    return "إعداد العقد وإرساله للعميل";
  }

  if (customerFile.status === "contract_sent") {
    return "انتظار قرار العميل على العقد";
  }

  if (customerFile.status === "waiting_transfer") {
    return "بدء إجراءات الإفراغ";
  }

  if (customerFile.status === "transfer_in_progress") {
    return "متابعة إجراءات الإفراغ";
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
  const [selectedDecision, setSelectedDecision] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const [landWorkspace, setLandWorkspace] = useState(null);
  const [isLandLoading, setIsLandLoading] = useState(false);
  const [landError, setLandError] = useState("");
  const [selectedLandDecision, setSelectedLandDecision] = useState("");
  const [landDecisionNote, setLandDecisionNote] = useState("");
  const [isSubmittingLandDecision, setIsSubmittingLandDecision] = useState(false);
  const [isOpeningDeed, setIsOpeningDeed] = useState(false);

  const statusLabel =
    STATUS_LABELS[customerFile?.status] ||
    customerFile?.status ||
    "غير محددة";

  const stageLabel =
    STAGE_LABELS[customerFile?.current_stage] ||
    customerFile?.current_stage ||
    "غير محددة";

  const statusClass = getStatusClass(customerFile?.status);
  const currentRequiredAction = getCurrentRequiredAction(customerFile);

  const canDecide = ["under_review", "needs_completion"].includes(
    customerFile?.status
  );

  const requiresDecisionNote =
    selectedDecision === "needs_completion" || selectedDecision === "reject";

  const decisionButtonDisabled =
    !selectedDecision ||
    isSubmittingDecision ||
    (requiresDecisionNote && decisionNote.trim().length === 0);

  const financingRatio = useMemo(
    () => Number(customerFile?.financing_ratio || 0),
    [customerFile]
  );

  const estimatedProjectCost = Number(
    customerFile?.estimated_project_cost || 0
  );

  const platformShare = estimatedProjectCost * 0.015;
  const supervisorShare = estimatedProjectCost * 0.015;
  const investorsShare = estimatedProjectCost * 0.09;

  const landSubmission = landWorkspace?.landSubmission || null;
  const landEvents = Array.isArray(landWorkspace?.events)
    ? landWorkspace.events
    : [];

  const canDecideLand = ["under_review", "needs_completion"].includes(
    landSubmission?.status
  );

  const requiresLandDecisionNote =
    selectedLandDecision === "request_completion" ||
    selectedLandDecision === "reject";

  const landDecisionButtonDisabled =
    !selectedLandDecision ||
    isSubmittingLandDecision ||
    (requiresLandDecisionNote && landDecisionNote.trim().length === 0);

  useEffect(() => {
    let active = true;

    async function loadLandWorkspace() {
      if (!customerFile?.id || !customerFile?.file_number) {
        setLandWorkspace(null);
        setLandError("");
        return;
      }

      setIsLandLoading(true);
      setLandError("");

      try {
        const result = await searchAdminLandSubmissions({
          search: customerFile.file_number,
          status: "all",
          sort: "newest",
          page: 1,
          pageSize: 100,
        });

        if (!active) return;

        const matchingSubmission = result.submissions.find(
          (submission) => submission.customerFileId === customerFile.id
        );

        if (!matchingSubmission?.id) {
          setLandWorkspace(null);
          return;
        }

        const workspace = await getAdminLandSubmissionWorkspace(
          matchingSubmission.id
        );

        if (active) setLandWorkspace(workspace);
      } catch (error) {
        if (!active) return;
        setLandWorkspace(null);
        setLandError(
          error?.message || "تعذر تحميل بيانات الأرض داخل ملف العميل."
        );
      } finally {
        if (active) setIsLandLoading(false);
      }
    }

    loadLandWorkspace();

    return () => {
      active = false;
    };
  }, [customerFile?.id, customerFile?.file_number, customerFile?.updated_at]);

  async function handleSubmitDecision(event) {
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
  }

  function handleOpenLandMap() {
    const url = landSubmission?.googleMapsUrl;
    if (!url) {
      setLandError("رابط موقع الأرض غير موجود.");
      return;
    }

    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error();
      }
      window.open(parsedUrl.toString(), "_blank", "noopener,noreferrer");
    } catch {
      setLandError("رابط موقع الأرض غير صحيح.");
    }
  }

  async function handleOpenLandDeed() {
    if (isOpeningDeed || !landSubmission?.deedStoragePath) return;

    try {
      setIsOpeningDeed(true);
      setLandError("");

      const signedUrl = await createAdminLandDeedSignedUrl(
        landSubmission.deedStoragePath,
        300
      );

      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setLandError(error?.message || "تعذر فتح ملف الصك.");
    } finally {
      setIsOpeningDeed(false);
    }
  }

  async function handleSubmitLandDecision(event) {
    event.preventDefault();

    if (
      landDecisionButtonDisabled ||
      !landSubmission?.id
    ) {
      return;
    }

    try {
      setIsSubmittingLandDecision(true);
      setLandError("");

      const result = await decideAdminLandSubmission({
        landSubmissionId: landSubmission.id,
        decision: selectedLandDecision,
        note: landDecisionNote,
      });

      setLandWorkspace(result);
      setSelectedLandDecision("");
      setLandDecisionNote("");

      if (typeof onRefresh === "function") {
        await onRefresh();
      }
    } catch (error) {
      setLandError(error?.message || "تعذر تنفيذ قرار مراجعة الأرض.");
    } finally {
      setIsSubmittingLandDecision(false);
    }
  }

  if (isLoading) {
    return (
      <main className="workspace-loading">
        <p role="status">جاري تحميل ملف العميل...</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="workspace-error-state">
        <h1>تعذر فتح ملف العميل</h1>
        <p role="alert"><strong>{errorMessage}</strong></p>
        <button type="button" className="workspace-button" onClick={onBack}>
          العودة إلى ملفات العملاء
        </button>
      </main>
    );
  }

  if (!customerFile) {
    return (
      <main className="workspace-missing-state">
        <h1>ملف العميل غير موجود</h1>
        <button type="button" className="workspace-button" onClick={onBack}>
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
            <h1>ملف العميل {customerFile.file_number}</h1>
            <p>
              آخر تحديث: <strong>{formatDate(customerFile.updated_at)}</strong>
            </p>
          </div>

          <div className="workspace-header-actions">
            <button
              type="button"
              className="workspace-button is-secondary"
              onClick={onRefresh}
              disabled={isSubmittingDecision || isSubmittingLandDecision}
            >
              تحديث الملف
            </button>

            <button
              type="button"
              className="workspace-button"
              onClick={onBack}
              disabled={isSubmittingDecision || isSubmittingLandDecision}
            >
              العودة إلى ملفات العملاء
            </button>
          </div>
        </header>

        <section className="workspace-card workspace-required-action">
          <h2>الإجراء الحالي المطلوب</h2>
          <p>{currentRequiredAction}</p>
        </section>

        <section className="workspace-card">
          <h2>الحالة التشغيلية</h2>
          <dl className="workspace-status-grid">
            <div className="workspace-data-item">
              <dt>رقم الملف</dt>
              <dd>{customerFile.file_number}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>الحالة الحالية</dt>
              <dd>
                <span className={`workspace-status-badge ${statusClass}`}>
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
              <dd>{formatDate(customerFile.submitted_at)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>تاريخ القبول</dt>
              <dd>{formatDate(customerFile.approved_at)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>تاريخ الرفض</dt>
              <dd>{formatDate(customerFile.rejected_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="workspace-card">
          <h2>بيانات العميل</h2>
          <dl className="workspace-data-grid">
            <div className="workspace-data-item">
              <dt>الاسم الكامل</dt>
              <dd>{customerFile.customer_name || "غير متوفر"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>رقم الجوال</dt>
              <dd>{customerFile.mobile_number || "غير متوفر"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>البريد الإلكتروني</dt>
              <dd>{customerFile.email || "غير مضاف"}</dd>
            </div>
          </dl>
        </section>

        <section className="workspace-card">
          <h2>بيانات المشروع والتمويل</h2>
          <dl className="workspace-data-grid">
            <div className="workspace-data-item">
              <dt>مساحة الأرض</dt>
              <dd>{formatSquareMeters(customerFile.land_area)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>قيمة الأرض</dt>
              <dd>{formatSaudiRiyal(customerFile.estimated_land_price)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>عدد الأدوار</dt>
              <dd>{customerFile.floors ?? "غير متوفر"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>عرض البنك</dt>
              <dd>{formatSaudiRiyal(customerFile.bank_offer)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>المساحة المحتسبة لكل دور</dt>
              <dd>{formatSquareMeters(customerFile.building_area_per_floor)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>إجمالي مسطح البناء</dt>
              <dd>{formatSquareMeters(customerFile.total_building_area)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>سعر متر البناء</dt>
              <dd>{formatSaudiRiyal(customerFile.meter_rate)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>تكلفة البناء التقديرية</dt>
              <dd>{formatSaudiRiyal(customerFile.estimated_construction_cost)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>إجمالي تكلفة المشروع</dt>
              <dd className="workspace-financial-highlight">
                {formatSaudiRiyal(estimatedProjectCost)}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>نسبة التكلفة إلى عرض البنك</dt>
              <dd>{formatPercentage(financingRatio)}</dd>
            </div>
          </dl>
        </section>

        <section className="workspace-card">
          <h2>الدفعة المقدمة وتوزيعها</h2>
          <dl className="workspace-data-grid">
            <div className="workspace-data-item">
              <dt>دفعة العميل الأساسية 12٪</dt>
              <dd>{formatSaudiRiyal(customerFile.base_customer_payment)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>فرق التجاوز عن حد 80٪</dt>
              <dd>{formatSaudiRiyal(customerFile.excess_amount)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>إجمالي الدفعة المطلوبة</dt>
              <dd className="workspace-financial-highlight">
                {formatSaudiRiyal(customerFile.total_customer_payment)}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>حصة المنصة 1.5٪</dt>
              <dd>{formatSaudiRiyal(platformShare)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>حصة مشرف المشروع 1.5٪</dt>
              <dd>{formatSaudiRiyal(supervisorShare)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>حصة المستثمرين 9٪</dt>
              <dd>{formatSaudiRiyal(investorsShare)}</dd>
            </div>
          </dl>

          {customerFile.requires_extra_payment_approval && (
            <p className="workspace-approval-message">
              موافقة العميل على الدفعة الإضافية: {" "}
              <strong>
                {customerFile.extra_payment_approved
                  ? "تمت الموافقة"
                  : "لم تتم الموافقة"}
              </strong>
            </p>
          )}
        </section>

        <section className="workspace-card">
          <h2>مراحل ملف العميل</h2>
          <ol className="workspace-stage-list">
            {PROJECT_STAGES.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>
          <p className="workspace-current-stage">
            المرحلة الحالية: <strong>{stageLabel}</strong>
          </p>
        </section>

        <section className="workspace-card" aria-labelledby="land-review-title">
          <h2 id="land-review-title">مراجعة الأرض</h2>

          {isLandLoading ? (
            <p role="status">جاري تحميل بيانات الأرض...</p>
          ) : landError && !landSubmission ? (
            <p className="workspace-decision-error" role="alert">
              <strong>{landError}</strong>
            </p>
          ) : !landSubmission ? (
            <p>لم يقدم العميل أرضًا بعد.</p>
          ) : (
            <>
              {landError && (
                <p className="workspace-decision-error" role="alert">
                  <strong>{landError}</strong>
                </p>
              )}

              <dl className="workspace-data-grid">
                <div className="workspace-data-item">
                  <dt>رقم تقديم الأرض</dt>
                  <dd dir="ltr">{landSubmission.submissionNumber}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>حالة الأرض</dt>
                  <dd>{LAND_STATUS_LABELS[landSubmission.status] || landSubmission.status}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>المدينة</dt>
                  <dd>{landSubmission.city || "غير متوفر"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>الحي</dt>
                  <dd>{landSubmission.district || "غير متوفر"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>مساحة الأرض</dt>
                  <dd>{formatNumber(landSubmission.landArea, " م²")}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>عرض الواجهة</dt>
                  <dd>{formatNumber(landSubmission.frontageWidth, " م")}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>عرض الشارع</dt>
                  <dd>{formatNumber(landSubmission.streetWidth, " م")}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>نوع الأرض</dt>
                  <dd>{LAND_USE_LABELS[landSubmission.landUseType] || landSubmission.landUseType || "غير متوفر"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>السعر الصافي</dt>
                  <dd>{formatSaudiRiyal(landSubmission.netPrice)}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>الضريبة</dt>
                  <dd>{formatSaudiRiyal(landSubmission.taxAmount)}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>السعي</dt>
                  <dd>{formatSaudiRiyal(landSubmission.brokerageAmount)}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>السعر الشامل</dt>
                  <dd className="workspace-financial-highlight">
                    {formatSaudiRiyal(landSubmission.totalPrice)}
                  </dd>
                </div>
                <div className="workspace-data-item">
                  <dt>مسؤول الأرض</dt>
                  <dd>{landSubmission.landContactName || "غير متوفر"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>جوال مسؤول الأرض</dt>
                  <dd dir="ltr">{landSubmission.landContactMobile || "غير متوفر"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>تاريخ التقديم</dt>
                  <dd>{formatDate(landSubmission.submittedAt)}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>آخر مراجعة</dt>
                  <dd>{formatDate(landSubmission.reviewedAt)}</dd>
                </div>
              </dl>

              <div className="workspace-header-actions" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="workspace-button is-secondary"
                  onClick={handleOpenLandMap}
                >
                  فتح موقع الأرض
                </button>

                <button
                  type="button"
                  className="workspace-button is-secondary"
                  onClick={handleOpenLandDeed}
                  disabled={isOpeningDeed || !landSubmission.deedStoragePath}
                >
                  {isOpeningDeed ? "جاري فتح الصك..." : "فتح الصك"}
                </button>
              </div>

              {landSubmission.customerNote && (
                <article className="workspace-note" style={{ marginTop: "16px" }}>
                  <h3>ملاحظة العميل على الأرض</h3>
                  <p>{landSubmission.customerNote}</p>
                </article>
              )}

              {landSubmission.adminDecisionNote && (
                <article className="workspace-note" style={{ marginTop: "16px" }}>
                  <h3>ملاحظة قرار الإدارة على الأرض</h3>
                  <p>{landSubmission.adminDecisionNote}</p>
                </article>
              )}

              {landEvents.length > 0 && (
                <div style={{ marginTop: "18px" }}>
                  <h3>سجل مراجعة الأرض</h3>
                  <ol className="workspace-timeline">
                    {landEvents.map((eventItem) => (
                      <li key={eventItem.id} className="workspace-timeline-item">
                        <article className="workspace-timeline-article">
                          <header className="workspace-timeline-header">
                            <p><strong>{eventItem.title || eventItem.event_type}</strong></p>
                            <time dateTime={eventItem.created_at}>
                              {formatDate(eventItem.created_at)}
                            </time>
                          </header>
                          {eventItem.description && (
                            <p className="workspace-timeline-description">
                              {eventItem.description}
                            </p>
                          )}
                        </article>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {canDecideLand && (
                <form
                  className="workspace-decision-form"
                  onSubmit={handleSubmitLandDecision}
                  style={{ marginTop: "20px" }}
                >
                  <label htmlFor="landDecision">قرار الأرض</label>
                  <select
                    id="landDecision"
                    value={selectedLandDecision}
                    onChange={(event) => {
                      setSelectedLandDecision(event.target.value);
                      setLandDecisionNote("");
                    }}
                    disabled={isSubmittingLandDecision}
                    required
                  >
                    <option value="">اختر القرار</option>
                    <option value="approve">قبول الأرض</option>
                    <option value="request_completion">طلب استكمال</option>
                    <option value="reject">رفض الأرض</option>
                  </select>

                  <label htmlFor="landDecisionNote">
                    {selectedLandDecision === "request_completion"
                      ? "البيانات المطلوب استكمالها"
                      : selectedLandDecision === "reject"
                        ? "سبب رفض الأرض"
                        : "ملاحظة القبول — اختيارية"}
                  </label>

                  <textarea
                    id="landDecisionNote"
                    value={landDecisionNote}
                    onChange={(event) => setLandDecisionNote(event.target.value)}
                    rows="5"
                    disabled={isSubmittingLandDecision}
                    required={requiresLandDecisionNote}
                  />

                  <button
                    type="submit"
                    className="workspace-decision-submit"
                    disabled={landDecisionButtonDisabled}
                  >
                    {isSubmittingLandDecision
                      ? "جاري تنفيذ قرار الأرض..."
                      : selectedLandDecision
                        ? LAND_DECISION_LABELS[selectedLandDecision]
                        : "تنفيذ قرار الأرض"}
                  </button>
                </form>
              )}
            </>
          )}
        </section>

        <section className="workspace-card">
          <h2>السجل الزمني</h2>
          {timeline.length === 0 ? (
            <p>لا توجد أحداث مسجلة في السجل الزمني.</p>
          ) : (
            <ol className="workspace-timeline">
              {timeline.map((eventItem) => {
                const eventLabel =
                  EVENT_TYPE_LABELS[eventItem.event_type] ||
                  eventItem.event_type ||
                  "حدث";

                return (
                  <li key={eventItem.id} className="workspace-timeline-item">
                    <article className="workspace-timeline-article">
                      <header className="workspace-timeline-header">
                        <p><strong>{eventItem.title || eventLabel}</strong></p>
                        <time dateTime={eventItem.created_at}>
                          {formatDate(eventItem.created_at)}
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

        <section className="workspace-card">
          <h2>ملاحظات الملف</h2>
          {notes.length === 0 ? (
            <p>لا توجد ملاحظات مسجلة.</p>
          ) : (
            <div className="workspace-notes-list">
              {notes.map((noteItem) => {
                const noteLabel =
                  NOTE_TYPE_LABELS[noteItem.note_type] ||
                  noteItem.note_type ||
                  "ملاحظة";

                return (
                  <article key={noteItem.id} className="workspace-note">
                    <h3>{noteLabel}</h3>
                    <p>{noteItem.note}</p>
                    <p className="workspace-note-date">
                      {formatDate(noteItem.created_at)}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {canDecide ? (
          <section className="workspace-card workspace-decision-card">
            <h2>قرار إدارة المنصة على الطلب الأولي</h2>

            <form className="workspace-decision-form" onSubmit={handleSubmitDecision}>
              <label htmlFor="adminDecision">القرار</label>
              <select
                id="adminDecision"
                value={selectedDecision}
                onChange={(event) => {
                  setSelectedDecision(event.target.value);
                  setDecisionNote("");
                }}
                disabled={isSubmittingDecision}
                required
              >
                <option value="">اختر القرار</option>
                <option value="approve">قبول العميل</option>
                <option value="needs_completion">طلب استكمال</option>
                <option value="reject">رفض الطلب</option>
              </select>

              <label htmlFor="decisionNote">
                {selectedDecision === "needs_completion"
                  ? "البيانات المطلوب استكمالها"
                  : selectedDecision === "reject"
                    ? "سبب الرفض"
                    : "ملاحظة القبول — اختيارية"}
              </label>

              <textarea
                id="decisionNote"
                value={decisionNote}
                onChange={(event) => setDecisionNote(event.target.value)}
                rows="5"
                disabled={isSubmittingDecision}
                required={requiresDecisionNote}
              />

              {decisionError && (
                <p className="workspace-decision-error" role="alert">
                  <strong>{decisionError}</strong>
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
                    ? DECISION_LABELS[selectedDecision]
                    : "تنفيذ القرار"}
              </button>
            </form>
          </section>
        ) : (
          <section className="workspace-card workspace-closed-decision">
            <h2>قرار الطلب الأولي</h2>
            <p>لا يمكن تنفيذ قرار جديد على الطلب الأولي في حالته الحالية.</p>
          </section>
        )}
      </div>
    </main>
  );
}

export default AdminCustomerWorkspace;
