import { useEffect, useState } from "react";
import {
  formatSaudiRiyal,
} from "../../utils/projectCalculations.js";
import "./AdminCustomerFilesPage.css";

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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusBadgeClass(status) {
  if (status === "under_review") {
    return "is-under-review";
  }

  if (
    status === "approved" ||
    status === "waiting_land"
  ) {
    return "is-approved";
  }

  if (status === "needs_completion") {
    return "is-needs-completion";
  }

  if (status === "rejected") {
    return "is-rejected";
  }

  return "is-default";
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

  useEffect(() => {
    setSearchInput(filters.search || "");
  }, [filters.search]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    onSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    if (isLoading) {
      return;
    }

    setSearchInput("");
    onSearch("");
  };

  return (
    <main className="admin-customer-files-page">
      <header className="admin-customers-header">
        <div>
          <p>إدارة منصة نايف المزيني</p>

          <h1>
            العملاء{" "}
            <span className="admin-customers-count">
              ({Number(pagination.totalCount || 0)})
            </span>
          </h1>

          <p>
            البحث وإدارة ملفات العملاء بمختلف
            حالاتهم ومراحلهم.
          </p>
        </div>

        <button
          type="button"
          className="admin-back-button"
          onClick={onBackToHome}
          disabled={isLoading}
        >
          العودة إلى لوحة الإدارة
        </button>
      </header>

      <section
        className="customer-tools"
        aria-labelledby="customer-search-title"
      >
        <h2 id="customer-search-title">
          البحث والتصفية
        </h2>

        <form
          className="customer-search-form"
          onSubmit={handleSearchSubmit}
        >
          <div className="customer-search-field">
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
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="customer-search-button"
            disabled={isLoading}
          >
            {isLoading ? "جاري البحث..." : "بحث"}
          </button>

          {filters.search && (
            <button
              type="button"
              className="customer-clear-button"
              onClick={handleClearSearch}
              disabled={isLoading}
            >
              مسح البحث
            </button>
          )}
        </form>

        <div
          className="customer-tabs"
          aria-label="تصنيف العملاء حسب الحالة"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className="customer-tab-button"
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

        <div className="customer-sort-field">
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
        </div>
      </section>

      {isLoading && (
        <p
          className="customer-system-message"
          role="status"
        >
          جاري تحميل ملفات العملاء...
        </p>
      )}

      {errorMessage && (
        <p
          className="customer-system-message is-error"
          role="alert"
        >
          <strong>{errorMessage}</strong>
        </p>
      )}

      {!isLoading &&
        !errorMessage &&
        customerFiles.length === 0 && (
          <section className="customer-empty-state">
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
            <section
              className="customer-results"
              aria-labelledby="customer-results-title"
            >
              <header className="customer-results-header">
                <h2 id="customer-results-title">
                  ملفات العملاء
                </h2>

                <p>
                  الصفحة{" "}
                  <strong>{pagination.page}</strong>
                  {" "}من{" "}
                  <strong>
                    {pagination.totalPages}
                  </strong>
                </p>
              </header>

              <div className="customer-table-scroll">
                <div
                  className="customer-table"
                  role="table"
                  aria-label="ملفات العملاء"
                >
                  <div
                    className="customer-table-header"
                    role="row"
                  >
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

                  {customerFiles.map(
                    (customerFile) => {
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

                      const statusClass =
                        getStatusBadgeClass(
                          customerFile.status
                        );

                      return (
                        <button
                          key={customerFile.id}
                          type="button"
                          className="customer-table-row"
                          role="row"
                          onClick={() =>
                            onOpenCustomerFile(
                              customerFile.id
                            )
                          }
                          aria-label={`فتح ملف العميل ${customerFile.file_number}`}
                        >
                          <span
                            role="cell"
                            className="customer-file-number"
                          >
                            {customerFile.file_number ||
                              "غير متوفر"}
                          </span>

                          <span
                            role="cell"
                            className="customer-name"
                          >
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
                            <span
                              className={`customer-status-badge ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
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
                    }
                  )}
                </div>
              </div>
            </section>

            <nav
              className="customer-pagination"
              aria-label="صفحات ملفات العملاء"
            >
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
                {" "}من{" "}
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
