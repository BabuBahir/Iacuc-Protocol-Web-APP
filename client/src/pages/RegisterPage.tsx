import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Filter, SlidersHorizontal, Download, Save, Trash2, ClipboardList } from "lucide-react";
import AppHeader from "../components/AppHeader";
import FilterBuilder from "../components/FilterBuilder";
import { api } from "../api";
import { downloadCsv } from "../utils/csv";
import type { AnimalUsageTransaction, SavedFilter, FilterClause } from "../types";
import { REGISTER_FILTER_FIELD_DEFS, registerFieldDef } from "../types";

function procedureLabel(key: string | null): string {
  return key ? key.replace(/_/g, " ") : "—";
}

function typeLabel(type: string): string {
  return type === "order" ? "Order" : "Use";
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<AnimalUsageTransaction[]>([]);
  const [filters, setFilters] = useState<FilterClause[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSavedMenu, setShowSavedMenu] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .searchAnimalUsage(filters)
      .then(rows => {
        setTransactions(rows);
        setError(null);
      })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filters]);

  const loadSavedFilters = () => {
    api
      .listSavedFilters("register")
      .then(setSavedFilters)
      .catch(() => setSavedFilters([]));
  };

  useEffect(() => {
    loadSavedFilters();
  }, []);

  const handleSaveFilter = () => {
    setSaveError(null);
    if (!saveName.trim()) {
      setSaveError("Enter a name for this filter.");
      return;
    }
    api
      .saveSavedFilter(saveName.trim(), "register", filters)
      .then(() => {
        setSaveName("");
        loadSavedFilters();
      })
      .catch(err => setSaveError(err instanceof Error ? err.message : String(err)));
  };

  const handleDeleteSavedFilter = (id: number) => {
    api
      .deleteSavedFilter(id)
      .then(loadSavedFilters)
      .catch(() => {});
  };

  const handleApplySavedFilter = (saved: SavedFilter) => {
    setFilters(saved.filters);
    setShowSavedMenu(false);
  };

  const handleExportCsv = () => {
    downloadCsv(
      `animal-usage-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Protocol number",
        "Title",
        "Transaction date",
        "Species / strain",
        "Pain level",
        "Quantity",
        "Type",
        "Procedure",
        "Notes",
      ],
      transactions.map(t => [
        t.protocol_id,
        t.protocol_title ?? "",
        t.transaction_date,
        t.species_strain,
        t.pain_level ?? "",
        t.quantity,
        t.type,
        procedureLabel(t.procedure_key),
        t.notes ?? "",
      ]),
    );
  };

  const emptyMessage =
    filters.length > 0 ? "No transactions match the current filters." : "No animal usage transactions yet.";

  return (
    <div>
      <AppHeader active="register" />

      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Animal usage register</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Actual animal orders and uses logged against approved protocols — the ledger, distinct from each
          protocol's planned allowance.
        </p>
      </div>

      <div className="p-4">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 flex-wrap">
            <button
              onClick={() => setShowFilters(v => !v)}
              aria-expanded={showFilters}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[13px] font-medium ${
                filters.length > 0
                  ? "border-[#0176D3] text-[#0176D3] bg-[#EFF7FD]"
                  : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              }`}
            >
              <Filter size={14} />
              Filters
              {filters.length > 0 && (
                <span className="ml-0.5 bg-[#0176D3] text-white text-[11px] leading-none px-1.5 py-1 rounded-full">
                  {filters.length}
                </span>
              )}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSavedMenu(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 text-[13px] font-medium bg-white hover:bg-gray-50"
              >
                <Save size={14} />
                Saved filters
              </button>
              {showSavedMenu && (
                <div
                  data-testid="saved-filters-menu"
                  className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                >
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-[12px] font-semibold text-gray-800 mb-1">Save current filter</div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={saveName}
                        onChange={e => setSaveName(e.target.value)}
                        placeholder="Filter name…"
                        aria-label="Filter name"
                        className="border border-gray-300 rounded px-2 py-1 text-[13px] bg-white w-full"
                      />
                      <button
                        onClick={handleSaveFilter}
                        disabled={filters.length === 0}
                        className="px-2 py-1 rounded bg-[#0176D3] text-white text-[12px] font-medium hover:bg-[#0b5cab] disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                    {saveError && <div className="text-[12px] text-red-600 mt-1">{saveError}</div>}
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {savedFilters.length === 0 && (
                      <div className="px-3 py-3 text-[12px] text-gray-400">No saved filters yet.</div>
                    )}
                    {savedFilters.map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-50 border-b border-gray-50">
                        <button
                          onClick={() => handleApplySavedFilter(s)}
                          className="text-[13px] text-gray-800 text-left flex-1 hover:text-[#0176D3]"
                        >
                          {s.name}
                          <span className="block text-[11px] text-gray-400">
                            {s.filters.length} clause{s.filters.length === 1 ? "" : "s"}
                          </span>
                        </button>
                        <button
                          onClick={() => handleDeleteSavedFilter(s.id)}
                          aria-label={`Delete saved filter ${s.name}`}
                          className="text-gray-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleExportCsv}
              disabled={transactions.length === 0}
              data-testid="export-csv"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 text-[13px] font-medium bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <Download size={14} />
              Export CSV
            </button>
            <div className="flex-1" />
            <span className="text-[12px] text-gray-500">
              {loading ? "Loading…" : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {filters.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[#F3F9FE] border-b border-gray-100 flex-wrap">
              <SlidersHorizontal size={13} className="text-[#0176D3]" />
              {filters.map((f, i) => {
                const def = registerFieldDef(f.field);
                return (
                  <span
                    key={i}
                    data-testid="active-filter-chip"
                    className="inline-flex items-center gap-1 bg-white border border-[#cfe4f7] text-[#185FA5] text-[12px] rounded px-2 py-0.5"
                  >
                    {def ? def.label : f.field} {f.op} {f.value}
                    <button
                      onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}
                      aria-label="Remove filter"
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                );
              })}
              <button onClick={() => setFilters([])} className="text-[12px] text-[#0176D3] hover:underline ml-1">
                Clear all filters
              </button>
            </div>
          )}

          {showFilters && (
            <FilterBuilder fieldDefs={REGISTER_FILTER_FIELD_DEFS} clauses={filters} onChange={setFilters} />
          )}

          {error && <div className="px-4 py-3 text-[13px] text-red-600">Couldn't load the register: {error}</div>}

          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Protocol</th>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Species / strain</th>
                <th className="px-4 py-2 font-medium">Pain level</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Procedure</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/protocols/${t.protocol_id}`)}
                  className="border-b border-gray-50 hover:bg-[#F3F9FE] cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-[#0176D3] font-medium flex items-center gap-1.5">
                    <ClipboardList size={13} className="text-gray-400" />
                    {t.protocol_id}
                  </td>
                  <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">{t.protocol_title ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{t.transaction_date}</td>
                  <td className="px-4 py-2.5 text-gray-700">{t.species_strain}</td>
                  <td className="px-4 py-2.5 text-gray-700">{t.pain_level ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700">{typeLabel(t.type)}</td>
                  <td className="px-4 py-2.5 text-gray-700">{t.quantity}</td>
                  <td className="px-4 py-2.5 text-gray-700">{procedureLabel(t.procedure_key)}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{t.notes ?? "—"}</td>
                </tr>
              ))}
              {!loading && transactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
