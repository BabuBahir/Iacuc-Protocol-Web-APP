import React from "react";
import { Routes, Route } from "react-router-dom";
import ListPage from "./pages/ListPage.jsx";
import DetailPage from "./pages/DetailPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import CommitteePage from "./pages/CommitteePage.jsx";

export default function App() {
  return (
    <div className="w-full min-h-screen bg-[#F3F2F2] font-sans text-[13px] text-gray-800">
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/protocols/:id" element={<DetailPage />} />
        <Route path="/committee" element={<CommitteePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<div className="p-6">Page not found.</div>} />
      </Routes>
    </div>
  );
}
