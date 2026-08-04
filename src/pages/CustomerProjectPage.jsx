import { useEffect, useState } from "react";

import CustomerFilePage from "./CustomerFilePage.jsx";

import {
  getMyCustomerProjectWorkspace,
} from "../services/customerProjectWorkspaceService.js";

function getProjectIdFromPath() {
  const pathParts =
    window.location.pathname
      .split("/")
      .filter(Boolean);

  if (
    pathParts.length !== 3 ||
    pathParts[0] !== "customer" ||
    pathParts[1] !== "project"
  ) {
    return "";
  }

  return pathParts[2];
}

export default function CustomerProjectPage() {
  const [customerFile, setCustomerFile] =
    useState(null);

  const [timeline, setTimeline] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let pageIsActive = true;

    async function loadProject() {
      try {
        setLoading(true);
        setErrorMessage("");

        const customerFileId =
          getProjectIdFromPath();

        if (!customerFileId) {
          throw new Error(
            "معرّف المشروع غير موجود."
          );
        }

        const result =
          await getMyCustomerProjectWorkspace(
            customerFileId
          );

        if (!pageIsActive) {
          return;
        }

        setCustomerFile(
          result.customerFile
        );

        setTimeline(
          result.timeline
        );
      } catch (error) {
        if (!pageIsActive) {
          return;
        }

        setCustomerFile(null);
        setTimeline([]);

        setErrorMessage(
          error?.message ||
            "تعذر فتح المشروع."
        );
      } finally {
        if (pageIsActive) {
          setLoading(false);
        }
      }
    }

    loadProject();

    return () => {
      pageIsActive = false;
    };
  }, []);

  function handleBackToProjects() {
    window.location.href =
      "/customer/projects";
  }

  function handleBackToLogin() {
    window.location.href =
      "/customer/account-login";
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f5f5f5",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "520px",
            padding: "28px",
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: "14px",
            textAlign: "center",
          }}
        >
          جاري تحميل المشروع...
        </div>
      </main>
    );
  }

  if (
    errorMessage ||
    !customerFile
  ) {
    return (
      <main
        dir="rtl"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f5f5f5",
          boxSizing: "border-box",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "520px",
            padding: "28px",
            background: "#ffffff",
            border:
              "1px solid #fecdd3",
            borderRadius: "14px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              marginTop: 0,
              marginBottom: "12px",
              fontSize: "24px",
            }}
          >
            تعذر فتح المشروع
          </h1>

          <p
            style={{
              color: "#9f1239",
              lineHeight: "1.8",
            }}
          >
            {errorMessage ||
              "المشروع غير موجود أو لا يتبع حسابك."}
          </p>

          <button
            type="button"
            onClick={
              handleBackToProjects
            }
            style={{
              width: "100%",
              minHeight: "46px",
              marginTop: "12px",
              border: 0,
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            العودة إلى مشاريعي
          </button>

          <button
            type="button"
            onClick={
              handleBackToLogin
            }
            style={{
              width: "100%",
              minHeight: "44px",
              marginTop: "10px",
              border:
                "1px solid #d1d5db",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#111827",
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            العودة إلى تسجيل الدخول
          </button>
        </section>
      </main>
    );
  }

  return (
    <CustomerFilePage
      customerFile={customerFile}
      timeline={timeline}
      onBackToHome={
        handleBackToProjects
      }
    />
  );
}
