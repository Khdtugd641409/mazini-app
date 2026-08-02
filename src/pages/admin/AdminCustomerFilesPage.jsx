import { useState } from "react";
import {
  formatSaudiRiyal,
} from "../../utils/projectCalculations.js";

const STATUS_LABELS = {
  under_review: "متقدم",
  approved: "مقبول",
  needs_completion: "مطلوب استكمال",
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
  application_review: "مراجعة الطلب",
  waiting_land: "انتظار تقديم الأرض",
  land_review: "فحص الأرض",
  land_transfer: "إفراغ الأرض",
  project_execution: "تنفيذ المشروع",
  project_closure: "إغلاق المشروع",
};

const STATUS_TABS = [
  {
    value: "all",
    label: "الكل",
  },
  {
    value: "under_review",
    label: "المتقدمون",
  },
  {
    value: "approved",
    label: "المقبولون",
  },
  {
    value: "needs_completion",
    label: "مطلوب استكمال",
  },
  {
    value: "rejected",
    label: "المرفوضون",
  },
];

const SORT_OPTIONS = [
  {
    value: "newest",
    label: "الأحدث أولًا",
  },
  {
    value: "oldest",
    label: "الأقدم أولًا",
  },
  {
    value: "file_number",
    label: "حسب رقم الملف",
  },
  {
    value: "project_cost_desc",
    label: "قيمة المشروع: الأعلى أولًا",
  },
  {
    value: "project_cost_asc",
    label: "قيمة المشروع: الأقل أولًا",
  },
  {
    value: "status",
    label: "حسب الحالة",
  },
];

function formatDate(value) {
  if (!value) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminCustomerFilesPage({
  customerFiles = [],
  pagination = {
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  filters = {
    search: "",
    status: "all",
    sort: "newest",
  },
  isLoading = false,
  errorMessage = "",
  onSearch,
  onStatusChange,
  onSortChange,
  onPreviousPage,
  onNextPage,
  onOpenCustomerFile,
  onBackToHome,
}) {
  const [searchInput, setSearchInput] = useState(
    filters.search || ""
  );

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    onSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    onSearch("");
  };

  return (
    <main>
      <header>
        <div>
          <p>نايف المزيني للبناء الذاتي</p>

          <h1>
            العملاء
            {" "}
            <span>
              ({Number(pagination.totalCount || 0)})
            </span>
          </h1>

          <p>
            البحث وإدارة ملفات العملاء بجميع حالاتهم.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToHome}
        >
          العودة إلى لوحة الإدارة
        </button>
      </header>

      <section aria-labelledby="customer-search-title">
        <h2 id="customer-search-title">
          البحث والتصفية
        </h2>

        <form onSubmit={handleSearchSubmit}>
          <label htmlFor="customerSearch">
            البحث في ملفات العملاء
          </label>

          <input
            id="customerSearch"
            type="search"
            value={searchInput}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
            placeholder="رقم الملف، الاسم، الجوال أو البريد"
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={isLoading}
          >
            بحث
          </button>

          {filters.search && (
            <button
              type="button"
              onClick={handleClearSearch}
              disabled={isLoading}
            >
              مسح البحث
            </button>
          )}
        </form>

        <div aria-label="تصنيف العملاء حسب الحالة">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() =>
                onStatusChange(tab.value)
              }
              disabled={isLoading}
              aria-pressed={
                filters.status === tab.value
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label htmlFor="customerSort">
          ترتيب النتائج
        </label>

        <select
          id="customerSort"
          value={filters.sort}
          onChange={(event) =>
            onSortChange(event.target.value)
          }
          disabled={isLoading}
        >
          {SORT_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
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
            <h2>لا توجد نتائج</h2>

            <p>
              لا توجد ملفات مطابقة للبحث أو التصنيف
              المحدد.
            </p>
          </section>
        )}

      {!isLoading &&
        !errorMessage &&
        customerFiles.length > 0 && (
          <>
            <section aria-labelledby="customer-results-title">
              <header>
                <h2 id="customer-results-title">
                  ملفات العملاء
                </h2>

                <p>
                  الصفحة{" "}
                  <strong>{pagination.page}</strong>
                  {" "}
                  من{" "}
                  <strong>
                    {pagination.totalPages}
                  </strong>
                </p>
              </header>

              <div role="table" aria-label="ملفات العملاء">
                <div role="row">
                  <span role="columnheader">
                    رقم الملف
                  </span>

                  <span role="columnheader">
                    اسم العميل
                  </span>

                  <span role="columnheader">
                    رقم الجوال
                  </span>

                  <span role="columnheader">
                    قيمة المشروع
                  </span>

                  <span role="columnheader">
                    الحالة
                  </span>

                  <span role="columnheader">
                    المرحلة
                  </span>

                  <span role="columnheader">
                    آخر تحديث
                  </span>
                </div>

                {customerFiles.map((customerFile) => {
                  const statusLabel =
                    STATUS_LABELS[
                      customerFile.status
                    ] ||
                    customerFile.status ||
                    "غير محددة";

                  const stageLabel =
                    STAGE_LABELS[
                      customerFile.current_stage
                    ] ||
                    customerFile.current_stage ||
                    "غير محددة";

                  return (
                    <button
                      key={customerFile.id}
                      type="button"
                      role="row"
                      onClick={() =>
                        onOpenCustomerFile(
                          customerFile.id
                        )
                      }
                    >
                      <span role="cell">
                        <strong>
                          {customerFile.file_number}
                        </strong>
                      </span>

                      <span role="cell">
                        {customerFile.customer_name ||
                          "غير متوفر"}
                      </span>

                      <span role="cell">
                        {customerFile.mobile_number ||
                          "غير متوفر"}
                      </span>

                      <span role="cell">
                        {formatSaudiRiyal(
                          customerFile
                            .estimated_project_cost
                        )}
                      </span>

                      <span role="cell">
                        {statusLabel}
                      </span>

                      <span role="cell">
                        {stageLabel}
                      </span>

                      <span role="cell">
                        {formatDate(
                          customerFile.updated_at ||
                            customerFile.submitted_at
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <nav aria-label="صفحات ملفات العملاء">
              <button
                type="button"
                onClick={onPreviousPage}
                disabled={
                  isLoading ||
                  !pagination.hasPreviousPage
                }
              >
                الصفحة السابقة
              </button>

              <span>
                الصفحة{" "}
                <strong>{pagination.page}</strong>
                {" "}
                من{" "}
                <strong>
                  {pagination.totalPages}
                </strong>
              </span>

              <button
                type="button"
                onClick={onNextPage}
                disabled={
                  isLoading ||
                  !pagination.hasNextPage
                }
              >
                الصفحة التالية
              </button>
            </nav>
          </>
        )}
    </main>
  );
}

export default AdminCustomerFilesPage;
