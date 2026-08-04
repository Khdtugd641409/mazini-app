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

function getCurrentAction(customerFile) {
  if (!customerFile) {
    return {
      title: "لا يوجد إجراء محدد",
      description:
        "تعذر تحديد الإجراء المطلوب للملف.",
    };
  }

  if (customerFile.status === "under_review") {
    return {
      title: "انتظار مراجعة إدارة المنصة",
      description:
        "تم استلام طلبك، وهو الآن لدى إدارة المنصة للمراجعة واتخاذ القرار.",
    };
  }

  if (customerFile.status === "needs_completion") {
    return {
      title: "استكمال البيانات المطلوبة",
      description:
        "توجد بيانات أو معلومات طلبت إدارة المنصة استكمالها قبل متابعة الطلب.",
    };
  }

  if (
    customerFile.status === "approved" ||
    customerFile.current_stage === "waiting_land"
  ) {
    return {
      title: "تقديم بيانات الأرض",
      description:
        "تم قبول طلبك الأولي. ستتاح لك مرحلة تقديم الأرض بعد اعتماد متطلباتها داخل المنصة.",
    };
  }

  if (customerFile.status === "rejected") {
    return {
      title: "الطلب مرفوض",
      description:
        "تم إيقاف رحلة الطلب الأولية بعد قرار إدارة المنصة.",
    };
  }

  if (customerFile.status === "closed") {
    return {
      title: "الملف مغلق",
      description:
        "لا يوجد إجراء مطلوب على هذا الملف حاليًا.",
    };
  }

  return {
    title:
      STAGE_LABELS[customerFile.current_stage] ||
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
        <h1>تعذر عرض ملف العميل</h1>

        <p>
          لم تصل بيانات الملف من قاعدة البيانات.
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
    STATUS_LABELS[customerFile.status] ||
    customerFile.status ||
    "غير محددة";

  const stageLabel =
    STAGE_LABELS[customerFile.current_stage] ||
    customerFile.current_stage ||
    "غير محددة";

  const statusClass = getStatusClass(
    customerFile.status
  );

  const currentAction =
    getCurrentAction(customerFile);

  return (
    <main className="customer-file-page">
      <div className="customer-file-container">
        <header className="customer-file-header">
          <div>
            <p>نايف المزيني للبناء الذاتي</p>

            <h1>
              ملف العميل{" "}
              <span className="customer-file-number">
                {customerFile.file_number}
              </span>
            </h1>

            <p>
              آخر تحديث:{" "}
              <strong>
                {formatDate(customerFile.updated_at)}
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

          <p>{currentAction.title}</p>

          <p className="customer-current-action-description">
            {currentAction.description}
          </p>
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
              <dd>{customerFile.file_number}</dd>
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
              <dt>المرحلة الحالية</dt>
              <dd>{stageLabel}</dd>
            </div>

            <div className="customer-file-data-item">
              <dt>تاريخ التقديم</dt>

              <dd>
                {formatDate(
                  customerFile.submitted_at
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>تاريخ القبول</dt>

              <dd>
                {formatDate(
                  customerFile.approved_at
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
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
                  customerFile.estimated_land_price
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
              <dt>المساحة المحتسبة لكل دور</dt>

              <dd>
                {formatSquareMeters(
                  customerFile
                    .building_area_per_floor
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>إجمالي مسطح البناء</dt>

              <dd>
                {formatSquareMeters(
                  customerFile
                    .total_building_area
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>سعر متر البناء</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile.meter_rate
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>تكلفة البناء التقديرية</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .estimated_construction_cost
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>إجمالي تكلفة المشروع</dt>

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
                  customerFile.financing_ratio
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
              <dt>الدفعة الأساسية 12٪</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile
                    .base_customer_payment
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>فرق التجاوز عن حد 80٪</dt>

              <dd>
                {formatSaudiRiyal(
                  customerFile.excess_amount
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>إجمالي الدفعة المطلوبة</dt>

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
              موافقتك على الدفعة الإضافية:{" "}
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
            {PROJECT_STAGES.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>

          <p className="customer-file-current-stage">
            المرحلة الحالية:{" "}
            <strong>{stageLabel}</strong>
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
              لا توجد أحداث مسجلة في الملف حتى الآن.
            </p>
          ) : (
            <ol className="customer-file-timeline">
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
                          {eventItem.description}
                        </p>
                      )}
                    </article>
                  </li>
                );
              })}
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
              يمكنك العودة إلى جميع مشاريعك من
              الصفحة الرئيسية عبر{" "}
              <strong>
                دخول ← حساب العميل
              </strong>
              .
            </p>

            <p>
              أدخل البريد الإلكتروني نفسه الذي
              سجلته عند تقديم الطلب، ثم استخدم رمز
              الدخول المرسل إلى بريدك.
            </p>

            <div className="customer-file-access-values">
              <div className="customer-file-access-value">
                <span>البريد الإلكتروني المسجل</span>

                <strong dir="ltr">
                  {customerFile.email ||
                    "البريد المسجل في الطلب"}
                </strong>
              </div>
            </div>

            <p className="customer-file-notice">
              بعد تسجيل الدخول ستظهر جميع المشاريع
              المرتبطة بالبريد نفسه داخل صفحة
              «مشاريعي»، دون الحاجة إلى إدخال رقم
              الملف أو رقم الجوال.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default CustomerFilePage;
