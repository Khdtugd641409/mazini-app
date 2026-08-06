import { useMemo, useState } from "react";

import {
  calculateLandTotalPrice,
  submitFinancedCustomerLand,
} from "../services/customerLandSubmissionService.js";

import "./CustomerLandSubmissionPage.css";

const INITIAL_FORM_DATA = {
  city: "",
  district: "",
  googleMapsUrl: "",
  landArea: "",
  frontageWidth: "",
  streetWidth: "",
  landUseType: "",
  services: {
    water: false,
    electricity: false,
    fiber: false,
    publicSewer: false,
  },
  netPrice: "",
  taxAmount: "",
  brokerageAmount: "",
  landContactName: "",
  landContactMobile: "",
  customerNote: "",
};

const LAND_USE_LABELS = {
  residential: "سكني",
  commercial: "تجاري",
  agricultural: "زراعي",
};

const SERVICE_LABELS = {
  water: "ماء",
  electricity: "كهرباء",
  fiber: "ألياف بصرية",
  publicSewer: "صرف صحي عام",
};

const ALLOWED_DEED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const MAX_DEED_SIZE_BYTES =
  15 * 1024 * 1024;

function getCustomerFileIdFromPath() {
  const pathParts =
    window.location.pathname
      .split("/")
      .filter(Boolean);

  /*
   * المسار المتوقع:
   * /customer/project/{id}/land
   */
  if (
    pathParts.length !== 4 ||
    pathParts[0] !== "customer" ||
    pathParts[1] !== "project" ||
    pathParts[3] !== "land"
  ) {
    return "";
  }

  return pathParts[2];
}

function normalizeNumberInput(value) {
  const normalizedValue = String(
    value || ""
  )
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");

  const firstDecimalIndex =
    normalizedValue.indexOf(".");

  if (firstDecimalIndex === -1) {
    return normalizedValue;
  }

  return (
    normalizedValue.slice(
      0,
      firstDecimalIndex + 1
    ) +
    normalizedValue
      .slice(firstDecimalIndex + 1)
      .replace(/\./g, "")
  );
}

function normalizeMobileInput(value) {
  return String(value || "")
    .replace(/[^\d]/g, "")
    .slice(0, 10);
}

function formatSaudiRiyal(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "0 ر.س";
  }

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(numericValue);
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

function validateDeedFile(file) {
  if (!(file instanceof File)) {
    throw new Error(
      "أرفق ملف الصك."
    );
  }

  if (
    !ALLOWED_DEED_TYPES.includes(
      file.type
    )
  ) {
    throw new Error(
      "ملف الصك يجب أن يكون PDF أو JPG أو PNG."
    );
  }

  if (
    file.size <= 0 ||
    file.size > MAX_DEED_SIZE_BYTES
  ) {
    throw new Error(
      "حجم ملف الصك يجب ألا يتجاوز 15 ميجابايت."
    );
  }
}

function validateFormBeforeReview({
  formData,
  deedFile,
}) {
  if (!formData.googleMapsUrl.trim()) {
    throw new Error(
      "أدخل رابط موقع الأرض في Google Maps."
    );
  }

  if (!formData.city.trim()) {
    throw new Error("أدخل المدينة.");
  }

  if (!formData.district.trim()) {
    throw new Error("أدخل الحي.");
  }

  if (
    !formData.landArea ||
    Number(formData.landArea) <= 0
  ) {
    throw new Error(
      "أدخل مساحة الأرض."
    );
  }

  if (
    !formData.frontageWidth ||
    Number(formData.frontageWidth) <= 0
  ) {
    throw new Error(
      "أدخل عرض واجهة الأرض."
    );
  }

  if (
    !formData.streetWidth ||
    Number(formData.streetWidth) <= 0
  ) {
    throw new Error(
      "أدخل عرض الشارع."
    );
  }

  if (!formData.landUseType) {
    throw new Error(
      "اختر نوع الأرض."
    );
  }

  if (
    !formData.netPrice ||
    Number(formData.netPrice) <= 0
  ) {
    throw new Error(
      "أدخل السعر الصافي للأرض."
    );
  }

  if (!formData.landContactName.trim()) {
    throw new Error(
      "أدخل اسم مسؤول الأرض."
    );
  }

  if (
    !/^05\d{8}$/.test(
      formData.landContactMobile
    )
  ) {
    throw new Error(
      "رقم جوال مسؤول الأرض غير صحيح."
    );
  }

  validateDeedFile(deedFile);
}

