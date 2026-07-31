function CustomerApplicationPage({ onBack }) {
  return (
    <main>
      <h1>تقديم طلب البناء الذاتي</h1>
      <p>سيُنشأ نموذج العميل هنا.</p>

      <button type="button" onClick={onBack}>
        العودة إلى الصفحة الرئيسية
      </button>
    </main>
  );
}

export default CustomerApplicationPage;
