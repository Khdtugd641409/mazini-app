import { useState } from "react";
import CustomerApplicationForm from "../components/customer/CustomerApplicationForm.jsx";
import CustomerApplicationReview from "../components/customer/CustomerApplicationReview.jsx";

function CustomerApplicationPage({ onBack }) {
  const [currentStep, setCurrentStep] = useState("form");
  const [applicationData, setApplicationData] =
    useState(null);

  const handleOpenReview = (data) => {
    setApplicationData(data);
    setCurrentStep("review");
  };

  const handleBackToForm = () => {
    setCurrentStep("form");
  };

  const handleConfirmApplication = () => {
    // في الخطوة التالية سنحفظ ملف العميل في Supabase.
    setCurrentStep("submitted");
  };

  if (currentStep === "review" && applicationData) {
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
        />
      </main>
    );
  }

  if (currentStep === "submitted") {
    return (
      <main>
        <h1>تم استلام طلبك</h1>

        <p>
          تم إنشاء ملف العميل مبدئيًا، وحالته الحالية:
        </p>

        <p>
          <strong>تحت المراجعة</strong>
        </p>

        <p>
          في الخطوة التالية سنربط هذه العملية
          بقاعدة البيانات، ليظهر الملف للعميل
          وإدارة المنصة.
        </p>

        <button type="button" onClick={onBack}>
          العودة إلى الصفحة الرئيسية
        </button>
      </main>
    );
  }

  return (
    <main>
      <button type="button" onClick={onBack}>
        العودة إلى الصفحة الرئيسية
      </button>

      <h1>تقديم طلب البناء الذاتي</h1>

      <p>
        أدخل بيانات الأرض والتمويل لمعرفة التكلفة
        التقديرية وأهلية التقديم.
      </p>

      <CustomerApplicationForm
        onReview={handleOpenReview}
      />
    </main>
  );
}

export default CustomerApplicationPage;
