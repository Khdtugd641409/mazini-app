import { useEffect, useMemo, useState } from "react";

import {
  createAdminLandDeedSignedUrl,
  decideAdminLandSubmission,
  getAdminLandSubmissionWorkspace,
} from "../../services/adminLandSubmissionService.js";

import "./AdminLandSubmissionWorkspace.css";

const STATUS_LABELS = {
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

const EVENT_TYPE_LABELS = {
  land_submitted: "تقديم الأرض",
  land_resubmitted: "إعادة تقديم الأرض",
  completion_requested: "طلب استكمال",
  land_approved: "قبول الأرض",
  land_rejected: "رفض الأرض",
  land_cancelled: "إلغاء الأرض",
  admin_note_added: "ملاحظة إدارية",
  deed_replaced: "استبدال الصك",
};

function formatSaudiRiyal(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "غير متوفر";
  }

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function formatNumber(value, suffix = "") {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "غير متوفر";
  }

  return `${new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(numericValue)}${suffix}`;
}

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

function formatFileSize(bytes) {
  const numericBytes = Number(bytes);

  if (
    !Number.isFinite(numericBytes) ||
    numericBytes <= 0
  ) {
    return "غير معروف";
  }

  if (numericBytes < 1024 * 1024) {
    return `${(
      numericBytes / 1024
    ).toFixed(1)} كيلوبايت`;
  }

  return `${(
    numericBytes /
    (1024 * 1024)
  ).toFixed(1)} ميجابايت`;
}

function getStatusClass(status) {
  if (status === "under_review") {
    return "is-under-review";
  }

  if (status === "needs_completion") {
    return "is-needs-completion";
  }

  if (status === "approved") {
    return "is-approved";
  }

  if (
    status === "rejected" ||
    status === "cancelled"
  ) {
    return "is-rejected";
  }

  return "is-default";
}

function getLandSubmissionIdFromPath() {
  const pathParts =
    window.location.pathname
      .split("/")
      .filter(Boolean);

  /*
   * المسار المتوقع:
   * /admin/lands/{landSubmissionId}
   */
  if (
    pathParts.length !== 3 ||
    pathParts[0] !== "admin" ||
    pathParts[1] !== "lands"
  ) {
    return "";
  }

  return pathParts[2];
}

