import { useState } from "react";

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    direction: "rtl",
    color: "#173f36",
    background:
      "radial-gradient(circle at top right, rgba(205, 166, 77, 0.18), transparent 34%), #f7f5ef",
  },

  container: {
    width: "min(100%, 520px)",
  },

  brand: {
    marginBottom: "18px",
    textAlign: "center",
  },

  brandMark: {
    display: "grid",
    placeItems: "center",
    width: "68px",
    height: "68px",
    margin: "0 auto 14px",
    color: "#d7b45c",
    fontSize: "22px",
    fontWeight: 950,
    background: "#0b3b32",
    border: "4px solid #ffffff",
    borderRadius: "20px",
    outline: "2px solid #cda64d",
    boxShadow: "0 14px 30px rgba(11, 59, 50, 0.2)",
  },

  platformName: {
    margin: 0,
    color: "#0b3b32",
    fontSize: "17px",
    fontWeight: 900,
  },

  card: {
    padding: "clamp(22px, 5vw, 36px)",
    background: "rgba(255, 255, 255, 0.96)",
    border: "1px solid rgba(11, 59, 50, 0.1)",
    borderRadius: "26px",
    boxShadow: "0 24px 70px rgba(40, 48, 42, 0.13)",
  },

  securityBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "36px",
    padding: "7px 13px",
    color: "#8c6518",
    fontSize: "14px",
    fontWeight: 900,
    background: "#f7efd9",
    border: "1px solid #e3d1a8",
    borderRadius: "999px",
  },

  title: {
    margin: "18px 0 10px",
    color: "#0b3b32",
    fontSize: "clamp(29px, 6vw, 42px)",
    lineHeight: 1.25,
  },

  description: {
    margin: "0 0 26px",
    color: "#65766f",
    lineHeight: 1.8,
  },

  form: {
    display: "grid",
    gap: "15px",
  },

  label: {
    color: "#173f36",
    fontWeight: 900,
  },

  input: {
    width: "100%",
    minHeight: "54px",
    boxSizing: "border-box",
    padding: "12px 15px",
    color: "#173f36",
    font: "inherit",
    background: "#fbfaf7",
    border: "1px solid #d6ddd8",
    borderRadius: "14px",
    outline: "none",
  },

  passwordField: {
    position: "relative",
  },

  passwordInput: {
    width: "100%",
    minHeight: "54px",
    boxSizing: "border-box",
    padding: "12px 15px 12px 100px",
    color: "#173f36",
    font: "inherit",
    background: "#fbfaf7",
    border: "1px solid #d6ddd8",
    borderRadius: "14px",
    outline: "none",
  },

  passwordToggle: {
    position: "absolute",
    top: "50%",
    left: "10px",
    minHeight: "36px",
    padding: "7px 11px",
    color: "#315048",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 850,
    cursor: "pointer",
    background: "#eee9dc",
    border: "1px solid #ddd0b4",
    borderRadius: "10px",
    transform: "translateY(-50%)",
  },

  error: {
    margin: 0,
    padding: "13px 15px",
    color: "#8b2020",
    lineHeight: 1.65,
    background: "#fff1f1",
    border: "1px solid #e8bcbc",
    borderRadius: "13px",
  },

  submitButton: {
    minHeight: "56px",
    marginTop: "4px",
    padding: "12px 20px",
    color: "#ffffff",
    font: "inherit",
    fontSize: "18px",
    fontWeight: 950,
    cursor: "pointer",
    background: "#0b3b32",
    border: 0,
    borderRadius: "15px",
    boxShadow: "0 12px 26px rgba(11, 59, 50, 0.2)",
  },

  backButton: {
    width: "100%",
    minHeight: "49px",
    marginTop: "13px",
    padding: "11px 18px",
    color: "#173f36",
    font: "inherit",
    fontWeight: 850,
    cursor: "pointer",
    background: "transparent",
    border: "1px solid #d7ddd9",
    borderRadius: "14px",
  },

  footerNote: {
    margin: "20px 0 0",
    color: "#7b8984",
    fontSize: "13px",
    lineHeight: 1.7,
    textAlign: "center",
  },
};

function AdminLoginPage({
  onSubmit,
  isSubmitting = false,
  errorMessage = "",
  onBackToHome,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [
    isPasswordVisible,
    setIsPasswordVisible,
  ] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      isSubmitting ||
      typeof onSubmit !== "function"
    ) {
      return;
    }

    onSubmit({
      email: email.trim(),
      password,
    });
  };

  const handleBack = () => {
    if (
      isSubmitting ||
      typeof onBackToHome !== "function"
    ) {
      return;
    }

    onBackToHome();
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.brand}>
          <div
            style={styles.brandMark}
            aria-hidden="true"
          >
            NM
          </div>

          <p style={styles.platformName}>
            منصة نايف المزيني للبناء الذاتي
          </p>
        </header>

        <section style={styles.card}>
          <span style={styles.securityBadge}>
            <span aria-hidden="true">🛡️</span>
            دخول إداري آمن
          </span>

          <h1 style={styles.title}>
            دخول إدارة المنصة
          </h1>

          <p style={styles.description}>
            هذه الصفحة مخصصة للحسابات الإدارية
            المصرح لها فقط.
          </p>

          <form
            style={styles.form}
            onSubmit={handleSubmit}
          >
            <label
              htmlFor="adminEmail"
              style={styles.label}
            >
              البريد الإلكتروني
            </label>

            <input
              id="adminEmail"
              name="adminEmail"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              inputMode="email"
              placeholder="admin@example.com"
              required
              disabled={isSubmitting}
              style={{
                ...styles.input,
                opacity: isSubmitting
                  ? 0.65
                  : 1,
              }}
            />

            <label
              htmlFor="adminPassword"
              style={styles.label}
            >
              كلمة المرور
            </label>

            <div style={styles.passwordField}>
              <input
                id="adminPassword"
                name="adminPassword"
                type={
                  isPasswordVisible
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                style={{
                  ...styles.passwordInput,
                  opacity: isSubmitting
                    ? 0.65
                    : 1,
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setIsPasswordVisible(
                    (currentValue) =>
                      !currentValue
                  )
                }
                disabled={isSubmitting}
                style={{
                  ...styles.passwordToggle,
                  opacity: isSubmitting
                    ? 0.5
                    : 1,
                }}
                aria-label={
                  isPasswordVisible
                    ? "إخفاء كلمة المرور"
                    : "إظهار كلمة المرور"
                }
              >
                {isPasswordVisible
                  ? "إخفاء"
                  : "إظهار"}
              </button>
            </div>

            {errorMessage && (
              <p
                role="alert"
                style={styles.error}
              >
                <strong>{errorMessage}</strong>
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...styles.submitButton,
                cursor: isSubmitting
                  ? "wait"
                  : "pointer",
                opacity: isSubmitting
                  ? 0.65
                  : 1,
              }}
            >
              {isSubmitting
                ? "جاري تسجيل الدخول..."
                : "تسجيل الدخول"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleBack}
            disabled={isSubmitting}
            style={{
              ...styles.backButton,
              cursor: isSubmitting
                ? "not-allowed"
                : "pointer",
              opacity: isSubmitting
                ? 0.5
                : 1,
            }}
          >
            العودة إلى الصفحة الرئيسية
          </button>

          <p style={styles.footerNote}>
            لن تطلب منك إدارة المنصة إرسال كلمة
            المرور عبر الهاتف أو الرسائل.
          </p>
        </section>
      </div>
    </main>
  );
}

export default AdminLoginPage;
