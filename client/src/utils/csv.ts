// Shared CSV export helpers. Extracted from ReportsPage so the dashboard's
// filter-builder (Roadmap item 8) can reuse the same download path.

// Escape a single cell for CSV (quote when it contains a comma, quote, or newline).
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Build and trigger a browser download of a UTF-8 (BOM-prefixed) CSV file.
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
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
