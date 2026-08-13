import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase.js";
import ConstructionStageRequests from "../components/ConstructionStageRequests.jsx";

import {
  formatPercentage,
  formatSaudiRiyal,
  formatSquareMeters,
} from "../utils/projectCalculations.js";

import "./CustomerFilePage.css";

const STATUS_LABELS = {
  under_review: "تحت المراجعة",
  needs_completion: "مطلوب استكمال",
  approved: "مقبول",
  accepted: "مقبول",
  rejected: "مرفوض",
  waiting_land: "بانتظار تقديم الأرض",
  land_under_review: "الأرض تحت المراجعة",
  land_needs_completion:
    "مطلوب استكمال بيانات الأرض",
  land_approved: "تم قبول الأرض",
  land_rejected: "تم رفض الأرض",
  waiting_contract:
    "بانتظار إرسال العقد",
  contract_sent:
    "العقد بانتظار موافقة العميل",
  contract_accepted:
    "تمت الموافقة على العقد",
  contract_rejected:
    "تم رفض العقد",
  waiting_transfer: "بانتظار الإفراغ",
  transfer_in_progress:
    "إجراءات الإفراغ جارية",
  transfer_completed: "تم الإفراغ",
  active_project:
    "المشروع قيد التنفيذ",
  active: "نشط",
  completed: "مكتمل",
  closed: "ملف مغلق",
};

const STAGE_LABELS = {
  initial_application:
    "التقديم الأولي",
  application_review:
    "مراجعة طلب العميل",
  waiting_admin_review:
    "انتظار مراجعة المنصة",
  waiting_land:
    "انتظار تقديم الأرض",
  waiting_land_submission:
    "انتظار تقديم الأرض",
  land_submission:
    "تقديم الأرض",
  land_review:
    "فحص الأرض",
  land_contract:
    "العقد",
  land_transfer:
    "إفراغ الأرض",
  project_execution:
    "تنفيذ المشروع",
  project_closure:
    "إغلاق المشروع",
};

const EVENT_TYPE_LABELS = {
  customer_file_created:
    "إنشاء الملف",
  status_changed:
    "تغيير الحالة",
  stage_changed:
    "تغيير المرحلة",
  current_state_snapshot:
    "الحالة الحالية",
  land_submitted:
    "تقديم الأرض",
  land_resubmitted:
    "إعادة تقديم الأرض",
  completion_requested:
    "طلب استكمال الأرض",
  land_approved:
    "قبول الأرض",
  land_rejected:
    "رفض الأرض",
  contract_sent:
    "إرسال العقد",
  contract_accepted:
    "الموافقة على العقد",
  contract_rejected:
    "رفض العقد",
  transfer_started:
    "بدء الإفراغ",
  transfer_completed:
    "اكتمال الإفراغ",
};

const PROJECT_STAGES = [
  "تقديم الطلب",
  "مراجعة الإدارة",
  "قبول العميل",
  "تقديم الأرض",
  "فحص الأرض",
  "إرسال العقد",
  "موافقة العميل",
  "إفراغ الأرض",
  "تعيين مشرف المشروع",
  "التنفيذ",
  "الإغلاق",
];

const LAND_SUBMISSION_ALLOWED_STATUSES = [
  "approved",
  "accepted",
  "waiting_land",
  "land_needs_completion",
];

const LAND_SUBMISSION_ALLOWED_STAGES = [
  "waiting_land",
  "waiting_land_submission",
  "land_submission",
];

const ALLOWED_STANDARD_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_STANDARD_FILE_SIZE = 20 * 1024 * 1024;

