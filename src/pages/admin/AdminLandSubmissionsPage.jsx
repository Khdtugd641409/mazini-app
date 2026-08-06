import { useEffect, useState } from "react";

import {
  getAdminLandSubmissionCounts,
  searchAdminLandSubmissions,
} from "../../services/adminLandSubmissionService.js";

import "./AdminLandSubmissionsPage.css";

const INITIAL_FILTERS = {
  search: "",
  status: "all",
  sort: "newest",
};

const INITIAL_PAGINATION = {
  page: 1,
  pageSize: 25,
  totalCount: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

const STATUS_LABELS = {
  all: "الكل",
  under_review: "بانتظار المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبولة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

const LAND_USE_LABELS = {
  residential: "سكني",
  commercial: "تجاري",
  agricultural: "زراعي",
};

function formatSaudiRiyal(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "غير متوفر";
  }

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function formatSquareMeters(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "غير متوفر";
  }

  return `${new Intl.NumberFormat(
    "ar-SA",
    {
      maximumFractionDigits: 2,
    }
  ).format(numericValue)} م²`;
}

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

function getStatusClass(status) {
  if (status === "under_review") {
    return "is-under-review";
  }

  if (status === "needs_completion") {
    return "is-needs-completion";
  }

  if (status === "approved") {
    return "is-approved";
  }

  if (
    status === "rejected" ||
    status === "cancelled"
  ) {
    return "is-rejected";
  }

  return "is-default";
}

export default function AdminLandSubmissionsPage({
  onOpenSubmission,
  onBack,
}) {
  const [submissions, setSubmissions] =
    useState([]);

  const [counts, setCounts] = useState({
    all: 0,
    underReview: 0,
    needsCompletion: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  });

  const [filters, setFilters] =
    useState(INITIAL_FILTERS);

  const [pagination, setPagination] =
    useState(INITIAL_PAGINATION);

  const [searchInput, setSearchInput] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function loadPage({
    search = filters.search,
    status = filters.status,
    sort = filters.sort,
    page = pagination.page,
    pageSize = pagination.pageSize,
  } = {}) {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const [searchResult, countsResult] =
        await Promise.all([
          searchAdminLandSubmissions({
            search,
            status,
            sort,
            page,
            pageSize,
          }),

          getAdminLandSubmissionCounts(),
        ]);

      setSubmissions(
        searchResult.submissions
      );

      setPagination(
        searchResult.pagination
      );

      setCounts(countsResult);

      setFilters({
        search,
        status,
        sort,
      });

      setSearchInput(search);
    } catch (error) {
      console.error(
        "تعذر تحميل صفحة طلبات الأراضي:",
        error
      );

      setSubmissions([]);

      setErrorMessage(
        error?.message ||
          "تعذر تحميل طلبات الأراضي."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPage({
      ...INITIAL_FILTERS,
      page: 1,
      pageSize: 25,
    });
  }, []);

  async function handleSearch(event) {
    event.preventDefault();

    await loadPage({
      search: searchInput.trim(),
      status: filters.status,
      sort: filters.sort,
      page: 1,
    });
  }

  async function handleStatusChange(status) {
    if (
      status === filters.status ||
      isLoading
    ) {
      return;
    }

    await loadPage({
      search: filters.search,
      status,
      sort: filters.sort,
      page: 1,
    });
  }

  async function handleSortChange(event) {
    const sort = event.target.value;

    await loadPage({
      search: filters.search,
      status: filters.status,
      sort,
      page: 1,
    });
  }

  async function handlePreviousPage() {
    if (
      !pagination.hasPreviousPage ||
      isLoading
    ) {
      return;
    }

    await loadPage({
      page: pagination.page - 1,
    });
  }

  async function handleNextPage() {
    if (
      !pagination.hasNextPage ||
      isLoading
    ) {
      return;
    }

    await loadPage({
      page: pagination.page + 1,
    });
  }

  function handleOpenSubmission(
    landSubmissionId
  ) {
    if (
      typeof onOpenSubmission ===
      "function"
    ) {
      onOpenSubmission(
        landSubmissionId
      );
    }
  }

  const statusTabs = [
    {
      key: "all",
      label: "الكل",
      count: counts.all,
    },
    {
      key: "under_review",
      label: "بانتظار المراجعة",
      count: counts.underReview,
    },
    {
      key: "needs_completion",
      label: "مطلوب استكمال",
      count: counts.needsCompletion,
    },
    {
      key: "approved",
      label: "مقبولة",
      count: counts.approved,
    },
    {
      key: "rejected",
      label: "مرفوضة",
      count: counts.rejected,
    },
  ];

  return (
    <main className="admin-land-page">
      <div className="admin-land-shell">
        <header className="admin-land-header">
          <div>
            <p className="admin-land-eyebrow">
              إدارة مرحلة الأرض
            </p>

            <h1>طلبات الأراضي</h1>

            <p>
              مراجعة الأراضي المقدمة من
              عملاء التمويل واتخاذ القرار
              المناسب.
            </p>
          </div>

          <button
            type="button"
            className="admin-land-back-button"
            onClick={onBack}
          >
            العودة إلى لوحة الإدارة
          </button>
        </header>

        <section className="admin-land-toolbar">
          <form
            className="admin-land-search"
            onSubmit={handleSearch}
          >
            <input
              type="search"
              placeholder="ابحث برقم الملف أو العميل أو المدينة أو مسؤول الأرض"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  event.target.value
                )
              }
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading}
            >
              بحث
            </button>
          </form>

          <label className="admin-land-sort">
            <span>الفرز</span>

            <select
              value={filters.sort}
              onChange={handleSortChange}
              disabled={isLoading}
            >
              <option value="newest">
                الأحدث
              </option>

              <option value="oldest">
                الأقدم
              </option>

              <option value="highest_price">
                الأعلى سعرًا
              </option>

              <option value="lowest_price">
                الأقل سعرًا
              </option>

              <option value="largest_area">
                الأكبر مساحة
              </option>

              <option value="smallest_area">
                الأصغر مساحة
              </option>
            </select>
          </label>
        </section>

        <nav
          className="admin-land-tabs"
          aria-label="حالات طلبات الأراضي"
        >
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                filters.status === tab.key
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                handleStatusChange(
                  tab.key
                )
              }
              disabled={isLoading}
            >
              <span>{tab.label}</span>
              <strong>{tab.count}</strong>
            </button>
          ))}
        </nav>

        {errorMessage && (
          <div
            className="admin-land-alert"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <section className="admin-land-state">
            جاري تحميل طلبات الأراضي...
          </section>
        ) : submissions.length === 0 ? (
          <section className="admin-land-state">
            <div
              className="admin-land-empty-icon"
              aria-hidden="true"
            >
              🏞️
            </div>

            <h2>
              لا توجد طلبات أراضٍ
            </h2>

            <p>
              لا توجد نتائج مطابقة للحالة
              أو البحث الحالي.
            </p>
          </section>
        ) : (
          <>
            <section className="admin-land-table-card">
              <div className="admin-land-table-wrapper">
                <table className="admin-land-table">
                  <thead>
                    <tr>
                      <th>رقم الملف</th>
                      <th>العميل</th>
                      <th>الموقع</th>
                      <th>المساحة</th>
                      <th>الاستخدام</th>
                      <th>السعر الشامل</th>
                      <th>تاريخ التقديم</th>
                      <th>الحالة</th>
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {submissions.map(
                      (submission) => (
                        <tr
                          key={
                            submission.id
                          }
                        >
                          <td>
                            <strong dir="ltr">
                              {
                                submission
                                  .fileNumber
                              }
                            </strong>

                            <small dir="ltr">
                              {
                                submission
                                  .submissionNumber
                              }
                            </small>
                          </td>

                          <td>
                            <strong>
                              {
                                submission
                                  .customerName
                              }
                            </strong>

                            <small dir="ltr">
                              {
                                submission
                                  .mobileNumber
                              }
                            </small>
                          </td>

                          <td>
                            <strong>
                              {
                                submission.city
                              }
                            </strong>

                            <small>
                              {
                                submission.district
                              }
                            </small>
                          </td>

                          <td>
                            {formatSquareMeters(
                              submission.landArea
                            )}
                          </td>

                          <td>
                            {
                              LAND_USE_LABELS[
                                submission
                                  .landUseType
                              ] ||
                              submission
                                .landUseType ||
                              "غير محدد"
                            }
                          </td>

                          <td>
                            {formatSaudiRiyal(
                              submission
                                .totalPrice
                            )}
                          </td>

                          <td>
                            {formatDate(
                              submission
                                .submittedAt
                            )}
                          </td>

                          <td>
                            <span
                              className={`admin-land-status ${getStatusClass(
                                submission.status
                              )}`}
                            >
                              {STATUS_LABELS[
                                submission
                                  .status
                              ] ||
                                submission
                                  .status}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="admin-land-open-button"
                              onClick={() =>
                                handleOpenSubmission(
                                  submission.id
                                )
                              }
                            >
                              فتح الطلب
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="admin-land-pagination">
              <button
                type="button"
                onClick={
                  handlePreviousPage
                }
                disabled={
                  isLoading ||
                  !pagination
                    .hasPreviousPage
                }
              >
                السابق
              </button>

              <span>
                الصفحة{" "}
                <strong>
                  {pagination.page}
                </strong>{" "}
                من{" "}
                <strong>
                  {
                    pagination
                      .totalPages
                  }
                </strong>
              </span>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={
                  isLoading ||
                  !pagination.hasNextPage
                }
              >
                التالي
              </button>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
