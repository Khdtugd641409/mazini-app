import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import SupervisorApplicationPage from "./pages/SupervisorApplicationPage.jsx";
import "./index.css";

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";

const rootContent =
  normalizedPath === "/supervisor/application" ? (
    <SupervisorApplicationPage
      onBack={() => {
        window.location.href = "/";
      }}
      onOpenSupervisor={() => {
        window.location.href = "/supervisor";
      }}
    />
  ) : (
    <App />
  );

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{rootContent}</React.StrictMode>
);
