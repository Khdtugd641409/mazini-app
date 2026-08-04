import { useRef, useState } from "react";

import CustomerApplicationForm from "../components/customer/CustomerApplicationForm.jsx";
import CustomerApplicationReview from "../components/customer/CustomerApplicationReview.jsx";
import CustomerFilePage from "./CustomerFilePage.jsx";

import {
  createCustomerFile,
} from "../services/customerFileService.js";

import "./CustomerApplicationPage.css";

function generateRequestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    Date.now().toString(16),
    Math.random().toString(16).slice(2),
    Math.random().toString(16).slice(2),
  ].join("-");
}

function CustomerApplicationPage({ onBack }) {
  const [currentStep, setCurrentStep] =
    useState("form");

  const [applicationData, setApplicationData] =
    useState(null);

  const [
    createdCustomerFile,
    setCreatedCustomerFile,
  ] = useState(null);

  const [
    similarCustomerFile,
    setSimilarCustomerFile,
  ] = useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitError, setSubmitError] =
    useState("");

  const requestIdRef = useRef(null);
  const submissionLockRef = useRef(false);

  const resetSubmissionState = () => {
    requestIdRef.current = null;
    submissionLockRef.current = false;

    setApplicationData(null);
    setCreatedCustomerFile(null);
    setSimilarCustomerFile(null);
    setSubmitError("");
    setIsSubmitting(false);
  };

  const handleOpenReview = (data) => {
    requestIdRef.current =
      generateRequestId();

    submissionLockRef.current = false;

    setApplicationData(data);
    setCreatedCustomerFile(null);
    setSimilarCustomerFile(null);
    setSubmitError("");
    setCurrentStep("review");
  };

  const handleBackToForm = () => {
    if (
      isSubmitting ||
      submissionLockRef.current
    ) {
      return;
    }

    requestIdRef.current = null;

    setSimilarCustomerFile(null);
    setSubmitError("");
    setCurrentStep("form");
  };

  const submitApplication = async ({
    allowSimilarApplication = false,
  } = {}) => {
    if (
      !applicationData ||
      isSubmitting ||
      submissionLockRef.current
    ) {
      return;
    }

    if (!requestIdRef.current) {
      requestIdRef.current =
        generateRequestId();
    }

    submissionLockRef.current = true;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const result =
        await createCustomerFile({
          formData:
            applicationData.formData,

          calculation:
            applicationData.calculation,

          acceptedExtraPayment:
            applicationData
              .acceptedExtraPayment,

          requestId:
            requestIdRef.current,

          allowSimilarApplication,
        });

      if (
        !result ||
        !result.customerFile ||
        !result.customerFile.id ||
        !result.customerFile.file_number
      ) {
        throw new Error(
          "تم تنفيذ العملية، لكن لم تصل بيانات ملف العميل بصورة صحيحة."
        );
      }

      if (
        result.resultType ===
        "similar_found"
      ) {
        setSimilarCustomerFile(
          result.customerFile
        );

        setCurrentStep("similar-found");

        return;
      }

      setCreatedCustomerFile(
        result.customerFile
      );

      setSimilarCustomerFile(null);
      setCurrentStep("customer-file");

      requestIdRef.current = null;
    } catch (error) {
      console.error(
        "تعذر إنشاء ملف العميل:",
        error
      );

      setSubmitError(
        error?.message ||
          "تعذر إنشاء ملف العميل. حاول مرة أخرى."
      );
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleConfirmApplication = async () => {
    await submitApplication({
      allowSimilarApplication: false,
    });
  };

  const handleCreateSimilarProject =
    async () => {
      await submitApplication({
        allowSimilarApplication: true,
      });
    };

  const handleOpenPreviousFile = () => {
    if (!similarCustomerFile) {
      return;
    }

    setCreatedCustomerFile(
      similarCustomerFile
    );

    setSimilarCustomerFile(null);
    setSubmitError("");
    setCurrentStep("customer-file");

    requestIdRef.current = null;
  };

  const handleReturnToReview = () => {
    if (
      isSubmitting ||
      submissionLockRef.current
    ) {
      return;
    }

    setSimilarCustomerFile(null);
    setSubmitError("");
    setCurrentStep("review");
  };

  const handleBackToHome = () => {
    resetSubmissionState();
    onBack();
  };

  if (
    currentStep === "customer-file" &&
    createdCustomerFile
  ) {
    return (
      <CustomerFilePage
        customerFile={createdCustomerFile}
        timeline={[]}
        onBackToHome={handleBackToHome}
      />
    );
  }

  if (
    currentStep === "similar-found" &&
    similarCustomerFile
  ) {
    return (
      <main className="customer-application-page">
        <div className="customer-application-shell">
          <header className="customer-application-header">
            <button
              type="button"
              className="customer-application-back-button"
              onClick={handleBackToHome}
            >
              العودة إلى الصفحة الرئيسية
            </button>

            <div className="customer-application-brand">
              <span aria-hidden="true">
                NM
              </span>

              <div>
                <p>منصة نايف المزيني</p>
                <strong>
                  للبناء الذاتي
                </strong>
              </div>
            </div>
          </header>

          <section className="customer-application-card customer-similar-card">
            <div className="customer-application-section-icon">
              ⚠️
            </div>

            <p className="customer-application-eyebrow">
              تنبيه قبل إنشاء الملف
            </p>

            <h1>وجدنا طلبًا مطابقًا</h1>

            <p className="customer-application-lead">
              يوجد طلب قُدّم خلال آخر سبعة
              أيام بنفس رقم الجوال وبيانات
              المشروع الأساسية.
            </p>

            <dl className="customer-application-data-grid">
              <div>
                <dt>رقم الملف السابق</dt>

                <dd className="customer-application-highlight-value">
                  {
                    similarCustomerFile
                      .file_number
                  }
                </dd>
              </div>

              <div>
                <dt>تاريخ التقديم</dt>

                <dd>
                  {similarCustomerFile
                    .submitted_at
                    ? new Intl.DateTimeFormat(
                        "ar-SA",
                        {
                          dateStyle:
                            "medium",
                          timeStyle:
                            "short",
                        }
                      ).format(
                        new Date(
                          similarCustomerFile
                            .submitted_at
                        )
                      )
                    : "غير متوفر"}
                </dd>
              </div>
            </dl>

            <p className="customer-application-lead">
              افتح الملف السابق إذا كان هذا
              هو الطلب نفسه، أو أكّد أنه
              مشروع جديد مستقل.
            </p>

            {submitError && (
              <div
                className="customer-application-alert is-error"
                role="alert"
              >
                {submitError}
              </div>
            )}

            <div className="customer-application-actions">
              <button
                type="button"
                className="customer-application-primary-button"
                onClick={
                  handleOpenPreviousFile
                }
                disabled={isSubmitting}
              >
                فتح الملف السابق
              </button>

              <button
                type="button"
                className="customer-application-secondary-button"
                onClick={
                  handleCreateSimilarProject
                }
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "جاري إنشاء المشروع..."
                  : "هذا مشروع جديد — إنشاء ملف مستقل"}
              </button>

              <button
                type="button"
                className="customer-application-text-button"
                onClick={
                  handleReturnToReview
                }
                disabled={isSubmitting}
              >
                العودة إلى مراجعة الطلب
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (
    currentStep === "review" &&
    applicationData
  ) {
    return (
      <main className="customer-application-page">
        <div className="customer-application-shell">
          <header className="customer-application-header">
            <button
              type="button"
              className="customer-application-back-button"
              onClick={handleBackToHome}
            >
              العودة إلى الصفحة الرئيسية
            </button>

            <div className="customer-application-brand">
              <span aria-hidden="true">
                NM
              </span>

              <div>
                <p>منصة نايف المزيني</p>
                <strong>
                  للبناء الذاتي
                </strong>
              </div>
            </div>
          </header>

          <CustomerApplicationReview
            formData={
              applicationData.formData
            }
            calculation={
              applicationData.calculation
            }
            acceptedExtraPayment={
              applicationData
                .acceptedExtraPayment
            }
            onBack={handleBackToForm}
            onConfirm={
              handleConfirmApplication
            }
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="customer-application-page">
      <div className="customer-application-shell">
        <header className="customer-application-header">
          <button
            type="button"
            className="customer-application-back-button"
            onClick={handleBackToHome}
          >
            العودة إلى الصفحة الرئيسية
          </button>

          <div className="customer-application-brand">
            <span aria-hidden="true">
              NM
            </span>

            <div>
              <p>منصة نايف المزيني</p>
              <strong>
                للبناء الذاتي
              </strong>
            </div>
          </div>
        </header>

        <section className="customer-application-intro">
          <p className="customer-application-eyebrow">
            طلب بناء ذاتي جديد
          </p>

          <h1>تقديم طلب البناء الذاتي</h1>

          <p>
            أدخل بيانات العميل والأرض
            والتمويل، ثم راجع التكلفة
            التقديرية والدفعة المطلوبة قبل
            إرسال الطلب.
          </p>
        </section>

        <CustomerApplicationForm
          onReview={handleOpenReview}
        />
      </div>
    </main>
  );
}

export default CustomerApplicationPage;
