import {
  formatPercentage,
  formatSaudiRiyal,
  formatSquareMeters,
} from "../utils/projectCalculations.js";

import "./CustomerFilePage.css";

const STATUS_LABELS = {
  under_review: "تحت المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبول",
  accepted: "مقبول",
  rejected: "مرفوض",
  waiting_land: "بانتظار تقديم الأرض",
  land_under_review: "الأرض تحت المراجعة",
  land_needs_completion:
    "مطلوب استكمال بيانات الأرض",
  land_approved: "تم قبول الأرض",
  land_rejected: "تم رفض الأرض",
  waiting_contract:
    "بانتظار إرسال العقد",
  contract_sent:
    "العقد بانتظار موافقة العميل",
  contract_accepted:
    "تمت الموافقة على العقد",
  contract_rejected:
    "تم رفض العقد",
  waiting_transfer: "بانتظار الإفراغ",
  transfer_in_progress:
    "إجراءات الإفراغ جارية",
  transfer_completed: "تم الإفراغ",
  active_project:
    "المشروع قيد التنفيذ",
  active: "نشط",
  completed: "مكتمل",
  closed: "ملف مغلق",
};

const STAGE_LABELS = {
  initial_application:
    "التقديم الأولي",
  application_review:
    "مراجعة طلب العميل",
  waiting_admin_review:
    "انتظار مراجعة المنصة",
  waiting_land:
    "انتظار تقديم الأرض",
  waiting_land_submission:
    "انتظار تقديم الأرض",
  land_submission:
    "تقديم الأرض",
  land_review:
    "فحص الأرض",
  land_contract:
    "العقد",
  land_transfer:
    "إفراغ الأرض",
  project_execution:
    "تنفيذ المشروع",
  project_closure:
    "إغلاق المشروع",
};

