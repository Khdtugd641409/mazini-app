import { useEffect, useState } from "react";

import HomePage from "./pages/HomePage.jsx";
import CustomerApplicationPage from "./pages/CustomerApplicationPage.jsx";

import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminCustomerFilesPage from "./pages/admin/AdminCustomerFilesPage.jsx";

import {
  getCurrentAdmin,
  signInAdmin,
  signOutAdmin,
} from "./services/adminAuthService.js";

import {
  getAdminDashboard,
  listAdminCustomerFiles,
} from "./services/adminCustomerFileService.js";

function App() {
  const [currentPage, setCurrentPage] = useState("home");

  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [isCheckingAdmin, setIsCheckingAdmin] =
    useState(true);

  const [isAdminSigningIn, setIsAdminSigningIn] =
    useState(false);

  const [adminLoginError, setAdminLoginError] =
    useState("");

  const [dashboardData, setDashboardData] = useState({
    pendingActions: [],
    sectionCounts: {},
  });

  const [isDashboardLoading, setIsDashboardLoading] =
    useState(false);

  const [dashboardError, setDashboardError] =
    useState("");

  const [customerFiles, setCustomerFiles] = useState([]);
  const [isCustomerFilesLoading, setIsCustomerFilesLoading] =
    useState(false);

  const [customerFilesError, setCustomerFilesError] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    async function restoreAdminSession() {
      try {
        const admin = await getCurrentAdmin();

        if (!isMounted) {
          return;
        }

        setCurrentAdmin(admin);
      } catch (error) {
        console.error(
          "تعذر استعادة جلسة الإدارة:",
          error
        );

        if (isMounted) {
          setCurrentAdmin(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAdmin(false);
        }
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
      const data = await getAdminDashboard();

      setDashboardData(data);
    } catch (error) {
      console.error(
        "تعذر تحميل لوحة الإدارة:",
        error
      );

      setDashboardError(
        error?.message ||
          "تعذر تحميل بيانات لوحة الإدارة."
      );
    } finally {
      setIsDashboardLoading(false);
    }
  };

  const loadCustomerFiles = async () => {
    setIsCustomerFilesLoading(true);
    setCustomerFilesError("");

    try {
      const files = await listAdminCustomerFiles();

      setCustomerFiles(files);
    } catch (error) {
      console.error(
        "تعذر تحميل ملفات العملاء:",
        error
      );

      setCustomerFilesError(
        error?.message ||
          "تعذر تحميل ملفات العملاء."
      );
    } finally {
      setIsCustomerFilesLoading(false);
    }
  };

  const openHomePage = () => {
    setCurrentPage("home");
    setAdminLoginError("");
  };

  const openCustomerApplication = () => {
    setCurrentPage("customer-application");
  };

  const openAdminEntry = async () => {
    setAdminLoginError("");

    if (isCheckingAdmin) {
      return;
    }

    if (currentAdmin) {
      setCurrentPage("admin-dashboard");
      await loadAdminDashboard();
      return;
    }

    setCurrentPage("admin-login");
  };

  const handleAdminSignIn = async ({
    email,
    password,
  }) => {
    if (isAdminSigningIn) {
      return;
    }

    setIsAdminSigningIn(true);
    setAdminLoginError("");

    try {
      const admin = await signInAdmin({
        email,
        password,
      });

      setCurrentAdmin(admin);
      setCurrentPage("admin-dashboard");

      await loadAdminDashboard();
    } catch (error) {
      console.error(
        "تعذر تسجيل دخول الإدارة:",
        error
      );

      setAdminLoginError(
        error?.message ||
          "تعذر تسجيل الدخول إلى إدارة المنصة."
      );
    } finally {
      setIsAdminSigningIn(false);
    }
  };

  const handleAdminSignOut = async () => {
    try {
      await signOutAdmin();
    } catch (error) {
      console.error(
        "تعذر تسجيل خروج الإدارة:",
        error
      );
    } finally {
      setCurrentAdmin(null);
      setDashboardData({
        pendingActions: [],
        sectionCounts: {},
      });
      setCustomerFiles([]);
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
    await loadCustomerFiles();
  };

  const handleOpenAdminAction = async (actionType) => {
    const customerActions = [
      "new_customer_application",
      "customer_needs_completion",
      "land_review",
      "land_transfer",
    ];

    if (customerActions.includes(actionType)) {
      await openAdminCustomers();
      return;
    }

    window.alert(
      "هذا القسم سيُربط عند إنشاء مرحلته في المنصة."
    );
  };

  const handleOpenAdminSection = async (sectionKey) => {
    if (sectionKey === "customers") {
      await openAdminCustomers();
      return;
    }

    window.alert(
      "هذا القسم سيُنشأ في مرحلته المخصصة."
    );
  };

  const handleOpenCustomerFile = (customerFileId) => {
    window.alert(
      `سيتم فتح ملف العميل الإداري في الخطوة التالية.\nمعرّف الملف: ${customerFileId}`
    );
  };

  if (currentPage === "customer-application") {
    return (
      <CustomerApplicationPage
        onBack={openHomePage}
      />
    );
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
        pendingActions={
          dashboardData.pendingActions
        }
        sectionCounts={
          dashboardData.sectionCounts
        }
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
        isLoading={isCustomerFilesLoading}
        errorMessage={customerFilesError}
        onOpenCustomerFile={
          handleOpenCustomerFile
        }
        onBackToHome={openAdminDashboard}
      />
    );
  }

  return (
    <HomePage
      onOpenCustomerApplication={
        openCustomerApplication
      }
      onOpenAdmin={openAdminEntry}
      isCheckingAdmin={isCheckingAdmin}
    />
  );
}

export default App;
