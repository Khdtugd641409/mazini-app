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
  const [loading, setLoading] =
    useState(false);
  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");
  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function handleSendCode(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result =
        await sendCustomerLoginCode(
          email
        );

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

    if (loading) return;

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
    if (loading) return;

    setStep("email");
    setOtp("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleBackToHome() {
    if (loading) return;

    window.location.href = "/";
  }

  return (
    <main className="customer-login-page">
      <div className="customer-login-shell">
        <header className="customer-login-header">
          <button
            type="button"
            className="customer-login-back-button"
            onClick={handleBackToHome}
            disabled={loading}
          >
            العودة إلى الصفحة الرئيسية
          </button>

          <div className="customer-login-brand">
            <span aria-hidden="true">
              NM
            </span>

            <div>
              <p>منصة نايف المزيني</p>
              <strong>
                للبناء الذاتي
              </strong>
            </div>
          </div>
        </header>

        <section className="customer-login-card">
          <div className="customer-login-icon">
            {step === "email"
              ? "✉️"
              : "🔐"}
          </div>

          <p className="customer-login-eyebrow">
            حساب العميل
          </p>

          <h1>
            {step === "email"
              ? "تسجيل الدخول"
              : "تأكيد رمز الدخول"}
          </h1>

          <p className="customer-login-description">
            {step === "email"
              ? "أدخل بريدك الإلكتروني لفتح حسابك ومتابعة جميع مشاريعك."
              : "أدخل الرمز المكوّن من 8 أرقام الذي أرسلناه إلى بريدك."}
          </p>

          {errorMessage && (
            <div
              className="customer-login-alert is-error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="customer-login-alert is-success">
              {successMessage}
            </div>
          )}

          {step === "email" ? (
            <form
              className="customer-login-form"
              onSubmit={handleSendCode}
            >
              <div className="customer-login-field">
                <label htmlFor="customer-email">
                  البريد الإلكتروني
                </label>

                <input
                  id="customer-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
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

                <p>
                  استخدم البريد المسجل عند
                  تقديم طلب البناء.
                </p>
              </div>

              <button
                type="submit"
                className="customer-login-primary-button"
                disabled={loading}
              >
                {loading
                  ? "جاري الإرسال..."
                  : "إرسال رمز الدخول"}
              </button>
            </form>
          ) : (
            <form
              className="customer-login-form"
              onSubmit={handleVerifyCode}
            >
              <div className="customer-login-email-summary">
                <span>
                  تم إرسال الرمز إلى
                </span>

                <strong dir="ltr">
                  {email}
                </strong>
              </div>

              <div className="customer-login-field">
                <label htmlFor="customer-otp">
                  رمز الدخول
                </label>

                <input
                  id="customer-otp"
                  className="customer-login-otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
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

              <button
                type="submit"
                className="customer-login-primary-button"
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
                className="customer-login-secondary-button"
                onClick={handleChangeEmail}
                disabled={loading}
              >
                تغيير البريد الإلكتروني
              </button>
            </form>
          )}

          <div className="customer-login-security-note">
            <span aria-hidden="true">
              🛡️
            </span>

            <p>
              لن نطلب منك كلمة مرور. رمز
              الدخول مؤقت ويُستخدم مرة واحدة
              فقط.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
