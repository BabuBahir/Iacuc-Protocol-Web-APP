import React, { useEffect, useState } from "react";
import {
  Building2, Plus, Trash2, ClipboardCheck, Check,
  ChevronDown, ChevronRight,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import { api } from "../api";
import type {
  DeficiencySeverity, Facility, FacilityType, Inspection, InspectionDetail,
  InspectionResult,
} from "../types";
import { DEFICIENCY_SEVERITIES, FACILITY_TYPES, INSPECTION_RESULTS } from "../types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 font-semibold text-gray-800 text-sm">
        <ClipboardCheck size={15} className="text-gray-500" />
        {title}
      </div>
      {children}
    </div>
  );
}

function resultStyles(result: InspectionResult): string {
  switch (result) {
    case "Pass": return "bg-emerald-50 text-emerald-700";
    case "Fail": return "bg-red-50 text-red-700";
    case "Re-inspection required": return "bg-amber-50 text-amber-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function severityStyles(severity: DeficiencySeverity): string {
  return severity === "Major" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
}

function FacilitiesPanel() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<FacilityType>("Housing Room");
  const [species, setSpecies] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => api.listFacilities().then(setFacilities).catch(err => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await api.createFacility({ name: name.trim(), type, species: species.trim() || null });
      setName("");
      setSpecies("");
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteFacility(id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Panel title="Facilities">
      <form onSubmit={add} className="px-4 py-3 border-b border-gray-100 space-y-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Facility name, e.g. Central Vivarium — Rodent Housing"
          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={e => setType(e.target.value as FacilityType)}
            className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {FACILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] shrink-0">
            <Plus size={14} />
            Add
          </button>
        </div>
        <input
          value={species}
          onChange={e => setSpecies(e.target.value)}
          placeholder="Species housed there (optional)"
          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
      </form>
      {error && <div className="px-4 py-2 text-[12px] text-red-600">{error}</div>}
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {facilities.map(f => (
          <div key={f.id} className="px-4 py-2.5 flex items-start justify-between gap-2 text-[13px]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-gray-900 font-medium">
                <Building2 size={14} className="text-gray-400 shrink-0" />
                <span>{f.name}</span>
              </div>
              <div className="text-gray-500 text-[12px] mt-0.5">
                {f.type}{f.species ? ` · ${f.species}` : ""}
              </div>
            </div>
            <button onClick={() => remove(f.id)} className="text-gray-400 hover:text-red-600 shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {facilities.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No facilities yet.</div>}
      </div>
    </Panel>
  );
}

function InspectionRow({ inspection, onChanged }: { inspection: Inspection; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deficiencies, setDeficiencies] = useState<InspectionDetail["deficiencies"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ severity: "Minor" as DeficiencySeverity, description: "", remediation_deadline: "" });

  const loadDetail = async () => {
    try {
      const detail = await api.getInspection(inspection.id);
      setDeficiencies(detail.deficiencies);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadDetail();
  };

  const addDeficiency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setError(null);
    try {
      await api.createDeficiency(inspection.id, {
        severity: form.severity,
        description: form.description.trim(),
        remediation_deadline: form.remediation_deadline || null,
      });
      setForm({ severity: "Minor", description: "", remediation_deadline: "" });
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remediate = async (defId: number) => {
    try {
      await api.remediateDeficiency(inspection.id, defId);
      await loadDetail();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={toggle}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-gray-50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] text-gray-900 font-medium">
            {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
            <span>{inspection.facility_name || "—"}</span>
          </div>
          <div className="text-[12px] text-gray-500 mt-0.5 ml-5">Inspected {inspection.inspection_date}</div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${resultStyles(inspection.result)}`}>
          {inspection.result}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {inspection.report && <div className="text-[12px] text-gray-600">{inspection.report}</div>}

          {deficiencies.length > 0 && (
            <div className="divide-y divide-gray-50">
              {deficiencies.map(d => (
                <div key={d.id} className="py-1.5 flex items-start justify-between gap-2 text-[12px]">
                  <div className="flex items-start gap-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium mt-0.5 shrink-0 ${severityStyles(d.severity)}`}>
                      {d.severity}
                    </span>
                    <div>
                      <div className="text-gray-700">{d.description}</div>
                      <div className="text-gray-400">
                        {d.remediation_deadline ? `Due ${d.remediation_deadline}` : "No deadline"}
                        {d.remediated_at ? " · remediated" : ""}
                      </div>
                    </div>
                  </div>
                  {!d.remediated_at && (
                    <button
                      onClick={() => remediate(d.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded border border-gray-300 bg-white text-[#0176D3] text-[11px] font-medium hover:bg-gray-50 shrink-0"
                    >
                      <Check size={12} />
                      Mark remediated
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addDeficiency} className="space-y-2 bg-gray-50 rounded p-3">
            <div className="flex items-center gap-2">
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value as DeficiencySeverity })}
                className="bg-white border border-gray-200 rounded px-2 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
              >
                {DEFICIENCY_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Record a deficiency…"
                className="flex-1 bg-white border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
              />
              <button className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0176D3] text-white text-[12px] font-medium hover:bg-[#0b5cab] shrink-0">
                <Plus size={13} />
                Add
              </button>
            </div>
            <input
              value={form.remediation_deadline}
              onChange={e => setForm({ ...form, remediation_deadline: e.target.value })}
              type="date"
              className="bg-white border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
            />
            {error && <div className="text-[12px] text-red-600">{error}</div>}
          </form>
        </div>
      )}
    </div>
  );
}

function InspectionsPanel() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [form, setForm] = useState({ facility_id: "", inspection_date: "", result: "Pending" as InspectionResult, report: "" });
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.listInspections().then(setInspections).catch(err => setError(errorMessage(err)));
    api.listFacilities().then(setFacilities).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.facility_id || !form.inspection_date) return;
    setError(null);
    try {
      await api.createInspection({
        facility_id: Number(form.facility_id),
        inspection_date: form.inspection_date,
        result: form.result,
        report: form.report.trim() || null,
      });
      setForm({ facility_id: "", inspection_date: "", result: "Pending", report: "" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Panel title="Semi-annual inspections">
      <form onSubmit={add} className="px-4 py-3 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={form.facility_id}
          onChange={e => setForm({ ...form, facility_id: e.target.value })}
          className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        >
          <option value="">Facility…</option>
          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input
          value={form.inspection_date}
          onChange={e => setForm({ ...form, inspection_date: e.target.value })}
          type="date"
          className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        <select
          value={form.result}
          onChange={e => setForm({ ...form, result: e.target.value as InspectionResult })}
          className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        >
          {INSPECTION_RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input
            value={form.report}
            onChange={e => setForm({ ...form, report: e.target.value })}
            placeholder="Report (optional)"
            className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          />
          <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] shrink-0">
            <Plus size={14} />
            Record
          </button>
        </div>
      </form>
      {error && <div className="px-4 py-2 text-[12px] text-red-600">{error}</div>}
      <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
        {inspections.map(i => (
          <InspectionRow key={i.id} inspection={i} onChanged={load} />
        ))}
        {inspections.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No inspections yet.</div>}
      </div>
    </Panel>
  );
}

export default function InspectionsPage() {
  return (
    <div>
      <AppHeader active="inspections" />
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Facilities & semi-annual inspections</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Track the physical spaces animals are housed and used in, record the twice-yearly inspections, and
          chase deficiencies to remediation — the meat of the AAALAC semi-annual inspection program.
        </p>
      </div>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <FacilitiesPanel />
        <InspectionsPanel />
      </div>
    </div>
  );
}
