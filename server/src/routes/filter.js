// Shared filter-builder engine for the dashboard search (ROADMAP item 8).
// A "filter" is a stackable { field, op, value } clause; the allowed fields
// and operators are whitelisted here so the API surface stays bounded and
// validation lives in one place. Filters are applied in memory — the datasets
// are demo-scale and the existing ?q= search already works this way, which
// sidesteps node:sqlite's strict named-parameter handling for dynamic SQL.
import { PROCEDURE_KEYS } from "./protocol-form.js";

export const FILTER_OPERATORS = [
  "eq",
  "neq",
  "contains",
  "starts_with",
  "ends_with",
  "gt",
  "gte",
  "lt",
  "lte",
];

const TEXT_OPS = ["eq", "neq", "contains", "starts_with", "ends_with"];
const ENUM_OPS = ["eq", "neq"];
const NUMERIC_OPS = ["eq", "neq", "gt", "gte", "lt", "lte"];

// Field definitions: { label, type, values? }. type drives which operators
// are allowed and how values are compared. enum fields restrict to `values`.
export const PROTOCOL_FILTER_FIELDS = {
  id: { label: "Protocol number", type: "text" },
  title: { label: "Title", type: "text" },
  pi: { label: "Principal investigator", type: "text" },
  species: { label: "Species", type: "text" },
  status: {
    label: "Status",
    type: "enum",
    values: ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"],
  },
  pain_category: {
    label: "Pain category",
    type: "enum",
    values: ["Category A", "Category B", "Category C", "Category D", "Category E"],
  },
  protocol_type: {
    label: "Protocol type",
    type: "enum",
    values: ["Research", "Teaching", "Breeding", "Animal care / maintenance", "Other"],
  },
  animals: { label: "Animals", type: "number" },
  submitted: { label: "Submitted date", type: "date" },
  expires: { label: "Expiration date", type: "date" },
};

export const REGISTER_FILTER_FIELDS = {
  protocol_id: { label: "Protocol number", type: "text" },
  transaction_date: { label: "Transaction date", type: "date" },
  species_strain: { label: "Species / strain", type: "text" },
  pain_level: { label: "Pain level", type: "enum", values: ["B", "C", "D", "E"] },
  quantity: { label: "Quantity", type: "number" },
  type: { label: "Type", type: "enum", values: ["order", "use"] },
  procedure_key: { label: "Procedure", type: "enum", values: PROCEDURE_KEYS.map(p => p.key) },
  notes: { label: "Notes", type: "text" },
};

function operatorsFor(def) {
  if (def.type === "text") return TEXT_OPS;
  if (def.type === "enum") return ENUM_OPS;
  return NUMERIC_OPS;
}

// Validate a filter array against a field-definition map. Returns an error
// string, or null when every clause is valid.
export function validateFilters(filters, fieldDefs) {
  if (!Array.isArray(filters)) return "filters must be an array";
  for (const f of filters) {
    if (!f || typeof f !== "object") return "each filter must be an object";
    const def = fieldDefs[f.field];
    if (!def) return `unknown filter field "${f.field}"`;
    if (!operatorsFor(def).includes(f.op)) {
      return `operator "${f.op}" is not valid for field "${f.field}"`;
    }
    if (f.value === undefined || f.value === null || f.value === "") {
      return `filter "${f.field}" requires a value`;
    }
    // Every operator eventually does string/number work on f.value (matchesFilter's
    // .toLowerCase()/.localeCompare() for text/date, Number(f.value) for numbers).
    // An object or array value passes the checks below silently (enum/number don't
    // apply to it) and either throws deep inside matchesFilter (text fields:
    // "f.value.toLowerCase is not a function") or, worse, gets silently coerced to
    // "[object Object]" and produces wrong-but-not-erroring results (date fields,
    // since operatorsFor() routes them through NUMERIC_OPS but only `number`-typed
    // fields were checked here). Reject non-primitives up front, for every type.
    if (typeof f.value !== "string" && typeof f.value !== "number") {
      return `value for field "${f.field}" must be a string or number, not ${Array.isArray(f.value) ? "an array" : typeof f.value}`;
    }
    if (def.type === "enum" && !def.values.includes(f.value)) {
      return `invalid value "${f.value}" for field "${f.field}"`;
    }
    if (def.type === "number" && Number.isNaN(Number(f.value))) {
      return `value "${f.value}" for field "${f.field}" must be a number`;
    }
  }
  return null;
}

// Case-insensitive text equality helper for eq/neq on text fields.
function textEq(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function compare(rowValue, f, def) {
  if (def.type === "number") return Number(rowValue) - Number(f.value);
  return String(rowValue).localeCompare(String(f.value));
}

// Returns true when a single row satisfies every clause (clauses AND together).
export function matchesFilter(row, f, def) {
  const value = row[f.field];
  switch (f.op) {
    case "eq":
      return def.type === "text" ? textEq(value ?? "", f.value) : String(value ?? "") === f.value;
    case "neq":
      return def.type === "text" ? !textEq(value ?? "", f.value) : String(value ?? "") !== f.value;
    case "contains":
      return String(value ?? "").toLowerCase().includes(f.value.toLowerCase());
    case "starts_with":
      return String(value ?? "").toLowerCase().startsWith(f.value.toLowerCase());
    case "ends_with":
      return String(value ?? "").toLowerCase().endsWith(f.value.toLowerCase());
    case "gt":
      return compare(value, f, def) > 0;
    case "gte":
      return compare(value, f, def) >= 0;
    case "lt":
      return compare(value, f, def) < 0;
    case "lte":
      return compare(value, f, def) <= 0;
    default:
      return false;
  }
}

export function applyFilters(rows, filters, fieldDefs) {
  if (!Array.isArray(filters) || filters.length === 0) return rows;
  return rows.filter(row => filters.every(f => matchesFilter(row, f, fieldDefs[f.field])));
}
