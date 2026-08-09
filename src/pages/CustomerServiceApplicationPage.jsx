import { useEffect, useState } from "react";

import {
  sendCustomerLoginCode,
  verifyCustomerLoginCode,
} from "../services/customerAccountAuthService.js";

import {
  createCustomerServiceProject,
  listBuildingStages,
} from "../services/customerServiceProjectService.js";

import "./CustomerServiceApplicationPage.css";

const INITIAL_FORM_DATA = {
  customerName: "",
  mobileNumber: "",
  email: "",
  propertyLocationUrl: "",
  city: "",
  landArea: "",
  projectTitle: "",
  floors: "",
  stageSelection: "",
  stageId: "",
  customStageName: "",
  customStageDescription: "",
};

function normalizeOtpInput(value) {
  return String(value || "")
    .replace(/[^\d٠-٩۰-۹]/g, "")
    .slice(0, 8);
}

export default function CustomerServiceApplicationPage({
  onBack,
}) {
  const [formData, setFormData] =
    useState(INITIAL_FORM_DATA);

  const [buildingStages, setBuildingStages] =
    useState([]);

  const [step, setStep] = useState("form");
  const [otp, setOtp] = useState("");

  const [createdProject, setCreatedProject] =
    useState(null);

  const [isLoadingStages, setIsLoadingStages] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    let pageIsActive = true;

    async function loadStages() {
      try {
        setIsLoadingStages(true);
        setErrorMessage("");

        const stages =
          await listBuildingStages();

        if (pageIsActive) {
          setBuildingStages(stages);
        }
      } catch (error) {
        if (pageIsActive) {
          setBuildingStages([]);

          setErrorMessage(
            error?.message ||
              "تعذر تحميل مراحل البناء."
          );
        }
      } finally {
        if (pageIsActive) {
          setIsLoadingStages(false);
        }
      }
    }

    loadStages();

    return () => {
      pageIsActive = false;
    };
  }, []);

  function updateField(fieldName, value) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      [fieldName]: value,
    }));
  }

  function handleStageChange(value) {
    setFormData((currentFormData) => {
      if (value === "other") {
        return {
          ...currentFormData,
          stageSelection: "other",
          stageId: "",
        };
      }

      return {
        ...currentFormData,
        stageSelection: value,
        stageId: value,
        customStageName: "",
        customStageDescription: "",
      };
    });
  }

  function validateBeforeSendingCode() {
    if (
      !formData.customerName.trim() ||
      !formData.mobileNumber.trim() ||
      !formData.email.trim() ||
      !formData.propertyLocationUrl.trim() ||
      !formData.city.trim() ||
      !formData.landArea ||
      !formData.projectTitle ||
      !formData.floors
    ) {
      throw new Error(
        "أكمل جميع البيانات الإلزامية."
      );
    }

    if (!formData.stageSelection) {
      throw new Error(
        "اختر المرحلة الحالية."
      );
    }

    if (
      formData.stageSelection === "other" &&
      !formData.customStageName.trim()
    ) {
      throw new Error(
        "اكتب اسم المرحلة الأخرى."
      );
    }
  }

  async function handleSendCode(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      validateBeforeSendingCode();

      setIsSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const result =
        await sendCustomerLoginCode(
          formData.email
        );

      setFormData((currentFormData) => ({
        ...currentFormData,
        email: result.email,
      }));

      setOtp("");
      setStep("otp");

      setSuccessMessage(
        "تم إرسال رمز التحقق إلى بريدك الإلكتروني."
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "تعذر إرسال رمز التحقق."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyAndCreateProject(
    event
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      await verifyCustomerLoginCode(
        formData.email,
        otp
      );

      const isCustomStage =
        formData.stageSelection === "other";

      const project =
        await createCustomerServiceProject({
          customerName:
            formData.customerName,

          mobileNumber:
            formData.mobileNumber,

          propertyLocationUrl:
            formData.propertyLocationUrl,

          city:
            formData.city,

          landArea:
            formData.landArea,

          projectTitle:
            formData.projectTitle,

          floors:
            formData.floors,

          stageId: isCustomStage
            ? null
            : formData.stageId,

          customStageName: isCustomStage
            ? formData.customStageName
            : "",

          customStageDescription:
            isCustomStage
              ? formData.customStageDescription
              : "",
        });

      setCreatedProject(project);
      setStep("success");

      setSuccessMessage(
        "تم إنشاء مشروع الخدمات بنجاح."
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "تعذر التحقق أو إنشاء المشروع."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleChangeEmail() {
    if (isSubmitting) {
      return;
    }

    setOtp("");
    setStep("form");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleBackToHome() {
    if (isSubmitting) {
      return;
    }

    if (typeof onBack === "function") {
      onBack();
      return;
    }

    window.location.href = "/";
  }

  function handleOpenProjects() {
    window.location.href =
      "/customer/projects";
  }

  function handleOpenCreatedProject() {
    if (!createdProject?.id) {
      return;
    }

    window.location.href =
      `/customer/project/${createdProject.id}`;
  }

  if (
    step === "success" &&
    createdProject
  ) {
    return (
      <main className="service-application-page">
        <section className="service-application-success-card">
          <div
            className="service-application-success-icon"
            aria-hidden="true"
          >
            ✓
          </div>

          <p className="service-application-eyebrow">
            مشروع خدمات جديد
          </p>

          <h1>تم إنشاء المشروع</h1>

          <p>
            أصبح مشروعك نشطًا، ويمكنك الآن
            متابعة مرحلته واستعراض المشرفين
            والموردين المناسبين.
          </p>

          <dl className="service-application-summary">
            <div>
              <dt>رقم المشروع</dt>

              <dd dir="ltr">
                {createdProject.projectNumber}
              </dd>
            </div>

            <div>
              <dt>المرحلة الحالية</dt>

              <dd>
                {
                  createdProject.currentStageName
                }
              </dd>
            </div>

            <div>
              <dt>الحالة</dt>
              <dd>نشط</dd>
            </div>
          </dl>

          <div className="service-application-actions">
            <button
              type="button"
              className="service-application-primary-button"
              onClick={
                handleOpenCreatedProject
              }
            >
              فتح المشروع
            </button>

            <button
              type="button"
              className="service-application-secondary-button"
              onClick={handleOpenProjects}
            >
              عرض جميع مشاريعي
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="service-application-page">
      <div className="service-application-shell">
        <header className="service-application-header">
          <button
            type="button"
            className="service-application-back-button"
            onClick={handleBackToHome}
            disabled={isSubmitting}
          >
            العودة إلى الصفحة الرئيسية
          </button>

          <div className="service-application-brand">
            <span aria-hidden="true">
              NM
            </span>

            <div>
              <p>منصة نايف المزيني</p>

              <strong>
                للبناء الذاتي وإدارة المشاريع
              </strong>
            </div>
          </div>
        </header>

        <section className="service-application-intro">
          <p className="service-application-eyebrow">
            عميل الخدمات
          </p>

          <h1>إنشاء مشروع خدمات</h1>

          <p>
            أدخل بياناتك وبيانات المشروع،
            وحدد المرحلة الحالية، ثم تحقق من
            بريدك الإلكتروني لفتح المشروع
            مباشرة دون انتظار قبول الإدارة.
          </p>
        </section>

        {errorMessage && (
          <div
            className="service-application-alert is-error"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="service-application-alert is-success"
            role="status"
          >
            {successMessage}
          </div>
        )}

        {step === "form" ? (
          <form
            className="service-application-card"
            onSubmit={handleSendCode}
          >
            <section>
              <h2>بيانات العميل</h2>

              <div className="service-application-grid">
                <label>
                  <span>الاسم الكامل</span>

                  <input
                    type="text"
                    autoComplete="name"
                    value={
                      formData.customerName
                    }
                    onChange={(event) =>
                      updateField(
                        "customerName",
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
                    autoComplete="tel"
                    placeholder="05xxxxxxxx"
                    value={
                      formData.mobileNumber
                    }
                    onChange={(event) =>
                      updateField(
                        "mobileNumber",
                        event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10)
                      )
                    }
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <label className="is-full-width">
                  <span>
                    البريد الإلكتروني
                  </span>

                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target.value
                      )
                    }
                    disabled={isSubmitting}
                    required
                  />
                </label>
              </div>
            </section>

            <section>
              <h2>بيانات المشروع</h2>

              <div className="service-application-grid">
                <label className="is-full-width">
                  <span>
                    رابط موقع العقار
                  </span>

                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://maps.google.com/..."
                    value={
                      formData
                        .propertyLocationUrl
                    }
                    onChange={(event) =>
                      updateField(
                        "propertyLocationUrl",
                        event.target.value
                      )
                    }
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <label>
                  <span>مدينة المشروع</span>
                  <input
                    type="text"
                    placeholder="مثال: الرياض"
                    value={formData.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <label>
                  <span>
                    المساحة بالمتر المربع
                  </span>

                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="0.01"
                    value={formData.landArea}
                    onChange={(event) =>
                      updateField(
                        "landArea",
                        event.target.value
                      )
                    }
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <label>
                  <span>مسمى المشروع</span>

                  <select
                    value={
                      formData.projectTitle
                    }
                    onChange={(event) =>
                      updateField(
                        "projectTitle",
                        event.target.value
                      )
                    }
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">
                      اختر المسمى
                    </option>

                    <option value="دور">
                      دور
                    </option>

                    <option value="شقق">
                      شقق
                    </option>

                    <option value="فيلا">
                      فيلا
                    </option>
                  </select>
                </label>

                <label>
                  <span>عدد الأدوار</span>

                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    step="1"
                    value={formData.floors}
                    onChange={(event) =>
                      updateField(
                        "floors",
                        event.target.value
                      )
                    }
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <label>
                  <span>
                    المرحلة الحالية
                  </span>

                  <select
                    value={
                      formData.stageSelection
                    }
                    onChange={(event) =>
                      handleStageChange(
                        event.target.value
                      )
                    }
                    disabled={
                      isSubmitting ||
                      isLoadingStages
                    }
                    required
                  >
                    <option value="">
                      {isLoadingStages
                        ? "جاري تحميل المراحل..."
                        : "اختر المرحلة"}
                    </option>

                    {buildingStages.map(
                      (stage) => (
                        <option
                          key={stage.id}
                          value={stage.id}
                        >
                          {stage.stageName}
                        </option>
                      )
                    )}

                    <option value="other">
                      أخرى
                    </option>
                  </select>
                </label>

                {formData.stageSelection ===
                  "other" && (
                  <>
                    <label>
                      <span>
                        اسم المرحلة الأخرى
                      </span>

                      <input
                        type="text"
                        value={
                          formData
                            .customStageName
                        }
                        onChange={(event) =>
                          updateField(
                            "customStageName",
                            event.target.value
                          )
                        }
                        disabled={isSubmitting}
                        required
                      />
                    </label>

                    <label className="is-full-width">
                      <span>
                        وصف المرحلة
                        (اختياري)
                      </span>

                      <textarea
                        rows="4"
                        value={
                          formData
                            .customStageDescription
                        }
                        onChange={(event) =>
                          updateField(
                            "customStageDescription",
                            event.target.value
                          )
                        }
                        disabled={isSubmitting}
                      />
                    </label>
                  </>
                )}
              </div>
            </section>

            <button
              type="submit"
              className="service-application-primary-button"
              disabled={
                isSubmitting ||
                isLoadingStages
              }
            >
              {isSubmitting
                ? "جاري إرسال الرمز..."
                : "التحقق من البريد وإنشاء المشروع"}
            </button>
          </form>
        ) : (
          <form
            className="service-application-card service-application-otp-card"
            onSubmit={
              handleVerifyAndCreateProject
            }
          >
            <h2>تأكيد البريد الإلكتروني</h2>

            <p>
              أرسلنا رمزًا من 8 أرقام إلى:
            </p>

            <strong dir="ltr">
              {formData.email}
            </strong>

            <label>
              <span>رمز التحقق</span>

              <input
                className="service-application-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="00000000"
                value={otp}
                onChange={(event) =>
                  setOtp(
                    normalizeOtpInput(
                      event.target.value
                    )
                  )
                }
                disabled={isSubmitting}
                maxLength={8}
                required
              />
            </label>

            <div className="service-application-actions">
              <button
                type="submit"
                className="service-application-primary-button"
                disabled={
                  isSubmitting ||
                  otp.length !== 8
                }
              >
                {isSubmitting
                  ? "جاري إنشاء المشروع..."
                  : "تأكيد وإنشاء المشروع"}
              </button>

              <button
                type="button"
                className="service-application-secondary-button"
                onClick={handleChangeEmail}
                disabled={isSubmitting}
              >
                تعديل البيانات أو البريد
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
