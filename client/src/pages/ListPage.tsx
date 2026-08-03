import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, LayoutGrid, Plus, ShieldCheck, Clock, AlertTriangle, CheckCircle2, FileText, PawPrint, type LucideIcon } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { api } from "../api";
import type { Protocol, Summary } from "../types";

interface MetricMeta {
  key: keyof Summary;
  label: string;
  icon: LucideIcon;
  tint: string;
}

const METRIC_META: MetricMeta[] = [
  { key: "active", label: "Active protocols", icon: ShieldCheck, tint: "bg-[#EAF3DE] text-[#3B6D11]" },
  { key: "pendingReview", label: "Pending IACUC review", icon: Clock, tint: "bg-[#FAEEDA] text-[#854F0B]" },
  { key: "expiringSoon", label: "Expiring within 60 days", icon: AlertTriangle, tint: "bg-[#FCEBEB] text-[#A32D2D]" },
  { key: "approvedThisQuarter", label: "Approved this quarter", icon: CheckCircle2, tint: "bg-[#E6F1FB] text-[#185FA5]" },
];

const EMPTY_SUMMARY: Summary = { active: 0, pendingReview: 0, expiringSoon: 0, approvedThisQuarter: 0 };

export default function ListPage() {
  const navigate = useNavigate();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.listProtocols(query), api.getSummary()])
      .then(([rows, summaryData]) => {
        setProtocols(rows);
        setSummary(summaryData);
        setError(null);
      })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [query]);

  return (
    <div>
      <div className="bg-[#032D60] text-white px-4 py-2 flex items-center gap-4">
        <div className="flex items-center gap-2 font-semibold text-[14px]">
          <LayoutGrid size={16} />
          IACUC Protocols
        </div>
        <div className="flex items-center gap-5 text-[13px] text-gray-200 ml-4">
          <span className="text-white border-b-2 border-white pb-2 -mb-2 pt-2">Protocols</span>
          <Link to="/committee" className="hover:text-white">Committee</Link>
          <Link to="/admin" className="hover:text-white">Admin</Link>
        </div>
        <div className="flex-1" />
        <div className="w-7 h-7 rounded-full bg-[#0176D3] flex items-center justify-center text-[12px] font-semibold">EM</div>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">IACUC protocol dashboard</h1>
          <button
            onClick={() => navigate("/protocols/new")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]"
          >
            <Plus size={15} />
            New protocol
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {METRIC_META.map(m => (
            <div key={m.key} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${m.tint}`}>
                <m.icon size={17} />
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900 leading-none">{summary[m.key] ?? "—"}</div>
                <div className="text-[11px] text-gray-500 mt-1">{m.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-2 py-1 w-64">
              <Search size={13} className="text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search this list..."
                className="bg-transparent outline-none text-[13px] px-2 w-full"
              />
            </div>
            <div className="flex-1" />
            <span className="text-[12px] text-gray-500">{loading ? "Loading…" : `${protocols.length} items`}</span>
          </div>

          {error && <div className="px-4 py-3 text-[13px] text-red-600">Couldn't load protocols: {error}</div>}

          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Protocol number</th>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Principal investigator</th>
                <th className="px-4 py-2 font-medium">Species</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {protocols.map(p => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/protocols/${p.id}`)}
                  className="border-b border-gray-50 hover:bg-[#F3F9FE] cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-[#0176D3] font-medium flex items-center gap-1.5">
                    <PawPrint size={13} className="text-gray-400" />
                    {p.id}
                  </td>
                  <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">{p.title}</td>
                  <td className="px-4 py-2.5 text-gray-700">{p.pi}</td>
                  <td className="px-4 py-2.5 text-gray-700">{p.species}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {!loading && protocols.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No protocols match "{query}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 font-semibold text-gray-800 text-sm">
            <FileText size={15} className="text-gray-500" />
            Recent committee activity
          </div>
          <div className="divide-y divide-gray-100">
            {[
              "IACUC-2026-0139 approved by full committee — Jun 18, 2026",
              "IACUC-2025-0091 flagged for 60-day expiration reminder — Jul 10, 2026",
              "IACUC-2026-0142 assigned to full committee review — Jul 10, 2026",
            ].map(row => (
              <div key={row} className="px-4 py-2.5 text-[13px] text-gray-700">{row}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
