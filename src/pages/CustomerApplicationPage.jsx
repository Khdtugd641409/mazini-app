import { useRef, useState } from "react";

import CustomerApplicationForm from "../components/customer/CustomerApplicationForm.jsx";
import CustomerApplicationReview from "../components/customer/CustomerApplicationReview.jsx";
import CustomerFilePage from "./CustomerFilePage.jsx";

import {
  createCustomerFile,
} from "../services/customerFileService.js";

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

    /*
     * عند العودة لتعديل البيانات، تبدأ محاولة
     * مستقلة بمعرّف جديد؛ لأن محتوى الطلب قد يتغير.
     */
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

      /*
       * created:
       * تم إنشاء ملف جديد.
       *
       * same_request:
       * كانت محاولة مكررة لنفس الضغط أو الإرسال،
       * فتمت إعادة الملف نفسه.
       */
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

      /*
       * لا نمسح requestId عند الخطأ؛
       * حتى تستخدم إعادة المحاولة المعرّف نفسه.
       */
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
      /*
       * العميل أكد أن الطلب المتطابق يمثل
       * مشروعًا جديدًا مستقلًا.
       */
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
      <main
        style={{
          minHeight: "100vh",
          padding: "24px",
          direction: "rtl",
          background: "#f7f5ef",
        }}
      >
        <section
          style={{
            maxWidth: "760px",
            margin: "40px auto",
            padding: "28px",
            background: "#ffffff",
            border: "1px solid rgba(11, 59, 50, 0.12)",
            borderRadius: "22px",
            boxShadow:
              "0 14px 40px rgba(40, 48, 42, 0.08)",
          }}
          aria-labelledby="similar-application-title"
        >
          <p
            style={{
              marginTop: 0,
              color: "#9a6b0f",
              fontWeight: 900,
            }}
          >
            تنبيه قبل إنشاء الملف
          </p>

          <h1
            id="similar-application-title"
            style={{
              color: "#173f36",
            }}
          >
            وجدنا طلبًا مطابقًا
          </h1>

          <p>
            يوجد طلب قُدّم خلال آخر سبعة أيام
            بنفس رقم الجوال وبيانات المشروع
            الأساسية.
          </p>

          <dl
            style={{
              display: "grid",
              gap: "12px",
              margin: "24px 0",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "#faf9f5",
                borderRadius: "14px",
              }}
            >
              <dt>رقم الملف السابق</dt>

              <dd
                style={{
                  margin: "7px 0 0",
                  fontSize: "20px",
                  fontWeight: 900,
                  color: "#9a6b0f",
                }}
              >
                {
                  similarCustomerFile
                    .file_number
                }
              </dd>
            </div>

            <div
              style={{
                padding: "16px",
                background: "#faf9f5",
                borderRadius: "14px",
              }}
            >
              <dt>تاريخ التقديم</dt>

              <dd
                style={{
                  margin: "7px 0 0",
                  fontWeight: 800,
                }}
              >
                {similarCustomerFile
                  .submitted_at
                  ? new Intl.DateTimeFormat(
                      "ar-SA",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
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

          <p>
            اختر فتح الملف السابق إذا كان هذا هو
            الطلب نفسه، أو أكّد أنه مشروع جديد
            مستقل رغم تشابه البيانات.
          </p>

          {submitError && (
            <p
              role="alert"
              style={{
                padding: "14px",
                color: "#8b2020",
                background: "#fff1f1",
                borderRadius: "12px",
              }}
            >
              <strong>{submitError}</strong>
            </p>
          )}

          <div
            style={{
              display: "grid",
              gap: "12px",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              onClick={handleOpenPreviousFile}
              disabled={isSubmitting}
              style={{
                minHeight: "52px",
                padding: "12px 18px",
                color: "#ffffff",
                font: "inherit",
                fontWeight: 900,
                cursor: "pointer",
                background: "#0b3b32",
                border: 0,
                borderRadius: "14px",
              }}
            >
              فتح الملف السابق
            </button>

            <button
              type="button"
              onClick={
                handleCreateSimilarProject
              }
              disabled={isSubmitting}
              style={{
                minHeight: "52px",
                padding: "12px 18px",
                color: "#173f36",
                font: "inherit",
                fontWeight: 900,
                cursor: "pointer",
                background: "#f1eadc",
                border: "1px solid #dbcba9",
                borderRadius: "14px",
              }}
            >
              {isSubmitting
                ? "جاري إنشاء المشروع..."
                : "هذا مشروع جديد — إنشاء ملف مستقل"}
            </button>

            <button
              type="button"
              onClick={handleReturnToReview}
              disabled={isSubmitting}
              style={{
                minHeight: "46px",
                padding: "10px 16px",
                color: "#52665f",
                font: "inherit",
                fontWeight: 800,
                cursor: "pointer",
                background: "transparent",
                border: "1px solid #d9dfda",
                borderRadius: "13px",
              }}
            >
              العودة إلى مراجعة الطلب
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (
    currentStep === "review" &&
    applicationData
  ) {
    return (
      <main>
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
      </main>
    );
  }

  return (
    <main>
      <button
        type="button"
        onClick={handleBackToHome}
      >
        العودة إلى الصفحة الرئيسية
      </button>

      <h1>تقديم طلب البناء الذاتي</h1>

      <p>
        أدخل بيانات العميل والأرض والتمويل
        لمعرفة التكلفة التقديرية وأهلية
        التقديم.
      </p>

      <CustomerApplicationForm
        onReview={handleOpenReview}
      />
    </main>
  );
}

export default CustomerApplicationPage;
