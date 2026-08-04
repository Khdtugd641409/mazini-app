import {
  formatPercentage,
  formatSaudiRiyal,
  formatSquareMeters,
} from "../../utils/projectCalculations.js";

function CustomerApplicationReview({
  formData,
  calculation,
  acceptedExtraPayment,
  onBack,
  onConfirm,
  isSubmitting = false,
  submitError = "",
}) {
  const floorsLabel =
    Number(formData.floors) === 1
      ? "دور واحد"
      : Number(formData.floors) === 2
        ? "دوران"
        : "ثلاثة أدوار";

  return (
    <section className="customer-application-review">
      <header className="customer-application-intro customer-review-intro">
        <p className="customer-application-eyebrow">
          الخطوة الأخيرة
        </p>

        <h1>مراجعة الطلب</h1>

        <p>
          راجع البيانات بعناية. بعد
          التأكيد سيُنشأ ملف عميل بحالة
          تحت المراجعة.
        </p>
      </header>

      <section className="customer-application-card">
        <div className="customer-application-card-heading">
          <span aria-hidden="true">👤</span>

          <div>
            <p>بيانات مقدم الطلب</p>
            <h2>بيانات العميل</h2>
          </div>
        </div>

        <dl className="customer-application-data-grid">
          <div>
            <dt>الاسم الكامل</dt>
            <dd>{formData.customerName}</dd>
          </div>

          <div>
            <dt>رقم الجوال</dt>
            <dd dir="ltr">
              {formData.mobileNumber}
            </dd>
          </div>

          <div>
            <dt>البريد الإلكتروني</dt>
            <dd dir="ltr">
              {formData.email}
            </dd>
          </div>
        </dl>
      </section>

      <section className="customer-application-card">
        <div className="customer-application-card-heading">
          <span aria-hidden="true">🏡</span>

          <div>
            <p>بيانات المشروع</p>
            <h2>
              الأرض والتمويل
            </h2>
          </div>
        </div>

        <dl className="customer-application-data-grid">
          <div>
            <dt>مساحة الأرض</dt>

            <dd>
              {formatSquareMeters(
                formData.landArea
              )}
            </dd>
          </div>

          <div>
            <dt>قيمة الأرض</dt>

            <dd>
              {formatSaudiRiyal(
                formData.landPrice
              )}
            </dd>
          </div>

          <div>
            <dt>عدد الأدوار</dt>
            <dd>{floorsLabel}</dd>
          </div>

          <div>
            <dt>
              الحد الأعلى لعرض البنك
            </dt>

            <dd>
              {formatSaudiRiyal(
                formData.bankOffer
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="customer-application-card customer-calculation-card">
        <div className="customer-application-card-heading">
          <span aria-hidden="true">🧮</span>

          <div>
            <p>تفاصيل الحساب</p>
            <h2>الحساب التقديري</h2>
          </div>
        </div>

        <dl className="customer-application-data-grid">
          <div>
            <dt>
              المساحة لكل دور
            </dt>

            <dd>
              {formatSquareMeters(
                calculation
                  .buildingAreaPerFloor
              )}
            </dd>
          </div>

          <div>
            <dt>
              إجمالي مسطح البناء
            </dt>

            <dd>
              {formatSquareMeters(
                calculation
                  .totalBuildingArea
              )}
            </dd>
          </div>

          <div>
            <dt>سعر متر البناء</dt>

            <dd>
              {formatSaudiRiyal(
                calculation.meterRate
              )}
            </dd>
          </div>

          <div>
            <dt>
              تكلفة البناء التقديرية
            </dt>

            <dd>
              {formatSaudiRiyal(
                calculation
                  .constructionCost
              )}
            </dd>
          </div>

          <div className="customer-application-featured-data">
            <dt>
              إجمالي تكلفة المشروع
            </dt>

            <dd>
              {formatSaudiRiyal(
                calculation
                  .estimatedProjectCost
              )}
            </dd>
          </div>

          <div>
            <dt>
              نسبة التكلفة إلى عرض البنك
            </dt>

            <dd>
              {formatPercentage(
                calculation
                  .financingRatio
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="customer-application-card customer-approval-card">
        <div className="customer-application-card-heading">
          <span aria-hidden="true">💰</span>

          <div>
            <p>الالتزام المالي</p>
            <h2>الدفعة المقدمة</h2>
          </div>
        </div>

        <dl className="customer-application-data-grid">
          <div>
            <dt>
              الدفعة الأساسية 12٪
            </dt>

            <dd>
              {formatSaudiRiyal(
                calculation
                  .baseCustomerPayment
              )}
            </dd>
          </div>

          <div>
            <dt>
              فرق التجاوز عن حد 80٪
            </dt>

            <dd>
              {formatSaudiRiyal(
                calculation.excessAmount
              )}
            </dd>
          </div>

          <div className="customer-application-featured-data">
            <dt>
              إجمالي الدفعة المقدمة
            </dt>

            <dd>
              {formatSaudiRiyal(
                calculation
                  .totalCustomerPayment
              )}
            </dd>
          </div>
        </dl>

        {calculation.excessAmount > 0 && (
          <div
            className={`customer-application-alert ${
              acceptedExtraPayment
                ? "is-success"
                : "is-error"
            }`}
          >
            إقرار الدفعة المقدمة:{" "}
            <strong>
              {acceptedExtraPayment
                ? "تمت الموافقة"
                : "لم تتم الموافقة"}
            </strong>
          </div>
        )}
      </section>

      <div className="customer-application-status-preview">
        <span>حالة الملف بعد التقديم</span>
        <strong>تحت المراجعة</strong>
      </div>

      {submitError && (
        <div
          className="customer-application-alert is-error"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <div className="customer-application-actions customer-review-actions">
        <button
          type="button"
          className="customer-application-secondary-button"
          onClick={onBack}
          disabled={isSubmitting}
        >
          العودة لتعديل البيانات
        </button>

        <button
          type="button"
          className="customer-application-primary-button"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "جاري إنشاء الملف..."
            : "أؤكد تقديم الطلب"}
        </button>
      </div>
    </section>
  );
}

export default CustomerApplicationReview;
