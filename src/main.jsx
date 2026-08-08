import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import SupervisorApplicationPage from "./pages/SupervisorApplicationPage.jsx";
import AdminSupervisorApplicationsPage from "./pages/admin/AdminSupervisorApplicationsPage.jsx";
import "./index.css";

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";

let rootContent;

if (normalizedPath === "/supervisor/application") {
  rootContent = (
    <SupervisorApplicationPage
      onBack={() => {
        window.location.href = "/";
      }}
      onOpenSupervisor={() => {
        window.location.href = "/supervisor";
      }}
    />
  );
} else if (normalizedPath === "/admin/supervisor-applications") {
  rootContent = <AdminSupervisorApplicationsPage />;
} else {
  rootContent = <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{rootContent}</React.StrictMode>
);
