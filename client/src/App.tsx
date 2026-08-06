import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import DisclaimerModal from "./components/DisclaimerModal";
import ListPage from "./pages/ListPage";
import DetailPage from "./pages/DetailPage";
import CreatePage from "./pages/CreatePage";
import ApplicationPage from "./pages/ApplicationPage";
import AdminPage from "./pages/AdminPage";
import CommitteePage from "./pages/CommitteePage";
import InspectionsPage from "./pages/InspectionsPage";
import PamPage from "./pages/PamPage";
import AmendmentsPage from "./pages/AmendmentsPage";

export default function App() {
  const [showDisclaimer, setShowDisclaimer] = useState(
    () => !localStorage.getItem("iacuc_demo_disclaimer_dismissed")
  );
  const dismissDisclaimer = () => {
    localStorage.setItem("iacuc_demo_disclaimer_dismissed", "1");
    setShowDisclaimer(false);
  };
  return (
    <div className="w-full min-h-screen bg-[#F3F2F2] font-sans text-[13px] text-gray-800">
      {showDisclaimer && <DisclaimerModal onClose={dismissDisclaimer} />}
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/protocols/new" element={<CreatePage />} />
        <Route path="/protocols/:id" element={<DetailPage />} />
        <Route path="/protocols/:id/application" element={<ApplicationPage />} />
        <Route path="/committee" element={<CommitteePage />} />
        <Route path="/inspections" element={<InspectionsPage />} />
        <Route path="/pam" element={<PamPage />} />
        <Route path="/amendments" element={<AmendmentsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<div className="p-6">Page not found.</div>} />
      </Routes>
    </div>
  );
}
