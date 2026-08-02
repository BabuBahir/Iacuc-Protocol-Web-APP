import { Routes, Route } from "react-router-dom";
import ListPage from "./pages/ListPage";
import DetailPage from "./pages/DetailPage";
import CreatePage from "./pages/CreatePage";
import AdminPage from "./pages/AdminPage";
import CommitteePage from "./pages/CommitteePage";

export default function App() {
  return (
    <div className="w-full min-h-screen bg-[#F3F2F2] font-sans text-[13px] text-gray-800">
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/protocols/new" element={<CreatePage />} />
        <Route path="/protocols/:id" element={<DetailPage />} />
        <Route path="/committee" element={<CommitteePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<div className="p-6">Page not found.</div>} />
      </Routes>
    </div>
  );
}
