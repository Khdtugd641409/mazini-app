export default function App() {
  return (
    <div
      style={{
        direction: "rtl",
        fontFamily: "sans-serif",
        background: "#f5f7fb",
        minHeight: "100vh",
        padding: "30px",
        textAlign: "center",
      }}
    >
      <h1 style={{ color: "#0b5ed7" }}>
        منصة نايف المزيني للبناء الذاتي
      </h1>

      <p style={{ color: "#666", fontSize: "18px" }}>
        الإصدار الثاني (V2)
      </p>

      <div style={{ marginTop: "40px" }}>
        <button style={btn}>
          تسجيل عميل جديد
        </button>

        <br /><br />

        <button style={btn}>
          دخول المستثمرين
        </button>

        <br /><br />

        <button style={btn}>
          دخول مدير المشروع
        </button>
      </div>
    </div>
  );
}

const btn = {
  width: "260px",
  padding: "15px",
  fontSize: "18px",
  borderRadius: "10px",
  border: "none",
  background: "#0b5ed7",
  color: "white",
  cursor: "pointer",
};
