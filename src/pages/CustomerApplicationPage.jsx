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

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitError, setSubmitError] =
    useState("");

  /*
   * يُنشأ مرة واحدة لكل طلب.
   * إذا فشل الاتصال وأعاد العميل المحاولة،
   * نعيد استخدام المعرّف نفسه.
   */
  const requestIdRef = useRef(null);

  /*
   * قفل فوري مستقل عن تحديث React.
   * يمنع تنفيذ دالتين عند الضغط السريع مرتين.
   */
  const submissionLockRef = useRef(false);

  const handleOpenReview = (data) => {
    /*
     * دخول المراجعة من النموذج يعني بداية
     * محاولة تقديم جديدة.
     */
    requestIdRef.current =
      generateRequestId();

    submissionLockRef.current = false;

    setApplicationData(data);
    setCreatedCustomerFile(null);
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
     * عند العودة لتعديل البيانات، لا نعيد
     * استخدام معرّف الطلب القديم؛ لأن البيانات
     * قد تتغير.
     */
    requestIdRef.current = null;

    setSubmitError("");
    setCurrentStep("form");
  };

  const handleConfirmApplication = async () => {
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
      const customerFile =
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
        });

      if (
        !customerFile ||
        !customerFile.id ||
        !customerFile.file_number
      ) {
        throw new Error(
          "تم الحفظ، لكن لم تصل بيانات ملف العميل بصورة صحيحة."
        );
      }

      setCreatedCustomerFile(customerFile);
      setCurrentStep("customer-file");

      /*
       * انتهى الطلب بنجاح، فلا نحتاج معرّفه
       * في أي طلب جديد لاحقًا.
       */
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
       * لا نمسح requestId هنا.
       * إعادة المحاولة يجب أن تستخدم المعرّف نفسه
       * حتى تعيد Supabase الملف السابق بدل إنشاء
       * ملف ثانٍ.
       */
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleBackToHome = () => {
    requestIdRef.current = null;
    submissionLockRef.current = false;

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
