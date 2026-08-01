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
}) {
  return (
    <section>
      <h2>مراجعة الطلب قبل التقديم</h2>

      <p>
        راجع البيانات والحسابات التالية بعناية. بعد
        التأكيد سيُنشأ ملف طلب بحالة تحت المراجعة.
      </p>

      <h3>بيانات الأرض والتمويل</h3>

      <dl>
        <div>
          <dt>مساحة الأرض</dt>
          <dd>
            {formatSquareMeters(formData.landArea)}
          </dd>
        </div>

        <div>
          <dt>قيمة الأرض</dt>
          <dd>
            {formatSaudiRiyal(formData.landPrice)}
          </dd>
        </div>

        <div>
          <dt>عدد الأدوار</dt>
          <dd>{formData.floors}</dd>
        </div>

        <div>
          <dt>الحد الأعلى لعرض البنك</dt>
          <dd>
            {formatSaudiRiyal(formData.bankOffer)}
          </dd>
        </div>
      </dl>

      <h3>الحساب التقديري</h3>

      <dl>
        <div>
          <dt>المساحة المحتسبة لكل دور</dt>
          <dd>
            {formatSquareMeters(
              calculation.buildingAreaPerFloor
            )}
          </dd>
        </div>

        <div>
          <dt>إجمالي مسطح البناء</dt>
          <dd>
            {formatSquareMeters(
              calculation.totalBuildingArea
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
          <dt>تكلفة البناء التقديرية</dt>
          <dd>
            {formatSaudiRiyal(
              calculation.constructionCost
            )}
          </dd>
        </div>

        <div>
          <dt>إجمالي تكلفة المشروع</dt>
          <dd>
            {formatSaudiRiyal(
              calculation.estimatedProjectCost
            )}
          </dd>
        </div>

        <div>
          <dt>نسبة التكلفة إلى عرض البنك</dt>
          <dd>
            {formatPercentage(
              calculation.financingRatio
            )}
          </dd>
        </div>
      </dl>

      <h3>الدفعة المقدمة</h3>

      <dl>
        <div>
          <dt>دفعة العميل الأساسية 12٪</dt>
          <dd>
            {formatSaudiRiyal(
              calculation.baseCustomerPayment
            )}
          </dd>
        </div>

        <div>
          <dt>فرق التجاوز عن حد 80٪</dt>
          <dd>
            {formatSaudiRiyal(
              calculation.excessAmount
            )}
          </dd>
        </div>

        <div>
          <dt>إجمالي الدفعة المقدمة</dt>
          <dd>
            <strong>
              {formatSaudiRiyal(
                calculation.totalCustomerPayment
              )}
            </strong>
          </dd>
        </div>
      </dl>

      {calculation.excessAmount > 0 && (
        <p>
          إقرار الدفعة الإضافية:
          {" "}
          <strong>
            {acceptedExtraPayment
              ? "تمت الموافقة"
              : "لم تتم الموافقة"}
          </strong>
        </p>
      )}

      <p>
        حالة الطلب بعد التأكيد:
        {" "}
        <strong>تحت المراجعة</strong>
      </p>

      <div>
        <button
          type="button"
          onClick={onBack}
        >
          العودة لتعديل البيانات
        </button>

        <button
          type="button"
          onClick={onConfirm}
        >
          أؤكد تقديم الطلب
        </button>
      </div>
    </section>
  );
}

export default CustomerApplicationReview;
