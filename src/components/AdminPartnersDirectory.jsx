import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function AdminPartnersDirectory() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let stopped = false;

    function applyDirectoryHost() {
      if (stopped) return;
      const section = document.getElementById("admin-supervisors");
      if (!section) return;
      setTarget(section);
      section.setAttribute("data-nm-partners-host", "true");
      Array.from(section.children).forEach((child) => {
        if (child.getAttribute("data-nm-partners-directory") === "true") return;
        child.style.setProperty("display", "none", "important");
      });
    }

    applyDirectoryHost();
    const observer = new MutationObserver(applyDirectoryHost);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  if (!target) return null;

  const cardStyle = {
    display: "grid",
    gap: 10,
    minHeight: 148,
    padding: 20,
    color: "#173f36",
    textDecoration: "none",
    textAlign: "right",
    background: "linear-gradient(135deg, #fbfaf7, #f3ecdc)",
    border: "1px solid #dfd5bd",
    borderRadius: 18,
    boxShadow: "0 10px 24px rgba(86,67,28,.07)",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
    gap: 14,
  };

  return createPortal(
    <div data-nm-partners-directory="true" style={{ display: "grid", gap: 26 }}>
      <section>
        <h2 style={{ margin: "0 0 8px", fontSize: 27 }}>مشرفو المشاريع</h2>
        <p style={{ margin: "0 0 16px", color: "#687872" }}>سجلات طلبات المشرفين والحسابات المعتمدة.</p>
        <div style={gridStyle}>
          <a href="/admin/supervisor-applications?view=applicants" style={cardStyle}>
            <span style={{ fontSize: 34 }}>📝</span>
            <strong style={{ fontSize: 21 }}>المشرفون المتقدمون</strong>
            <span style={{ color: "#687872" }}>عرض طلبات التسجيل وسجلات المتقدمين</span>
          </a>
          <a href="/admin/supervisor-applications?view=approved" style={cardStyle}>
            <span style={{ fontSize: 34 }}>✅</span>
            <strong style={{ fontSize: 21 }}>المشرفون المعتمدون</strong>
            <span style={{ color: "#687872" }}>عرض سجلات المشرفين المقبولين</span>
          </a>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #e3e0d7", paddingTop: 22 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 27 }}>الموردون</h2>
        <p style={{ margin: "0 0 16px", color: "#687872" }}>سجلات طلبات الموردين والحسابات المعتمدة.</p>
        <div style={gridStyle}>
          <a href="/admin/supplier-applications?view=applicants" style={cardStyle}>
            <span style={{ fontSize: 34 }}>📝</span>
            <strong style={{ fontSize: 21 }}>الموردون المتقدمون</strong>
            <span style={{ color: "#687872" }}>عرض طلبات التسجيل وسجلات المتقدمين</span>
          </a>
          <a href="/admin/supplier-applications?view=approved" style={cardStyle}>
            <span style={{ fontSize: 34 }}>✅</span>
            <strong style={{ fontSize: 21 }}>الموردون المعتمدون</strong>
            <span style={{ color: "#687872" }}>عرض سجلات الموردين المقبولين</span>
          </a>
        </div>
      </section>
    </div>,
    target
  );
}
