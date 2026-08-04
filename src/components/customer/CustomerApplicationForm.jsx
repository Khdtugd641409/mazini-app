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
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>بيانات العميل</legend>

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

        <label htmlFor="mobileNumber">
          رقم الجوال
        </label>

        <input
          id="mobileNumber"
          name="mobileNumber"
          type="tel"
          inputMode="tel"
          value={formData.mobileNumber}
          onChange={handleChange}
          placeholder="05xxxxxxxx"
          pattern="05\d{8}"
          maxLength="10"
          autoComplete="tel"
          required
        />

        <label htmlFor="email">
          البريد الإلكتروني
        </label>

        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          value={formData.email}
          onChange={handleChange}
          onBlur={handleEmailBlur}
          placeholder="name@example.com"
          autoComplete="email"
          maxLength="254"
          required
          aria-invalid={
            emailTouched && !isEmailValid
              ? "true"
              : "false"
          }
          aria-describedby="email-help email-error"
        />

        <p id="email-help">
          استخدم بريدًا تستطيع فتحه؛ سيُرسل
          إليه رمز الدخول إلى حسابك ومشاريعك.
        </p>

        {emailTouched && !isEmailValid && (
          <p
            id="email-error"
            role="alert"
          >
            <strong>
              أدخل بريدًا إلكترونيًا صحيحًا.
            </strong>
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>
          بيانات الأرض والتمويل
        </legend>

        <label htmlFor="landArea">
          مساحة الأرض بالمتر المربع
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

        <label htmlFor="landPrice">
          قيمة الأرض بالريال
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

        <label htmlFor="bankOffer">
          الحد الأعلى للتمويل في عرض البنك
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
      </fieldset>

      <section aria-live="polite">
        <h2>الحساب التقديري</h2>

        <dl>
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

          <div>
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
              دفعة العميل الأساسية 12٪
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

          <div>
            <dt>
              إجمالي الدفعة المطلوبة
            </dt>

            <dd>
              <strong>
                {formatSaudiRiyal(
                  calculation
                    .totalCustomerPayment
                )}
              </strong>
            </dd>
          </div>
        </dl>

        <strong>
          {calculation.eligibilityLabel}
        </strong>
      </section>

      {requiresApproval && (
        <section aria-live="polite">
          <h2>
            إقرار الدفعة المقدمة
          </h2>

          <p>
            تجاوزت تكلفة المشروع 80٪ من
            عرض البنك، ولذلك أضيف فرق
            التجاوز إلى دفعة العميل
            الأساسية البالغة 12٪.
          </p>

          <dl>
            <div>
              <dt>
                دفعة العميل الأساسية 12٪
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

            <div>
              <dt>
                إجمالي الدفعة المقدمة
              </dt>

              <dd>
                <strong>
                  {formatSaudiRiyal(
                    calculation
                      .totalCustomerPayment
                  )}
                </strong>
              </dd>
            </div>
          </dl>

          <label htmlFor="acceptedExtraPayment">
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

            أقر بموافقتي على دفع إجمالي
            الدفعة المقدمة الموضحة أعلاه
            عند قبول طلبي.
          </label>

          {acceptedExtraPayment && (
            <p>
              <strong>
                تم تسجيل موافقتك على
                الدفعة المقدمة.
              </strong>
            </p>
          )}
        </section>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
      >
        مراجعة الطلب
      </button>
    </form>
  );
}

export default CustomerApplicationForm;
