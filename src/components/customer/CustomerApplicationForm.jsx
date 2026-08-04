import { useMemo, useState } from "react";

import {
  calculateProjectCosts,
  formatPercentage,
  formatSaudiRiyal,
  formatSquareMeters,
} from "../../utils/projectCalculations.js";

const INITIAL_FORM = {
  customerName: "",
  mobileNumber: "",
  email: "",
  landArea: "",
  landPrice: "",
  floors: "1",
  bankOffer: "",
};

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function CustomerApplicationForm({ onReview }) {
  const [formData, setFormData] =
    useState(INITIAL_FORM);

  const [
    acceptedExtraPayment,
    setAcceptedExtraPayment,
  ] = useState(false);

  const [emailTouched, setEmailTouched] =
    useState(false);

  const calculation = useMemo(
    () => calculateProjectCosts(formData),
    [formData]
  );

  const normalizedEmail = normalizeEmail(
    formData.email
  );

  const isEmailValid =
    EMAIL_PATTERN.test(normalizedEmail);

  const requiresApproval =
    calculation.excessAmount > 0;

  const isCustomerDataComplete =
    formData.customerName.trim().length >= 3 &&
    /^05\d{8}$/.test(
      formData.mobileNumber
    ) &&
    isEmailValid;

  const submitDisabled =
    !isCustomerDataComplete ||
    !calculation.canSubmit ||
    (requiresApproval &&
      !acceptedExtraPayment);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    if (
      name === "landArea" ||
      name === "landPrice" ||
      name === "floors" ||
      name === "bankOffer"
    ) {
      setAcceptedExtraPayment(false);
    }
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);

    setFormData((currentData) => ({
      ...currentData,
      email: normalizeEmail(
        currentData.email
      ),
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setEmailTouched(true);

    const finalEmail = normalizeEmail(
      formData.email
    );

    if (
      submitDisabled ||
      !EMAIL_PATTERN.test(finalEmail)
    ) {
      return;
    }

    onReview({
      formData: {
        customerName:
          formData.customerName.trim(),

        mobileNumber:
          formData.mobileNumber.trim(),

        email: finalEmail,

        landArea: formData.landArea,

        landPrice: formData.landPrice,

        floors: formData.floors,

        bankOffer: formData.bankOffer,
      },

      calculation: {
        ...calculation,
      },

      acceptedExtraPayment,
    });
  };

  return (
    <form
      className="customer-application-form"
      onSubmit={handleSubmit}
    >
      <section className="customer-application-card">
        <div className="customer-application-card-heading">
          <span aria-hidden="true">👤</span>

          <div>
            <p>الخطوة الأولى</p>
            <h2>بيانات العميل</h2>
          </div>
        </div>

        <div className="customer-application-fields-grid">
          <div className="customer-application-field">
            <label htmlFor="customerName">
              الاسم الكامل
            </label>

            <input
              id="customerName"
              name="customerName"
              type="text"
              value={formData.customerName}
              onChange={handleChange}
              placeholder="الاسم الكامل"
              autoComplete="name"
              minLength="3"
              required
            />
          </div>

          <div className="customer-application-field">
            <label htmlFor="mobileNumber">
              رقم الجوال
            </label>

            <input
              id="mobileNumber"
              name="mobileNumber"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={formData.mobileNumber}
              onChange={handleChange}
              placeholder="05xxxxxxxx"
              pattern="05\d{8}"
              maxLength="10"
              autoComplete="tel"
              required
            />
          </div>

          <div className="customer-application-field customer-application-field-wide">
            <label htmlFor="email">
              البريد الإلكتروني
            </label>

            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              dir="ltr"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleEmailBlur}
              placeholder="name@example.com"
              autoComplete="email"
              maxLength="254"
              required
              aria-invalid={
                emailTouched &&
                !isEmailValid
                  ? "true"
                  : "false"
              }
              aria-describedby="email-help email-error"
            />

            <p
              id="email-help"
              className="customer-application-field-help"
            >
              سيُرسل إلى هذا البريد رمز
              الدخول إلى حسابك وجميع
              مشاريعك.
            </p>

            {emailTouched &&
              !isEmailValid && (
                <p
                  id="email-error"
                  className="customer-application-field-error"
                  role="alert"
                >
                  أدخل بريدًا إلكترونيًا
                  صحيحًا.
                </p>
              )}
          </div>
        </div>
      </section>

      <section className="customer-application-card">
        <div className="customer-application-card-heading">
          <span aria-hidden="true">🏡</span>

          <div>
            <p>الخطوة الثانية</p>
            <h2>
              بيانات الأرض والتمويل
            </h2>
          </div>
        </div>

        <div className="customer-application-fields-grid">
          <div className="customer-application-field">
            <label htmlFor="landArea">
              مساحة الأرض
            </label>

            <input
              id="landArea"
              name="landArea"
              type="number"
              min="1"
              step="1"
              inputMode="decimal"
              value={formData.landArea}
              onChange={handleChange}
              placeholder="مثال: 500"
              required
            />

            <p className="customer-application-field-help">
              بالمتر المربع
            </p>
          </div>

          <div className="customer-application-field">
            <label htmlFor="landPrice">
              قيمة الأرض
            </label>

            <input
              id="landPrice"
              name="landPrice"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={formData.landPrice}
              onChange={handleChange}
              placeholder="مثال: 400000"
              required
            />

            <p className="customer-application-field-help">
              بالريال السعودي
            </p>
          </div>

          <div className="customer-application-field">
            <label htmlFor="floors">
              عدد الأدوار
            </label>

            <select
              id="floors"
              name="floors"
              value={formData.floors}
              onChange={handleChange}
              required
            >
              <option value="1">
                دور واحد
              </option>

              <option value="2">
                دوران
              </option>

              <option value="3">
                ثلاثة أدوار
              </option>
            </select>
          </div>

          <div className="customer-application-field">
            <label htmlFor="bankOffer">
              الحد الأعلى لعرض البنك
            </label>

            <input
              id="bankOffer"
              name="bankOffer"
              type="number"
              min="1"
              step="1"
              inputMode="decimal"
              value={formData.bankOffer}
              onChange={handleChange}
              placeholder="مثال: 1200000"
              required
            />

            <p className="customer-application-field-help">
              بالريال السعودي
            </p>
          </div>
        </div>
      </section>

      <section className="customer-application-card customer-calculation-card">
        <div className="customer-application-card-heading">
          <span aria-hidden="true">🧮</span>

          <div>
            <p>النتيجة التقديرية</p>
            <h2>حساب المشروع</h2>
          </div>
        </div>

        <dl className="customer-application-data-grid">
          <div>
            <dt>
              المساحة المحتسبة لكل دور
            </dt>

            <dd>
              {formatSquareMeters(
                calculation
                  .buildingAreaPerFloor
              )}
            </dd>
          </div>

          <div>
            <dt>إجمالي مسطح البناء</dt>

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
              إجمالي الدفعة المطلوبة
            </dt>

            <dd>
              {formatSaudiRiyal(
                calculation
                  .totalCustomerPayment
              )}
            </dd>
          </div>
        </dl>

        <div className="customer-application-eligibility">
          <span>نتيجة الأهلية</span>

          <strong>
            {calculation.eligibilityLabel}
          </strong>
        </div>
      </section>

      {requiresApproval && (
        <section className="customer-application-card customer-approval-card">
          <div className="customer-application-card-heading">
            <span aria-hidden="true">✅</span>

            <div>
              <p>إقرار مطلوب</p>
              <h2>
                الموافقة على الدفعة
                المقدمة
              </h2>
            </div>
          </div>

          <p className="customer-application-lead">
            تجاوزت تكلفة المشروع 80٪ من
            عرض البنك، ولذلك أضيف فرق
            التجاوز إلى دفعة العميل
            الأساسية البالغة 12٪.
          </p>

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
                فرق التجاوز
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

          <label className="customer-application-checkbox">
            <input
              id="acceptedExtraPayment"
              name="acceptedExtraPayment"
              type="checkbox"
              checked={
                acceptedExtraPayment
              }
              onChange={(event) =>
                setAcceptedExtraPayment(
                  event.target.checked
                )
              }
            />

            <span>
              أقر بموافقتي على دفع إجمالي
              الدفعة المقدمة الموضحة أعلاه
              عند قبول طلبي.
            </span>
          </label>

          {acceptedExtraPayment && (
            <div className="customer-application-alert is-success">
              تم تسجيل موافقتك على الدفعة
              المقدمة.
            </div>
          )}
        </section>
      )}

      <button
        type="submit"
        className="customer-application-primary-button customer-application-submit-button"
        disabled={submitDisabled}
      >
        مراجعة الطلب
      </button>
    </form>
  );
}

export default CustomerApplicationForm;
