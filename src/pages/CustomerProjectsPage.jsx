import { useEffect, useState } from "react";

import {
  getCustomerSession,
  getMyCustomerProjects,
  signOutCustomerAccount,
} from "../services/customerAccountAuthService.js";
import { getMySupplierMarketplaceOrders } from "../services/supplierMarketplaceService.js";
import {
  MARKETPLACE_ORDER_STATUSES,
  formatMarketplaceMoney,
  formatMarketplaceQuantity,
  getSupplierProductImageUrl,
  getSupplierUnitLabel,
} from "../utils/supplierMarketplace.js";

function getStatusLabel(status) {
  const labels = {
    submitted: "متقدم",
    under_review: "تحت المراجعة",
    pending: "تحت المراجعة",
    approved: "مقبول",
    accepted: "مقبول",
    needs_completion: "مطلوب استكمال",
    rejected: "مرفوض",
    waiting_land: "بانتظار تقديم الأرض",
    land_under_review: "الأرض تحت المراجعة",
    land_approved: "تم قبول الأرض",
    land_rejected: "تم رفض الأرض",
    waiting_transfer: "بانتظار الإفراغ",
    transfer_in_progress: "إجراءات الإفراغ جارية",
    active_project: "المشروع قيد التنفيذ",
    active: "نشط",
    completed: "مكتمل",
    closed: "مغلق",
  };

  return labels[status] || status || "غير محدد";
}

function getStageLabel(stage) {
  const labels = {
    initial_application: "التقديم الأولي",
    application_review: "مراجعة طلب العميل",
    waiting_admin_review: "انتظار مراجعة المنصة",
    waiting_land_submission: "انتظار تقديم الأرض",
    waiting_land: "انتظار تقديم الأرض",
    land_submission: "تقديم الأرض",
    land_review: "فحص الأرض",
    land_transfer: "إفراغ الأرض",
    project_execution: "تنفيذ المشروع",
    project_closure: "إغلاق المشروع",
  };

  return labels[stage] || stage || "لم تحدد المرحلة";
}

