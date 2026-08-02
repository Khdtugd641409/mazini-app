import { useEffect, useState } from "react";

import HomePage from "./pages/HomePage.jsx";
import CustomerApplicationPage from "./pages/CustomerApplicationPage.jsx";
import CustomerAccessPage from "./pages/CustomerAccessPage.jsx";
import CustomerFilePage from "./pages/CustomerFilePage.jsx";

import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminCustomerFilesPage from "./pages/admin/AdminCustomerFilesPage.jsx";
import AdminCustomerWorkspace from "./pages/admin/AdminCustomerWorkspace.jsx";

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
  searchAdminCustomerFiles,
} from "./services/adminCustomerFileService.js";

import {
  getCustomerFileByAccess,
} from "./services/customerAccessService.js";

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

function App() {
  const [currentPage, setCurrentPage] =
    useState("home");

  const [currentAdmin, setCurrentAdmin] =
    useState(null);

  const [isCheckingAdmin, setIsCheckingAdmin] =
    useState(true);

  const [
    isAdminSigningIn,
    setIsAdminSigningIn,
  ] = useState(false);

  const [
    adminLoginError,
    setAdminLoginError,
  ] = useState("");

  const [dashboardData, setDashboardData] =
    useState({
      pendingActions: [],
      sectionCounts: {},
    });

  const [
    isDashboardLoading,
    setIsDashboardLoading,
  ] = useState(false);

  const [
    dashboardError,
    setDashboardError,
  ] = useState("");

  const [customerFiles, setCustomerFiles] =
    useState([]);

  const [
    customerFilters,
    setCustomerFilters,
  ] = useState(INITIAL_CUSTOMER_FILTERS);

  const [
    customerPagination,
    setCustomerPagination,
  ] = useState(INITIAL_PAGINATION);

  const [
    isCustomerFilesLoading,
    setIsCustomerFilesLoading,
  ] = useState(false);

  const [
    customerFilesError,
    setCustomerFilesError,
  ] = useState("");

  const [
    selectedCustomerFileId,
    setSelectedCustomerFileId,
  ] = useState(null);

  const [
    selectedCustomerFile,
    setSelectedCustomerFile,
  ] = useState(null);

  const [
    selectedCustomerFileNotes,
    setSelectedCustomerFileNotes,
  ] = useState([]);

  const [
    isCustomerWorkspaceLoading,
    setIsCustomerWorkspaceLoading,
  ] = useState(false);

  const [
    customerWorkspaceError,
    setCustomerWorkspaceError,
  ] = useState("");

  const [
    isSubmittingDecision,
    setIsSubmittingDecision,
  ] = useState(false);

  const [
    customerDecisionError,
    setCustomerDecisionError,
  ] = useState("");

  const [
    accessedCustomerFile,
    setAccessedCustomerFile,
  ] = useState(null);

  const [
    isCustomerAccessLoading,
    setIsCustomerAccessLoading,
  ] = useState(false);

  const [
    customerAccessError,
    setCustomerAccessError,
  ] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function restoreAdminSession() {
      try {
        const admin = await getCurrentAdmin();

        if (isMounted) {
          setCurrentAdmin(admin);
        }
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
      const result =
        await searchAdminCustomerFiles({
          search,
          status,
          sort,
          page,
          pageSize,
        });

      setCustomerFiles(result.files);
      setCustomerPagination(result.pagination);

      setCustomerFilters({
        search,
        status,
        sort,
      });
    } catch (error) {
      console.error(
        "تعذر تحميل ملفات العملاء:",
        error
      );

      setCustomerFiles([]);

      setCustomerFilesError(
        error?.message ||
          "تعذر تحميل ملفات العملاء."
      );
    } finally {
      setIsCustomerFilesLoading(false);
    }
  };

  const loadCustomerWorkspace = async (
    customerFileId
  ) => {
    if (!customerFileId) {
      setCustomerWorkspaceError(
        "معرّف ملف العميل غير موجود."
      );

      return;
    }

    setIsCustomerWorkspaceLoading(true);
    setCustomerWorkspaceError("");
    setCustomerDecisionError("");

    try {
      const [customerFile, notes] =
        await Promise.all([
          getAdminCustomerFile(customerFileId),
          listAdminCustomerFileNotes(
            customerFileId
          ),
        ]);

      setSelectedCustomerFile(customerFile);
      setSelectedCustomerFileNotes(notes);
    } catch (error) {
      console.error(
        "تعذر تحميل مساحة عمل العميل:",
        error
      );

      setSelectedCustomerFile(null);
      setSelectedCustomerFileNotes([]);

      setCustomerWorkspaceError(
        error?.message ||
          "تعذر تحميل ملف العميل."
      );
    } finally {
      setIsCustomerWorkspaceLoading(false);
    }
  };

  const openHomePage = () => {
    setCurrentPage("home");
    setAdminLoginError("");
    setCustomerAccessError("");
    setAccessedCustomerFile(null);
  };

  const openCustomerApplication = () => {
    setCurrentPage("customer-application");
  };

  const openCustomerAccess = () => {
    setCustomerAccessError("");
    setAccessedCustomerFile(null);
    setCurrentPage("customer-access");
  };

  const handleCustomerAccess = async ({
    fileNumber,
    mobileNumber,
  }) => {
    if (isCustomerAccessLoading) {
      return;
    }

    setIsCustomerAccessLoading(true);
    setCustomerAccessError("");

    try {
      const customerFile =
        await getCustomerFileByAccess({
          fileNumber,
          mobileNumber,
        });

      setAccessedCustomerFile(customerFile);
      setCurrentPage("customer-file");
    } catch (error) {
      console.error(
        "تعذر فتح ملف العميل:",
        error
      );

      setCustomerAccessError(
        error?.message ||
          "تعذر فتح ملف العميل."
      );
    } finally {
      setIsCustomerAccessLoading(false);
    }
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
      setCustomerFilters(
        INITIAL_CUSTOMER_FILTERS
      );
      setCustomerPagination(
        INITIAL_PAGINATION
      );

      setSelectedCustomerFileId(null);
      setSelectedCustomerFile(null);
      setSelectedCustomerFileNotes([]);

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

    const initialFilters =
      INITIAL_CUSTOMER_FILTERS;

    setCurrentPage("admin-customer-files");

    await loadCustomerFiles({
      ...initialFilters,
      page: 1,
      pageSize: 25,
    });
  };

  const handleCustomerSearch = async (
    search
  ) => {
    await loadCustomerFiles({
      search,
      status: customerFilters.status,
      sort: customerFilters.sort,
      page: 1,
    });
  };

  const handleCustomerStatusChange =
    async (status) => {
      await loadCustomerFiles({
        search: customerFilters.search,
        status,
        sort: customerFilters.sort,
        page: 1,
      });
    };

  const handleCustomerSortChange =
    async (sort) => {
      await loadCustomerFiles({
        search: customerFilters.search,
        status: customerFilters.status,
        sort,
        page: 1,
      });
    };

  const handleCustomerPreviousPage =
    async () => {
      if (
        !customerPagination.hasPreviousPage ||
        isCustomerFilesLoading
      ) {
        return;
      }

      await loadCustomerFiles({
        page: customerPagination.page - 1,
      });
    };

  const handleCustomerNextPage =
    async () => {
      if (
        !customerPagination.hasNextPage ||
        isCustomerFilesLoading
      ) {
        return;
      }

      await loadCustomerFiles({
        page: customerPagination.page + 1,
      });
    };

  const handleOpenAdminAction = async (
    actionType
  ) => {
    if (
      actionType ===
      "new_customer_application"
    ) {
      setCurrentPage("admin-customer-files");

      await loadCustomerFiles({
        search: "",
        status: "under_review",
        sort: "newest",
        page: 1,
        pageSize: 25,
      });

      return;
    }

    if (
      actionType ===
      "customer_needs_completion"
    ) {
      setCurrentPage("admin-customer-files");

      await loadCustomerFiles({
        search: "",
        status: "needs_completion",
        sort: "newest",
        page: 1,
        pageSize: 25,
      });

      return;
    }

    window.alert(
      "هذا القسم سيُربط عند إنشاء مرحلته."
    );
  };

  const handleOpenAdminSection = async (
    sectionKey
  ) => {
    if (sectionKey === "customers") {
      await openAdminCustomers();
      return;
    }

    window.alert(
      "هذا القسم سيُنشأ في مرحلته المخصصة."
    );
  };

  const handleOpenCustomerFile = async (
    customerFileId
  ) => {
    if (!currentAdmin) {
      setCurrentPage("admin-login");
      return;
    }

    setSelectedCustomerFileId(customerFileId);
    setSelectedCustomerFile(null);
    setSelectedCustomerFileNotes([]);
    setCustomerWorkspaceError("");
    setCustomerDecisionError("");

    setCurrentPage(
      "admin-customer-workspace"
    );

    await loadCustomerWorkspace(
      customerFileId
    );
  };

  const handleRefreshCustomerWorkspace =
    async () => {
      if (!selectedCustomerFileId) {
        return;
      }

      await loadCustomerWorkspace(
        selectedCustomerFileId
      );
    };

  const handleBackToCustomerFiles =
    async () => {
      setCurrentPage("admin-customer-files");

      setSelectedCustomerFileId(null);
      setSelectedCustomerFile(null);
      setSelectedCustomerFileNotes([]);
      setCustomerWorkspaceError("");
      setCustomerDecisionError("");

      await loadCustomerFiles();
    };

  const handleCustomerDecision = async ({
    customerFileId,
    decision,
    note,
  }) => {
    if (isSubmittingDecision) {
      return;
    }

    setIsSubmittingDecision(true);
    setCustomerDecisionError("");

    try {
      await decideCustomerApplication({
        customerFileId,
        decision,
        note,
      });

      await Promise.all([
        loadCustomerWorkspace(customerFileId),
        loadCustomerFiles(),
        loadAdminDashboard(),
      ]);
    } catch (error) {
      console.error(
        "تعذر تنفيذ قرار العميل:",
        error
      );

      setCustomerDecisionError(
        error?.message ||
          "تعذر تنفيذ قرار الإدارة."
      );

      throw error;
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  if (
    currentPage === "customer-application"
  ) {
    return (
      <CustomerApplicationPage
        onBack={openHomePage}
      />
    );
  }

  if (currentPage === "customer-access") {
    return (
      <CustomerAccessPage
        onSubmit={handleCustomerAccess}
        isSubmitting={
          isCustomerAccessLoading
        }
        errorMessage={customerAccessError}
        onBackToHome={openHomePage}
      />
    );
  }

  if (
    currentPage === "customer-file" &&
    accessedCustomerFile
  ) {
    return (
      <CustomerFilePage
        customerFile={accessedCustomerFile}
        onBackToHome={openHomePage}
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
        adminProfile={
          currentAdmin.adminProfile
        }
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

  if (
    currentPage === "admin-customer-files"
  ) {
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
        isLoading={
          isCustomerFilesLoading
        }
        errorMessage={customerFilesError}
        onSearch={handleCustomerSearch}
        onStatusChange={
          handleCustomerStatusChange
        }
        onSortChange={
          handleCustomerSortChange
        }
        onPreviousPage={
          handleCustomerPreviousPage
        }
        onNextPage={
          handleCustomerNextPage
        }
        onOpenCustomerFile={
          handleOpenCustomerFile
        }
        onBackToHome={openAdminDashboard}
      />
    );
  }

  if (
    currentPage ===
    "admin-customer-workspace"
  ) {
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
        isLoading={
          isCustomerWorkspaceLoading
        }
        errorMessage={
          customerWorkspaceError
        }
        isSubmittingDecision={
          isSubmittingDecision
        }
        decisionError={
          customerDecisionError
        }
        onBack={handleBackToCustomerFiles}
        onRefresh={
          handleRefreshCustomerWorkspace
        }
        onDecision={
          handleCustomerDecision
        }
      />
    );
  }

  return (
    <HomePage
      onOpenCustomerApplication={
        openCustomerApplication
      }
      onOpenCustomerAccess={
        openCustomerAccess
      }
      onOpenAdmin={openAdminEntry}
      isCheckingAdmin={isCheckingAdmin}
    />
  );
}

export default App;