const EVENT_TYPE_LABELS = {
  customer_file_created:
    "إنشاء الملف",
  status_changed:
    "تغيير الحالة",
  stage_changed:
    "تغيير المرحلة",
  current_state_snapshot:
    "الحالة الحالية",
  land_submitted:
    "تقديم الأرض",
  land_resubmitted:
    "إعادة تقديم الأرض",
  completion_requested:
    "طلب استكمال الأرض",
  land_approved:
    "قبول الأرض",
  land_rejected:
    "رفض الأرض",
  contract_sent:
    "إرسال العقد",
  contract_accepted:
    "الموافقة على العقد",
  contract_rejected:
    "رفض العقد",
  transfer_started:
    "بدء الإفراغ",
  transfer_completed:
    "اكتمال الإفراغ",
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

const LAND_SUBMISSION_ALLOWED_STATUSES = [
  "approved",
  "accepted",
  "waiting_land",
  "land_needs_completion",
];

const LAND_SUBMISSION_ALLOWED_STAGES = [
  "waiting_land",
  "waiting_land_submission",
  "land_submission",
];

function formatDate(value) {
  if (!value) {
    return "غير متوفر";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat(
    "ar-SA",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
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

function canSubmitLand(customerFile) {
  if (!customerFile?.id) {
    return false;
  }

  return (
    LAND_SUBMISSION_ALLOWED_STATUSES.includes(
      customerFile.status
    ) ||
    LAND_SUBMISSION_ALLOWED_STAGES.includes(
      customerFile.current_stage
    )
  );
}

function getCurrentAction(customerFile) {
  if (!customerFile) {
    return {
      title:
        "لا يوجد إجراء محدد",
      description:
        "تعذر تحديد الإجراء المطلوب للملف.",
    };
  }

  if (
    customerFile.status ===
    "under_review"
  ) {
    return {
      title:
        "انتظار مراجعة إدارة المنصة",
      description:
        "تم استلام طلبك، وهو الآن لدى إدارة المنصة للمراجعة واتخاذ القرار.",
    };
  }

  if (
    customerFile.status ===
    "needs_completion"
  ) {
    return {
      title:
        "استكمال بيانات الطلب",
      description:
        "توجد بيانات طلبت إدارة المنصة استكمالها قبل متابعة الطلب.",
    };
  }

  if (
    canSubmitLand(customerFile)
  ) {
    const isLandCompletion =
      customerFile.status ===
      "land_needs_completion";

    return {
      title: isLandCompletion
        ? "استكمال بيانات الأرض"
        : "تقديم بيانات الأرض",

      description: isLandCompletion
        ? "طلبت إدارة المنصة استكمال أو تصحيح بعض بيانات الأرض. افتح النموذج وراجع البيانات المطلوبة ثم أعد التقديم."
        : "تم قبول طلبك الأولي. قدّم بيانات الأرض ورابط موقعها والصك حتى تبدأ إدارة المنصة مراجعتها.",
    };
  }

  if (
    customerFile.status ===
    "land_under_review"
  ) {
    return {
      title:
        "انتظار مراجعة الأرض",
      description:
        "تم استلام بيانات الأرض والصك، وهي الآن قيد المراجعة لدى إدارة المنصة.",
    };
  }

  if (
    customerFile.status ===
    "land_approved"
  ) {
    return {
      title:
        "تم قبول الأرض",
      description:
        "وافقت إدارة المنصة على الأرض. الخطوة التالية هي إعداد العقد وإرساله إليك للمراجعة.",
    };
  }

  if (
    customerFile.status ===
    "land_rejected"
  ) {
    return {
      title:
        "تم رفض الأرض",
      description:
        "لم تعتمد إدارة المنصة الأرض المقدمة. راجع سبب الرفض وابحث عن أرض أخرى قبل تقديمها.",
    };
  }

  if (
    customerFile.status ===
    "waiting_contract"
  ) {
    return {
      title:
        "انتظار إعداد العقد",
      description:
        "تم قبول الأرض، وتعمل إدارة المنصة على إعداد العقد وإرساله إليك.",
    };
  }

  if (
    customerFile.status ===
    "contract_sent"
  ) {
    return {
      title:
        "مراجعة العقد",
      description:
        "أرسلت إدارة المنصة العقد. راجعه ثم وافق عليه أو ارفضه من داخل حسابك.",
    };
  }

  if (
    customerFile.status ===
    "contract_accepted"
  ) {
    return {
      title:
        "انتظار بدء الإفراغ",
      description:
        "تم تسجيل موافقتك على العقد، وستبدأ إجراءات إفراغ الأرض.",
    };
  }

  if (
    customerFile.status ===
    "contract_rejected"
  ) {
    return {
      title:
        "تم رفض العقد",
      description:
        "تم تسجيل رفضك للعقد، ولن تبدأ إجراءات الإفراغ حتى معالجة سبب الرفض.",
    };
  }

  if (
    customerFile.status ===
    "waiting_transfer"
  ) {
    return {
      title:
        "بانتظار بدء الإفراغ",
      description:
        "الأرض مقبولة والعقد معتمد، والملف جاهز لبدء إجراءات الإفراغ.",
    };
  }

  if (
    customerFile.status ===
    "transfer_in_progress"
  ) {
    return {
      title:
        "إجراءات الإفراغ جارية",
      description:
        "بدأت إجراءات إفراغ الأرض، وسيتم تحديث الملف عند اكتمالها.",
    };
  }

  if (
    customerFile.status ===
    "transfer_completed"
  ) {
    return {
      title:
        "تم إفراغ الأرض",
      description:
        "اكتمل إفراغ الأرض، وأصبح المشروع جاهزًا للانتقال إلى مراحل البناء.",
    };
  }

  if (
    customerFile.status ===
    "rejected"
  ) {
    return {
      title:
        "الطلب مرفوض",
      description:
        "تم إيقاف رحلة الطلب الأولية بعد قرار إدارة المنصة.",
    };
  }

  if (
    customerFile.status === "closed"
  ) {
    return {
      title:
        "الملف مغلق",
      description:
        "لا يوجد إجراء مطلوب على هذا الملف حاليًا.",
    };
  }

  return {
    title:
      STAGE_LABELS[
        customerFile.current_stage
      ] ||
      customerFile.current_stage ||
      "متابعة الملف",

    description:
      "تابع حالة الملف والتعليمات المرتبطة بالمرحلة الحالية.",
  };
}

function CustomerFilePage({
  customerFile,
  timeline = [],
  onBackToHome,
}) {
  if (!customerFile) {
    return (
      <main className="customer-file-error-state">
        <h1>
          تعذر عرض ملف العميل
        </h1>

        <p>
          لم تصل بيانات الملف من قاعدة
          البيانات.
        </p>

        <button
          type="button"
          onClick={onBackToHome}
        >
          العودة
        </button>
      </main>
    );
  }

  const statusLabel =
    STATUS_LABELS[
      customerFile.status
    ] ||
    customerFile.status ||
    "غير محددة";

  const stageLabel =
    STAGE_LABELS[
      customerFile.current_stage
    ] ||
    customerFile.current_stage ||
    "غير محددة";

  const statusClass =
    getStatusClass(
      customerFile.status
    );

  const currentAction =
    getCurrentAction(customerFile);

  const showLandSubmissionButton =
    canSubmitLand(customerFile);

  function handleOpenLandSubmission() {
    if (
      !showLandSubmissionButton ||
      !customerFile.id
    ) {
      return;
    }

    window.location.href =
      `/customer/project/${customerFile.id}/land`;
  }

  return (
    <main className="customer-file-page">
      <div className="customer-file-container">
        <header className="customer-file-header">
          <div>
            <p>
              نايف المزيني للبناء الذاتي
            </p>

            <h1>
              ملف العميل{" "}
              <span className="customer-file-number">
                {customerFile.file_number}
              </span>
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

          <button
            type="button"
            className="customer-file-home-button"
            onClick={onBackToHome}
          >
            العودة
          </button>
        </header>

        <section
          className="customer-file-card customer-current-action"
          aria-labelledby="customer-current-action-title"
        >
          <h2 id="customer-current-action-title">
            الإجراء الحالي المطلوب
          </h2>

          <p>
            {currentAction.title}
          </p>

          <p className="customer-current-action-description">
            {currentAction.description}
          </p>

          {showLandSubmissionButton && (
            <button
              type="button"
              className="customer-land-entry-button"
              onClick={
                handleOpenLandSubmission
              }
            >
              <span aria-hidden="true">
                📍
              </span>

              <span>
                {customerFile.status ===
                "land_needs_completion"
                  ? "استكمال بيانات الأرض"
                  : "تقديم الأرض"}
              </span>
            </button>
          )}
        </section>

        <section
          className="customer-file-card"
          aria-labelledby="customer-file-summary-title"
        >
          <h2 id="customer-file-summary-title">
            حالة الملف
          </h2>

          <dl className="customer-file-grid">
            <div className="customer-file-data-item">
              <dt>رقم الملف</dt>

              <dd>
                {customerFile.file_number}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>الحالة الحالية</dt>

              <dd>
                <span
                  className={`customer-file-status ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                المرحلة الحالية
              </dt>

              <dd>{stageLabel}</dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                تاريخ التقديم
              </dt>

              <dd>
                {formatDate(
                  customerFile.submitted_at
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                تاريخ القبول
              </dt>

              <dd>
                {formatDate(
                  customerFile.approved_at
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                تاريخ الرفض
              </dt>

              <dd>
                {formatDate(
                  customerFile.rejected_at
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="customer-file-card"
          aria-labelledby="customer-project-title"
        >
          <h2 id="customer-project-title">
            بيانات المشروع والتمويل
          </h2>

          <dl className="customer-file-grid">
            <div className="customer-file-data-item">
              <dt>مساحة الأرض</dt>

              <dd>
                {formatSquareMeters(
                  customerFile.land_area
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>قيمة الأرض</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .estimated_land_price
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>عدد الأدوار</dt>

              <dd>
                {customerFile.floors ??
                  "غير متوفر"}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>عرض البنك</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile.bank_offer
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
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

            <div className="customer-file-data-item">
              <dt>
                إجمالي مسطح البناء
              </dt>

              <dd>
                {formatSquareMeters(
                  customerFile
                    .total_building_area
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                سعر متر البناء
              </dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile.meter_rate
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                تكلفة البناء التقديرية
              </dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .estimated_construction_cost
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                إجمالي تكلفة المشروع
              </dt>

              <dd className="customer-file-financial-value">
                {formatSaudiRiyal(
                  customerFile
                    .estimated_project_cost
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                نسبة التكلفة إلى عرض البنك
              </dt>

              <dd>
                {formatPercentage(
                  customerFile
                    .financing_ratio
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="customer-file-card"
          aria-labelledby="customer-payment-title"
        >
          <h2 id="customer-payment-title">
            الدفعة المطلوبة
          </h2>

          <dl className="customer-file-grid">
            <div className="customer-file-data-item">
              <dt>
                الدفعة الأساسية 12٪
              </dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .base_customer_payment
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                فرق التجاوز عن حد 80٪
              </dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile.excess_amount
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                إجمالي الدفعة المطلوبة
              </dt>

              <dd className="customer-file-financial-value">
                {formatSaudiRiyal(
                  customerFile
                    .total_customer_payment
                )}
              </dd>
            </div>
          </dl>

          {customerFile
            .requires_extra_payment_approval && (
            <p className="customer-file-notice">
              موافقتك على الدفعة
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
          className="customer-file-card"
          aria-labelledby="customer-stages-title"
        >
          <h2 id="customer-stages-title">
            مراحل الملف
          </h2>

          <ol className="customer-file-stages">
            {PROJECT_STAGES.map(
              (stage) => (
                <li key={stage}>
                  {stage}
                </li>
              )
            )}
          </ol>

          <p className="customer-file-current-stage">
            المرحلة الحالية:{" "}
            <strong>
              {stageLabel}
            </strong>
          </p>
        </section>

        <section
          className="customer-file-card"
          aria-labelledby="customer-timeline-title"
        >
          <h2 id="customer-timeline-title">
            السجل الزمني
          </h2>

          {timeline.length === 0 ? (
            <p>
              لا توجد أحداث مسجلة في الملف
              حتى الآن.
            </p>
          ) : (
            <ol className="customer-file-timeline">
              {timeline.map(
                (eventItem) => {
                  const eventLabel =
                    EVENT_TYPE_LABELS[
                      eventItem.event_type
                    ] ||
                    eventItem.event_type ||
                    "حدث";

                  return (
                    <li
                      key={eventItem.id}
                      className="customer-file-timeline-item"
                    >
                      <article className="customer-file-timeline-article">
                        <header className="customer-file-timeline-header">
                          <h3>
                            {eventItem.title ||
                              eventLabel}
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
                          <p className="customer-file-timeline-description">
                            {
                              eventItem.description
                            }
                          </p>
                        )}
                      </article>
                    </li>
                  );
                }
              )}
            </ol>
          )}
        </section>

        <section
          className="customer-file-card"
          aria-labelledby="customer-access-title"
        >
          <h2 id="customer-access-title">
            الدخول إلى حسابك لاحقًا
          </h2>

          <div className="customer-file-access-note">
            <p>
              يمكنك العودة إلى جميع مشاريعك
              من الصفحة الرئيسية عبر{" "}
              <strong>
                دخول ← حساب العميل
              </strong>
              .
            </p>

            <p>
              أدخل البريد الإلكتروني نفسه
              الذي سجلته عند تقديم الطلب، ثم
              استخدم رمز الدخول المرسل إلى
              بريدك.
            </p>

            <div className="customer-file-access-values">
              <div className="customer-file-access-value">
                <span>
                  البريد الإلكتروني المسجل
                </span>

                <strong dir="ltr">
                  {customerFile.email ||
                    "البريد المسجل في الطلب"}
                </strong>
              </div>
            </div>

            <p className="customer-file-notice">
              بعد تسجيل الدخول ستظهر جميع
              المشاريع المرتبطة بالبريد نفسه
              داخل صفحة «مشاريعي»، دون الحاجة
              إلى إدخال رقم الملف أو رقم
              الجوال.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default CustomerFilePage;