export default function CustomerLandSubmissionPage({
  customerFileId: suppliedCustomerFileId = "",
  onBack,
}) {
  const customerFileId =
    suppliedCustomerFileId ||
    getCustomerFileIdFromPath();

  const [formData, setFormData] =
    useState(INITIAL_FORM_DATA);

  const [deedFile, setDeedFile] =
    useState(null);

  const [currentStep, setCurrentStep] =
    useState("form");

  const [createdSubmission, setCreatedSubmission] =
    useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const totalPrice = useMemo(() => {
    try {
      return calculateLandTotalPrice({
        netPrice:
          formData.netPrice || 0,

        taxAmount:
          formData.taxAmount || 0,

        brokerageAmount:
          formData.brokerageAmount || 0,
      });
    } catch {
      return 0;
    }
  }, [
    formData.netPrice,
    formData.taxAmount,
    formData.brokerageAmount,
  ]);

  function updateField(fieldName, value) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      [fieldName]: value,
    }));
  }

  function updateService(
    serviceName,
    checked
  ) {
    setFormData((currentFormData) => ({
      ...currentFormData,

      services: {
        ...currentFormData.services,
        [serviceName]: checked,
      },
    }));
  }

  function handleSelectDeedFile(event) {
    const selectedFile =
      event.target.files?.[0] || null;

    setErrorMessage("");

    if (!selectedFile) {
      setDeedFile(null);
      return;
    }

    try {
      validateDeedFile(selectedFile);
      setDeedFile(selectedFile);
    } catch (error) {
      event.target.value = "";
      setDeedFile(null);

      setErrorMessage(
        error?.message ||
          "ملف الصك غير صالح."
      );
    }
  }

  function handleOpenGoogleMaps() {
    const url =
      formData.googleMapsUrl.trim();

    if (!url) {
      setErrorMessage(
        "أدخل رابط موقع الأرض أولًا."
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

  function handleOpenReview(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");

    try {
      if (!customerFileId) {
        throw new Error(
          "معرّف مشروع العميل غير موجود."
        );
      }

      validateFormBeforeReview({
        formData,
        deedFile,
      });

      setCurrentStep("review");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "تحقق من بيانات الأرض."
      );
    }
  }

  function handleBackToForm() {
    if (isSubmitting) {
      return;
    }

    setCurrentStep("form");
    setErrorMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleConfirmSubmission() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const submission =
        await submitFinancedCustomerLand({
          customerFileId,

          city: formData.city,

          district:
            formData.district,

          googleMapsUrl:
            formData.googleMapsUrl,

          landArea:
            formData.landArea,

          frontageWidth:
            formData.frontageWidth,

          streetWidth:
            formData.streetWidth,

          landUseType:
            formData.landUseType,

          services:
            formData.services,

          netPrice:
            formData.netPrice,

          taxAmount:
            formData.taxAmount || 0,

          brokerageAmount:
            formData.brokerageAmount ||
            0,

          landContactName:
            formData.landContactName,

          landContactMobile:
            formData.landContactMobile,

          deedFile,

          customerNote:
            formData.customerNote,
        });

      setCreatedSubmission(submission);
      setCurrentStep("success");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "تعذر تقديم الأرض."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToProject() {
    if (isSubmitting) {
      return;
    }

    if (typeof onBack === "function") {
      onBack();
      return;
    }

    if (customerFileId) {
      window.location.href =
        `/customer/project/${customerFileId}`;

      return;
    }

    window.location.href =
      "/customer/projects";
  }

  function handleBackToProjects() {
    window.location.href =
      "/customer/projects";
  }

  const selectedServices =
    Object.entries(formData.services)
      .filter(
        ([, isAvailable]) =>
          isAvailable
      )
      .map(
        ([serviceKey]) =>
          SERVICE_LABELS[serviceKey]
      );

  if (
    currentStep === "success" &&
    createdSubmission
  ) {
    return (
      <main className="customer-land-page">
        <section className="customer-land-success-card">
          <div
            className="customer-land-success-icon"
            aria-hidden="true"
          >
            ✓
          </div>

          <p className="customer-land-eyebrow">
            تقديم الأرض
          </p>

          <h1>
            تم استلام بيانات الأرض
          </h1>

          <p>
            أُرسلت بيانات الأرض والصك إلى
            إدارة المنصة للمراجعة. لا يمكن
            تعديل التقديم أثناء المراجعة.
          </p>

          <dl className="customer-land-success-summary">
            <div>
              <dt>رقم التقديم</dt>

              <dd dir="ltr">
                {
                  createdSubmission
                    .submissionNumber
                }
              </dd>
            </div>

            <div>
              <dt>الحالة</dt>
              <dd>الأرض تحت المراجعة</dd>
            </div>

            <div>
              <dt>السعر الشامل</dt>

              <dd>
                {formatSaudiRiyal(
                  createdSubmission.totalPrice
                )}
              </dd>
            </div>
          </dl>

          <div className="customer-land-actions">
            <button
              type="button"
              className="customer-land-primary-button"
              onClick={handleBackToProject}
            >
              العودة إلى المشروع
            </button>

            <button
              type="button"
              className="customer-land-secondary-button"
              onClick={handleBackToProjects}
            >
              عرض جميع مشاريعي
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (currentStep === "review") {
    return (
      <main className="customer-land-page">
        <div className="customer-land-shell">
          <header className="customer-land-header">
            <button
              type="button"
              className="customer-land-back-button"
              onClick={handleBackToForm}
              disabled={isSubmitting}
            >
              العودة للتعديل
            </button>

            <div className="customer-land-brand">
              <span aria-hidden="true">
                NM
              </span>

              <div>
                <p>منصة نايف المزيني</p>

                <strong>
                  مراجعة بيانات الأرض
                </strong>
              </div>
            </div>
          </header>

          <section className="customer-land-intro">
            <p className="customer-land-eyebrow">
              الخطوة الأخيرة
            </p>

            <h1>
              راجع بيانات الأرض
            </h1>

            <p>
              تحقق من البيانات والسعر
              الشامل وملف الصك قبل إرسالها
              إلى إدارة المنصة.
            </p>
          </section>

          {errorMessage && (
            <div
              className="customer-land-alert is-error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <section className="customer-land-card">
            <h2>الموقع والأبعاد</h2>

            <dl className="customer-land-review-grid">
              <div>
                <dt>المدينة</dt>
                <dd>{formData.city}</dd>
              </div>

              <div>
                <dt>الحي</dt>
                <dd>{formData.district}</dd>
              </div>

              <div>
                <dt>مساحة الأرض</dt>

                <dd>
                  {formData.landArea} م²
                </dd>
              </div>

              <div>
                <dt>عرض الواجهة</dt>

                <dd>
                  {formData.frontageWidth} م
                </dd>
              </div>

              <div>
                <dt>عرض الشارع</dt>

                <dd>
                  {formData.streetWidth} م
                </dd>
              </div>

              <div>
                <dt>نوع الأرض</dt>

                <dd>
                  {
                    LAND_USE_LABELS[
                      formData.landUseType
                    ]
                  }
                </dd>
              </div>
            </dl>

            <button
              type="button"
              className="customer-land-map-button"
              onClick={handleOpenGoogleMaps}
            >
              فتح موقع الأرض في Google Maps
            </button>
          </section>

          <section className="customer-land-card">
            <h2>الخدمات المتوفرة</h2>

            {selectedServices.length > 0 ? (
              <ul className="customer-land-service-review">
                {selectedServices.map(
                  (serviceName) => (
                    <li key={serviceName}>
                      <span aria-hidden="true">
                        ✓
                      </span>

                      {serviceName}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p>
                لم يحدد العميل أي خدمة
                متوفرة.
              </p>
            )}
          </section>

          <section className="customer-land-card">
            <h2>بيانات السعر</h2>

            <dl className="customer-land-review-grid">
              <div>
                <dt>السعر الصافي</dt>

                <dd>
                  {formatSaudiRiyal(
                    formData.netPrice
                  )}
                </dd>
              </div>

              <div>
                <dt>الضريبة</dt>

                <dd>
                  {formatSaudiRiyal(
                    formData.taxAmount || 0
                  )}
                </dd>
              </div>

              <div>
                <dt>السعي</dt>

                <dd>
                  {formatSaudiRiyal(
                    formData
                      .brokerageAmount ||
                      0
                  )}
                </dd>
              </div>

              <div className="is-total">
                <dt>السعر الشامل</dt>

                <dd>
                  {formatSaudiRiyal(
                    totalPrice
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="customer-land-card">
            <h2>مسؤول الأرض والصك</h2>

            <dl className="customer-land-review-grid">
              <div>
                <dt>اسم المسؤول</dt>

                <dd>
                  {
                    formData
                      .landContactName
                  }
                </dd>
              </div>

              <div>
                <dt>رقم الجوال</dt>

                <dd dir="ltr">
                  {
                    formData
                      .landContactMobile
                  }
                </dd>
              </div>

              <div>
                <dt>اسم ملف الصك</dt>

                <dd>
                  {deedFile?.name}
                </dd>
              </div>

              <div>
                <dt>حجم الملف</dt>

                <dd>
                  {formatFileSize(
                    deedFile?.size
                  )}
                </dd>
              </div>
            </dl>

            {formData.customerNote && (
              <div className="customer-land-note-review">
                <strong>
                  ملاحظات العميل
                </strong>

                <p>
                  {formData.customerNote}
                </p>
              </div>
            )}
          </section>

          <div className="customer-land-actions">
            <button
              type="button"
              className="customer-land-primary-button"
              onClick={
                handleConfirmSubmission
              }
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "جاري تقديم الأرض..."
                : "تأكيد تقديم الأرض"}
            </button>

            <button
              type="button"
              className="customer-land-secondary-button"
              onClick={handleBackToForm}
              disabled={isSubmitting}
            >
              العودة للتعديل
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="customer-land-page">
      <div className="customer-land-shell">
        <header className="customer-land-header">
          <button
            type="button"
            className="customer-land-back-button"
            onClick={handleBackToProject}
            disabled={isSubmitting}
          >
            العودة إلى المشروع
          </button>

          <div className="customer-land-brand">
            <span aria-hidden="true">
              NM
            </span>

            <div>
              <p>منصة نايف المزيني</p>

              <strong>
                البناء الذاتي الممول
              </strong>
            </div>
          </div>
        </header>

        <section className="customer-land-intro">
          <p className="customer-land-eyebrow">
            مرحلة الأرض
          </p>

          <h1>تقديم الأرض</h1>

          <p>
            أدخل بيانات الأرض وأرفق الصك،
            ثم راجع البيانات قبل إرسالها
            إلى إدارة المنصة.
          </p>
        </section>

        <section className="customer-land-important-note">
          <h2>
            ملاحظات مهمة قبل التقديم
          </h2>

          <ul>
            <li>
              تأكد من صحة رابط الموقع
              والمدينة والحي.
            </li>

            <li>
              يجب أن يكون الصك واضحًا
              وكاملًا.
            </li>

            <li>
              ستتم مراجعة الأرض وفق معايير
              المنصة.
            </li>

            <li>
              قد تطلب الإدارة استكمال بعض
              البيانات قبل اتخاذ القرار.
            </li>
          </ul>
        </section>

        {errorMessage && (
          <div
            className="customer-land-alert is-error"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <form
          className="customer-land-form"
          onSubmit={handleOpenReview}
        >
          <section className="customer-land-card">
            <h2>بيانات الأرض</h2>

            <div className="customer-land-form-grid">
              <label className="is-full-width">
                <span>
                  رابط موقع الأرض في Google
                  Maps
                </span>

                <div className="customer-land-map-field">
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://maps.google.com/..."
                    value={
                      formData.googleMapsUrl
                    }
                    onChange={(event) =>
                      updateField(
                        "googleMapsUrl",
                        event.target.value
                      )
                    }
                    disabled={isSubmitting}
                    required
                  />

                  <button
                    type="button"
                    onClick={
                      handleOpenGoogleMaps
                    }
                    disabled={isSubmitting}
                  >
                    فتح الموقع
                  </button>
                </div>
              </label>

              <label>
                <span>المدينة</span>

                <input
                  type="text"
                  value={formData.city}
                  onChange={(event) =>
                    updateField(
                      "city",
                      event.target.value
                    )
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                <span>الحي</span>

                <input
                  type="text"
                  value={formData.district}
                  onChange={(event) =>
                    updateField(
                      "district",
                      event.target.value
                    )
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                <span>
                  مساحة الأرض (م²)
                </span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    formData.landArea
                  }
                  onChange={(event) =>
                    updateField(
                      "landArea",
                      normalizeNumberInput(
                        event.target.value
                      )
                    )
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                <span>
                  عرض الواجهة (م)
                </span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    formData.frontageWidth
                  }
                  onChange={(event) =>
                    updateField(
                      "frontageWidth",
                      normalizeNumberInput(
                        event.target.value
                      )
                    )
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                <span>
                  عرض الشارع (م)
                </span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    formData.streetWidth
                  }
                  onChange={(event) =>
                    updateField(
                      "streetWidth",
                      normalizeNumberInput(
                        event.target.value
                      )
                    )
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                <span>نوع الأرض</span>

                <select
                  value={
                    formData.landUseType
                  }
                  onChange={(event) =>
                    updateField(
                      "landUseType",
                      event.target.value
                    )
                  }
                  disabled={isSubmitting}
                  required
                >
                  <option value="">
                    اختر النوع
                  </option>

                  <option value="residential">
                    سكني
                  </option>

                  <option value="commercial">
                    تجاري
                  </option>

                  <option value="agricultural">
                    زراعي
                  </option>
                </select>
              </label>
            </div>
          </section>

          <section className="customer-land-card">
            <h2>الخدمات المتوفرة</h2>

            <div className="customer-land-services-grid">
              {Object.entries(
                SERVICE_LABELS
              ).map(
                ([
                  serviceKey,
                  serviceLabel,
                ]) => (
                  <label
                    key={serviceKey}
                    className="customer-land-service-option"
                  >
                    <input
                      type="checkbox"
                      checked={
                        formData.services[
                          serviceKey
                        ]
                      }
                      onChange={(event) =>
                        updateService(
                          serviceKey,
                          event.target.checked
                        )
                      }
                      disabled={
                        isSubmitting
                      }
                    />

                    <span aria-hidden="true">
                      ✓
                    </span>

                    <strong>
                      {serviceLabel}
                    </strong>
                  </label>
                )
              )}
            </div>
          </section>

          <section className="customer-land-card">
            <h2>بيانات السعر</h2>

            <div className="customer-land-form-grid">
              <label>
                <span>
                  السعر الصافي
                </span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    formData.netPrice
                  }
                  onChange={(event) =>
                    updateField(
                      "netPrice",
                      normalizeNumberInput(
                        event.target.value
                      )
                    )
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                <span>الضريبة</span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    formData.taxAmount
                  }
                  onChange={(event) =>
                    updateField(
                      "taxAmount",
                      normalizeNumberInput(
                        event.target.value
                      )
                    )
                  }
                  disabled={isSubmitting}
                  placeholder="0"
                />
              </label>

              <label>
                <span>السعي</span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    formData.brokerageAmount
                  }
                  onChange={(event) =>
                    updateField(
                      "brokerageAmount",
                      normalizeNumberInput(
                        event.target.value
                      )
                    )
                  }
                  disabled={isSubmitting}
                  placeholder="0"
                />
              </label>

              <div className="customer-land-total-price">
                <span>
                  السعر الشامل
                </span>

                <strong>
                  {formatSaudiRiyal(
                    totalPrice
                  )}
                </strong>

                <small>
                  السعر الصافي + الضريبة +
                  السعي
                </small>
              </div>
            </div>
          </section>

          <section className="customer-land-card">
            <h2>بيانات مسؤول الأرض</h2>

            <div className="customer-land-form-grid">
              <label>
                <span>
                  اسم مسؤول الأرض
                </span>

                <input
                  type="text"
                  value={
                    formData.landContactName
                  }
                  onChange={(event) =>
                    updateField(
                      "landContactName",
                      event.target.value
                    )
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                <span>رقم الجوال</span>

                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="05xxxxxxxx"
                  value={
                    formData
                      .landContactMobile
                  }
                  onChange={(event) =>
                    updateField(
                      "landContactMobile",
                      normalizeMobileInput(
                        event.target.value
                      )
                    )
                  }
                  disabled={isSubmitting}
                  maxLength={10}
                  required
                />
              </label>
            </div>
          </section>

          <section className="customer-land-card">
            <h2>إرفاق الصك</h2>

            <label className="customer-land-file-field">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={
                  handleSelectDeedFile
                }
                disabled={isSubmitting}
                required
              />

              <span className="customer-land-file-icon">
                📄
              </span>

              <strong>
                {deedFile
                  ? deedFile.name
                  : "اختر ملف الصك"}
              </strong>

              <small>
                PDF أو JPG أو PNG — بحد
                أقصى 15 ميجابايت
              </small>

              {deedFile && (
                <small>
                  الحجم:{" "}
                  {formatFileSize(
                    deedFile.size
                  )}
                </small>
              )}
            </label>

            <label className="customer-land-note-field">
              <span>
                ملاحظات إضافية
                (اختياري)
              </span>

              <textarea
                rows="4"
                value={
                  formData.customerNote
                }
                onChange={(event) =>
                  updateField(
                    "customerNote",
                    event.target.value
                  )
                }
                disabled={isSubmitting}
                maxLength={1500}
              />
            </label>
          </section>

          <button
            type="submit"
            className="customer-land-primary-button customer-land-submit-button"
            disabled={isSubmitting}
          >
            مراجعة بيانات الأرض
          </button>
        </form>
      </div>
    </main>
  );
}