function formatDate(value) {
  if (!value) {
    return "غير متوفر";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat(
    "ar-SA",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function sanitizeFileName(fileName) {
  const original = String(fileName || "standard").trim();
  const extensionMatch = original.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch?.[1]?.toLowerCase() || "";
  const base = original
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "standard";

  return extension ? `${base}.${extension}` : base;
}

function getStatusClass(status) {
  if (
    status === "under_review" ||
    status === "land_under_review" ||
    status === "contract_sent" ||
    status === "transfer_in_progress"
  ) {
    return "is-under-review";
  }

  if (
    status === "approved" ||
    status === "accepted" ||
    status === "waiting_land" ||
    status === "land_approved" ||
    status === "contract_accepted" ||
    status === "transfer_completed" ||
    status === "active_project" ||
    status === "active" ||
    status === "completed"
  ) {
    return "is-approved";
  }

  if (
    status === "needs_completion" ||
    status === "land_needs_completion"
  ) {
    return "is-needs-completion";
  }

  if (
    status === "rejected" ||
    status === "land_rejected" ||
    status === "contract_rejected"
  ) {
    return "is-rejected";
  }

  return "is-default";
}

function canSubmitLand(customerFile) {
  if (!customerFile?.id) {
    return false;
  }

  if (customerFile.project_type === "services") {
    return false;
  }

  return (
    LAND_SUBMISSION_ALLOWED_STATUSES.includes(
      customerFile.status
    ) ||
    LAND_SUBMISSION_ALLOWED_STAGES.includes(
      customerFile.current_stage
    )
  );
}

function getCurrentAction(customerFile) {
  if (!customerFile) {
    return {
      title:
        "لا يوجد إجراء محدد",
      description:
        "تعذر تحديد الإجراء المطلوب للملف.",
    };
  }

  if (customerFile.project_type === "services") {
    return {
      title: customerFile.current_stage ||
        "متابعة مرحلة البناء",
      description:
        "تابع المرحلة الحالية والصور ومعايير الاستلام الخاصة بالمشروع والمعايير العامة.",
    };
  }

  if (
    customerFile.status ===
    "under_review"
  ) {
    return {
      title:
        "انتظار مراجعة إدارة المنصة",
      description:
        "تم استلام طلبك، وهو الآن لدى إدارة المنصة للمراجعة واتخاذ القرار.",
    };
  }

  if (
    customerFile.status ===
    "needs_completion"
  ) {
    return {
      title:
        "استكمال بيانات الطلب",
      description:
        "توجد بيانات طلبت إدارة المنصة استكمالها قبل متابعة الطلب.",
    };
  }

  if (
    canSubmitLand(customerFile)
  ) {
    const isLandCompletion =
      customerFile.status ===
      "land_needs_completion";

    return {
      title: isLandCompletion
        ? "استكمال بيانات الأرض"
        : "تقديم بيانات الأرض",

      description: isLandCompletion
        ? "طلبت إدارة المنصة استكمال أو تصحيح بعض بيانات الأرض. افتح النموذج وراجع البيانات المطلوبة ثم أعد التقديم."
        : "تم قبول طلبك الأولي. قدّم بيانات الأرض ورابط موقعها والصك حتى تبدأ إدارة المنصة مراجعتها.",
    };
  }

  if (
    customerFile.status ===
    "land_under_review"
  ) {
    return {
      title:
        "انتظار مراجعة الأرض",
      description:
        "تم استلام بيانات الأرض والصك، وهي الآن قيد المراجعة لدى إدارة المنصة.",
    };
  }

  if (
    customerFile.status ===
    "land_approved"
  ) {
    return {
      title:
        "تم قبول الأرض",
      description:
        "وافقت إدارة المنصة على الأرض. الخطوة التالية هي إعداد العقد وإرساله إليك للمراجعة.",
    };
  }

  if (
    customerFile.status ===
    "land_rejected"
  ) {
    return {
      title:
        "تم رفض الأرض",
      description:
        "لم تعتمد إدارة المنصة الأرض المقدمة. راجع سبب الرفض وابحث عن أرض أخرى قبل تقديمها.",
    };
  }

  if (
    customerFile.status ===
    "waiting_contract"
  ) {
    return {
      title:
        "انتظار إعداد العقد",
      description:
        "تم قبول الأرض، وتعمل إدارة المنصة على إعداد العقد وإرساله إليك.",
    };
  }

  if (
    customerFile.status ===
    "contract_sent"
  ) {
    return {
      title:
        "مراجعة العقد",
      description:
        "أرسلت إدارة المنصة العقد. راجعه ثم وافق عليه أو ارفضه من داخل حسابك.",
    };
  }

  if (
    customerFile.status ===
    "contract_accepted"
  ) {
    return {
      title:
        "انتظار بدء الإفراغ",
      description:
        "تم تسجيل موافقتك على العقد، وستبدأ إجراءات إفراغ الأرض.",
    };
  }

  if (
    customerFile.status ===
    "contract_rejected"
  ) {
    return {
      title:
        "تم رفض العقد",
      description:
        "تم تسجيل رفضك للعقد، ولن تبدأ إجراءات الإفراغ حتى معالجة سبب الرفض.",
    };
  }

  if (
    customerFile.status ===
    "waiting_transfer"
  ) {
    return {
      title:
        "بانتظار بدء الإفراغ",
      description:
        "الأرض مقبولة والعقد معتمد، والملف جاهز لبدء إجراءات الإفراغ.",
    };
  }

  if (
    customerFile.status ===
    "transfer_in_progress"
  ) {
    return {
      title:
        "إجراءات الإفراغ جارية",
      description:
        "بدأت إجراءات إفراغ الأرض، وسيتم تحديث الملف عند اكتمالها.",
    };
  }

  if (
    customerFile.status ===
    "transfer_completed"
  ) {
    return {
      title:
        "تم إفراغ الأرض",
      description:
        "اكتمل إفراغ الأرض، وأصبح المشروع جاهزًا للانتقال إلى مراحل البناء.",
    };
  }

  if (
    customerFile.status ===
    "rejected"
  ) {
    return {
      title:
        "الطلب مرفوض",
      description:
        "تم إيقاف رحلة الطلب الأولية بعد قرار إدارة المنصة.",
    };
  }

  if (
    customerFile.status === "closed"
  ) {
    return {
      title:
        "الملف مغلق",
      description:
        "لا يوجد إجراء مطلوب على هذا الملف حاليًا.",
    };
  }

  return {
    title:
      STAGE_LABELS[
        customerFile.current_stage
      ] ||
      customerFile.current_stage ||
      "متابعة الملف",

    description:
      "تابع حالة الملف والتعليمات المرتبطة بالمرحلة الحالية.",
  };
}

function StandardList({
  title,
  items = [],
  emptyMessage,
  onDelete,
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "12px",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "18px",
        }}
      >
        {title}
      </h3>

      {items.length === 0 ? (
        <p
          className="customer-file-notice"
          style={{ margin: 0 }}
        >
          {emptyMessage}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "14px 16px",
                background: item.checked
                  ? "#edf7f2"
                  : "#faf9f5",
                border: item.checked
                  ? "1px solid #b9dfcf"
                  : "1px solid #e1e5e1",
                borderRadius: "14px",
                lineHeight: "1.7",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(item.checked)}
                readOnly
                disabled
                aria-label={`حالة استلام المعيار: ${item.text}`}
                style={{
                  width: "20px",
                  height: "20px",
                  marginTop: "3px",
                  accentColor: "#0b3b32",
                }}
              />

              <span style={{ flex: 1 }}>
                <strong>{item.text}</strong>

                {item.checkedAt && (
                  <small
                    style={{
                      display: "block",
                      marginTop: "5px",
                      color: "#718079",
                    }}
                  >
                    تم اعتماد الاستلام: {formatDate(item.checkedAt)}
                  </small>
                )}
              </span>

              {typeof onDelete === "function" && (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  style={{
                    padding: "6px 9px",
                    border: "1px solid #dc2626",
                    borderRadius: "8px",
                    background: "#fff",
                    color: "#b91c1c",
                    cursor: "pointer",
                  }}
                >
                  حذف
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupervisorOffersCard({ projectId }) {
  const [offers, setOffers] = useState([]);
  const [availableSupervisors, setAvailableSupervisors] = useState([]);
  const [requestNotes, setRequestNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  async function loadOffers() {
    if (!projectId) return;
    try {
      setLoading(true);
      setErrorMessage("");
      setAvailabilityMessage("");
      setAvailableSupervisors([]);

      const [offersResult, supervisorsResult] = await Promise.all([
        supabase.rpc("customer_get_supervisor_offers", {
          p_project_id: projectId,
        }),
        supabase.rpc("customer_list_available_supervisors_for_project", {
          p_project_id: projectId,
        }),
      ]);

      if (offersResult.error) throw offersResult.error;

      setOffers(Array.isArray(offersResult.data) ? offersResult.data : []);

      if (supervisorsResult.error) {
        const message = String(supervisorsResult.error.message || "");

        if (message.includes("PROJECT_ALREADY_HAS_SUPERVISOR")) {
          setAvailableSupervisors([]);
          setAvailabilityMessage("تم إسناد مشرف لهذا المشروع بالفعل.");
        } else if (message.includes("PROJECT_NOT_AVAILABLE_FOR_SUPERVISION")) {
          setAvailableSupervisors([]);
          setAvailabilityMessage(
            "تتاح طلبات الإشراف بعد وصول المشروع إلى مرحلة جاهزة للمتابعة وتحديد مدينته."
          );
        } else {
          throw supervisorsResult.error;
        }
      } else {
        setAvailableSupervisors(
          Array.isArray(supervisorsResult.data) ? supervisorsResult.data : []
        );
      }
    } catch (error) {
      setOffers([]);
      setAvailableSupervisors([]);
      setErrorMessage(error?.message || "تعذر تحميل عروض المشرفين.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOffers(); }, [projectId]);

  async function selectOffer(offerId) {
    if (!offerId || loading) return;
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      const { error } = await supabase.rpc("customer_select_supervisor_offer", { p_offer_id: offerId });
      if (error) throw error;
      setSuccessMessage("تم إرسال اختيارك إلى إدارة المنصة لاعتماد الإسناد.");
      await loadOffers();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر اختيار العرض.");
      setLoading(false);
    }
  }

  async function requestSupervisorOffer(supervisorId) {
    if (!supervisorId || loading) return;

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc(
        "customer_request_supervisor_offer",
        {
          p_project_id: projectId,
          p_supervisor_user_id: supervisorId,
          p_note: String(requestNotes[supervisorId] || "").trim() || null,
        }
      );

      if (error) throw error;

      setRequestNotes((current) => ({ ...current, [supervisorId]: "" }));
      setSuccessMessage("تم إرسال طلب الإشراف إلى المشرف، وبانتظار أن يضع سعره.");
      await loadOffers();
    } catch (error) {
      const message = String(error?.message || "");

      if (message.includes("LIVE_REQUEST_OR_OFFER_ALREADY_EXISTS")) {
        setErrorMessage("يوجد طلب أو عرض قائم مع هذا المشرف بالفعل.");
      } else {
        setErrorMessage(error?.message || "تعذر إرسال طلب الإشراف.");
      }
      setLoading(false);
    }
  }

  const selectedOffer = offers.find((offer) => ["customer_selected","fee_pending","active"].includes(offer.status));
  const visibleOffers = offers.filter(
    (offer) => !["expired", "cancelled", "withdrawn"].includes(offer.status)
  );

  const supervisorRequestLabels = {
    requested: "تم إرسال الطلب — بانتظار السعر",
    submitted: "وصل عرض المشرف",
    customer_selected: "تم اختيار العرض",
    fee_pending: "اعتمدت الإدارة الاختيار",
    active: "تم تفعيل المتابعة",
  };

  return (
    <section className="customer-file-card">
      <h2>طلب إشراف وعروض المشرفين</h2>
      {errorMessage && <p className="customer-file-notice" style={{ color: "#991b1b" }}>{errorMessage}</p>}
      {successMessage && <p className="customer-file-notice"><strong>{successMessage}</strong></p>}
      {selectedOffer?.status === "customer_selected" && <p className="customer-file-notice"><strong>تم اختيار المشرف. في انتظار قبول إدارة المنصة.</strong></p>}
      {selectedOffer?.status === "fee_pending" && <p className="customer-file-notice"><strong>اعتمدت الإدارة اختيارك. بانتظار سداد المشرف رسوم المنصة لتفعيل الإشراف.</strong></p>}
      {selectedOffer?.status === "active" && <p className="customer-file-notice"><strong>تم تفعيل المشرف على المشروع.</strong></p>}

      {!selectedOffer && (
        <div style={{ margin: "18px 0", display: "grid", gap: 12 }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>المشرفون المتاحون للمشروع</h3>
            <p className="customer-file-notice" style={{ margin: 0 }}>
              اختر المشرف وأرسل له طلبًا؛ لا يستطيع وضع السعر قبل استلام طلبك.
            </p>
          </div>

          {loading ? (
            <p>جاري تحميل المشرفين...</p>
          ) : availabilityMessage ? (
            <p>{availabilityMessage}</p>
          ) : availableSupervisors.length === 0 ? (
            <p>لا يوجد مشرف نشط يغطي مدينة المشروع حاليًا.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {availableSupervisors.map((supervisor) => {
                const requestIsLive = [
                  "requested",
                  "submitted",
                  "customer_selected",
                  "fee_pending",
                  "active",
                ].includes(supervisor.requestStatus);

                return (
                  <article
                    key={supervisor.id}
                    style={{
                      padding: 14,
                      border: "1px solid #e1e5e1",
                      borderRadius: 14,
                    }}
                  >
                    <strong style={{ display: "block", fontSize: 18 }}>
                      {supervisor.name || "مشرف"}
                    </strong>
                    {supervisor.organizationName && <span>{supervisor.organizationName}</span>}
                    <div>{supervisor.professionalTitle || ""}</div>
                    <div>
                      الخبرة: {Number(supervisor.experienceYears || 0)} سنة — المشاريع السابقة: {Number(supervisor.completedProjectsCount || 0)}
                    </div>
                    {supervisor.summary && <p>{supervisor.summary}</p>}

                    {requestIsLive ? (
                      <p className="customer-file-notice" style={{ marginBottom: 0 }}>
                        <strong>
                          {supervisorRequestLabels[supervisor.requestStatus] || supervisor.requestStatus}
                        </strong>
                      </p>
                    ) : (
                      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                        <textarea
                          rows="2"
                          value={requestNotes[supervisor.id] || ""}
                          onChange={(event) =>
                            setRequestNotes((current) => ({
                              ...current,
                              [supervisor.id]: event.target.value,
                            }))
                          }
                          maxLength={1000}
                          disabled={loading}
                          placeholder="ملاحظة للمشرف عن طلب الإشراف (اختياري)"
                        />
                        <button
                          type="button"
                          className="customer-land-entry-button"
                          onClick={() => requestSupervisorOffer(supervisor.id)}
                          disabled={loading}
                        >
                          إرسال طلب إشراف
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <h3>العروض والطلبات المرسلة</h3>
      {loading ? <p>جاري تحميل العروض...</p> : visibleOffers.length === 0 ? <p>لم تُرسل طلبات ولم تصل عروض حتى الآن.</p> : (
        <div style={{ display: "grid", gap: 10 }}>
          {visibleOffers.map((offer) => (
            <article key={offer.id} style={{ padding: 14, border: offer.id === selectedOffer?.id ? "2px solid #0b3b32" : "1px solid #e1e5e1", borderRadius: 14 }}>
              <strong style={{ display: "block", fontSize: 18 }}>{offer.supervisor?.name || "مشرف"}</strong>
              {offer.supervisor?.organizationName && <span>{offer.supervisor.organizationName}</span>}
              <div>{offer.supervisor?.professionalTitle || ""}</div>
              <div>الخبرة: {Number(offer.supervisor?.experienceYears || 0)} سنة — المشاريع السابقة: {Number(offer.supervisor?.completedProjectsCount || 0)}</div>
              {offer.status === "requested" ? (
                <p><strong>بانتظار أن يضع المشرف السعر.</strong></p>
              ) : (
                <p><strong>{Number(offer.price || 0).toLocaleString("ar-SA")} ريال</strong></p>
              )}
              {offer.note && <p>{offer.note}</p>}
              {offer.status === "admin_rejected" && (
                <p className="customer-file-notice" style={{ color: "#991b1b" }}>
                  <strong>لم تعتمد الإدارة هذا الاختيار.</strong>
                  {offer.adminNote ? ` ${offer.adminNote}` : " يمكنك اختيار عرض آخر."}
                </p>
              )}
              {offer.status === "submitted" && !selectedOffer && (
                <button type="button" className="customer-land-entry-button" onClick={() => selectOffer(offer.id)} disabled={loading}>اختيار العرض</button>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="customer-file-notice" style={{ marginBottom: 0 }}>يمكنك المقارنة بالسعر والخبرة وسجل المشرف؛ لا يفرض النظام اختيار الأرخص تلقائيًا.</p>
    </section>
  );
}

function ConstructionStageCard({ workspace }) {
  const [newStandardText, setNewStandardText] = useState("");
  const [standardFile, setStandardFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const stage = workspace?.stage || null;

  if (!stage) {
    return null;
  }

  const photos = Array.isArray(workspace?.photos)
    ? workspace.photos
    : [];

  const projectStandards = Array.isArray(
    workspace?.projectStandards
  )
    ? workspace.projectStandards
    : [];

  const generalStandards = Array.isArray(
    workspace?.generalStandards
  )
    ? workspace.generalStandards
    : [];

  const documents = Array.isArray(workspace?.documents)
    ? workspace.documents
    : [];

  const projectDocuments = documents.filter(
    (document) => document.scope === "project"
  );

  const generalDocuments = documents.filter(
    (document) => document.scope === "general"
  );

  async function handleAddProjectStandard(event) {
    event.preventDefault();
    const text = newStandardText.trim();

    if (saving || text.length < 2) return;

    try {
      setSaving(true);
      setErrorMessage("");
      setMessage("");

      const { error } = await supabase.rpc(
        "customer_add_project_construction_standard_item",
        {
          p_project_stage_id: stage.id,
          p_item_text: text,
          p_is_required: true,
        }
      );

      if (error) throw error;

      setMessage("تمت إضافة معيار المشروع.");
      setNewStandardText("");
      window.location.reload();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إضافة معيار المشروع.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProjectStandard(itemId) {
    if (saving || !itemId) return;

    try {
      setSaving(true);
      setErrorMessage("");

      const { error } = await supabase.rpc(
        "customer_delete_project_construction_standard_item",
        { p_standard_item_id: itemId }
      );

      if (error) throw error;
      window.location.reload();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر حذف معيار المشروع.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadProjectStandardDocument() {
    if (saving || !standardFile) return;

    if (!ALLOWED_STANDARD_FILE_TYPES.includes(standardFile.type)) {
      setErrorMessage("الملف يجب أن يكون PDF أو JPG أو PNG أو WEBP.");
      return;
    }

    if (standardFile.size <= 0 || standardFile.size > MAX_STANDARD_FILE_SIZE) {
      setErrorMessage("حجم ملف المعايير يجب ألا يتجاوز 20 ميجابايت.");
      return;
    }

    let storagePath = "";

    try {
      setSaving(true);
      setErrorMessage("");
      setMessage("");

      const safeName = sanitizeFileName(standardFile.name);
      const uniquePart =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      storagePath = `project/${stage.id}/${uniquePart}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("construction-standards")
        .upload(storagePath, standardFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: standardFile.type,
        });

      if (uploadError) throw uploadError;

      const { error: registerError } = await supabase.rpc(
        "customer_register_project_construction_standard_document",
        {
          p_project_stage_id: stage.id,
          p_storage_path: storagePath,
          p_original_name: standardFile.name,
          p_content_type: standardFile.type,
          p_size_bytes: standardFile.size,
        }
      );

      if (registerError) throw registerError;

      setMessage("تم رفع ملف معايير المشروع.");
      setStandardFile(null);
      window.location.reload();
    } catch (error) {
      if (storagePath) {
        await supabase.storage
          .from("construction-standards")
          .remove([storagePath]);
      }

      setErrorMessage(error?.message || "تعذر رفع ملف معايير المشروع.");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenDocument(document) {
    try {
      setErrorMessage("");
      const { data, error } = await supabase.storage
        .from(document.storageBucket || "construction-standards")
        .createSignedUrl(document.storagePath, 300);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("تعذر إنشاء رابط الملف.");

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(error?.message || "تعذر فتح ملف المعايير.");
    }
  }

  return (
    <section
      className="customer-file-card"
      aria-labelledby="construction-stage-title"
    >
      <header
        style={{
          marginBottom: "22px",
          paddingBottom: "16px",
          borderBottom: "1px solid #e1e5e1",
        }}
      >
        <h2
          id="construction-stage-title"
          style={{
            marginBottom: "7px",
            fontWeight: 950,
          }}
        >
          {stage.mainStageName}
        </h2>

        <p
          style={{
            margin: 0,
            color: "#52665f",
            fontSize: "18px",
            lineHeight: "1.7",
          }}
        >
          {stage.detailedStageName}
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gap: "24px",
        }}
      >
        {errorMessage && (
          <p className="customer-file-notice" style={{ margin: 0, color: "#991b1b" }}>
            {errorMessage}
          </p>
        )}

        {message && (
          <p className="customer-file-notice" style={{ margin: 0 }}>
            {message}
          </p>
        )}

        <ConstructionStageRequests projectStageId={stage.id} />

        <div>
          <h3
            style={{
              marginTop: 0,
              marginBottom: "12px",
              fontSize: "18px",
            }}
          >
            صور المرحلة
          </h3>

          {photos.length === 0 ? (
            <p
              className="customer-file-notice"
              style={{ margin: 0 }}
            >
              لم يرفع المشرف صورًا لهذه المرحلة حتى الآن.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: "12px",
              }}
            >
              {photos.map((photo) => (
                <figure
                  key={photo.id}
                  style={{
                    margin: 0,
                    overflow: "hidden",
                    background: "#faf9f5",
                    border: "1px solid #e1e5e1",
                    borderRadius: "16px",
                  }}
                >
                  {photo.signedUrl ? (
                    <img
                      src={photo.signedUrl}
                      alt={photo.caption || photo.originalName || "صورة المرحلة"}
                      loading="lazy"
                      style={{
                        display: "block",
                        width: "100%",
                        aspectRatio: "4 / 3",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        placeItems: "center",
                        minHeight: "150px",
                        padding: "18px",
                        textAlign: "center",
                        color: "#718079",
                      }}
                    >
                      📷 {photo.originalName || "صورة المرحلة"}
                    </div>
                  )}

                  {photo.caption && (
                    <figcaption
                      style={{
                        padding: "10px 12px",
                        color: "#52665f",
                        lineHeight: "1.6",
                      }}
                    >
                      {photo.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "18px" }}>
            إضافة معايير خاصة بالمشروع
          </h3>

          <form onSubmit={handleAddProjectStandard} style={{ display: "grid", gap: "10px" }}>
            <textarea
              rows="3"
              value={newStandardText}
              onChange={(event) => setNewStandardText(event.target.value)}
              disabled={saving}
              placeholder="اكتب المقاس أو المواصفة أو الشرط الخاص بهذا المشروع."
              style={{ padding: "12px", borderRadius: "10px", border: "1px solid #d1d5db", font: "inherit", resize: "vertical" }}
            />
            <button
              type="submit"
              className="customer-land-entry-button"
              disabled={saving || !newStandardText.trim()}
            >
              إضافة المعيار
            </button>
          </form>

          <div style={{ display: "grid", gap: "8px" }}>
            <strong>ملف معايير المشروع</strong>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setStandardFile(event.target.files?.[0] || null)}
              disabled={saving}
            />
            <button
              type="button"
              className="customer-land-entry-button"
              onClick={handleUploadProjectStandardDocument}
              disabled={saving || !standardFile}
            >
              رفع الملف
            </button>
          </div>
        </div>

        <StandardList
          title="المعايير الخاصة بالمشروع"
          items={projectStandards}
          emptyMessage="لم يرفع العميل معايير خاصة بهذه المرحلة حتى الآن."
          onDelete={handleDeleteProjectStandard}
        />

        {projectDocuments.length > 0 && (
          <div style={{ display: "grid", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "18px" }}>ملفات معايير المشروع</h3>
            {projectDocuments.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => handleOpenDocument(document)}
                style={{ textAlign: "right", padding: "11px 12px", border: "1px solid #d1d5db", borderRadius: "10px", background: "#fff", cursor: "pointer", font: "inherit" }}
              >
                📄 {document.originalName}
              </button>
            ))}
          </div>
        )}

        <StandardList
          title="المعايير العامة"
          items={generalStandards}
          emptyMessage="لم تضف الإدارة معايير عامة لهذه المرحلة حتى الآن."
        />

        {generalDocuments.length > 0 && (
          <div style={{ display: "grid", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "18px" }}>ملف المعايير العامة</h3>
            {generalDocuments.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => handleOpenDocument(document)}
                style={{ textAlign: "right", padding: "11px 12px", border: "1px solid #d1d5db", borderRadius: "10px", background: "#fff", cursor: "pointer", font: "inherit" }}
              >
                📄 {document.originalName}
              </button>
            ))}
          </div>
        )}

        <p
          className="customer-file-notice"
          style={{ margin: 0 }}
        >
          مربعات الاستلام للعرض في حساب العميل. الاعتماد الفني ووضع ✓ يتم بواسطة المشرف ويُسجل معه وقت الاعتماد وهوية من اعتمده.
        </p>
      </div>
    </section>
  );
}

function CustomerFilePage({
  customerFile,
  timeline = [],
  onBackToHome,
}) {
  if (!customerFile) {
    return (
      <main className="customer-file-error-state">
        <h1>
          تعذر عرض ملف العميل
        </h1>

        <p>
          لم تصل بيانات الملف من قاعدة
          البيانات.
        </p>

        <button
          type="button"
          onClick={onBackToHome}
        >
          العودة
        </button>
      </main>
    );
  }

  const isServiceProject =
    customerFile.project_type === "services";

  const constructionWorkspace =
    customerFile.construction_stage_workspace ||
    null;

  const statusLabel =
    STATUS_LABELS[
      customerFile.status
    ] ||
    customerFile.status ||
    "غير محددة";

  const stageLabel = isServiceProject
    ? customerFile.current_stage ||
      "غير محددة"
    : STAGE_LABELS[
        customerFile.current_stage
      ] ||
      customerFile.current_stage ||
      "غير محددة";

  const statusClass =
    getStatusClass(
      customerFile.status
    );

  const currentAction =
    getCurrentAction(customerFile);

  const showLandSubmissionButton =
    canSubmitLand(customerFile);

  function handleOpenLandSubmission() {
    if (
      !showLandSubmissionButton ||
      !customerFile.id
    ) {
      return;
    }

    window.location.href =
      `/customer/project/${customerFile.id}/land`;
  }

  return (
    <main className="customer-file-page">
      <div className="customer-file-container">
        <header className="customer-file-header">
          <div>
            <p>
              نايف المزيني للبناء الذاتي
            </p>

            <h1>
              {isServiceProject
                ? "المشروع "
                : "ملف العميل "}
              <span className="customer-file-number">
                {customerFile.file_number}
              </span>
            </h1>

            <p>
              آخر تحديث:{" "}
              <strong>
                {formatDate(
                  customerFile.updated_at
                )}
              </strong>
            </p>
          </div>

          <button
            type="button"
            className="customer-file-home-button"
            onClick={onBackToHome}
          >
            العودة
          </button>
        </header>

        <section
          className="customer-file-card customer-current-action"
          aria-labelledby="customer-current-action-title"
        >
          <h2 id="customer-current-action-title">
            الإجراء الحالي المطلوب
          </h2>

          <p>
            {currentAction.title}
          </p>

          <p className="customer-current-action-description">
            {currentAction.description}
          </p>

          {showLandSubmissionButton && (
            <button
              type="button"
              className="customer-land-entry-button"
              onClick={
                handleOpenLandSubmission
              }
            >
              <span aria-hidden="true">
                📍
              </span>

              <span>
                {customerFile.status ===
                "land_needs_completion"
                  ? "استكمال بيانات الأرض"
                  : "تقديم الأرض"}
              </span>
            </button>
          )}
        </section>

        <ConstructionStageCard
          workspace={constructionWorkspace}
        />

        <SupervisorOffersCard projectId={customerFile.id} />

        <section
          className="customer-file-card"
          aria-labelledby="customer-file-summary-title"
        >
          <h2 id="customer-file-summary-title">
            حالة {isServiceProject ? "المشروع" : "الملف"}
          </h2>

          <dl className="customer-file-grid">
            <div className="customer-file-data-item">
              <dt>{isServiceProject ? "رقم المشروع" : "رقم الملف"}</dt>

              <dd>
                {customerFile.file_number}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>الحالة الحالية</dt>

              <dd>
                <span
                  className={`customer-file-status ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>
                المرحلة الحالية
              </dt>

              <dd>{stageLabel}</dd>
            </div>

            {!isServiceProject && (
              <>
                <div className="customer-file-data-item">
                  <dt>
                    تاريخ التقديم
                  </dt>

                  <dd>
                    {formatDate(
                      customerFile.submitted_at
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>
                    تاريخ القبول
                  </dt>

                  <dd>
                    {formatDate(
                      customerFile.approved_at
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>
                    تاريخ الرفض
                  </dt>

                  <dd>
                    {formatDate(
                      customerFile.rejected_at
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>

        <section
          className="customer-file-card"
          aria-labelledby="customer-project-title"
        >
          <h2 id="customer-project-title">
            {isServiceProject
              ? "بيانات المشروع"
              : "بيانات المشروع والتمويل"}
          </h2>

          <dl className="customer-file-grid">
            <div className="customer-file-data-item">
              <dt>مساحة الأرض</dt>

              <dd>
                {formatSquareMeters(
                  customerFile.land_area
                )}
              </dd>
            </div>

            <div className="customer-file-data-item">
              <dt>عدد الأدوار</dt>

              <dd>
                {customerFile.floors ??
                  "غير متوفر"}
              </dd>
            </div>

            {isServiceProject && customerFile.project_title && (
              <div className="customer-file-data-item">
                <dt>مسمى المشروع</dt>
                <dd>{customerFile.project_title}</dd>
              </div>
            )}

            {isServiceProject && customerFile.property_location_url && (
              <div className="customer-file-data-item">
                <dt>موقع العقار</dt>
                <dd>
                  <a
                    href={customerFile.property_location_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    فتح الموقع
                  </a>
                </dd>
              </div>
            )}

            {!isServiceProject && (
              <>
                <div className="customer-file-data-item">
                  <dt>قيمة الأرض</dt>

                  <dd>
                    {formatSaudiRiyal(
                      customerFile
                        .estimated_land_price
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>عرض البنك</dt>

                  <dd>
                    {formatSaudiRiyal(
                      customerFile.bank_offer
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>
                    المساحة المحتسبة لكل دور
                  </dt>

                  <dd>
                    {formatSquareMeters(
                      customerFile
                        .building_area_per_floor
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>
                    إجمالي مسطح البناء
                  </dt>

                  <dd>
                    {formatSquareMeters(
                      customerFile
                        .total_building_area
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>
                    سعر متر البناء
                  </dt>

                  <dd>
                    {formatSaudiRiyal(
                      customerFile.meter_rate
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>
                    تكلفة البناء التقديرية
                  </dt>

                  <dd>
                    {formatSaudiRiyal(
                      customerFile
                        .estimated_construction_cost
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>
                    إجمالي تكلفة المشروع
                  </dt>

                  <dd className="customer-file-financial-value">
                    {formatSaudiRiyal(
                      customerFile
                        .estimated_project_cost
                    )}
                  </dd>
                </div>

                <div className="customer-file-data-item">
                  <dt>
                    نسبة التكلفة إلى عرض البنك
                  </dt>

                  <dd>
                    {formatPercentage(
                      customerFile
                        .financing_ratio
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>

        {!isServiceProject && (
          <section
            className="customer-file-card"
            aria-labelledby="customer-payment-title"
          >
            <h2 id="customer-payment-title">
              الدفعة المطلوبة
            </h2>

            <dl className="customer-file-grid">
              <div className="customer-file-data-item">
                <dt>
                  الدفعة الأساسية 12٪
                </dt>

                <dd>
                  {formatSaudiRiyal(
                    customerFile
                      .base_customer_payment
                  )}
                </dd>
              </div>

              <div className="customer-file-data-item">
                <dt>
                  فرق التجاوز عن حد 80٪
                </dt>

                <dd>
                  {formatSaudiRiyal(
                    customerFile.excess_amount
                  )}
                </dd>
              </div>

              <div className="customer-file-data-item">
                <dt>
                  إجمالي الدفعة المطلوبة
                </dt>

                <dd className="customer-file-financial-value">
                  {formatSaudiRiyal(
                    customerFile
                      .total_customer_payment
                  )}
                </dd>
              </div>
            </dl>

            {customerFile
              .requires_extra_payment_approval && (
              <p className="customer-file-notice">
                موافقتك على الدفعة
                الإضافية:{" "}
                <strong>
                  {customerFile
                    .extra_payment_approved
                    ? "تمت الموافقة"
                    : "لم تتم الموافقة"}
                </strong>
              </p>
            )}
          </section>
        )}

        {!isServiceProject && (
          <section
            className="customer-file-card"
            aria-labelledby="customer-stages-title"
          >
            <h2 id="customer-stages-title">
              مراحل الملف
            </h2>

            <ol className="customer-file-stages">
              {PROJECT_STAGES.map(
                (stage) => (
                  <li key={stage}>
                    {stage}
                  </li>
                )
              )}
            </ol>

            <p className="customer-file-current-stage">
              المرحلة الحالية:{" "}
              <strong>
                {stageLabel}
              </strong>
            </p>
          </section>
        )}

        {!isServiceProject && (
          <section
            className="customer-file-card"
            aria-labelledby="customer-timeline-title"
          >
            <h2 id="customer-timeline-title">
              السجل الزمني
            </h2>

            {timeline.length === 0 ? (
              <p>
                لا توجد أحداث مسجلة في الملف
                حتى الآن.
              </p>
            ) : (
              <ol className="customer-file-timeline">
                {timeline.map(
                  (eventItem) => {
                    const eventLabel =
                      EVENT_TYPE_LABELS[
                        eventItem.event_type
                      ] ||
                      eventItem.event_type ||
                      "حدث";

                    return (
                      <li
                        key={eventItem.id}
                        className="customer-file-timeline-item"
                      >
                        <article className="customer-file-timeline-article">
                          <header className="customer-file-timeline-header">
                            <h3>
                              {eventItem.title ||
                                eventLabel}
                            </h3>

                            <time
                              dateTime={
                                eventItem.created_at
                              }
                            >
                              {formatDate(
                                eventItem.created_at
                              )}
                            </time>
                          </header>

                          {eventItem.description && (
                            <p className="customer-file-timeline-description">
                              {
                                eventItem.description
                              }
                            </p>
                          )}
                        </article>
                      </li>
                    );
                  }
                )}
              </ol>
            )}
          </section>
        )}

        <section
          className="customer-file-card"
          aria-labelledby="customer-access-title"
        >
          <h2 id="customer-access-title">
            الدخول إلى حسابك لاحقًا
          </h2>

          <div className="customer-file-access-note">
            <p>
              يمكنك العودة إلى جميع مشاريعك
              من الصفحة الرئيسية عبر{" "}
              <strong>
                دخول ← حساب العميل
              </strong>
              .
            </p>

            <p>
              أدخل البريد الإلكتروني نفسه
              الذي سجلته عند تقديم الطلب، ثم
              استخدم رمز الدخول المرسل إلى
              بريدك.
            </p>

            <div className="customer-file-access-values">
              <div className="customer-file-access-value">
                <span>
                  البريد الإلكتروني المسجل
                </span>

                <strong dir="ltr">
                  {customerFile.email ||
                    "البريد المسجل في الحساب"}
                </strong>
              </div>
            </div>

            <p className="customer-file-notice">
              بعد تسجيل الدخول ستظهر جميع
              المشاريع المرتبطة بالبريد نفسه
              داخل صفحة «مشاريعي»، دون الحاجة
              إلى إدخال رقم الملف أو رقم
              الجوال.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default CustomerFilePage;
