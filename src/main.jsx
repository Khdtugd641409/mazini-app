import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";
import App from "./App.jsx";
import SupervisorApplicationPage from "./pages/SupervisorApplicationPage.jsx";
import SupervisorServicesPage from "./pages/SupervisorServicesPage.jsx";
import AdminSupervisorApplicationsPage from "./pages/admin/AdminSupervisorApplicationsPage.jsx";
import SupplierApplicationPage from "./pages/SupplierApplicationPage.jsx";
import SupplierPortalPage from "./pages/SupplierPortalPage.jsx";
import AdminSupplierApplicationsPage from "./pages/admin/AdminSupplierApplicationsPage.jsx";
import { supabase } from "./lib/supabase.js";
import "./index.css";

const SUPERVISOR_SESSION_KEY = "nm_supervisor_session_started_at";
const SUPPLIER_SESSION_KEY = "nm_supplier_session_started_at";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";

function SupervisorSessionGuard({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function enforceSession(session) {
      if (!session) {
        localStorage.removeItem(SUPERVISOR_SESSION_KEY);
        if (active) setReady(true);
        return;
      }

      const storedStartedAt = Number(
        localStorage.getItem(SUPERVISOR_SESSION_KEY) || 0
      );
      const startedAt = storedStartedAt || Date.now();

      if (!storedStartedAt) {
        localStorage.setItem(SUPERVISOR_SESSION_KEY, String(startedAt));
      }

      if (Date.now() - startedAt >= THIRTY_DAYS_MS) {
        await supabase.auth.signOut();
        localStorage.removeItem(SUPERVISOR_SESSION_KEY);
      }

      if (active) setReady(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      enforceSession(data?.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        const existing = Number(
          localStorage.getItem(SUPERVISOR_SESSION_KEY) || 0
        );
        if (!existing) {
          localStorage.setItem(SUPERVISOR_SESSION_KEY, String(Date.now()));
        }
      }

      if (event === "SIGNED_OUT") {
        localStorage.removeItem(SUPERVISOR_SESSION_KEY);
      }

      enforceSession(session || null);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <main style={{ padding: 24, direction: "rtl" }}>
        جاري التحقق من جلسة المشرف...
      </main>
    );
  }

  return children;
}

function SupplierSessionGuard({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function enforce(session) {
      if (!session) {
        localStorage.removeItem(SUPPLIER_SESSION_KEY);
        if (active) setReady(true);
        return;
      }
      const stored = Number(localStorage.getItem(SUPPLIER_SESSION_KEY) || 0);
      const startedAt = stored || Date.now();
      if (!stored) localStorage.setItem(SUPPLIER_SESSION_KEY, String(startedAt));
      if (Date.now() - startedAt >= THIRTY_DAYS_MS) {
        await supabase.auth.signOut();
        localStorage.removeItem(SUPPLIER_SESSION_KEY);
      }
      if (active) setReady(true);
    }
    supabase.auth.getSession().then(({ data }) => enforce(data?.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && !localStorage.getItem(SUPPLIER_SESSION_KEY)) localStorage.setItem(SUPPLIER_SESSION_KEY, String(Date.now()));
      if (event === "SIGNED_OUT") localStorage.removeItem(SUPPLIER_SESSION_KEY);
      enforce(session || null);
    });
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, []);

  if (!ready) return <main style={{ padding: 24, direction: "rtl" }}>جاري التحقق من جلسة المورد...</main>;
  return children;
}

function FloatingShortcut({ href, children, bottom = 18 }) {
  return (
    <a
      href={href}
      style={{
        position: "fixed",
        left: 18,
        bottom,
        zIndex: 2000,
        background: "#173f36",
        color: "#fff",
        textDecoration: "none",
        padding: "11px 15px",
        borderRadius: 999,
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
        fontWeight: 800,
      }}
    >
      {children}
    </a>
  );
}