export default function CustomerProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let pageIsActive = true;

    async function loadPage() {
      try {
        setLoading(true);
        setErrorMessage("");

        const session =
          await getCustomerSession();

        if (!session) {
          window.location.replace(
            "/customer/account-login"
          );

          return;
        }

        const [projectResult, purchaseResult] = await Promise.allSettled([
          getMyCustomerProjects(),
          getMySupplierMarketplaceOrders("home"),
        ]);

        if (projectResult.status === "rejected" && purchaseResult.status === "rejected") {
          throw projectResult.reason;
        }

        if (pageIsActive) {
          setProjects(projectResult.status === "fulfilled" ? projectResult.value : []);
          setPurchases(purchaseResult.status === "fulfilled" ? purchaseResult.value : []);
          if (projectResult.status === "rejected") setErrorMessage("تعذر تحميل المشاريع، لكن مشترياتك ما زالت متاحة.");
          if (purchaseResult.status === "rejected") setErrorMessage("تعذر تحميل المشتريات، لكن مشاريعك ما زالت متاحة.");
        }
      } catch (error) {
        if (pageIsActive) {
          setProjects([]);
          setPurchases([]);

          setErrorMessage(
            error?.message ||
              "تعذر تحميل مشاريع الحساب."
          );
        }
      } finally {
        if (pageIsActive) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      pageIsActive = false;
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    try {
      setSigningOut(true);
      setErrorMessage("");

      await signOutCustomerAccount();

      window.location.replace(
        "/customer/account-login"
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "تعذر تسجيل الخروج."
      );

      setSigningOut(false);
    }
  }

  function handleBackToHome() {
    window.location.href = "/";
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        color: "#0b3b32",
        background:
          "radial-gradient(circle at 50% 20%, rgba(255,255,255,0.98) 0%, rgba(255,252,246,0.96) 42%, rgba(243,233,213,0.92) 100%)",
        padding: "24px 16px 70px",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "960px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "34px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: "52px",
                height: "52px",
                color: "#b98822",
                fontSize: "22px",
                fontWeight: "950",
                border: "2px solid #cda64d",
                borderRadius: "15px",
                transform: "rotate(-7deg)",
              }}
            >
              NM
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  marginBottom: "5px",
                  fontSize: "30px",
                }}
              >
                {projects.length === 0 && purchases.length > 0 ? "مشترياتي" : purchases.length > 0 ? "حسابي" : "مشاريعي"}
              </h1>

              <p
                style={{
                  margin: 0,
                  color: "#65756f",
                  lineHeight: "1.7",
                }}
              >
                {projects.length === 0 && purchases.length > 0
                  ? "طلبات متجر المنزل المرتبطة بحسابك."
                  : purchases.length > 0
                    ? "مشاريعك ومشترياتك في حساب واحد."
                    : "جميع مشاريع البناء المرتبطة بحسابك."}
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => { window.location.href = "/home-store"; }}
              style={{
                minHeight: "44px",
                padding: "0 15px",
                color: "#ffffff",
                font: "inherit",
                fontWeight: "800",
                cursor: "pointer",
                background: "#173f36",
                border: 0,
                borderRadius: "13px",
              }}
            >
              🏠 متجر المنزل
            </button>

            <button
              type="button"
              onClick={() => { window.location.href = "/marketplace"; }}
              style={{
                minHeight: "44px",
                padding: "0 15px",
                color: "#ffffff",
                font: "inherit",
                fontWeight: "800",
                cursor: "pointer",
                background: "#b98822",
                border: 0,
                borderRadius: "13px",
              }}
            >
              🛒 سوق مواد البناء
            </button>

            <button
              type="button"
              onClick={handleBackToHome}
              disabled={signingOut}
              style={{
                minHeight: "44px",
                padding: "0 15px",
                color: "#0b3b32",
                font: "inherit",
                fontWeight: "800",
                cursor: signingOut
                  ? "not-allowed"
                  : "pointer",
                background:
                  "rgba(255,255,255,0.86)",
                border:
                  "1px solid rgba(11,59,50,0.14)",
                borderRadius: "13px",
              }}
            >
              الصفحة الرئيسية
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                minHeight: "44px",
                padding: "0 15px",
                color: "#ffffff",
                font: "inherit",
                fontWeight: "800",
                cursor: signingOut
                  ? "not-allowed"
                  : "pointer",
                background: signingOut
                  ? "#879792"
                  : "#0b3b32",
                border: 0,
                borderRadius: "13px",
              }}
            >
              {signingOut
                ? "جاري الخروج..."
                : "تسجيل الخروج"}
            </button>
          </div>
        </header>

        {errorMessage && (
          <div
            role="alert"
            style={{
              marginBottom: "18px",
              padding: "15px 17px",
              color: "#94283b",
              background: "#fff1f3",
              border: "1px solid #f1bcc6",
              borderRadius: "14px",
              fontWeight: "800",
              lineHeight: "1.7",
            }}
          >
            {errorMessage}
          </div>
        )}

        {!loading && purchases.length > 0 && (
          <section style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "12px", marginBottom: "13px" }}>
              <div><small style={{ color: "#8d620e", fontWeight: "900" }}>متجر المنزل</small><h2 style={{ margin: "4px 0 0" }}>مشترياتي</h2></div>
              <strong>{purchases.length}</strong>
            </div>
            <div style={{ display: "grid", gap: "14px" }}>
              {purchases.map((order) => (
                <article key={order.id} style={{ overflow: "hidden", background: "rgba(255,255,255,.94)", border: "1px solid rgba(11,59,50,.11)", borderRadius: "18px", boxShadow: "0 12px 34px rgba(50,42,27,.07)" }}>
                  <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "14px 16px", background: "#fbfaf7", borderBottom: "1px solid #ece8de" }}><div><strong dir="ltr">{order.orderNumber}</strong><small style={{ display: "block", marginTop: "3px", color: "#74807c" }}>{order.supplierName}</small></div><span style={{ padding: "6px 10px", color: "#875c14", background: "#fff3ce", borderRadius: "999px", fontSize: "13px", fontWeight: "850" }}>{MARKETPLACE_ORDER_STATUSES[order.status] || order.status}</span></header>
                  <div style={{ display: "grid", gap: "8px", padding: "14px 16px" }}>{(order.items || []).map((item) => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) auto", alignItems: "center", gap: "10px" }}><img src={getSupplierProductImageUrl(item.imagePath)} alt="" style={{ width: "52px", height: "52px", objectFit: "cover", borderRadius: "10px" }} /><span><strong style={{ display: "block" }}>{item.productName}</strong><small style={{ color: "#74807c" }}>{formatMarketplaceQuantity(item.quantity)} {getSupplierUnitLabel(item.unitCode)}</small></span><b>{formatMarketplaceMoney(item.lineTotal)}</b></div>)}</div>
                  <footer style={{ display: "flex", justifyContent: "space-between", padding: "13px 16px", borderTop: "1px solid #ece8de" }}><span>الإجمالي</span><strong>{formatMarketplaceMoney(order.subtotal)}</strong></footer>
                </article>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div
            style={{
              padding: "34px",
              background:
                "rgba(255,255,255,0.9)",
              border:
                "1px solid rgba(11,59,50,0.11)",
              borderRadius: "22px",
              boxShadow:
                "0 18px 50px rgba(50,42,27,0.1)",
              textAlign: "center",
              fontWeight: "800",
            }}
          >
            جاري تحميل الحساب...
          </div>
        ) : projects.length === 0 ? (
          purchases.length === 0 ? (
          <div
            style={{
              padding: "38px 24px",
              background:
                "rgba(255,255,255,0.9)",
              border:
                "1px solid rgba(11,59,50,0.11)",
              borderRadius: "22px",
              boxShadow:
                "0 18px 50px rgba(50,42,27,0.1)",
              textAlign: "center",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: "64px",
                height: "64px",
                margin: "0 auto 18px",
                fontSize: "30px",
                background: "#f7f1e5",
                border: "1px solid #e2d2ae",
                borderRadius: "20px",
              }}
            >
              🏗️
            </div>

            <h2
              style={{
                marginTop: 0,
                marginBottom: "10px",
                fontSize: "23px",
              }}
            >
              لا توجد مشاريع ظاهرة حاليًا
            </h2>

            <p
              style={{
                maxWidth: "600px",
                margin: "0 auto",
                color: "#65756f",
                lineHeight: "1.9",
              }}
            >
              تظهر المشاريع تلقائيًا بعد
              قبول الطلب إذا كان البريد
              المستخدم في الحساب مطابقًا
              للبريد المسجل عند تقديم الطلب.
            </p>
          </div>
          ) : null
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
            }}
          >
            {projects.map((project) => (
              <article
                key={project.id}
                style={{
                  padding: "22px",
                  background:
                    "rgba(255,255,255,0.92)",
                  border:
                    "1px solid rgba(11,59,50,0.11)",
                  borderRadius: "20px",
                  boxShadow:
                    "0 15px 40px rgba(50,42,27,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent:
                      "space-between",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        marginBottom: "7px",
                        color: "#718079",
                        fontSize: "14px",
                      }}
                    >
                      رقم الملف
                    </div>

                    <strong
                      dir="ltr"
                      style={{
                        display: "block",
                        color: "#173f36",
                        fontSize: "22px",
                      }}
                    >
                      {project.file_number}
                    </strong>
                  </div>

                  <span
                    style={{
                      padding: "8px 13px",
                      color: "#8d620e",
                      background: "#f5ecda",
                      border: "1px solid #ddc58e",
                      borderRadius: "999px",
                      fontSize: "14px",
                      fontWeight: "900",
                    }}
                  >
                    {getStatusLabel(
                      project.status
                    )}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: "19px",
                    paddingTop: "17px",
                    borderTop:
                      "1px solid rgba(11,59,50,0.09)",
                  }}
                >
                  <div
                    style={{
                      marginBottom: "6px",
                      color: "#718079",
                      fontSize: "14px",
                    }}
                  >
                    المرحلة الحالية
                  </div>

                  <div
                    style={{
                      color: "#173f36",
                      fontWeight: "800",
                    }}
                  >
                    {getStageLabel(
                      project.current_stage
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href =
                      `/customer/project/${project.id}`;
                  }}
                  style={{
                    width: "100%",
                    minHeight: "49px",
                    marginTop: "19px",
                    color: "#ffffff",
                    font: "inherit",
                    fontSize: "16px",
                    fontWeight: "900",
                    cursor: "pointer",
                    background: "#0b3b32",
                    border: 0,
                    borderRadius: "14px",
                    boxShadow:
                      "0 12px 26px rgba(11,59,50,0.18)",
                  }}
                >
                  فتح المشروع
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
