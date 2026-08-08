import { useState } from "react";
import "./HomePage.css";

function HomePage({
  onOpenCustomerApplication,
  onOpenCustomerServiceApplication,
  onOpenCustomerAccountLogin,
  onOpenCustomerAccess,
  onOpenSupervisor,
  onOpenAdmin,
  isCheckingAdmin = false,
}) {
  const [isLoginMenuOpen, setIsLoginMenuOpen] =
    useState(false);

  const toggleLoginMenu = () => {
    setIsLoginMenuOpen(
      (currentValue) => !currentValue
    );
  };

  const closeLoginMenu = () => {
    setIsLoginMenuOpen(false);
  };

  const handleOpenCustomerApplication = () => {
    closeLoginMenu();

    if (
      typeof onOpenCustomerApplication ===
      "function"
    ) {
      onOpenCustomerApplication();
    }
  };

  const handleOpenCustomerServiceApplication =
    () => {
      closeLoginMenu();

      if (
        typeof onOpenCustomerServiceApplication ===
        "function"
      ) {
        onOpenCustomerServiceApplication();
        return;
      }

      window.alert(
        "صفحة طلب الخدمة غير مرتبطة حتى الآن."
      );
    };

  const handleOpenCustomerAccount = () => {
    closeLoginMenu();

    if (
      typeof onOpenCustomerAccountLogin ===
      "function"
    ) {
      onOpenCustomerAccountLogin();
      return;
    }

    if (
      typeof onOpenCustomerAccess ===
      "function"
    ) {
      onOpenCustomerAccess();
    }
  };

  const handleOpenSupervisor = () => {
    closeLoginMenu();

    if (typeof onOpenSupervisor === "function") {
      onOpenSupervisor();
      return;
    }

    window.alert(
      "تعذر فتح حساب المشرف حاليًا."
    );
  };

  const handleOpenSupervisorApplication = () => {
    closeLoginMenu();
    window.location.href = "/supervisor/application";
  };

  const handleOpenAdmin = () => {
    closeLoginMenu();

    if (typeof onOpenAdmin === "function") {
      onOpenAdmin();
    }
  };

  const handleUnavailableSection = (
    sectionName
  ) => {
    closeLoginMenu();

    window.alert(
      `دخول ${sectionName} سيُفعّل عند اكتمال مرحلته في المنصة.`
    );
  };

  return (
    <main className="home-page">
      <header className="home-header">
        <div className="home-brand">
          <div
            className="home-brand-mark"
            aria-hidden="true"
          >
            NM
          </div>

          <div className="home-brand-text">
            <h1>منصة نايف المزيني</h1>

            <p>
              للبناء الذاتي وإدارة المشاريع
            </p>
          </div>
        </div>

        <div className="login-menu">
          <button
            type="button"
            className="login-menu-button"
            onClick={toggleLoginMenu}
            aria-expanded={isLoginMenuOpen}
            aria-controls="home-login-dropdown"
          >
            <span aria-hidden="true">◉</span>

            <span>
              {isCheckingAdmin
                ? "جاري التحقق..."
                : "دخول"}
            </span>

            <span
              className={`login-menu-arrow ${
                isLoginMenuOpen
                  ? "is-open"
                  : ""
              }`}
              aria-hidden="true"
            >
              ▼
            </span>
          </button>

          {isLoginMenuOpen && (
            <div
              id="home-login-dropdown"
              className="login-dropdown"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={
                  handleOpenCustomerAccount
                }
              >
                <span>حساب العميل</span>

                <span aria-hidden="true">
                  👤
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  handleUnavailableSection(
                    "المستثمر"
                  )
                }
              >
                <span>مستثمر</span>

                <span aria-hidden="true">
                  📈
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleOpenSupervisor}
              >
                <span>دخول المشرف</span>

                <span aria-hidden="true">
                  🏗️
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleOpenSupervisorApplication}
              >
                <span>التسجيل كمشرف</span>

                <span aria-hidden="true">
                  📝
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleOpenAdmin}
                disabled={isCheckingAdmin}
              >
                <span>إدارة منصة</span>

                <span aria-hidden="true">
                  🛡️
                </span>
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="home-hero">
        <div className="hero-content">
          <h2 className="hero-title">
            ابني منزلك
          </h2>

          <p className="hero-description">
            حسب تصميمك واختيارك وإشرافك،
            <strong>
              ثم تقدم للبنك ليشتريه لك
            </strong>
          </p>

          <div className="home-primary-actions">
            <button
              type="button"
              className="application-button"
              onClick={
                handleOpenCustomerApplication
              }
            >
              <span
                className="application-icon"
                aria-hidden="true"
              >
                📝
              </span>

              <span>تقديم الطلب</span>
            </button>

            <button
              type="button"
              className="service-request-button"
              onClick={
                handleOpenCustomerServiceApplication
              }
            >
              <span
                className="service-request-icon"
                aria-hidden="true"
              >
                🏗️
              </span>

              <span>طلب خدمة</span>
            </button>
          </div>

          <p className="service-request-description">
            لديك مشروع قائم وتحتاج إلى مشرف
            أو مورد؟ أنشئ مشروعك واطّلع على
            مقدمي الخدمات المناسبين لمرحلتك.
          </p>
        </div>

        <section
          className="build-animation"
          aria-label="مراحل بناء المنزل"
        >
          <div className="build-stage">
            <div className="build-ground" />

            <div
              className="house-animation"
              aria-hidden="true"
            >
              <div className="house-foundation" />

              <div className="house-columns">
                <span className="house-column" />
                <span className="house-column" />
                <span className="house-column" />
                <span className="house-column" />
              </div>

              <div className="house-walls" />

              <div className="house-roof" />

              <div className="house-finish" />
            </div>
          </div>

          <div
            className="build-progress"
            aria-hidden="true"
          >
            <div className="build-progress-bar" />
          </div>

          <p className="build-caption">
            يتم بناء منزلك أمامك خطوة بخطوة...
          </p>
        </section>
      </section>

      <section
        className="home-features"
        aria-label="مزايا المنصة"
      >
        <article className="feature-card">
          <span
            className="feature-icon"
            aria-hidden="true"
          >
            🛡️
          </span>

          <h2>إشراف احترافي</h2>

          <p>
            متابعة مراحل المشروع وتوثيق
            التقدم حتى اكتمال المنزل.
          </p>
        </article>

        <article className="feature-card">
          <span
            className="feature-icon"
            aria-hidden="true"
          >
            ✍️
          </span>

          <h2>تصميم حسب رغبتك</h2>

          <p>
            تختار التصميم والمقاول والمواد
            بما يناسب احتياجاتك.
          </p>
        </article>

        <article className="feature-card">
          <span
            className="feature-icon"
            aria-hidden="true"
          >
            🏦
          </span>

          <h2>تمويل بنكي</h2>

          <p>
            بعد اكتمال المرحلة المناسبة،
            يتقدم العميل للبنك لشراء العقار.
          </p>
        </article>

        <article className="feature-card">
          <span
            className="feature-icon"
            aria-hidden="true"
          >
            🤝
          </span>

          <h2>وضوح وشفافية</h2>

          <p>
            عرض التكاليف والدفعة والحالة
            والمرحلة الحالية داخل ملف العميل.
          </p>
        </article>
      </section>
    </main>
  );
}

export default HomePage;