export default function AdminLandSubmissionWorkspace({
  landSubmissionId:
    suppliedLandSubmissionId = "",
  onBack,
}) {
  const landSubmissionId =
    suppliedLandSubmissionId ||
    getLandSubmissionIdFromPath();

  const [workspace, setWorkspace] =
    useState(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmittingDecision, setIsSubmittingDecision] =
    useState(false);

  const [isOpeningDeed, setIsOpeningDeed] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [decisionError, setDecisionError] =
    useState("");

  const [selectedDecision, setSelectedDecision] =
    useState("");

  const [decisionNote, setDecisionNote] =
    useState("");

  const landSubmission =
    workspace?.landSubmission || null;

  const customerFile =
    workspace?.customerFile || null;

  const events = Array.isArray(
    workspace?.events
  )
    ? workspace.events
    : [];

  const availableServices = useMemo(() => {
    if (!landSubmission) {
      return [];
    }

    return [
      {
        key: "water",
        label: "ماء",
        available:
          landSubmission.hasWater,
      },
      {
        key: "electricity",
        label: "كهرباء",
        available:
          landSubmission.hasElectricity,
      },
      {
        key: "fiber",
        label: "ألياف بصرية",
        available:
          landSubmission.hasFiber,
      },
      {
        key: "publicSewer",
        label: "صرف صحي عام",
        available:
          landSubmission.hasPublicSewer,
      },
    ];
  }, [landSubmission]);

  const canMakeDecision =
    landSubmission?.status ===
      "under_review" ||
    landSubmission?.status ===
      "needs_completion";

  async function loadWorkspace() {
    if (!landSubmissionId) {
      setErrorMessage(
        "معرّف طلب الأرض غير موجود."
      );

      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      setDecisionError("");

      const result =
        await getAdminLandSubmissionWorkspace(
          landSubmissionId
        );

      setWorkspace(result);
    } catch (error) {
      console.error(
        "تعذر تحميل مساحة عمل الأرض:",
        error
      );

      setWorkspace(null);

      setErrorMessage(
        error?.message ||
          "تعذر فتح طلب الأرض."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [landSubmissionId]);

  function handleBack() {
    if (
      isSubmittingDecision ||
      isOpeningDeed
    ) {
      return;
    }

    if (typeof onBack === "function") {
      onBack();
      return;
    }

    window.location.href =
      "/admin/lands";
  }

  function handleOpenGoogleMaps() {
    const url =
      landSubmission?.googleMapsUrl;

    if (!url) {
      setErrorMessage(
        "رابط موقع الأرض غير موجود."
      );

      return;
    }

    try {
      const parsedUrl = new URL(url);

      if (
        !["http:", "https:"].includes(
          parsedUrl.protocol
        )
      ) {
        throw new Error();
      }

      window.open(
        parsedUrl.toString(),
        "_blank",
        "noopener,noreferrer"
      );
    } catch {
      setErrorMessage(
        "رابط موقع الأرض غير صحيح."
      );
    }
  }

  async function handleOpenDeed() {
    if (
      isOpeningDeed ||
      !landSubmission
        ?.deedStoragePath
    ) {
      return;
    }

    try {
      setIsOpeningDeed(true);
      setErrorMessage("");

      const signedUrl =
        await createAdminLandDeedSignedUrl(
          landSubmission.deedStoragePath,
          300
        );

      window.open(
        signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "تعذر فتح ملف الصك."
      );
    } finally {
      setIsOpeningDeed(false);
    }
  }

  function handleOpenStandards() {
    /*
     * سنربط هذا الزر لاحقًا بمكتبة
     * المعايير المركزية وملف PDF الساري.
     */
    window.alert(
      "سيتم ربط معايير قبول الأرض بمكتبة المعايير والأدلة."
    );
  }

  function handleSelectDecision(
    decision
  ) {
    if (
      isSubmittingDecision ||
      !canMakeDecision
    ) {
      return;
    }

    setSelectedDecision(decision);
    setDecisionError("");

    if (decision === "approve") {
      setDecisionNote("");
    }
  }

  function handleCancelDecision() {
    if (isSubmittingDecision) {
      return;
    }

    setSelectedDecision("");
    setDecisionNote("");
    setDecisionError("");
  }

  async function handleConfirmDecision(
    event
  ) {
    event.preventDefault();

    if (
      isSubmittingDecision ||
      !selectedDecision ||
      !landSubmission?.id
    ) {
      return;
    }

    const note =
      decisionNote.trim();

    if (
      (
        selectedDecision ===
          "request_completion" ||
        selectedDecision ===
          "reject"
      ) &&
      !note
    ) {
      setDecisionError(
        "اكتب سبب طلب الاستكمال أو الرفض."
      );

      return;
    }

    try {
      setIsSubmittingDecision(true);
      setDecisionError("");
      setErrorMessage("");

      const result =
        await decideAdminLandSubmission({
          landSubmissionId:
            landSubmission.id,

          decision:
            selectedDecision,

          note,
        });

      setWorkspace(result);
      setSelectedDecision("");
      setDecisionNote("");
    } catch (error) {
      setDecisionError(
        error?.message ||
          "تعذر تنفيذ القرار."
      );
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  if (isLoading) {
    return (
      <main className="admin-land-workspace-page">
        <section className="admin-land-workspace-state">
          جاري تحميل طلب الأرض...
        </section>
      </main>
    );
  }

  if (
    errorMessage &&
    !landSubmission
  ) {
    return (
      <main className="admin-land-workspace-page">
        <section className="admin-land-workspace-error">
          <h1>
            تعذر فتح طلب الأرض
          </h1>

          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={handleBack}
          >
            العودة إلى طلبات الأراضي
          </button>
        </section>
      </main>
    );
  }

  if (
    !landSubmission ||
    !customerFile
  ) {
    return (
      <main className="admin-land-workspace-page">
        <section className="admin-land-workspace-error">
          <h1>
            بيانات الطلب غير مكتملة
          </h1>

          <p>
            لم تصل بيانات الأرض أو ملف
            العميل من قاعدة البيانات.
          </p>

          <button
            type="button"
            onClick={handleBack}
          >
            العودة
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-land-workspace-page">
      <div className="admin-land-workspace-shell">
        <header className="admin-land-workspace-header">
          <div>
            <p className="admin-land-workspace-eyebrow">
              مساحة عمل الأرض
            </p>

            <h1>
              طلب الأرض{" "}
              <span dir="ltr">
                {
                  landSubmission
                    .submissionNumber
                }
              </span>
            </h1>

            <p>
              ملف العميل:{" "}
              <strong dir="ltr">
                {customerFile.fileNumber}
              </strong>
            </p>
          </div>

          <div className="admin-land-workspace-header-actions">
            <button
              type="button"
              className="admin-land-workspace-standards-button"
              onClick={
                handleOpenStandards
              }
            >
              <span aria-hidden="true">
                📄
              </span>

              معايير قبول الأرض
            </button>

            <button
              type="button"
              className="admin-land-workspace-back-button"
              onClick={handleBack}
              disabled={
                isSubmittingDecision ||
                isOpeningDeed
              }
            >
              العودة إلى الطلبات
            </button>
          </div>
        </header>

        {errorMessage && (
          <div
            className="admin-land-workspace-alert"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <section className="admin-land-workspace-summary">
          <div>
            <span>الحالة</span>

            <strong
              className={`admin-land-workspace-status ${getStatusClass(
                landSubmission.status
              )}`}
            >
              {STATUS_LABELS[
                landSubmission.status
              ] ||
                landSubmission.status}
            </strong>
          </div>

          <div>
            <span>تاريخ التقديم</span>

            <strong>
              {formatDate(
                landSubmission.submittedAt
              )}
            </strong>
          </div>

          <div>
            <span>آخر مراجعة</span>

            <strong>
              {formatDate(
                landSubmission.reviewedAt
              )}
            </strong>
          </div>

          <div>
            <span>السعر الشامل</span>

            <strong>
              {formatSaudiRiyal(
                landSubmission.totalPrice
              )}
            </strong>
          </div>
        </section>

        <section className="admin-land-workspace-card">
          <h2>بيانات العميل والتمويل</h2>

          <dl className="admin-land-workspace-grid">
            <div>
              <dt>اسم العميل</dt>
              <dd>
                {customerFile.customerName}
              </dd>
            </div>

            <div>
              <dt>رقم الجوال</dt>
              <dd dir="ltr">
                {customerFile.mobileNumber}
              </dd>
            </div>

            <div>
              <dt>البريد الإلكتروني</dt>
              <dd dir="ltr">
                {customerFile.email ||
                  "غير متوفر"}
              </dd>
            </div>

            <div>
              <dt>عرض البنك</dt>
              <dd>
                {formatSaudiRiyal(
                  customerFile.bankOffer
                )}
              </dd>
            </div>

            <div>
              <dt>
                التكلفة التقديرية للمشروع
              </dt>
              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .estimatedProjectCost
                )}
              </dd>
            </div>

            <div>
              <dt>
                الدفعة المطلوبة من العميل
              </dt>
              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .totalCustomerPayment
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="admin-land-workspace-card">
          <div className="admin-land-workspace-card-header">
            <h2>موقع الأرض وأبعادها</h2>

            <button
              type="button"
              className="admin-land-workspace-map-button"
              onClick={
                handleOpenGoogleMaps
              }
            >
              فتح الموقع في Google Maps
            </button>
          </div>

          <dl className="admin-land-workspace-grid">
            <div>
              <dt>المدينة</dt>
              <dd>
                {landSubmission.city}
              </dd>
            </div>

            <div>
              <dt>الحي</dt>
              <dd>
                {landSubmission.district}
              </dd>
            </div>

            <div>
              <dt>مساحة الأرض</dt>
              <dd>
                {formatNumber(
                  landSubmission.landArea,
                  " م²"
                )}
              </dd>
            </div>

            <div>
              <dt>عرض الواجهة</dt>
              <dd>
                {formatNumber(
                  landSubmission
                    .frontageWidth,
                  " م"
                )}
              </dd>
            </div>

            <div>
              <dt>عرض الشارع</dt>
              <dd>
                {formatNumber(
                  landSubmission
                    .streetWidth,
                  " م"
                )}
              </dd>
            </div>

            <div>
              <dt>نوع الأرض</dt>
              <dd>
                {LAND_USE_LABELS[
                  landSubmission.landUseType
                ] ||
                  landSubmission.landUseType ||
                  "غير محدد"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="admin-land-workspace-card">
          <h2>الخدمات المتوفرة</h2>

          <div className="admin-land-workspace-services">
            {availableServices.map(
              (service) => (
                <article
                  key={service.key}
                  className={
                    service.available
                      ? "is-available"
                      : "is-unavailable"
                  }
                >
                  <span aria-hidden="true">
                    {service.available
                      ? "✓"
                      : "×"}
                  </span>

                  <strong>
                    {service.label}
                  </strong>

                  <small>
                    {service.available
                      ? "متوفرة"
                      : "غير محددة كمتوفرة"}
                  </small>
                </article>
              )
            )}
          </div>
        </section>

        <section className="admin-land-workspace-card">
          <h2>تفاصيل السعر</h2>

          <dl className="admin-land-workspace-grid">
            <div>
              <dt>السعر الصافي</dt>
              <dd>
                {formatSaudiRiyal(
                  landSubmission.netPrice
                )}
              </dd>
            </div>

            <div>
              <dt>الضريبة</dt>
              <dd>
                {formatSaudiRiyal(
                  landSubmission.taxAmount
                )}
              </dd>
            </div>

            <div>
              <dt>السعي</dt>
              <dd>
                {formatSaudiRiyal(
                  landSubmission
                    .brokerageAmount
                )}
              </dd>
            </div>

            <div className="is-highlighted">
              <dt>السعر الشامل</dt>
              <dd>
                {formatSaudiRiyal(
                  landSubmission.totalPrice
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="admin-land-workspace-card">
          <h2>مسؤول الأرض والصك</h2>

          <dl className="admin-land-workspace-grid">
            <div>
              <dt>اسم مسؤول الأرض</dt>
              <dd>
                {
                  landSubmission
                    .landContactName
                }
              </dd>
            </div>

            <div>
              <dt>رقم الجوال</dt>
              <dd dir="ltr">
                {
                  landSubmission
                    .landContactMobile
                }
              </dd>
            </div>

            <div>
              <dt>اسم ملف الصك</dt>
              <dd>
                {
                  landSubmission
                    .deedOriginalName
                }
              </dd>
            </div>

            <div>
              <dt>حجم الملف</dt>
              <dd>
                {formatFileSize(
                  landSubmission
                    .deedSizeBytes
                )}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            className="admin-land-workspace-deed-button"
            onClick={handleOpenDeed}
            disabled={isOpeningDeed}
          >
            {isOpeningDeed
              ? "جاري فتح الصك..."
              : "فتح ملف الصك"}
          </button>

          {landSubmission.customerNote && (
            <div className="admin-land-workspace-note">
              <strong>
                ملاحظات العميل
              </strong>

              <p>
                {
                  landSubmission
                    .customerNote
                }
              </p>
            </div>
          )}
        </section>

        {landSubmission.adminDecisionNote && (
          <section className="admin-land-workspace-card">
            <h2>
              ملاحظة القرار الإداري
            </h2>

            <div className="admin-land-workspace-note">
              <p>
                {
                  landSubmission
                    .adminDecisionNote
                }
              </p>
            </div>
          </section>
        )}

        <section className="admin-land-workspace-card">
          <h2>سجل طلب الأرض</h2>

          {events.length === 0 ? (
            <p>
              لا توجد أحداث مسجلة حتى الآن.
            </p>
          ) : (
            <ol className="admin-land-workspace-timeline">
              {events.map((eventItem) => (
                <li key={eventItem.id}>
                  <article>
                    <header>
                      <h3>
                        {eventItem.title ||
                          EVENT_TYPE_LABELS[
                            eventItem.event_type
                          ] ||
                          "حدث"}
                      </h3>

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
                      <p>
                        {
                          eventItem.description
                        }
                      </p>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="admin-land-workspace-card admin-land-workspace-decision-card">
          <h2>قرار إدارة المنصة</h2>

          {!canMakeDecision ? (
            <div className="admin-land-workspace-decision-closed">
              تم اتخاذ قرار على هذا الطلب،
              ولا يمكن تنفيذ قرار جديد في
              حالته الحالية.
            </div>
          ) : (
            <>
              <div className="admin-land-workspace-decision-buttons">
                <button
                  type="button"
                  className="is-approve"
                  onClick={() =>
                    handleSelectDecision(
                      "approve"
                    )
                  }
                  disabled={
                    isSubmittingDecision
                  }
                >
                  قبول الأرض
                </button>

                <button
                  type="button"
                  className="is-completion"
                  onClick={() =>
                    handleSelectDecision(
                      "request_completion"
                    )
                  }
                  disabled={
                    isSubmittingDecision
                  }
                >
                  طلب استكمال
                </button>

                <button
                  type="button"
                  className="is-reject"
                  onClick={() =>
                    handleSelectDecision(
                      "reject"
                    )
                  }
                  disabled={
                    isSubmittingDecision
                  }
                >
                  رفض الأرض
                </button>
              </div>

              {selectedDecision && (
                <form
                  className="admin-land-workspace-decision-form"
                  onSubmit={
                    handleConfirmDecision
                  }
                >
                  <h3>
                    {selectedDecision ===
                    "approve"
                      ? "تأكيد قبول الأرض"
                      : selectedDecision ===
                          "request_completion"
                        ? "طلب استكمال بيانات الأرض"
                        : "تأكيد رفض الأرض"}
                  </h3>

                  <label>
                    <span>
                      {selectedDecision ===
                      "approve"
                        ? "ملاحظة القرار (اختياري)"
                        : "سبب القرار"}
                    </span>

                    <textarea
                      rows="5"
                      value={decisionNote}
                      onChange={(event) =>
                        setDecisionNote(
                          event.target.value
                        )
                      }
                      maxLength={2000}
                      disabled={
                        isSubmittingDecision
                      }
                      required={
                        selectedDecision !==
                        "approve"
                      }
                    />
                  </label>

                  {decisionError && (
                    <div
                      className="admin-land-workspace-decision-error"
                      role="alert"
                    >
                      {decisionError}
                    </div>
                  )}

                  <div className="admin-land-workspace-decision-actions">
                    <button
                      type="submit"
                      className="is-confirm"
                      disabled={
                        isSubmittingDecision
                      }
                    >
                      {isSubmittingDecision
                        ? "جاري تنفيذ القرار..."
                        : "تأكيد القرار"}
                    </button>

                    <button
                      type="button"
                      className="is-cancel"
                      onClick={
                        handleCancelDecision
                      }
                      disabled={
                        isSubmittingDecision
                      }
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
