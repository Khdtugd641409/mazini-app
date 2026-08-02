function HomePage({
  onOpenCustomerApplication,
  onOpenAdmin,
  isCheckingAdmin = false,
}) {
  return (
    <main>
      <h1>نايف المزيني للبناء الذاتي</h1>

      <p>منصة البناء الذاتي الممول</p>

      <button
        type="button"
        onClick={onOpenCustomerApplication}
      >
        تقديم طلب عميل
      </button>

      <button
        type="button"
        onClick={onOpenAdmin}
        disabled={isCheckingAdmin}
      >
        {isCheckingAdmin
          ? "جاري التحقق من جلسة الإدارة..."
          : "إدارة المنصة"}
      </button>
    </main>
  );
}

export default HomePage;
