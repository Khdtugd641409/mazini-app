import { useMemo, useState } from "react";
import {
  calculateProjectCosts,
  formatPercentage,
  formatSaudiRiyal,
  formatSquareMeters,
} from "../../utils/projectCalculations.js";

const INITIAL_FORM = {
  landArea: "",
  landPrice: "",
  floors: "1",
  bankOffer: "",
};

function CustomerApplicationForm() {
  const [formData, setFormData] = useState(INITIAL_FORM);

  const calculation = useMemo(
    () => calculateProjectCosts(formData),
    [formData]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>بيانات الأرض والتمويل</legend>

        <label htmlFor="landArea">مساحة الأرض بالمتر المربع</label>
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

        <label htmlFor="landPrice">قيمة الأرض بالريال</label>
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

        <label htmlFor="floors">عدد الأدوار</label>
        <select
          id="floors"
          name="floors"
          value={formData.floors}
          onChange={handleChange}
          required
        >
          <option value="1">دور واحد</option>
          <option value="2">دوران</option>
          <option value="3">ثلاثة أدوار</option>
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
              {formatSaudiRiyal(calculation.meterRate)}
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
            <dt>إجمالي الدفعة المطلوبة</dt>
            <dd>
              {formatSaudiRiyal(
                calculation.totalCustomerPayment
              )}
            </dd>
          </div>
        </dl>

        <strong>{calculation.eligibilityLabel}</strong>
      </section>

      <button
        type="submit"
        disabled={!calculation.canSubmit}
      >
        تقديم الطلب
      </button>
    </form>
  );
}

export default CustomerApplicationForm;
