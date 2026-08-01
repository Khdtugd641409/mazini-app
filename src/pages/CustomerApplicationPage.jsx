import CustomerApplicationForm from "../components/customer/CustomerApplicationForm.jsx";

function CustomerApplicationPage({ onBack }) {
  return (
    <main>
      <button type="button" onClick={onBack}>
        العودة إلى الصفحة الرئيسية
      </button>

      <h1>تقديم طلب البناء الذاتي</h1>

      <p>
        أدخل بيانات الأرض والتمويل لمعرفة التكلفة التقديرية
        وأهلية التقديم.
      </p>

      <CustomerApplicationForm />
    </main>
  );
}

export default CustomerApplicationPage;
