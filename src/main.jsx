import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import SupervisorApplicationPage from "./pages/SupervisorApplicationPage.jsx";
import SupervisorServicesPage from "./pages/SupervisorServicesPage.jsx";
import AdminSupervisorApplicationsPage from "./pages/admin/AdminSupervisorApplicationsPage.jsx";
import SupplierApplicationPage from "./pages/SupplierApplicationPage.jsx";
import SupplierPortalPage from "./pages/SupplierPortalPage.jsx";
import AdminSupplierApplicationsPage from "./pages/admin/AdminSupplierApplicationsPage.jsx";
import AdminPartnersDirectory from "./components/AdminPartnersDirectory.jsx";
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

      const storedStartedAt = Number(localStorage.getItem(SUPERVISOR_SESSION_KEY) || 0);
      const startedAt = storedStartedAt || Date.now();
      if (!storedStartedAt) localStorage.setItem(SUPERVISOR_SESSION_KEY, String(startedAt));

      if (Date.now() - startedAt >= THIRTY_DAYS_MS) {
        await supabase.auth.signOut();
        localStorage.removeItem(SUPERVISOR_SESSION_KEY);
      }

      if (active) setReady(true);
    }

    supabase.auth.getSession().then(({ data }) => enforceSession(data?.session || null));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && !localStorage.getItem(SUPERVISOR_SESSION_KEY)) {
        localStorage.setItem(SUPERVISOR_SESSION_KEY, String(Date.now()));
      }
      if (event === "SIGNED_OUT") localStorage.removeItem(SUPERVISOR_SESSION_KEY);
      enforceSession(session || null);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  if (!ready) return <main style={{ padding: 24, direction: "rtl" }}>جاري التحقق من جلسة المشرف...</main>;
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
      if (event === "SIGNED_IN" && !localStorage.getItem(SUPPLIER_SESSION_KEY)) {
        localStorage.setItem(SUPPLIER_SESSION_KEY, String(Date.now()));
      }
      if (event === "SIGNED_OUT") localStorage.removeItem(SUPPLIER_SESSION_KEY);
      enforce(session || null);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
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
      onBack={() => { window.location.href = "/"; }}
      onOpenSupervisor={() => { window.location.href = "/supervisor"; }}
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
} else if (normalizedPath === "/supervisor" || normalizedPath === "/supervisor/dashboard") {
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
      <AdminPartnersDirectory />
    </>
  );
} else {
  rootContent = <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{rootContent}</React.StrictMode>
);
