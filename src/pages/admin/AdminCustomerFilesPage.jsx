function AdminCustomerFilesPage({
  customerFiles = [],
  isLoading = false,
  errorMessage = "",
  onOpenCustomerFile,
  onBackToHome,
}) {
  return (
    <main>
      <header>
        <p>نايف المزيني للبناء الذاتي</p>
        <h1>ملفات العملاء</h1>

        <button
          type="button"
          onClick={onBackToHome}
        >
          العودة إلى الصفحة الرئيسية
        </button>
      </header>

      <section aria-labelledby="customer-files-title">
        <h2 id="customer-files-title">
          طلبات العملاء المقدمة
        </h2>

        <p>
          تظهر هنا ملفات العملاء منذ لحظة تقديمها،
          وتكون حالتها الأولى: تحت المراجعة.
        </p>
      </section>

      {isLoading && (
        <p role="status">
          جاري تحميل ملفات العملاء...
        </p>
      )}

      {errorMessage && (
        <p role="alert">
          <strong>{errorMessage}</strong>
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        customerFiles.length === 0 && (
          <section>
            <h2>لا توجد ملفات ظاهرة حاليًا</h2>

            <p>
              لم تُربط هذه الصفحة بصلاحيات إدارة
              المنصة وقاعدة البيانات بعد.
            </p>
          </section>
        )}

      {!isLoading &&
        !errorMessage &&
        customerFiles.length > 0 && (
          <section>
            <h2>
              عدد الملفات: {customerFiles.length}
            </h2>

            <div>
              {customerFiles.map((customerFile) => (
                <article key={customerFile.id}>
                  <h3>
                    {customerFile.file_number}
                  </h3>

                  <dl>
                    <div>
                      <dt>اسم العميل</dt>
                      <dd>
                        {customerFile.customer_name ||
                          "غير متوفر"}
                      </dd>
                    </div>

                    <div>
                      <dt>رقم الجوال</dt>
                      <dd>
                        {customerFile.mobile_number ||
                          "غير متوفر"}
                      </dd>
                    </div>

                    <div>
                      <dt>الحالة</dt>
                      <dd>
                        {customerFile.status_label ||
                          customerFile.status ||
                          "غير محددة"}
                      </dd>
                    </div>

                    <div>
                      <dt>تاريخ التقديم</dt>
                      <dd>
                        {customerFile.submitted_at
                          ? new Intl.DateTimeFormat(
                              "ar-SA",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }
                            ).format(
                              new Date(
                                customerFile.submitted_at
                              )
                            )
                          : "غير متوفر"}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenCustomerFile(
                        customerFile.id
                      )
                    }
                  >
                    فتح ملف العميل
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
    </main>
  );
}

export default AdminCustomerFilesPage;
