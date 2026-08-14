import { useEffect, useState } from "react";

import HomePage from "./pages/HomePage.jsx";
import CustomerApplicationPage from "./pages/CustomerApplicationPage.jsx";
import CustomerServiceApplicationPage from "./pages/CustomerServiceApplicationPage.jsx";
import CustomerAccountLoginPage from "./pages/CustomerAccountLoginPage.jsx";
import CustomerProjectsPage from "./pages/CustomerProjectsPage.jsx";
import CustomerProjectPage from "./pages/CustomerProjectPage.jsx";
import CustomerLandSubmissionPage from "./pages/CustomerLandSubmissionPage.jsx";

import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminCustomerFilesPage from "./pages/admin/AdminCustomerFilesPage.jsx";
import AdminCustomerWorkspace from "./pages/admin/AdminCustomerWorkspace.jsx";
import AdminProjectFollowUpRequestsPage from "./pages/admin/AdminProjectFollowUpRequestsPage.jsx";

import { supabase } from "./lib/supabase.js";
import ConstructionStageRequests from "./components/ConstructionStageRequests.jsx";

import {
  getCurrentAdmin,
  signInAdmin,
  signOutAdmin,
} from "./services/adminAuthService.js";

import {
  decideCustomerApplication,
  getAdminCustomerFile,
  getAdminDashboard,
  listAdminCustomerFileNotes,
  listAdminCustomerFileTimeline,
  searchAdminCustomerFiles,
} from "./services/adminCustomerFileService.js";

