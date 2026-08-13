import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabase.js";

import "./AdminProjectFollowUpRequestsPage.css";

const STATUS_LABELS = {
  customer_selected: "بانتظار اعتماد الإدارة",
  fee_pending: "معتمد — بانتظار تأكيد الرسوم",
  active: "تم الإسناد وتفعيل المتابعة",
  admin_rejected: "لم تعتمد الإدارة الطلب",
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

function AdminProjectFollowUpRequestsPage({ onBack }) {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState({});
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
        error?.message || "تعذر تحميل طلبات متابعة المشاريع."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const pendingCount = useMemo(
    () =>
      requests.filter((request) =>
        ["customer_selected", "fee_pending"].includes(request.status)
      ).length,
    [requests]
  );

  const visibleRequests = useMemo(() => {
    if (filter === "pending") {
      return requests.filter((request) =>
        ["customer_selected", "fee_pending"].includes(request.status)
      );
    }

    return requests;
  }, [filter, requests]);

  function updateNote(offerId, value) {
    setNotes((current) => ({
      ...current,
      [offerId]: value,
    }));
  }

  async function decideRequest(request, approve) {
    if (!request?.id || busyOfferId) return;

    const note = String(notes[request.id] || "").trim();

    if (!approve && note.length < 3) {
      setErrorMessage("اكتب سبب عدم الاعتماد قبل رفض الطلب.");
      return;
    }

    const confirmed = window.confirm(
      approve
        ? "هل تريد اعتماد اختيار العميل؟ سيصبح الطلب بانتظار تأكيد رسوم المنصة قبل الإسناد."
        : "هل تريد رفض طلب الإسناد؟ سيتمكن العميل بعدها من اختيار عرض آخر."
    );

    if (!confirmed) return;

    try {
      setBusyOfferId(request.id);
      setErrorMessage("");
      setMessage("");

      const { error } = await supabase.rpc(
        "admin_decide_supervisor_offer",
        {
          p_offer_id: request.id,
          p_approve: Boolean(approve),
          p_note: note || null,
        }
      );

      if (error) throw error;

      setNotes((current) => ({ ...current, [request.id]: "" }));
      setMessage(
        approve
          ? "تم اعتماد الطلب. بقي تأكيد سداد رسوم المنصة لإسناد المشروع وفتح خدمات المتابعة."
          : "تم رفض الطلب، ويمكن للعميل اختيار عرض آخر."
      );

      await loadRequests();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر تنفيذ قرار الإدارة.");
    } finally {
      setBusyOfferId("");
    }
  }

  async function confirmFeeAndActivate(request) {
    if (!request?.id || busyOfferId) return;

    const confirmed = window.confirm(
      "هل تؤكد استلام رسوم المنصة؟ سيُسند المشروع للمشرف وتُفتح خدمات متابعة المشروع فورًا."
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
        "تم إسناد المشروع للمشرف وفتح خدمات متابعة المشروع بنجاح."
      );
      await loadRequests();
    } catch (error) {
      setErrorMessage(
        error?.message || "تعذر إسناد المشروع وتفعيل المتابعة."
      );
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
              طلبات الإسناد التي وافق العميل على سعر المشرف الخاص بها.
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

        <section className="admin-follow-up-summary" aria-label="ملخص الطلبات">
          <div>
            <span>تحتاج إجراءً</span>
            <strong>{pendingCount}</strong>
          </div>
          <div>
            <span>إجمالي السجل</span>
            <strong>{requests.length}</strong>
          </div>
        </section>

        <div className="admin-follow-up-filters" role="group" aria-label="تصفية الطلبات">
          <button
            type="button"
            className={filter === "pending" ? "is-active" : ""}
            onClick={() => setFilter("pending")}
          >
            الطلبات المعلقة ({pendingCount})
          </button>
          <button
            type="button"
            className={filter === "all" ? "is-active" : ""}
            onClick={() => setFilter("all")}
          >
            جميع الطلبات ({requests.length})
          </button>
          <button type="button" onClick={loadRequests} disabled={loading || Boolean(busyOfferId)}>
            تحديث
          </button>
        </div>

        {message && <p className="admin-follow-up-notice is-success"><strong>{message}</strong></p>}
        {errorMessage && <p className="admin-follow-up-notice is-error"><strong>{errorMessage}</strong></p>}

        {loading ? (
          <section className="admin-follow-up-empty">جاري تحميل الطلبات...</section>
        ) : visibleRequests.length === 0 ? (
          <section className="admin-follow-up-empty">
            <span aria-hidden="true">✓</span>
            <h2>{filter === "pending" ? "لا توجد طلبات معلقة" : "لا يوجد سجل طلبات بعد"}</h2>
            <p>ستظهر هنا الطلبات بعد موافقة العميل على عرض المشرف.</p>
          </section>
        ) : (
          <section className="admin-follow-up-list" aria-label="طلبات متابعة المشاريع">
            {visibleRequests.map((request) => (
              <article key={request.id} className="admin-follow-up-card">
                <header>
                  <div>
                    <span className={`admin-follow-up-status is-${request.status}`}>
                      {STATUS_LABELS[request.status] || request.status}
                    </span>
                    <h2>{request.projectNumber || "مشروع بدون رقم"}</h2>
                    <p>{PROJECT_TYPE_LABELS[request.projectType] || "مشروع"}</p>
                  </div>
                  <strong className="admin-follow-up-price">
                    {formatMoney(request.offerPrice)}
                  </strong>
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
                    <dt>وقت طلب العميل</dt>
                    <dd>{formatDate(request.requestedAt)}</dd>
                  </div>
                  <div>
                    <dt>وقت موافقة العميل على السعر</dt>
                    <dd>{formatDate(request.selectedAt)}</dd>
                  </div>
                  {request.status === "fee_pending" && (
                    <div>
                      <dt>رسوم المنصة ٢٪</dt>
                      <dd>{formatMoney(request.feeAmount)}</dd>
                    </div>
                  )}
                </dl>

                {request.requestNote && (
                  <div className="admin-follow-up-note">
                    <strong>ملاحظة طلب العميل</strong>
                    <p>{request.requestNote}</p>
                  </div>
                )}

                {request.adminNote && (
                  <div className="admin-follow-up-note">
                    <strong>ملاحظة الإدارة</strong>
                    <p>{request.adminNote}</p>
                  </div>
                )}

                {request.status === "customer_selected" && (
                  <div className="admin-follow-up-decision">
                    <label>
                      <strong>ملاحظة الإدارة</strong>
                      <textarea
                        rows="3"
                        value={notes[request.id] || ""}
                        onChange={(event) => updateNote(request.id, event.target.value)}
                        placeholder="اختيارية عند الاعتماد، ومطلوبة عند الرفض"
                        disabled={Boolean(busyOfferId)}
                        maxLength={1000}
                      />
                    </label>

                    <div>
                      <button
                        type="button"
                        className="is-approve"
                        onClick={() => decideRequest(request, true)}
                        disabled={Boolean(busyOfferId)}
                      >
                        {busyOfferId === request.id ? "جاري التنفيذ..." : "اعتماد الطلب"}
                      </button>
                      <button
                        type="button"
                        className="is-reject"
                        onClick={() => decideRequest(request, false)}
                        disabled={Boolean(busyOfferId)}
                      >
                        عدم الاعتماد
                      </button>
                    </div>
                  </div>
                )}

                {request.status === "fee_pending" && (
                  <div className="admin-follow-up-activation">
                    <p>
                      لا تُفتح أدوات المتابعة قبل تأكيد استلام الرسوم؛ التأكيد يُنشئ الإسناد الفعلي للمشروع.
                    </p>
                    <button
                      type="button"
                      onClick={() => confirmFeeAndActivate(request)}
                      disabled={Boolean(busyOfferId)}
                    >
                      {busyOfferId === request.id
                        ? "جاري التفعيل..."
                        : "تأكيد السداد وإسناد المشروع"}
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
