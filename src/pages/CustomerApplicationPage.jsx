import { useState } from "react";
import CustomerApplicationForm from "../components/customer/CustomerApplicationForm.jsx";
import CustomerApplicationReview from "../components/customer/CustomerApplicationReview.jsx";
import CustomerFilePage from "./CustomerFilePage.jsx";
import { createCustomerFile } from "../services/customerFileService.js";

function CustomerApplicationPage({ onBack }) {
  const [currentStep, setCurrentStep] = useState("form");

  const [applicationData, setApplicationData] =
    useState(null);

  const [createdCustomerFile, setCreatedCustomerFile] =
    useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitError, setSubmitError] =
    useState("");

  const handleOpenReview = (data) => {
    setApplicationData(data);
    setSubmitError("");
    setCurrentStep("review");
  };

  const handleBackToForm = () => {
    if (isSubmitting) {
      return;
    }

    setSubmitError("");
    setCurrentStep("form");
  };

  const handleConfirmApplication = async () => {
    if (!applicationData || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const customerFile = await createCustomerFile({
        formData: applicationData.formData,
        calculation: applicationData.calculation,
        acceptedExtraPayment:
          applicationData.acceptedExtraPayment,
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
      setIsSubmitting(false);
    }
  };

  const handleBackToHome = () => {
    onBack();
  };

  if (
    currentStep === "customer-file" &&
    createdCustomerFile
  ) {
    return (
      <CustomerFilePage
        customerFile={createdCustomerFile}
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
          formData={applicationData.formData}
          calculation={applicationData.calculation}
          acceptedExtraPayment={
            applicationData.acceptedExtraPayment
          }
          onBack={handleBackToForm}
          onConfirm={handleConfirmApplication}
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
        onClick={onBack}
      >
        العودة إلى الصفحة الرئيسية
      </button>

      <h1>تقديم طلب البناء الذاتي</h1>

      <p>
        أدخل بيانات العميل والأرض والتمويل لمعرفة
        التكلفة التقديرية وأهلية التقديم.
      </p>

      <CustomerApplicationForm
        onReview={handleOpenReview}
      />
    </main>
  );
}

export default CustomerApplicationPage;
