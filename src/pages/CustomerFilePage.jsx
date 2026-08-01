const STATUS_LABELS = {
  under_review: "تحت المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبول",
  rejected: "مرفوض",
  waiting_land: "بانتظار تقديم الأرض",
  land_under_review: "الأرض تحت المراجعة",
  land_approved: "تم قبول الأرض",
  land_rejected: "تم رفض الأرض",
  waiting_transfer: "بانتظار الإفراغ",
  transfer_in_progress: "إجراءات الإفراغ جارية",
  active_project: "المشروع قيد التنفيذ",
  closed: "ملف مغلق",
};

const STAGE_LABELS = {
  application_review: "مراجعة طلب العميل",
  waiting_land: "انتظار تقديم الأرض",
  land_review: "فحص الأرض",
  land_transfer: "إفراغ الأرض",
  project_execution: "تنفيذ المشروع",
  project_closure: "إغلاق المشروع",
};

function formatDate(value) {
  if (!value) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function CustomerFilePage({
  customerFile,
  onBackToHome,
}) {
  if (!customerFile) {
    return (
      <main>
        <h1>تعذر عرض ملف العميل</h1>

        <p>
          لم تصل بيانات الملف من قاعدة البيانات.
        </p>

        <button
          type="button"
          onClick={onBackToHome}
        >
          العودة إلى الصفحة الرئيسية
        </button>
      </main>
    );
  }

  const statusLabel =
    STATUS_LABELS[customerFile.status] ||
    customerFile.status ||
    "غير محددة";

  const stageLabel =
    STAGE_LABELS[customerFile.current_stage] ||
    customerFile.current_stage ||
    "غير محددة";

  return (
    <main>
      <header>
        <p>نايف المزيني للبناء الذاتي</p>

        <h1>ملف العميل</h1>
      </header>

      <section aria-labelledby="file-created-title">
        <h2 id="file-created-title">
          تم إنشاء ملفك بنجاح
        </h2>

        <p>
          احتفظ برقم الملف؛ سيكون اسم المستخدم
          الخاص بك عند تفعيل الدخول لأول مرة.
        </p>
      </section>

      <section aria-labelledby="file-summary-title">
        <h2 id="file-summary-title">
          بيانات الملف
        </h2>

        <dl>
          <div>
            <dt>رقم الملف</dt>

            <dd>
              <strong>
                {customerFile.file_number}
              </strong>
            </dd>
          </div>

          <div>
            <dt>الحالة الحالية</dt>

            <dd>
              <strong>{statusLabel}</strong>
            </dd>
          </div>

          <div>
            <dt>المرحلة الحالية</dt>

            <dd>{stageLabel}</dd>
          </div>

          <div>
            <dt>تاريخ التقديم</dt>

            <dd>
              {formatDate(customerFile.submitted_at)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="next-step-title">
        <h2 id="next-step-title">
          الخطوة الحالية
        </h2>

        {customerFile.status === "under_review" ? (
          <>
            <p>
              ملفك الآن لدى إدارة المنصة للمراجعة.
            </p>

            <p>
              ستتغير حالة الملف بعد اتخاذ الإدارة
              قرارها.
            </p>
          </>
        ) : (
          <p>
            تابع الحالة الحالية والتعليمات المرتبطة
            بها من داخل ملفك.
          </p>
        )}
      </section>

      <section aria-labelledby="login-title">
        <h2 id="login-title">
          الدخول إلى الملف لاحقًا
        </h2>

        <p>
          اسم المستخدم:
        </p>

        <p>
          <strong>
            {customerFile.file_number}
          </strong>
        </p>

        <p>
          عند أول دخول ستنشئ كلمة المرور الخاصة بك.
        </p>
      </section>

      <button
        type="button"
        onClick={onBackToHome}
      >
        العودة إلى الصفحة الرئيسية
      </button>
    </main>
  );
}

export default CustomerFilePage;
