import { useState } from "react";

import {
  sendCustomerLoginCode,
  verifyCustomerLoginCode,
} from "../services/customerAccountAuthService.js";

import "./CustomerAccountLoginPage.css";

export default function CustomerAccountLoginPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function handleSendCode(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result =
        await sendCustomerLoginCode(email);

      setEmail(result.email);
      setStep("otp");

      setSuccessMessage(
        "تم إرسال رمز الدخول إلى بريدك الإلكتروني."
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "تعذر إرسال رمز الدخول."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await verifyCustomerLoginCode(
        email,
        otp
      );

      setSuccessMessage(
        "تم تسجيل الدخول بنجاح."
      );

      window.location.href =
        "/customer/projects";
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "تعذر التحقق من رمز الدخول."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChangeEmail() {
    if (loading) {
      return;
    }

    setStep("email");
    setOtp("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleBackToHome() {
    if (loading) {
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="customer-account-login-page">
      <div className="customer-account-login-shell">
        <header className="customer-account-login-header">
          <button
            type="button"
            className="customer-account-login-back"
            onClick={handleBackToHome}
            disabled={loading}
          >
            العودة إلى الصفحة الرئيسية
          </button>

          <div className="customer-account-login-title">
            <h1>حساب العميل</h1>

            <p>
              الدخول إلى جميع مشاريعك من
              حساب واحد.
            </p>
          </div>
        </header>

        <section className="customer-account-card">
          <div className="customer-account-brand">
            <div
              className="customer-account-brand-mark"
              aria-hidden="true"
            >
              NM
            </div>

            <h1>منصة نايف المزيني</h1>

            <p>
              للبناء الذاتي وإدارة المشاريع
            </p>
          </div>

          <h2>
            {step === "email"
              ? "تسجيل الدخول"
              : "تأكيد رمز الدخول"}
          </h2>

          <p>
            {step === "email"
              ? "أدخل البريد الإلكتروني المسجل عند تقديم الطلب."
              : "أدخل الرمز المكوّن من 8 أرقام الذي أرسلناه إلى بريدك."}
          </p>

          {errorMessage && (
            <div
              className="customer-account-alert error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="customer-account-alert success">
              {successMessage}
            </div>
          )}

          {step === "email" ? (
            <form
              className="customer-account-form"
              onSubmit={handleSendCode}
            >
              <div className="customer-account-field">
                <label htmlFor="customer-email">
                  البريد الإلكتروني
                </label>

                <input
                  id="customer-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  disabled={loading}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <button
                type="submit"
                className="customer-account-submit"
                disabled={loading}
              >
                {loading
                  ? "جاري الإرسال..."
                  : "إرسال رمز الدخول"}
              </button>
            </form>
          ) : (
            <form
              className="customer-account-form"
              onSubmit={handleVerifyCode}
            >
              <p className="customer-account-email-preview">
                تم إرسال الرمز إلى:

                <strong>
                  {email}
                </strong>
              </p>

              <div className="customer-account-field">
                <label htmlFor="customer-otp">
                  رمز الدخول
                </label>

                <input
                  id="customer-otp"
                  className="customer-account-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) => {
                    const value =
                      event.target.value
                        .replace(
                          /[^\d٠-٩۰-۹]/g,
                          ""
                        )
                        .slice(0, 8);

                    setOtp(value);
                  }}
                  disabled={loading}
                  placeholder="00000000"
                  required
                  maxLength={8}
                />
              </div>

              <div className="customer-account-actions">
                <button
                  type="submit"
                  className="customer-account-submit"
                  disabled={
                    loading ||
                    otp.length !== 8
                  }
                >
                  {loading
                    ? "جاري التحقق..."
                    : "تسجيل الدخول"}
                </button>

                <button
                  type="button"
                  className="customer-account-secondary"
                  onClick={handleChangeEmail}
                  disabled={loading}
                >
                  تغيير البريد الإلكتروني
                </button>
              </div>
            </form>
          )}

          <div className="customer-account-tip">
            <h3>دخول آمن بدون كلمة مرور</h3>

            <p>
              رمز الدخول مؤقت ويُستخدم مرة
              واحدة فقط، وتبقى جلسة الحساب
              محفوظة على جهازك حتى تسجيل
              الخروج.
            </p>
          </div>

          <div className="customer-account-note">
            <h4>مهم</h4>

            <p>
              استخدم البريد الإلكتروني نفسه
              الذي سجلته عند تقديم طلب البناء،
              حتى تظهر مشاريعك تلقائيًا داخل
              الحساب.
            </p>
          </div>
        </section>

        <footer className="customer-account-footer">
          نايف المزيني للبناء الذاتي
        </footer>
      </div>
    </main>
  );
}
