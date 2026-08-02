import { useState } from "react";

function CustomerAccessPage({
  onSubmit,
  isSubmitting = false,
  errorMessage = "",
  onBackToHome,
}) {
  const [fileNumber, setFileNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    onSubmit({
      fileNumber,
      mobileNumber,
    });
  };

  return (
    <main>
      <header>
        <p>نايف المزيني للبناء الذاتي</p>

        <h1>متابعة ملفي</h1>
      </header>

      <p>
        أدخل رقم الملف ورقم الجوال المسجل عند تقديم الطلب.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="customerFileNumber">
          رقم الملف
        </label>

        <input
          id="customerFileNumber"
          name="customerFileNumber"
          type="text"
          value={fileNumber}
          onChange={(event) =>
            setFileNumber(event.target.value)
          }
          placeholder="مثال: NM-100001"
          autoComplete="off"
          disabled={isSubmitting}
          required
        />

        <label htmlFor="customerMobileNumber">
          رقم الجوال
        </label>

        <input
          id="customerMobileNumber"
          name="customerMobileNumber"
          type="tel"
          inputMode="tel"
          value={mobileNumber}
          onChange={(event) =>
            setMobileNumber(event.target.value)
          }
          placeholder="05xxxxxxxx"
          pattern="05\d{8}"
          maxLength="10"
          autoComplete="tel"
          disabled={isSubmitting}
          required
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
            ? "جاري فتح الملف..."
            : "فتح ملفي"}
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

export default CustomerAccessPage;
