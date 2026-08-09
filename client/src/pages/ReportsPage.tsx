import { useEffect, useState } from "react";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { api } from "../api";
import type {
  AnalgesicAnestheticDrugRow,
  EuthanasiaBySpeciesRow,
  MultipleMajorRecoverySurgeryRow,
  ReportsPayload,
  RestraintBySpeciesRow,
  SurgeryLocationRow,
  UseLocationBySpeciesRow,
} from "../types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Escape a single cell for CSV (quote when it contains a comma, quote, or newline).
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [headers.map(csvCell).join(","), ...rows.map(r => r.map(csvCell).join(","))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface Column<T> {
  header: string;
  cell: (row: T) => string | number | null;
}

interface ReportTableProps<T> {
  title: string;
  description: string;
  filename: string;
  columns: Column<T>[];
  rows: T[];
  emptyMessage: string;
}

function ReportTable<T>({ title, description, filename, columns, rows, emptyMessage }: ReportTableProps<T>) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <FileBarChart size={15} className="text-gray-500" />
        <span className="font-semibold text-gray-800 text-sm">{title}</span>
        <span className="text-gray-400 text-[12px]">({rows.length})</span>
        <span className="flex-1" />
        <button
          onClick={() => downloadCsv(filename, columns.map(c => c.header), rows.map(r => columns.map(c => c.cell(r))))}
          disabled={rows.length === 0}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0176D3] text-white text-[12px] font-medium hover:bg-[#0b5cab] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={12} />
          Download CSV
        </button>
      </div>
      <p className="px-4 pt-2 text-[12px] text-gray-500">{description}</p>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-[13px] text-gray-400">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50 text-gray-500 text-[12px]">
                {columns.map(c => (
                  <th key={c.header} className="px-4 py-2 font-medium whitespace-nowrap">{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className="text-gray-800">
                  {columns.map(c => (
                    <td key={c.header} className="px-4 py-2 whitespace-nowrap">{c.cell(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [payload, setPayload] = useState<ReportsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.getReports().then(setPayload).catch(err => setError(errorMessage(err)));
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <AppHeader active="reports" />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Compliance reports</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Canned AAALAC-style reports aggregated from the Appendix A application content. Each table can be
            downloaded as CSV.
            {payload ? ` Generated ${new Date(payload.generated_at).toLocaleString()}.` : ""}
          </p>
        </div>

        {error && <div className="px-4 py-2 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded">{error}</div>}
        {!payload && !error && (
          <div className="flex items-center gap-2 text-gray-500 text-[13px]">
            <Loader2 size={15} className="animate-spin" />
            Loading reports…
          </div>
        )}

        {payload && (
          <>
            <ReportTable<RestraintBySpeciesRow>
              title="Restraint by species"
              description="Protocols using devices for prolonged restraint, with the restraint method as described."
              filename="restraint-by-species.csv"
              columns={[
                { header: "Protocol", cell: r => r.protocol_id },
                { header: "Species", cell: r => r.species ?? "—" },
                { header: "Restraint method", cell: r => r.restraint_method ?? "—" },
              ]}
              rows={payload.reports.restraint_by_species}
              emptyMessage="No protocols report prolonged restraint."
            />

            <ReportTable<EuthanasiaBySpeciesRow>
              title="Euthanasia methods by species"
              description="Euthanasia agents recorded in the drug/dosing table, grouped by species."
              filename="euthanasia-methods-by-species.csv"
              columns={[
                { header: "Protocol", cell: r => r.protocol_id },
                { header: "Species", cell: r => r.species ?? "—" },
                { header: "Method", cell: r => r.method },
                { header: "Dose", cell: r => r.dose ?? "—" },
                { header: "Route", cell: r => r.route ?? "—" },
              ]}
              rows={payload.reports.euthanasia_by_species}
              emptyMessage="No euthanasia agents recorded."
            />

            <ReportTable<SurgeryLocationRow>
              title="Surgery locations and types"
              description="Survival and non-survival surgery, cross-referenced with the research-plan locations where it occurs."
              filename="surgery-locations-and-types.csv"
              columns={[
                { header: "Protocol", cell: r => r.protocol_id },
                { header: "Species", cell: r => r.species ?? "—" },
                { header: "Surgery type", cell: r => r.surgery_type },
                { header: "Location", cell: r => r.location },
              ]}
              rows={payload.reports.surgery_locations}
              emptyMessage="No surgery protocols on file."
            />

            <ReportTable<MultipleMajorRecoverySurgeryRow>
              title="Multiple major recovery surgery"
              description="Experiments flagged as performing surgery more than once on the same animal."
              filename="multiple-major-recovery-surgery.csv"
              columns={[
                { header: "Protocol", cell: r => r.protocol_id },
                { header: "Species", cell: r => r.species ?? "—" },
                { header: "Experiment", cell: r => r.experiment },
                { header: "Description", cell: r => r.description ?? "—" },
              ]}
              rows={payload.reports.multiple_major_recovery_surgery}
              emptyMessage="No experiments flagged for multiple major recovery surgery."
            />

            <ReportTable<AnalgesicAnestheticDrugRow>
              title="Analgesic and anesthetic drugs"
              description="Drugs recorded for anesthesia or analgesia, by protocol and species."
              filename="analgesic-anesthetic-drugs.csv"
              columns={[
                { header: "Protocol", cell: r => r.protocol_id },
                { header: "Species", cell: r => r.species ?? "—" },
                { header: "Reason", cell: r => r.reason_for_use ?? "—" },
                { header: "Drug", cell: r => r.drug },
                { header: "Dose", cell: r => r.dose ?? "—" },
                { header: "Route", cell: r => r.route ?? "—" },
              ]}
              rows={payload.reports.analgesic_anesthetic_drugs}
              emptyMessage="No analgesic or anesthetic drugs recorded."
            />

            <ReportTable<UseLocationBySpeciesRow>
              title="Use locations by species"
              description="Research-plan locations aggregated by species, with the number of protocols using each."
              filename="use-locations-by-species.csv"
              columns={[
                { header: "Location", cell: r => r.location },
                { header: "Species", cell: r => r.species ?? "—" },
                { header: "Protocols", cell: r => r.protocol_count },
                { header: "Protocol IDs", cell: r => r.protocol_ids.join(", ") },
              ]}
              rows={payload.reports.use_locations_by_species}
              emptyMessage="No research-plan locations recorded."
            />
          </>
        )}
      </div>
    </div>
  );
}
