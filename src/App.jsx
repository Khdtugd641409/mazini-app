import { useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import CustomerApplicationPage from "./pages/CustomerApplicationPage.jsx";

function App() {
  const [currentPage, setCurrentPage] = useState("home");

  if (currentPage === "customer-application") {
    return (
      <CustomerApplicationPage
        onBack={() => setCurrentPage("home")}
      />
    );
  }

  return (
    <HomePage
      onOpenCustomerApplication={() =>
        setCurrentPage("customer-application")
      }
    />
  );
}

export default App;