const INITIAL_CUSTOMER_FILTERS = {
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

const SUPERVISOR_ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_SUPERVISOR_PHOTO_SIZE = 20 * 1024 * 1024;

function normalizeSupervisorOtp(value) {
  return String(value || "")
    .replace(/[^\d٠-٩۰-۹]/g, "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .slice(0, 8);
}

function sanitizeSupervisorFileName(fileName) {
  const original = String(fileName || "stage-photo").trim();
  const extensionMatch = original.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch?.[1]?.toLowerCase() || "";
  const base = original
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "stage-photo";

  return extension ? `${base}.${extension}` : base;
}

function formatSupervisorDate(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function SupervisorPortal({ onBackHome }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [authStep, setAuthStep] = useState("checking");
  const [dashboard, setDashboard] = useState({ projects: [], reminders: [] });
  const [selectedStageId, setSelectedStageId] = useState("");
  const [stageWorkspace, setStageWorkspace] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [customStageName, setCustomStageName] = useState("");
  const [customStageDate, setCustomStageDate] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [availableProjects, setAvailableProjects] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [offerPrices, setOfferPrices] = useState({});
  const [offerNotes, setOfferNotes] = useState({});

  async function loadSupervisorDashboard() {
    const [dashboardResult, availableResult, offersResult] = await Promise.all([
      supabase.rpc("supervisor_get_dashboard"),
      supabase.rpc("supervisor_list_available_projects"),
      supabase.rpc("supervisor_list_my_project_offers"),
    ]);

    if (dashboardResult.error) {
      const message = String(dashboardResult.error.message || "");
      if (message.includes("SUPERVISOR_AUTHORIZATION_REQUIRED")) {
        setAuthStep("not-approved");
        return false;
      }
      throw dashboardResult.error;
    }
    if (availableResult.error) throw availableResult.error;
    if (offersResult.error) throw offersResult.error;

    const data = dashboardResult.data;
    setDashboard({
      projects: Array.isArray(data?.projects) ? data.projects : [],
      reminders: Array.isArray(data?.reminders) ? data.reminders : [],
    });
    setAvailableProjects(Array.isArray(availableResult.data) ? availableResult.data : []);
    setMyOffers(Array.isArray(offersResult.data) ? offersResult.data : []);
    setAuthStep("dashboard");
    return true;
  }

  useEffect(() => {
    let active = true;

    async function restoreSupervisor() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;

        if (!data?.session) {
          setAuthStep("email");
          return;
        }

        await loadSupervisorDashboard();
      } catch (error) {
        if (active) {
          setErrorMessage(error?.message || "تعذر التحقق من حساب المشرف.");
          setAuthStep("email");
        }
      }
    }

    restoreSupervisor();
    return () => {
      active = false;
    };
  }, []);

  async function sendSupervisorCode(event) {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setErrorMessage("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });

      if (error) throw error;

      setEmail(normalizedEmail);
      setOtp("");
      setAuthStep("otp");
      setSuccessMessage("تم إرسال رمز الدخول إلى بريدك الإلكتروني.");
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إرسال رمز الدخول.");
    } finally {
      setLoading(false);
    }
  }

  async function verifySupervisorCode(event) {
    event.preventDefault();
    if (loading) return;

    const normalizedOtp = normalizeSupervisorOtp(otp);
    if (!/^\d{8}$/.test(normalizedOtp)) {
      setErrorMessage("أدخل رمز الدخول المكوّن من 8 أرقام.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: normalizedOtp,
        type: "email",
      });

      if (error) throw error;
      if (!data?.session) throw new Error("لم تُنشأ جلسة دخول صالحة.");

      await loadSupervisorDashboard();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر التحقق من رمز الدخول.");
    } finally {
      setLoading(false);
    }
  }

  async function signOutSupervisor() {
    try {
      await supabase.auth.signOut();
    } finally {
      setDashboard({ projects: [], reminders: [] });
      setStageWorkspace(null);
      setSelectedStageId("");
      setAuthStep("email");
      setErrorMessage("");
      setSuccessMessage("");
    }
  }

  async function loadStageWorkspace(stageId) {
    if (!stageId) return;

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase.rpc(
        "supervisor_get_construction_stage_workspace",
        { p_project_stage_id: stageId }
      );

      if (error) throw error;

      const photos = Array.isArray(data?.photos) ? data.photos : [];
      const photosWithUrls = await Promise.all(
        photos.map(async (photo) => {
          if (!photo?.storagePath) return photo;
          const { data: signedData } = await supabase.storage
            .from(photo.storageBucket || "construction-stage-photos")
            .createSignedUrl(photo.storagePath, 300);
          return { ...photo, signedUrl: signedData?.signedUrl || null };
        })
      );

      setSelectedStageId(stageId);
      setStageWorkspace({
        ...data,
        photos: photosWithUrls,
        projectStandards: Array.isArray(data?.projectStandards)
          ? data.projectStandards
          : [],
        generalStandards: Array.isArray(data?.generalStandards)
          ? data.generalStandards
          : [],
      });
    } catch (error) {
      setErrorMessage(error?.message || "تعذر فتح مرحلة المشروع.");
    } finally {
      setLoading(false);
    }
  }

  async function setStandardCheck(itemId, checked) {
    if (!selectedStageId || !itemId || loading) return;

    try {
      setLoading(true);
      setErrorMessage("");

      const { error } = await supabase.rpc(
        "supervisor_set_construction_standard_check",
        {
          p_project_stage_id: selectedStageId,
          p_standard_item_id: itemId,
          p_is_checked: checked,
          p_note: null,
        }
      );

      if (error) throw error;
      await loadStageWorkspace(selectedStageId);
    } catch (error) {
      setErrorMessage(error?.message || "تعذر تحديث اعتماد المعيار.");
      setLoading(false);
    }
  }

  async function uploadStagePhoto() {
    if (!selectedStageId || !photoFile || loading) return;

    if (!SUPERVISOR_ALLOWED_PHOTO_TYPES.includes(photoFile.type)) {
      setErrorMessage("الصورة يجب أن تكون JPG أو PNG أو WEBP.");
      return;
    }

    if (photoFile.size <= 0 || photoFile.size > MAX_SUPERVISOR_PHOTO_SIZE) {
      setErrorMessage("حجم الصورة يجب ألا يتجاوز 20 ميجابايت.");
      return;
    }

    let storagePath = "";

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const safeName = sanitizeSupervisorFileName(photoFile.name);
      const uniquePart =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      storagePath = `stage/${selectedStageId}/${uniquePart}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("construction-stage-photos")
        .upload(storagePath, photoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: photoFile.type,
        });

      if (uploadError) throw uploadError;

      const { error: registerError } = await supabase.rpc(
        "supervisor_register_construction_stage_photo",
        {
          p_project_stage_id: selectedStageId,
          p_storage_path: storagePath,
          p_original_name: photoFile.name,
          p_content_type: photoFile.type,
          p_size_bytes: photoFile.size,
          p_caption: photoCaption.trim() || null,
        }
      );

      if (registerError) throw registerError;

      setPhotoFile(null);
      setPhotoCaption("");
      setSuccessMessage("تم رفع صورة المرحلة.");
      await loadStageWorkspace(selectedStageId);
    } catch (error) {
      if (storagePath) {
        await supabase.storage.from("construction-stage-photos").remove([storagePath]);
      }
      setErrorMessage(error?.message || "تعذر رفع صورة المرحلة.");
      setLoading(false);
    }
  }

  async function createCustomStage(event) {
    event.preventDefault();
    if (!selectedStageId || loading) return;

    const name = customStageName.trim();
    if (name.length < 2) {
      setErrorMessage("اكتب اسم المرحلة التفصيلية.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc(
        "supervisor_create_custom_construction_stage",
        {
          p_reference_stage_id: selectedStageId,
          p_detailed_stage_name: name,
          p_planned_for: customStageDate
            ? new Date(customStageDate).toISOString()
            : null,
        }
      );

      if (error) throw error;

      setCustomStageName("");
      setCustomStageDate("");
      setSuccessMessage("تم إنشاء المرحلة التفصيلية الجديدة.");
      await loadSupervisorDashboard();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إنشاء المرحلة.");
    } finally {
      setLoading(false);
    }
  }

  async function createReminder(event) {
    event.preventDefault();
    if (!selectedStageId || loading) return;

    if (!reminderTitle.trim() || !reminderAt) {
      setErrorMessage("اكتب عنوان التذكير وحدد الموعد.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc(
        "supervisor_create_construction_stage_reminder",
        {
          p_project_stage_id: selectedStageId,
          p_title: reminderTitle.trim(),
          p_reminder_at: new Date(reminderAt).toISOString(),
          p_note: reminderNote.trim() || null,
        }
      );

      if (error) throw error;

      setReminderTitle("");
      setReminderAt("");
      setReminderNote("");
      setSuccessMessage("تمت إضافة التذكير إلى جدول الأعمال.");
      await loadSupervisorDashboard();
    } catch (error) {
      setErrorMessage(error?.message || "تعذر إنشاء التذكير.");
    } finally {
      setLoading(false);
    }
  }

  async function completeConstructionStage() {
    if (!selectedStageId || loading) return;

    const confirmed = window.confirm(
      "هل أنت متأكد من إكمال هذه المرحلة؟ سيتم الانتقال إلى المرحلة التالية إن وجدت."
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase.rpc(
        "supervisor_complete_construction_stage",
        { p_project_stage_id: selectedStageId }
      );

      if (error) throw error;

      await loadSupervisorDashboard();

      if (data?.projectCompleted) {
        setStageWorkspace(null);
        setSelectedStageId("");
        setSuccessMessage(
          data?.feeBecameDue
            ? `اكتملت جميع مراحل المشروع. أصبحت مديونية المنصة ${Number(
                data.feeAmount || 0
              ).toLocaleString("ar-SA")} ريال مستحقة، ولن يظهر حسابك في الترشيحات الجديدة حتى تأكيد سدادها.`
            : "اكتملت جميع مراحل المشروع."
        );
        return;
      }

      const nextStageId = data?.nextStageId || null;
      await loadStageWorkspace(nextStageId || selectedStageId);

      if (data?.alreadyCompleted) {
        setSuccessMessage("هذه المرحلة مكتملة بالفعل.");
      } else if (nextStageId) {
        setSuccessMessage("تم إكمال المرحلة وفتح المرحلة التالية.");
      } else {
        setSuccessMessage("تم إكمال المرحلة بنجاح.");
      }
    } catch (error) {
      const message = String(error?.message || "");
      const missingMatch = message.match(/REQUIRED_STANDARDS_INCOMPLETE:(\d+)/);

      if (missingMatch) {
        setErrorMessage(
          `لا يمكن إكمال المرحلة قبل اعتماد ${missingMatch[1]} من المعايير المطلوبة.`
        );
      } else if (message.includes("PROJECT_STAGE_NOT_COMPLETABLE")) {
        setErrorMessage("لا يمكن إكمال مرحلة ملغاة أو مرحلة بحالة غير قابلة للإكمال.");
      } else if (message.includes("SUPERVISOR_AUTHORIZATION_REQUIRED")) {
        setErrorMessage("ليس لديك صلاحية إكمال هذه المرحلة.");
      } else {
        setErrorMessage(error?.message || "تعذر إكمال المرحلة.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitProjectOffer(project) {
    const key = `${project.projectType}:${project.projectId}`;
    const price = Number(offerPrices[key]);
    if (!Number.isFinite(price) || price <= 0 || loading) {
      setErrorMessage("أدخل سعرًا صحيحًا للعرض.");
      return;
    }
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      const { error } = await supabase.rpc("supervisor_submit_project_offer", {
        p_project_type: project.projectType,
        p_project_id: project.projectId,
        p_offer_price: price,
        p_offer_note: String(offerNotes[key] || "").trim() || null,
      });
      if (error) throw error;
      setSuccessMessage("تم إرسال السعر إلى العميل.");
      setOfferPrices((current) => ({ ...current, [key]: "" }));
      setOfferNotes((current) => ({ ...current, [key]: "" }));
      await loadSupervisorDashboard();
    } catch (error) {
      const message = String(error?.message || "");
      setErrorMessage(
        message.includes("SUPERVISOR_HAS_OUTSTANDING_PLATFORM_DEBT")
          ? "لا يمكنك إرسال عرض جديد قبل تأكيد سداد مديونية المنصة المستحقة."
          : error?.message || "تعذر إرسال العرض."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedStageStatus = stageWorkspace?.stage?.status || "";
  const selectedStageStatusLabel = {
    planned: "مخططة",
    in_progress: "قيد التنفيذ",
    completed: "مكتملة",
    cancelled: "ملغاة",
  }[selectedStageStatus] || selectedStageStatus;
  const missingRequiredStandards = [
    ...(stageWorkspace?.projectStandards || []),
    ...(stageWorkspace?.generalStandards || []),
  ].filter((item) => Boolean(item.required) && !Boolean(item.checked)).length;
  const canCompleteSelectedStage = ["planned", "in_progress"].includes(
    selectedStageStatus
  );
  const pendingPlatformDebts = myOffers.filter(
    (offer) => offer.feeStatus === "pending"
  );
  const pendingPlatformDebtTotal = pendingPlatformDebts.reduce(
    (total, offer) => total + Number(offer.feeAmount || 0),
    0
  );

  const shellStyle = {
    minHeight: "100vh",
    background: "#f5f3ee",
    color: "#173f36",
    padding: "24px 16px 60px",
    boxSizing: "border-box",
    direction: "rtl",
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e3e0d7",
    borderRadius: "18px",
    padding: "20px",
  };

  if (authStep === "checking") {
    return <main style={shellStyle}><div style={{ ...cardStyle, maxWidth: 520, margin: "80px auto", textAlign: "center" }}>جاري التحقق من حساب المشرف...</div></main>;
  }

  if (authStep === "email" || authStep === "otp" || authStep === "not-approved") {
    return (
      <main style={shellStyle}>
        <section style={{ ...cardStyle, maxWidth: 520, margin: "50px auto" }}>
          <button type="button" onClick={onBackHome} style={{ marginBottom: 18 }}>العودة</button>
          <h1 style={{ marginTop: 0 }}>دخول المشرف</h1>

          {errorMessage && <p style={{ color: "#991b1b" }}>{errorMessage}</p>}
          {successMessage && <p>{successMessage}</p>}

          {authStep === "not-approved" ? (
            <div>
              <p>تم تسجيل الدخول، لكن الحساب غير مفعّل كمشرف في المنصة بعد.</p>
              <p>يجب اعتماد حساب المشرف من الإدارة قبل ظهور المشاريع وجدول الأعمال.</p>
              <button type="button" onClick={signOutSupervisor}>تسجيل الخروج</button>
            </div>
          ) : authStep === "email" ? (
            <form onSubmit={sendSupervisorCode} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 7 }}>
                <strong>البريد الإلكتروني</strong>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                  style={{ minHeight: 46, padding: "0 12px", border: "1px solid #d1d5db", borderRadius: 10, font: "inherit" }}
                />
              </label>
              <button type="submit" disabled={loading} style={{ minHeight: 46 }}>إرسال رمز الدخول</button>
            </form>
          ) : (
            <form onSubmit={verifySupervisorCode} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 7 }}>
                <strong>رمز الدخول من 8 أرقام</strong>
                <input
                  inputMode="numeric"
                  value={otp}
                  onChange={(event) => setOtp(normalizeSupervisorOtp(event.target.value))}
                  maxLength={8}
                  disabled={loading}
                  required
                  style={{ minHeight: 46, padding: "0 12px", border: "1px solid #d1d5db", borderRadius: 10, font: "inherit" }}
                />
              </label>
              <button type="submit" disabled={loading}>دخول</button>
              <button type="button" onClick={() => setAuthStep("email")} disabled={loading}>تغيير البريد</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <div style={{ maxWidth: 1050, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0 }}>نايف المزيني للبناء الذاتي</p>
            <h1 style={{ margin: "5px 0 0" }}>حساب المشرف</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onBackHome}>الرئيسية</button>
            <button type="button" onClick={signOutSupervisor}>تسجيل الخروج</button>
          </div>
        </header>

        {errorMessage && <div style={{ ...cardStyle, color: "#991b1b" }}>{errorMessage}</div>}
        {successMessage && <div style={cardStyle}>{successMessage}</div>}
        {pendingPlatformDebts.length > 0 && (
          <div style={{ ...cardStyle, color: "#991b1b", background: "#fff1f2", borderColor: "#fecdd3" }}>
            <strong>مديونية مستحقة للمنصة: {pendingPlatformDebtTotal.toLocaleString("ar-SA")} ريال</strong>
            <p style={{ marginBottom: 0 }}>
              لا يظهر حسابك ضمن ترشيحات المشرفين الجديدة حتى تأكيد السداد. المشاريع السابقة وسجلاتها لا تُحذف.
            </p>
          </div>
        )}

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>طلبات إشراف من العملاء</h2>
          <p>لا يظهر المشروع هنا إلا بعد أن يختارك العميل ويرسل لك طلب تسعير الإشراف.</p>
          {availableProjects.length === 0 ? (
            <p>لا توجد طلبات إشراف جديدة حاليًا.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {availableProjects.map((project) => {
                const key = `${project.projectType}:${project.projectId}`;
                return (
                  <article key={key} style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
                    <strong style={{ display: "block" }}>{project.projectNumber || "مشروع"}</strong>
                    <div>{project.city || ""}{project.district ? ` — ${project.district}` : ""}</div>
                    <div>{project.projectTitle || ""} — مساحة الأرض {project.landArea || "-"} م² — المسطح المبني {project.builtUpArea || "-"} م² — {project.floors || "-"} دور</div>
                    <small>المرحلة: {project.currentStage || "غير محددة"}</small>
                    {project.locationUrl && <p><a href={project.locationUrl} target="_blank" rel="noreferrer">فتح موقع المشروع</a></p>}
                    <p><strong>وقت الطلب:</strong> {formatSupervisorDate(project.requestedAt)}</p>
                    {project.customerRequestNote && (
                      <p><strong>ملاحظة العميل:</strong> {project.customerRequestNote}</p>
                    )}
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <input type="number" min="1" step="0.01" placeholder="سعر الإشراف بالريال" value={offerPrices[key] || ""} onChange={(e) => setOfferPrices((current) => ({ ...current, [key]: e.target.value }))} disabled={loading} />
                      <textarea rows="2" placeholder="ملاحظة العرض (اختياري)" value={offerNotes[key] || ""} onChange={(e) => setOfferNotes((current) => ({ ...current, [key]: e.target.value }))} disabled={loading} />
                      <button type="button" onClick={() => submitProjectOffer(project)} disabled={loading || !offerPrices[key]}>إرسال السعر إلى العميل</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>عروضي</h2>
          {myOffers.length === 0 ? <p>لم ترسل عروضًا بعد.</p> : (
            <div style={{ display: "grid", gap: 9 }}>
              {myOffers.map((offer) => (
                <article key={offer.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
                  <strong>{offer.projectNumber || "مشروع"}</strong>
                  {offer.status === "requested" ? (
                    <div>السعر: لم يُرسل بعد</div>
                  ) : (
                    <div>قيمة العرض: {Number(offer.offerPrice || 0).toLocaleString("ar-SA")} ريال</div>
                  )}
                  <div>الحالة: {offer.status === "requested" ? "طلب جديد من العميل — بانتظار تسعيرك" : offer.status === "submitted" ? "بانتظار اختيار العميل" : offer.status === "active" ? "تم الإسناد وفتح خدمات المتابعة" : offer.status === "completed" && offer.feeStatus === "pending" ? "اكتملت المراحل — المديونية مستحقة" : offer.status === "completed" && offer.feeStatus === "paid" ? "اكتملت المراحل — تم سداد المديونية" : offer.status}</div>
                  {offer.feeAmount != null && offer.status === "active" && (
                    <p>
                      رسوم المنصة المحتسبة: <strong>{Number(offer.feeAmount || 0).toLocaleString("ar-SA")} ريال</strong>
                      {" "}({Number(offer.feeBasisArea || 0).toLocaleString("ar-SA")} م² × {Number(offer.feeUnitRate || 0).toLocaleString("ar-SA")} ريال). تستحق عند اكتمال جميع المراحل.
                    </p>
                  )}
                  {offer.feeStatus === "pending" && <p><strong>مديونية المنصة: {Number(offer.feeAmount || 0).toLocaleString("ar-SA")} ريال</strong><br />يُعاد ظهور حسابك في الترشيحات الجديدة بعد تأكيد السداد.</p>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>جدول الأعمال</h2>
          {dashboard.reminders.length === 0 ? (
            <p>لا توجد أعمال مجدولة حاليًا.</p>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {dashboard.reminders.map((reminder) => (
                <article key={reminder.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
                  <strong>{reminder.title}</strong>
                  <div>{reminder.projectNumber} — {reminder.mainStageName} / {reminder.detailedStageName}</div>
                  <time>{formatSupervisorDate(reminder.reminderAt)}</time>
                  {reminder.note && <p>{reminder.note}</p>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>المشاريع</h2>
          {dashboard.projects.length === 0 ? (
            <p>لا توجد مشاريع مسندة إلى هذا المشرف.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {dashboard.projects.map((project) => (
                <article key={project.assignmentId} style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
                  <strong style={{ display: "block" }}>{project.projectNumber || "مشروع"}</strong>
                  <span>{project.customerName || ""}</span>
                  <p>{project.currentStage?.mainStageName || "لا توجد مرحلة"} — {project.currentStage?.detailedStageName || ""}</p>
                  <button
                    type="button"
                    disabled={!project.currentStage?.id || loading}
                    onClick={() => loadStageWorkspace(project.currentStage?.id)}
                  >
                    فتح المشروع
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {stageWorkspace?.stage && (
          <section style={cardStyle}>
            <h2 style={{ margin: 0, fontWeight: 950 }}>{stageWorkspace.stage.mainStageName}</h2>
            <p style={{ marginTop: 6, fontSize: 18 }}>{stageWorkspace.stage.detailedStageName}</p>

            <div style={{ padding: 14, marginBottom: 18, border: "1px solid #d1d5db", borderRadius: 12, background: "#f8fafc" }}>
              <p style={{ marginTop: 0 }}>
                <strong>حالة المرحلة:</strong> {selectedStageStatusLabel}
              </p>
              {canCompleteSelectedStage ? (
                <>
                  <p>
                    {missingRequiredStandards > 0
                      ? `متبقٍ ${missingRequiredStandards} من المعايير المطلوبة قبل إكمال المرحلة.`
                      : "تم اعتماد جميع المعايير المطلوبة ويمكن إكمال المرحلة."}
                  </p>
                  <button
                    type="button"
                    onClick={completeConstructionStage}
                    disabled={loading || missingRequiredStandards > 0}
                  >
                    إكمال المرحلة
                  </button>
                </>
              ) : selectedStageStatus === "completed" ? (
                <p style={{ marginBottom: 0 }}>تم إكمال هذه المرحلة.</p>
              ) : selectedStageStatus === "cancelled" ? (
                <p style={{ marginBottom: 0 }}>هذه المرحلة ملغاة ولا يمكن إكمالها.</p>
              ) : null}
            </div>

            <ConstructionStageRequests projectStageId={stageWorkspace.stage.id} />

            <div style={{ display: "grid", gap: 22 }}>
              <div>
                <h3>صور المرحلة</h3>
                {stageWorkspace.photos?.length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                    {stageWorkspace.photos.map((photo) => (
                      <figure key={photo.id} style={{ margin: 0, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                        {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.caption || "صورة المرحلة"} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} /> : <div style={{ padding: 20 }}>📷 {photo.originalName}</div>}
                        {photo.caption && <figcaption style={{ padding: 9 }}>{photo.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                ) : <p>لا توجد صور بعد.</p>}

                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} disabled={loading} />
                  <input type="text" placeholder="وصف الصورة (اختياري)" value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)} disabled={loading} />
                  <button type="button" onClick={uploadStagePhoto} disabled={loading || !photoFile}>رفع الصورة</button>
                </div>
              </div>

              <div>
                <h3>المعايير الخاصة بالمشروع</h3>
                {(stageWorkspace.projectStandards || []).length === 0 ? <p>لا توجد معايير خاصة.</p> : (stageWorkspace.projectStandards || []).map((item) => (
                  <label key={item.id} style={{ display: "flex", gap: 10, padding: "9px 0" }}>
                    <input type="checkbox" checked={Boolean(item.checked)} onChange={(e) => setStandardCheck(item.id, e.target.checked)} disabled={loading} />
                    <span>{item.text}</span>
                  </label>
                ))}
              </div>

              <div>
                <h3>المعايير العامة</h3>
                {(stageWorkspace.generalStandards || []).length === 0 ? <p>لا توجد معايير عامة.</p> : (stageWorkspace.generalStandards || []).map((item) => (
                  <label key={item.id} style={{ display: "flex", gap: 10, padding: "9px 0" }}>
                    <input type="checkbox" checked={Boolean(item.checked)} onChange={(e) => setStandardCheck(item.id, e.target.checked)} disabled={loading} />
                    <span>{item.text}</span>
                  </label>
                ))}
              </div>

              <form onSubmit={createCustomStage} style={{ display: "grid", gap: 8 }}>
                <h3 style={{ marginBottom: 2 }}>إضافة مرحلة تفصيلية</h3>
                <input type="text" placeholder="اسم المرحلة الجديدة" value={customStageName} onChange={(e) => setCustomStageName(e.target.value)} disabled={loading} />
                <input type="datetime-local" value={customStageDate} onChange={(e) => setCustomStageDate(e.target.value)} disabled={loading} />
                <button type="submit" disabled={loading || !customStageName.trim()}>إنشاء المرحلة</button>
              </form>

              <form onSubmit={createReminder} style={{ display: "grid", gap: 8 }}>
                <h3 style={{ marginBottom: 2 }}>إضافة تذكير لجدول الأعمال</h3>
                <input type="text" placeholder="عنوان العمل" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} disabled={loading} />
                <input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} disabled={loading} />
                <textarea rows="3" placeholder="ملاحظة (اختياري)" value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} disabled={loading} />
                <button type="submit" disabled={loading || !reminderTitle.trim() || !reminderAt}>إضافة إلى جدول الأعمال</button>
              </form>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function getInitialPageFromPath() {
  const path =
    window.location.pathname.replace(/\/+$/, "") ||
    "/";

  if (/^\/customer\/project\/[^/]+\/land$/i.test(path)) {
    return "customer-land-submission";
  }

  if (/^\/customer\/project\/[^/]+$/i.test(path)) {
    return "customer-project";
  }

  const routes = {
    "/": "home",
    "/customer/application": "customer-application",
    "/customer/service-application": "customer-service-application",
    "/customer/account-login": "customer-account-login",
    "/customer/projects": "customer-projects",
    "/customer/access": "customer-account-login",
    "/supervisor": "supervisor",
    "/supervisor/dashboard": "supervisor",
    "/admin/login": "admin-login",
    "/admin/dashboard": "admin-dashboard",
    "/admin/customers": "admin-customer-files",
    "/admin/project-follow-up-requests": "admin-project-follow-up-requests",
  };

  return routes[path] || "home";
}

function App() {
  const [currentPage, setCurrentPage] = useState(getInitialPageFromPath);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isAdminSigningIn, setIsAdminSigningIn] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState("");
  const [dashboardData, setDashboardData] = useState({ pendingActions: [], sectionCounts: {} });
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [customerFiles, setCustomerFiles] = useState([]);
  const [customerFilters, setCustomerFilters] = useState(INITIAL_CUSTOMER_FILTERS);
  const [customerPagination, setCustomerPagination] = useState(INITIAL_PAGINATION);
  const [isCustomerFilesLoading, setIsCustomerFilesLoading] = useState(false);
  const [customerFilesError, setCustomerFilesError] = useState("");
  const [selectedCustomerFileId, setSelectedCustomerFileId] = useState(null);
  const [selectedCustomerFile, setSelectedCustomerFile] = useState(null);
  const [selectedCustomerFileNotes, setSelectedCustomerFileNotes] = useState([]);
  const [selectedCustomerFileTimeline, setSelectedCustomerFileTimeline] = useState([]);
  const [isCustomerWorkspaceLoading, setIsCustomerWorkspaceLoading] = useState(false);
  const [customerWorkspaceError, setCustomerWorkspaceError] = useState("");
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [customerDecisionError, setCustomerDecisionError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function restoreAdminSession() {
      try {
        const admin = await getCurrentAdmin();
        if (isMounted) setCurrentAdmin(admin);
      } catch (error) {
        console.error("تعذر استعادة جلسة الإدارة:", error);
        if (isMounted) setCurrentAdmin(null);
      } finally {
        if (isMounted) setIsCheckingAdmin(false);
      }
    }

    restoreAdminSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadAdminDashboard = async () => {
    setIsDashboardLoading(true);
    setDashboardError("");
    try {
      setDashboardData(await getAdminDashboard());
    } catch (error) {
      console.error("تعذر تحميل لوحة الإدارة:", error);
      setDashboardError(error?.message || "تعذر تحميل بيانات لوحة الإدارة.");
    } finally {
      setIsDashboardLoading(false);
    }
  };

  const loadCustomerFiles = async ({
    search = customerFilters.search,
    status = customerFilters.status,
    sort = customerFilters.sort,
    page = customerPagination.page,
    pageSize = customerPagination.pageSize,
  } = {}) => {
    setIsCustomerFilesLoading(true);
    setCustomerFilesError("");
    try {
      const result = await searchAdminCustomerFiles({ search, status, sort, page, pageSize });
      setCustomerFiles(result.files);
      setCustomerPagination(result.pagination);
      setCustomerFilters({ search, status, sort });
    } catch (error) {
      console.error("تعذر تحميل ملفات العملاء:", error);
      setCustomerFiles([]);
      setCustomerFilesError(error?.message || "تعذر تحميل ملفات العملاء.");
    } finally {
      setIsCustomerFilesLoading(false);
    }
  };

  const loadCustomerWorkspace = async (customerFileId) => {
    if (!customerFileId) {
      setCustomerWorkspaceError("معرّف ملف العميل غير موجود.");
      return;
    }

    setIsCustomerWorkspaceLoading(true);
    setCustomerWorkspaceError("");
    setCustomerDecisionError("");

    try {
      const [customerFile, notes, timeline] = await Promise.all([
        getAdminCustomerFile(customerFileId),
        listAdminCustomerFileNotes(customerFileId),
        listAdminCustomerFileTimeline(customerFileId),
      ]);
      setSelectedCustomerFile(customerFile);
      setSelectedCustomerFileNotes(notes);
      setSelectedCustomerFileTimeline(timeline);
    } catch (error) {
      console.error("تعذر تحميل مساحة عمل العميل:", error);
      setSelectedCustomerFile(null);
      setSelectedCustomerFileNotes([]);
      setSelectedCustomerFileTimeline([]);
      setCustomerWorkspaceError(error?.message || "تعذر تحميل ملف العميل.");
    } finally {
      setIsCustomerWorkspaceLoading(false);
    }
  };

  const openHomePage = () => {
    setCurrentPage("home");
    setAdminLoginError("");
  };

  const openCustomerApplication = () => setCurrentPage("customer-application");
  const openCustomerServiceApplication = () => setCurrentPage("customer-service-application");
  const openCustomerAccountLogin = () => {
    window.location.href = "/customer/projects";
  };
  const openSupervisor = () => setCurrentPage("supervisor");

  const openAdminEntry = async () => {
    setAdminLoginError("");
    if (isCheckingAdmin) return;
    if (currentAdmin) {
      setCurrentPage("admin-dashboard");
      await loadAdminDashboard();
      return;
    }
    setCurrentPage("admin-login");
  };

  const handleAdminSignIn = async ({ email, password }) => {
    if (isAdminSigningIn) return;
    setIsAdminSigningIn(true);
    setAdminLoginError("");
    try {
      const admin = await signInAdmin({ email, password });
      setCurrentAdmin(admin);
      setCurrentPage("admin-dashboard");
      await loadAdminDashboard();
    } catch (error) {
      console.error("تعذر تسجيل دخول الإدارة:", error);
      setAdminLoginError(error?.message || "تعذر تسجيل الدخول إلى إدارة المنصة.");
    } finally {
      setIsAdminSigningIn(false);
    }
  };

  const handleAdminSignOut = async () => {
    try {
      await signOutAdmin();
    } catch (error) {
      console.error("تعذر تسجيل خروج الإدارة:", error);
    } finally {
      setCurrentAdmin(null);
      setDashboardData({ pendingActions: [], sectionCounts: {} });
      setCustomerFiles([]);
      setCustomerFilters(INITIAL_CUSTOMER_FILTERS);
      setCustomerPagination(INITIAL_PAGINATION);
      setSelectedCustomerFileId(null);
      setSelectedCustomerFile(null);
      setSelectedCustomerFileNotes([]);
      setSelectedCustomerFileTimeline([]);
      setCurrentPage("home");
    }
  };

  const openAdminDashboard = async () => {
    if (!currentAdmin) {
      setCurrentPage("admin-login");
      return;
    }
    setCurrentPage("admin-dashboard");
    await loadAdminDashboard();
  };

  const openAdminCustomers = async () => {
    if (!currentAdmin) {
      setCurrentPage("admin-login");
      return;
    }
    setCurrentPage("admin-customer-files");
    await loadCustomerFiles({ ...INITIAL_CUSTOMER_FILTERS, page: 1, pageSize: 25 });
  };

  const handleCustomerSearch = async (search) => {
    await loadCustomerFiles({ search, status: customerFilters.status, sort: customerFilters.sort, page: 1 });
  };

  const handleCustomerStatusChange = async (status) => {
    await loadCustomerFiles({ search: customerFilters.search, status, sort: customerFilters.sort, page: 1 });
  };

  const handleCustomerSortChange = async (sort) => {
    await loadCustomerFiles({ search: customerFilters.search, status: customerFilters.status, sort, page: 1 });
  };

  const handleCustomerPreviousPage = async () => {
    if (!customerPagination.hasPreviousPage || isCustomerFilesLoading) return;
    await loadCustomerFiles({ page: customerPagination.page - 1 });
  };

  const handleCustomerNextPage = async () => {
    if (!customerPagination.hasNextPage || isCustomerFilesLoading) return;
    await loadCustomerFiles({ page: customerPagination.page + 1 });
  };

  const handleOpenAdminAction = async (actionType) => {
    if (actionType === "new_customer_application") {
      setCurrentPage("admin-customer-files");
      await loadCustomerFiles({ search: "", status: "under_review", sort: "newest", page: 1, pageSize: 25 });
      return;
    }

    if (actionType === "customer_needs_completion") {
      setCurrentPage("admin-customer-files");
      await loadCustomerFiles({ search: "", status: "needs_completion", sort: "newest", page: 1, pageSize: 25 });
      return;
    }

    window.alert("هذا القسم سيُربط عند إنشاء مرحلته.");
  };

  const handleOpenAdminSection = async (sectionKey) => {
    if (sectionKey === "customers") {
      await openAdminCustomers();
      return;
    }
    window.alert("هذا القسم سيُنشأ في مرحلته المخصصة.");
  };

  const handleOpenCustomerFile = async (customerFileId) => {
    if (!currentAdmin) {
      setCurrentPage("admin-login");
      return;
    }
    setSelectedCustomerFileId(customerFileId);
    setSelectedCustomerFile(null);
    setSelectedCustomerFileNotes([]);
    setSelectedCustomerFileTimeline([]);
    setCustomerWorkspaceError("");
    setCustomerDecisionError("");
    setCurrentPage("admin-customer-workspace");
    await loadCustomerWorkspace(customerFileId);
  };

  const handleRefreshCustomerWorkspace = async () => {
    if (!selectedCustomerFileId) return;
    await loadCustomerWorkspace(selectedCustomerFileId);
  };

  const handleBackToCustomerFiles = async () => {
    setCurrentPage("admin-customer-files");
    setSelectedCustomerFileId(null);
    setSelectedCustomerFile(null);
    setSelectedCustomerFileNotes([]);
    setSelectedCustomerFileTimeline([]);
    setCustomerWorkspaceError("");
    setCustomerDecisionError("");
    await loadCustomerFiles();
  };

  const handleCustomerDecision = async ({ customerFileId, decision, note }) => {
    if (isSubmittingDecision) return;
    setIsSubmittingDecision(true);
    setCustomerDecisionError("");
    try {
      await decideCustomerApplication({ customerFileId, decision, note });
      await Promise.all([
        loadCustomerWorkspace(customerFileId),
        loadCustomerFiles(),
        loadAdminDashboard(),
      ]);
    } catch (error) {
      console.error("تعذر تنفيذ قرار العميل:", error);
      setCustomerDecisionError(error?.message || "تعذر تنفيذ قرار الإدارة.");
      throw error;
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  if (currentPage === "supervisor") {
    return <SupervisorPortal onBackHome={openHomePage} />;
  }

  if (currentPage === "customer-account-login") return <CustomerAccountLoginPage />;
  if (currentPage === "customer-projects") return <CustomerProjectsPage />;
  if (currentPage === "customer-land-submission") return <CustomerLandSubmissionPage />;
  if (currentPage === "customer-project") return <CustomerProjectPage />;

  if (currentPage === "customer-application") {
    return <CustomerApplicationPage onBack={openHomePage} />;
  }

  if (currentPage === "customer-service-application") {
    return <CustomerServiceApplicationPage onBack={openHomePage} />;
  }

  if (currentPage === "admin-login") {
    return (
      <AdminLoginPage
        onSubmit={handleAdminSignIn}
        isSubmitting={isAdminSigningIn}
        errorMessage={adminLoginError}
        onBackToHome={openHomePage}
      />
    );
  }

  if (currentPage === "admin-dashboard") {
    if (!currentAdmin) {
      return (
        <AdminLoginPage
          onSubmit={handleAdminSignIn}
          isSubmitting={isAdminSigningIn}
          errorMessage={adminLoginError}
          onBackToHome={openHomePage}
        />
      );
    }

    return (
      <AdminDashboardPage
        adminProfile={currentAdmin.adminProfile}
        pendingActions={dashboardData.pendingActions}
        sectionCounts={dashboardData.sectionCounts}
        isLoading={isDashboardLoading}
        errorMessage={dashboardError}
        onOpenAction={handleOpenAdminAction}
        onOpenSection={handleOpenAdminSection}
        onSignOut={handleAdminSignOut}
      />
    );
  }

  if (currentPage === "admin-customer-files") {
    if (!currentAdmin) {
      return (
        <AdminLoginPage
          onSubmit={handleAdminSignIn}
          isSubmitting={isAdminSigningIn}
          errorMessage={adminLoginError}
          onBackToHome={openHomePage}
        />
      );
    }

    return (
      <AdminCustomerFilesPage
        customerFiles={customerFiles}
        pagination={customerPagination}
        filters={customerFilters}
        isLoading={isCustomerFilesLoading}
        errorMessage={customerFilesError}
        onSearch={handleCustomerSearch}
        onStatusChange={handleCustomerStatusChange}
        onSortChange={handleCustomerSortChange}
        onPreviousPage={handleCustomerPreviousPage}
        onNextPage={handleCustomerNextPage}
        onOpenCustomerFile={handleOpenCustomerFile}
        onBackToHome={openAdminDashboard}
      />
    );
  }

  if (currentPage === "admin-project-follow-up-requests") {
    if (!currentAdmin) {
      return (
        <AdminLoginPage
          onSubmit={handleAdminSignIn}
          isSubmitting={isAdminSigningIn}
          errorMessage={adminLoginError}
          onBackToHome={openHomePage}
        />
      );
    }

    return (
      <AdminProjectFollowUpRequestsPage
        onBack={openAdminDashboard}
      />
    );
  }

  if (currentPage === "admin-customer-workspace") {
    if (!currentAdmin) {
      return (
        <AdminLoginPage
          onSubmit={handleAdminSignIn}
          isSubmitting={isAdminSigningIn}
          errorMessage={adminLoginError}
          onBackToHome={openHomePage}
        />
      );
    }

    return (
      <AdminCustomerWorkspace
        customerFile={selectedCustomerFile}
        notes={selectedCustomerFileNotes}
        timeline={selectedCustomerFileTimeline}
        isLoading={isCustomerWorkspaceLoading}
        errorMessage={customerWorkspaceError}
        isSubmittingDecision={isSubmittingDecision}
        decisionError={customerDecisionError}
        onBack={handleBackToCustomerFiles}
        onRefresh={handleRefreshCustomerWorkspace}
        onDecision={handleCustomerDecision}
      />
    );
  }

  return (
    <HomePage
      onOpenCustomerApplication={openCustomerApplication}
      onOpenCustomerServiceApplication={openCustomerServiceApplication}
      onOpenCustomerAccountLogin={openCustomerAccountLogin}
      onOpenSupervisor={openSupervisor}
      onOpenAdmin={openAdminEntry}
      isCheckingAdmin={isCheckingAdmin}
    />
  );
}

export default App;
