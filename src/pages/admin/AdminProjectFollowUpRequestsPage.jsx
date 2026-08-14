import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabase.js";

import "./AdminProjectFollowUpRequestsPage.css";

const STATUS_LABELS = {
  active: "المتابعة فعالة",
  completed: "اكتملت المتابعة",
  customer_selected: "حالة قديمة — لم تُفعّل",
  fee_pending: "حالة قديمة — بانتظار المعالجة",
  admin_rejected: "حالة قديمة — غير معتمدة",
};

const FEE_STATUS_LABELS = {
  not_due: "غير مستحقة حتى نهاية المراحل",
  pending: "مديونية مستحقة",
  paid: "تم السداد",
  waived: "معفاة",
  refunded: "مستردة",
};

const PROJECT_TYPE_LABELS = {
  financed: "مشروع بناء ممول",
  services: "مشروع خدمات",
};

function formatDate(value) {
  if (!value) return "غير متوفر";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متوفر";

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "غير متوفر";

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "غير متوفر";
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(number);
}

function AdminProjectFollowUpRequestsPage({ onBack }) {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("debts");
  const [loading, setLoading] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadRequests() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase.rpc(
        "admin_list_selected_supervisor_offers"
      );

      if (error) throw error;

      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setRequests([]);
      setErrorMessage(
        error?.message || "تعذر تحميل سجل متابعة المشاريع."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const pendingDebtCount = useMemo(
    () => requests.filter((request) => request.feeStatus === "pending").length,
    [requests]
  );

  const activeProjectCount = useMemo(
    () => requests.filter((request) => request.status === "active").length,
    [requests]
  );

  const visibleRequests = useMemo(() => {
    if (filter === "debts") {
      return requests.filter((request) => request.feeStatus === "pending");
    }

    return requests;
  }, [filter, requests]);

  async function confirmDebtPayment(request) {
    if (!request?.id || busyOfferId) return;

    const confirmed = window.confirm(
      "هل تؤكد استلام مديونية المنصة؟ سيعود حساب المشرف للظهور في الترشيحات الجديدة، ولن يتغير سجل المشروع المكتمل."
    );

    if (!confirmed) return;

    try {
      setBusyOfferId(request.id);
      setErrorMessage("");
      setMessage("");

      const { error } = await supabase.rpc(
        "admin_confirm_supervisor_offer_fee_paid",
        { p_offer_id: request.id }
      );

      if (error) throw error;

      setMessage(
        "تم تأكيد سداد المديونية، وأصبح المشرف مؤهلًا للظهور في الترشيحات الجديدة."
      );
      await loadRequests();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر تأكيد سداد المديونية.");
    } finally {
      setBusyOfferId("");
    }
  }

  return (
    <main className="admin-follow-up-page">
      <div className="admin-follow-up-container">
        <header className="admin-follow-up-header">
          <div>
            <p>إدارة منصة نايف المزيني</p>
            <h1>طلبات متابعة مشاريع</h1>
            <p className="admin-follow-up-description">
              سجل الإسنادات المباشرة ومديونيات المشرفين. قبول العميل يفتح
              المتابعة دون موافقة إدارية.
            </p>
          </div>

          <button
            type="button"
            className="admin-follow-up-back"
            onClick={() => typeof onBack === "function" && onBack()}
          >
            العودة إلى لوحة الإدارة
          </button>
        </header>

        <section className="admin-follow-up-summary" aria-label="ملخص المتابعة">
          <div>
            <span>مديونيات تحتاج تأكيدًا</span>
            <strong>{pendingDebtCount}</strong>
          </div>
          <div>
            <span>مشاريع متابعة فعالة</span>
            <strong>{activeProjectCount}</strong>
          </div>
        </section>

        <div className="admin-follow-up-filters" role="group" aria-label="تصفية السجل">
          <button
            type="button"
            className={filter === "debts" ? "is-active" : ""}
            onClick={() => setFilter("debts")}
          >
            المديونيات المستحقة ({pendingDebtCount})
          </button>
          <button
            type="button"
            className={filter === "all" ? "is-active" : ""}
            onClick={() => setFilter("all")}
          >
            جميع المشاريع ({requests.length})
          </button>
          <button type="button" onClick={loadRequests} disabled={loading || Boolean(busyOfferId)}>
            تحديث
          </button>
        </div>

        {message && <p className="admin-follow-up-notice is-success"><strong>{message}</strong></p>}
        {errorMessage && <p className="admin-follow-up-notice is-error"><strong>{errorMessage}</strong></p>}

        {loading ? (
          <section className="admin-follow-up-empty">جاري تحميل السجل...</section>
        ) : visibleRequests.length === 0 ? (
          <section className="admin-follow-up-empty">
            <span aria-hidden="true">✓</span>
            <h2>{filter === "debts" ? "لا توجد مديونيات مستحقة" : "لا توجد مشاريع متابعة بعد"}</h2>
            <p>
              {filter === "debts"
                ? "كل مديونيات المشرفين مسددة أو لم يحِن استحقاقها."
                : "تظهر المشاريع هنا فور قبول العميل لعرض المشرف."}
            </p>
          </section>
        ) : (
          <section className="admin-follow-up-list" aria-label="سجل متابعة المشاريع">
            {visibleRequests.map((request) => (
              <article key={request.id} className="admin-follow-up-card">
                <header>
                  <div>
                    <span
                      className={`admin-follow-up-status ${
                        request.feeStatus === "pending"
                          ? "is-debt-pending"
                          : `is-${request.status}`
                      }`}
                    >
                      {request.feeStatus === "pending"
                        ? "مديونية مستحقة"
                        : STATUS_LABELS[request.status] || request.status}
                    </span>
                    <h2>{request.projectNumber || "مشروع بدون رقم"}</h2>
                    <p>{PROJECT_TYPE_LABELS[request.projectType] || "مشروع"}</p>
                  </div>
                  <div className="admin-follow-up-price">
                    <small>قيمة عقد الإشراف</small>
                    <strong>{formatMoney(request.offerPrice)}</strong>
                  </div>
                </header>

                <dl className="admin-follow-up-details">
                  <div>
                    <dt>العميل</dt>
                    <dd>{request.customerName || "غير متوفر"}</dd>
                  </div>
                  <div>
                    <dt>المشرف</dt>
                    <dd>{request.supervisorName || "غير متوفر"}</dd>
                  </div>
                  <div>
                    <dt>المنشأة</dt>
                    <dd>{request.organizationName || "فرد"}</dd>
                  </div>
                  <div>
                    <dt>عدد الأدوار</dt>
                    <dd>{formatNumber(request.floors)}</dd>
                  </div>
                  <div>
                    <dt>المسطح المثبت</dt>
                    <dd>{formatNumber(request.feeBasisArea)} م²</dd>
                  </div>
                  <div>
                    <dt>سعر المنصة للمتر</dt>
                    <dd>{formatMoney(request.feeUnitRate)}</dd>
                  </div>
                  <div>
                    <dt>رسوم المنصة</dt>
                    <dd>{formatMoney(request.feeAmount)}</dd>
                  </div>
                  <div>
                    <dt>حالة الرسوم</dt>
                    <dd>{FEE_STATUS_LABELS[request.feeStatus] || request.feeStatus}</dd>
                  </div>
                  <div>
                    <dt>وقت قبول العميل</dt>
                    <dd>{formatDate(request.selectedAt)}</dd>
                  </div>
                  {request.feeDueAt && (
                    <div>
                      <dt>وقت الاستحقاق</dt>
                      <dd>{formatDate(request.feeDueAt)}</dd>
                    </div>
                  )}
                  {request.feePaidAt && (
                    <div>
                      <dt>وقت تأكيد السداد</dt>
                      <dd>{formatDate(request.feePaidAt)}</dd>
                    </div>
                  )}
                </dl>

                {request.requestNote && (
                  <div className="admin-follow-up-note">
                    <strong>ملاحظة طلب العميل</strong>
                    <p>{request.requestNote}</p>
                  </div>
                )}

                {request.status === "active" && request.feeStatus === "not_due" && (
                  <div className="admin-follow-up-activation">
                    <p>
                      خدمات المتابعة مفتوحة الآن. الرسوم محسوبة ومثبتة، لكنها لا
                      تصبح مديونية إلا بعد اكتمال جميع المراحل.
                    </p>
                  </div>
                )}

                {request.feeStatus === "pending" && (
                  <div className="admin-follow-up-activation is-debt">
                    <p>
                      انتهت المراحل وحُجب المشرف عن الترشيحات الجديدة. أكّد
                      السداد فقط بعد تحقق وصول المبلغ.
                    </p>
                    <button
                      type="button"
                      onClick={() => confirmDebtPayment(request)}
                      disabled={Boolean(busyOfferId)}
                    >
                      {busyOfferId === request.id
                        ? "جاري التأكيد..."
                        : "تأكيد سداد المديونية"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default AdminProjectFollowUpRequestsPage;
