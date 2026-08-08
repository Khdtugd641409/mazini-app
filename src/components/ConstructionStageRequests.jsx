import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase.js";

const ROLE_LABELS = {
  customer: "العميل",
  supervisor: "المشرف",
  supplier: "المورد",
  contractor: "المقاول",
  investor: "المستثمر",
  admin: "الإدارة",
};

const STATUS_LABELS = {
  open: "مفتوح",
  in_progress: "قيد التنفيذ",
  completed: "تم",
  cancelled: "ملغي",
};

function formatDateTime(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ConstructionStageRequests({ projectStageId }) {
  const [workspace, setWorkspace] = useState({
    actorRole: null,
    currentUserId: null,
    recipients: [],
    requests: [],
  });
  const [isOpen, setIsOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const unreadRequests = useMemo(
    () => (workspace.requests || []).filter((request) => request.isUnread),
    [workspace.requests]
  );

  async function loadWorkspace() {
    if (!projectStageId) return;
    const { data, error } = await supabase.rpc(
      "construction_stage_get_requests_workspace",
      { p_project_stage_id: projectStageId }
    );
    if (error) throw error;

    const recipients = Array.isArray(data?.recipients) ? data.recipients : [];
    setWorkspace({
      actorRole: data?.actorRole || null,
      currentUserId: data?.currentUserId || null,
      recipients,
      requests: Array.isArray(data?.requests) ? data.requests : [],
    });
    setRecipientId((current) =>
      current && recipients.some((item) => item.userId === current)
        ? current
        : recipients[0]?.userId || ""
    );
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        setLoading(true);
        setErrorMessage("");
        await loadWorkspace();
      } catch (error) {
        if (active) setErrorMessage(error?.message || "تعذر تحميل طلبات المرحلة.");
      } finally {
        if (active) setLoading(false);
      }
    }
    initialize();
    return () => {
      active = false;
    };
  }, [projectStageId]);

  async function openRequests() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen || unreadRequests.length === 0) return;

    try {
      await Promise.all(
        unreadRequests.map((request) =>
          supabase.rpc("construction_stage_mark_request_read", {
            p_task_id: request.id,
          })
        )
      );
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر تحديث حالة قراءة الطلبات.");
    }
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (loading) return;

    const cleanBody = body.trim();
    if (!recipientId) {
      setErrorMessage("اختر الشخص الذي سيستلم الطلب.");
      return;
    }
    if (cleanBody.length < 2) {
      setErrorMessage("اكتب الطلب المطلوب.");
      return;
    }
    if (!dueAt) {
      setErrorMessage("حدد يوم وتاريخ ووقت تنفيذ الطلب.");
      return;
    }

    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime()) || dueDate.getTime() <= Date.now()) {
      setErrorMessage("موعد الطلب يجب أن يكون في وقت لاحق.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      const { error } = await supabase.rpc("construction_stage_create_request", {
        p_project_stage_id: projectStageId,
        p_recipient_user_id: recipientId,
        p_body: cleanBody,
        p_due_at: dueDate.toISOString(),
      });
      if (error) throw error;
      setBody("");
      setDueAt("");
      setSuccessMessage("تم إرسال الطلب.");
      await loadWorkspace();
      setIsOpen(true);
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إرسال الطلب.");
    } finally {
      setLoading(false);
    }
  }

  async function completeRequest(requestId) {
    if (!requestId || loading) return;
    try {
      setLoading(true);
      setErrorMessage("");
      const { error } = await supabase.rpc(
        "construction_stage_complete_request",
        { p_task_id: requestId }
      );
      if (error) throw error;
      setSuccessMessage("تم إغلاق الطلب وتسجيل تنفيذه.");
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إكمال الطلب.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        display: "grid",
        gap: 12,
        padding: 14,
        border: "1px solid #d8ddd9",
        borderRadius: 14,
        background: "#fafbf9",
      }}
      aria-label="طلبات المرحلة"
    >
      <button
        type="button"
        onClick={openRequests}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minHeight: 48,
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid #173f36",
          background: "#fff",
          color: "#173f36",
          font: "inherit",
          fontWeight: 850,
          cursor: "pointer",
        }}
      >
        <span>➕ إضافة طلب</span>
        {unreadRequests.length > 0 && (
          <span
            style={{
              minWidth: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              borderRadius: 999,
              background: "#b42318",
              color: "#fff",
              fontSize: 14,
            }}
          >
            {unreadRequests.length}
          </span>
        )}
      </button>

      {unreadRequests.length > 0 && !isOpen && (
        <strong style={{ color: "#b42318" }}>
          لديك {unreadRequests.length === 1 ? "طلب جديد" : `${unreadRequests.length} طلبات جديدة`}
        </strong>
      )}

      {errorMessage && <p style={{ margin: 0, color: "#991b1b" }}>{errorMessage}</p>}
      {successMessage && <p style={{ margin: 0 }}>{successMessage}</p>}

      {isOpen && (
        <div style={{ display: "grid", gap: 18 }}>
          {(workspace.actorRole === "customer" || workspace.actorRole === "supervisor") && (
            <form onSubmit={submitRequest} style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <strong>إلى</strong>
                <select
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                  disabled={loading || workspace.recipients.length === 0}
                  required
                  style={{ minHeight: 44, padding: "0 10px", font: "inherit" }}
                >
                  {workspace.recipients.length === 0 && (
                    <option value="">لا يوجد عضو آخر مرتبط بالمشروع حاليًا</option>
                  )}
                  {workspace.recipients.map((recipient) => (
                    <option key={recipient.userId} value={recipient.userId}>
                      {recipient.name} — {ROLE_LABELS[recipient.role] || recipient.role}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <strong>الطلب</strong>
                <textarea
                  rows="3"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="مثال: حان موعد شراء الرخام"
                  disabled={loading}
                  required
                  style={{ padding: 10, font: "inherit", resize: "vertical" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <strong>الموعد</strong>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  disabled={loading}
                  required
                  style={{ minHeight: 44, padding: "0 10px", font: "inherit" }}
                />
              </label>

              <button
                type="submit"
                disabled={loading || !recipientId || !body.trim() || !dueAt}
                style={{ minHeight: 46, font: "inherit", fontWeight: 800 }}
              >
                إرسال الطلب
              </button>
            </form>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            <h3 style={{ margin: 0 }}>طلبات هذه المرحلة</h3>
            {workspace.requests.length === 0 ? (
              <p style={{ margin: 0 }}>لا توجد طلبات في هذه المرحلة.</p>
            ) : (
              workspace.requests.map((request) => (
                <article
                  key={request.id}
                  style={{
                    display: "grid",
                    gap: 7,
                    padding: 12,
                    borderRadius: 12,
                    border: request.isUnread ? "2px solid #b42318" : "1px solid #e1e5e1",
                    background: request.status === "completed" ? "#edf7f2" : "#fff",
                  }}
                >
                  <div>
                    <strong>{request.senderName || ROLE_LABELS[request.senderRole] || "مرسل"}</strong>
                    <span> ← </span>
                    <strong>{request.recipientName || ROLE_LABELS[request.recipientRole] || "مستلم"}</strong>
                  </div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{request.body}</p>
                  <small>الموعد: {formatDateTime(request.dueAt)}</small>
                  <small>الحالة: {STATUS_LABELS[request.status] || request.status}</small>
                  <small>أُرسل: {formatDateTime(request.createdAt)}</small>
                  {request.isMine && request.status !== "completed" && request.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() => completeRequest(request.id)}
                      disabled={loading}
                      style={{ minHeight: 40, font: "inherit", fontWeight: 800 }}
                    >
                      ✅ تم تنفيذ الطلب
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default ConstructionStageRequests;