function AdminSupervisorDirectory() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let stopped = false;

    function locateTarget() {
      if (stopped) return;
      const section = document.getElementById("admin-supervisors");
      if (section) setTarget((current) => current || section);
    }

    locateTarget();
    const observer = new MutationObserver(locateTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!target) return undefined;
    const hiddenChildren = [];

    Array.from(target.children).forEach((child) => {
      if (child.getAttribute("data-nm-supervisor-directory") === "true") return;
      hiddenChildren.push({ child, display: child.style.display });
      child.style.display = "none";
    });

    return () => {
      hiddenChildren.forEach(({ child, display }) => {
        child.style.display = display;
      });
    };
  }, [target]);

  if (!target) return null;

  const cardStyle = {
    display: "grid",
    gap: 10,
    minHeight: 148,
    padding: 20,
    color: "#173f36",
    textDecoration: "none",
    textAlign: "right",
    background: "linear-gradient(135deg, #fbfaf7, #f3ecdc)",
    border: "1px solid #dfd5bd",
    borderRadius: 18,
    boxShadow: "0 10px 24px rgba(86, 67, 28, 0.07)",
  };

  return createPortal(
    <div data-nm-supervisor-directory="true" style={{ display: "grid", gap: 18 }}>
      <header>
        <h2 style={{ margin: 0, color: "#173f36" }}>مشرفو المشاريع</h2>
        <p style={{ margin: "7px 0 0", color: "#687872" }}>
          سجلات طلبات المشرفين والحسابات المعتمدة.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
        <a href="/admin/supervisor-applications?view=applicants" style={cardStyle}>
          <span style={{ fontSize: 34 }}>📝</span>
          <strong style={{ fontSize: 21 }}>المشرفون المتقدمون</strong>
          <span style={{ color: "#687872", lineHeight: 1.6 }}>
            عرض طلبات التسجيل وسجلات المتقدمين
          </span>
        </a>

        <a href="/admin/supervisor-applications?view=approved" style={cardStyle}>
          <span style={{ fontSize: 34 }}>✅</span>
          <strong style={{ fontSize: 21 }}>المشرفون المعتمدون</strong>
          <span style={{ color: "#687872", lineHeight: 1.6 }}>
            عرض سجلات المشرفين المقبولين في المنصة
          </span>
        </a>
      </div>
    </div>,
    target
  );
}

let rootContent;

if (normalizedPath === "/supplier/application") {
  rootContent = <SupplierApplicationPage />;
} else if (normalizedPath === "/supplier") {
  rootContent = (
    <SupplierSessionGuard>
      <SupplierPortalPage />
    </SupplierSessionGuard>
  );
} else if (normalizedPath === "/admin/supplier-applications") {
  rootContent = <AdminSupplierApplicationsPage />;
} else if (normalizedPath === "/supervisor/application") {
  rootContent = (
    <SupervisorApplicationPage
      onBack={() => {
        window.location.href = "/";
      }}
      onOpenSupervisor={() => {
        window.location.href = "/supervisor";
      }}
    />
  );
} else if (normalizedPath === "/admin/supervisor-applications") {
  rootContent = <AdminSupervisorApplicationsPage />;
} else if (normalizedPath === "/supervisor/services") {
  rootContent = (
    <SupervisorSessionGuard>
      <SupervisorServicesPage />
    </SupervisorSessionGuard>
  );
} else if (
  normalizedPath === "/supervisor" ||
  normalizedPath === "/supervisor/dashboard"
) {
  rootContent = (
    <SupervisorSessionGuard>
      <App />
      <FloatingShortcut href="/supervisor/services">خدماتي</FloatingShortcut>
    </SupervisorSessionGuard>
  );
} else if (normalizedPath === "/admin/dashboard") {
  rootContent = (
    <>
      <App />
      <AdminSupervisorDirectory />
      <FloatingShortcut href="/admin/supplier-applications" bottom={18}>طلبات تسجيل الموردين</FloatingShortcut>
    </>
  );
} else {
  rootContent = <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{rootContent}</React.StrictMode>
);
