import { Plus, Trash2 } from "lucide-react";
import type { FilterClause, FilterFieldDef, FilterOperator } from "../types";
import { FILTER_OPERATORS, operatorsFor } from "../types";

interface FilterBuilderProps {
  fieldDefs: FilterFieldDef[];
  clauses: FilterClause[];
  onChange: (clauses: FilterClause[]) => void;
}

function defFor(fieldDefs: FilterFieldDef[], key: string): FilterFieldDef {
  return fieldDefs.find(d => d.key === key) ?? fieldDefs[0];
}

function defaultClause(fieldDefs: FilterFieldDef[]): FilterClause {
  const def = fieldDefs[0];
  return { field: def.key, op: operatorsFor(def)[0], value: "" };
}

export default function FilterBuilder({ fieldDefs, clauses, onChange }: FilterBuilderProps) {
  const update = (index: number, patch: Partial<FilterClause>) => {
    onChange(clauses.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const changeField = (index: number, field: string) => {
    const def = defFor(fieldDefs, field);
    const ops = operatorsFor(def);
    update(index, { field, op: ops.includes(clauses[index].op) ? clauses[index].op : ops[0] });
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
      {clauses.length === 0 && (
        <div className="text-[12px] text-gray-500 mb-2">No filters applied. Add a clause to filter this list.</div>
      )}
      <div className="space-y-2">
        {clauses.map((clause, i) => {
          const def = defFor(fieldDefs, clause.field);
          const ops = operatorsFor(def);
          return (
            <div key={i} className="flex items-center gap-2" data-testid={`filter-clause-${i}`}>
              <select
                value={clause.field}
                onChange={e => changeField(i, e.target.value)}
                aria-label={`Filter ${i + 1} field`}
                className="border border-gray-300 rounded px-2 py-1.5 text-[13px] bg-white w-44"
              >
                {fieldDefs.map(d => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
              <select
                value={clause.op}
                onChange={e => update(i, { op: e.target.value as FilterOperator })}
                aria-label={`Filter ${i + 1} operator`}
                className="border border-gray-300 rounded px-2 py-1.5 text-[13px] bg-white w-36"
              >
                {ops.map(op => {
                  const meta = FILTER_OPERATORS.find(o => o.key === op);
                  return (
                    <option key={op} value={op}>
                      {meta ? meta.label : op}
                    </option>
                  );
                })}
              </select>
              {def.type === "enum" ? (
                <select
                  value={clause.value}
                  onChange={e => update(i, { value: e.target.value })}
                  aria-label={`Filter ${i + 1} value`}
                  className="border border-gray-300 rounded px-2 py-1.5 text-[13px] bg-white w-52"
                >
                  <option value="">— select —</option>
                  {def.values?.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
                  value={clause.value}
                  onChange={e => update(i, { value: e.target.value })}
                  placeholder="Value…"
                  aria-label={`Filter ${i + 1} value`}
                  className="border border-gray-300 rounded px-2 py-1.5 text-[13px] bg-white w-52"
                />
              )}
              <button
                type="button"
                onClick={() => onChange(clauses.filter((_, idx) => idx !== i))}
                aria-label={`Remove filter ${i + 1}`}
                className="text-gray-400 hover:text-red-600 p-1"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={() => onChange([...clauses, defaultClause(fieldDefs)])}
          className="flex items-center gap-1 text-[#0176D3] text-[13px] font-medium hover:text-[#0b5cab]"
        >
          <Plus size={14} />
          Add clause
        </button>
        {clauses.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[12px] text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
