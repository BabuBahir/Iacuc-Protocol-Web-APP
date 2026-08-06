import { Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";

export type NavKey = "protocols" | "committee" | "inspections" | "pam" | "amendments" | "admin";

const NAV_TABS: { key: NavKey; label: string; to: string }[] = [
  { key: "protocols", label: "Protocols", to: "/" },
  { key: "committee", label: "Committee", to: "/committee" },
  { key: "inspections", label: "Inspections", to: "/inspections" },
  { key: "pam", label: "PAM", to: "/pam" },
  { key: "amendments", label: "Amendments", to: "/amendments" },
  { key: "admin", label: "Admin", to: "/admin" },
];

export default function AppHeader({ active }: { active?: NavKey }) {
  return (
    <div className="bg-[#032D60] text-white px-4 py-2 flex items-center gap-4">
      <Link to="/" className="flex items-center gap-2 font-semibold text-[14px] hover:opacity-90">
        <LayoutGrid size={16} />
        IACUC Protocols
      </Link>
      <div className="flex items-center gap-5 text-[13px] text-gray-200 ml-4">
        {NAV_TABS.map(tab =>
          tab.key === active ? (
            <span key={tab.key} className="text-white border-b-2 border-white pb-2 -mb-2 pt-2">
              {tab.label}
            </span>
          ) : (
            <Link key={tab.key} to={tab.to} className="hover:text-white">
              {tab.label}
            </Link>
          )
        )}
      </div>
      <div className="flex-1" />
      <a
        href="https://github.com/BabuBahir/Iacuc-Protocol-Web-APP/discussions/40"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub repository"
        className="hover:opacity-80"
      >
        <div className="w-7 h-7 rounded-full bg-[#0176D3] flex items-center justify-center text-[12px] font-semibold">Feedback !!</div>
      </a>
    </div>
  );
}
