import { useState } from "react";

function AdminLoginPage({
  onSubmit,
  isSubmitting = false,
  errorMessage = "",
  onBackToHome,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    onSubmit({
      email,
      password,
    });
  };

  return (
    <main>
      <header>
        <p>نايف المزيني للبناء الذاتي</p>
        <h1>دخول إدارة المنصة</h1>
      </header>

      <p>
        هذه الصفحة مخصصة للحسابات الإدارية المصرح لها فقط.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="adminEmail">
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
          placeholder="admin@example.com"
          required
          disabled={isSubmitting}
        />

        <label htmlFor="adminPassword">
          كلمة المرور
        </label>

        <input
          id="adminPassword"
          name="adminPassword"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />

        {errorMessage && (
          <p role="alert">
            <strong>{errorMessage}</strong>
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "جاري تسجيل الدخول..."
            : "تسجيل الدخول"}
        </button>
      </form>

      <button
        type="button"
        onClick={onBackToHome}
        disabled={isSubmitting}
      >
        العودة إلى الصفحة الرئيسية
      </button>
    </main>
  );
}

export default AdminLoginPage;
