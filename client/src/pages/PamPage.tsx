import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid, Plus, ShieldAlert, ClipboardList,
} from "lucide-react";
import { api } from "../api";
import type {
  Incident, IncidentSeverity, IncidentStatus, IncidentType, PamAudit,
  Personnel,
} from "../types";
import {
  INCIDENT_SEVERITIES, INCIDENT_TYPES,
} from "../types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function Header({ active }: { active: string }) {
  return (
    <div className="bg-[#032D60] text-white px-4 py-2 flex items-center gap-4">
      <Link to="/" className="flex items-center gap-2 font-semibold text-[14px] hover:opacity-90">
        <LayoutGrid size={16} />
        IACUC Protocols
      </Link>
      <div className="flex items-center gap-5 text-[13px] text-gray-200 ml-4">
        <Link to="/" className="hover:text-white">Protocols</Link>
        <Link to="/committee" className="hover:text-white">Committee</Link>
        <Link to="/inspections" className="hover:text-white">Inspections</Link>
        {active === "pam" ? (
          <span className="text-white border-b-2 border-white pb-2 -mb-2 pt-2">PAM</span>
        ) : (
          <Link to="/pam" className="hover:text-white">PAM</Link>
        )}
        <Link to="/admin" className="hover:text-white">Admin</Link>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 font-semibold text-gray-800 text-sm">
        <Icon size={15} className="text-gray-500" />
        {title}
      </div>
      {children}
    </div>
  );
}

function statusStyles(status: IncidentStatus): string {
  switch (status) {
    case "Open": return "bg-red-50 text-red-700";
    case "CAPA": return "bg-amber-50 text-amber-700";
    default: return "bg-emerald-50 text-emerald-700";
  }
}

function severityStyles(severity: IncidentSeverity): string {
  switch (severity) {
    case "Immediate": return "bg-red-50 text-red-700";
    case "Major": return "bg-amber-50 text-amber-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function IncidentCard({
  incident, onChanged,
}: { incident: Incident; onChanged: () => void }) {
  const [capa, setCapa] = useState(incident.corrective_action ?? "");
  const [error, setError] = useState<string | null>(null);

  const saveCapa = async () => {
    setError(null);
    try {
      await api.updateIncident(incident.id, { corrective_action: capa.trim() || null });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const close = async () => {
    setError(null);
    try {
      await api.updateIncident(incident.id, { corrective_action: capa.trim(), status: "Closed" });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {incident.protocol_id ? (
              <Link to={`/protocols/${incident.protocol_id}`} className="text-[#0176D3] font-medium hover:underline">
                {incident.protocol_id}
              </Link>
            ) : (
              <span className="text-gray-400 font-medium">No protocol</span>
            )}
            <span className="text-gray-500">{incident.type}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${severityStyles(incident.severity)}`}>
              {incident.severity}
            </span>
            <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${statusStyles(incident.status)}`}>
              {incident.status}
            </span>
          </div>
          <div className="text-gray-800 mt-1 text-[13px]">{incident.description}</div>
          <div className="text-[12px] text-gray-500 mt-1">
            Reported {incident.created_at?.slice(0, 10)}
            {incident.reported_by_name ? ` by ${incident.reported_by_name}` : ""}
            {incident.assigned_to_name ? ` · assigned to ${incident.assigned_to_name}` : ""}
            {incident.closed_at ? ` · closed ${incident.closed_at.slice(0, 10)}` : ""}
          </div>
        </div>
      </div>

      {incident.corrective_action && (
        <div className="mt-2 text-[12px] text-gray-600 bg-gray-50 rounded p-2">
          <span className="font-medium text-gray-700">CAPA:</span> {incident.corrective_action}
        </div>
      )}

      {incident.status !== "Closed" && (
        <div className="mt-2 space-y-2">
          <textarea
            value={capa}
            onChange={e => setCapa(e.target.value)}
            placeholder="Corrective & preventive action (CAPA)…"
            data-testid={`incident-capa-${incident.id}`}
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
          />
          {error && <div className="text-[12px] text-red-600">{error}</div>}
          <div className="flex items-center gap-2">
            <button
              onClick={saveCapa}
              className="px-2.5 py-1 rounded bg-[#0176D3] text-white text-[12px] font-medium hover:bg-[#0b5cab]"
            >
              Log CAPA
            </button>
            {incident.status === "CAPA" && (
              <button
                onClick={close}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white text-[#0176D3] text-[12px] font-medium hover:bg-gray-50"
              >
                Close incident
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IncidentReportForm({ personnel, onCreated }: { personnel: Personnel[]; onCreated: () => void }) {
  const [form, setForm] = useState({
    protocol_id: "", type: "Adverse Event" as IncidentType,
    severity: "Minor" as IncidentSeverity, description: "", reported_by: "",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setError(null);
    try {
      await api.createIncident({
        protocol_id: form.protocol_id.trim() || null,
        type: form.type,
        severity: form.severity,
        description: form.description.trim(),
        reported_by: form.reported_by ? Number(form.reported_by) : null,
      });
      setForm({ protocol_id: "", type: "Adverse Event", severity: "Minor", description: "", reported_by: "" });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <form onSubmit={submit} className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={form.protocol_id}
            onChange={e => setForm({ ...form, protocol_id: e.target.value })}
            placeholder="Protocol id (optional), e.g. IACUC-2026-0142"
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          />
          <select
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value as IncidentType })}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={form.severity}
            onChange={e => setForm({ ...form, severity: e.target.value as IncidentSeverity })}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {INCIDENT_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={form.reported_by}
            onChange={e => setForm({ ...form, reported_by: e.target.value })}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            <option value="">Reported by (optional)…</option>
            {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="Describe the adverse event, deviation, or noncompliance…"
          rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        {error && <div className="text-[12px] text-red-600">{error}</div>}
        <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]">
          <Plus size={14} />
          Report incident
        </button>
      </form>
    </div>
  );
}

function PamAuditForm({ personnel, onCreated }: { personnel: Personnel[]; onCreated: () => void }) {
  const [form, setForm] = useState({
    protocol_id: "", audit_date: "", auditor_id: "",
    site_visits: "", findings: "", report: "",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.protocol_id.trim() || !form.audit_date) return;
    setError(null);
    try {
      await api.createPamAudit(form.protocol_id.trim(), {
        audit_date: form.audit_date,
        auditor_id: form.auditor_id ? Number(form.auditor_id) : null,
        site_visits: form.site_visits.trim() || null,
        findings: form.findings.trim() || null,
        report: form.report.trim() || null,
      });
      setForm({ protocol_id: "", audit_date: "", auditor_id: "", site_visits: "", findings: "", report: "" });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <form onSubmit={submit} className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={form.protocol_id}
            onChange={e => setForm({ ...form, protocol_id: e.target.value })}
            placeholder="Protocol id, e.g. IACUC-2026-0142"
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          />
          <input
            value={form.audit_date}
            onChange={e => setForm({ ...form, audit_date: e.target.value })}
            type="date"
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          />
          <select
            value={form.auditor_id}
            onChange={e => setForm({ ...form, auditor_id: e.target.value })}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            <option value="">Auditor (optional)…</option>
            {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <input
          value={form.site_visits}
          onChange={e => setForm({ ...form, site_visits: e.target.value })}
          placeholder="Site visits (optional)"
          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        <input
          value={form.findings}
          onChange={e => setForm({ ...form, findings: e.target.value })}
          placeholder="Findings (optional)"
          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        <textarea
          value={form.report}
          onChange={e => setForm({ ...form, report: e.target.value })}
          placeholder="Audit report (optional)"
          rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        {error && <div className="text-[12px] text-red-600">{error}</div>}
        <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]">
          <Plus size={14} />
          Log site-visit audit
        </button>
      </form>
    </div>
  );
}

export default function PamPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [audits, setAudits] = useState<PamAudit[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadAudits = () => api.listPamAuditsForAll().then(setAudits).catch(err => setError(errorMessage(err)));

  const load = () => {
    api.listIncidents().then(setIncidents).catch(err => setError(errorMessage(err)));
    api.listPersonnel().then(setPersonnel).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { loadAudits(); }, []);

  return (
    <div>
      <Header active="pam" />
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Post-Approval Monitoring & incident reporting</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Report adverse events, deviations, and noncompliance against approved protocols, drive each one through
          the Open → CAPA → Closed lifecycle, and log the PAM site-visit audits the IACUC office conducts after approval.
        </p>
      </div>
      {error && <div className="px-4 pt-4 text-[12px] text-red-600">{error}</div>}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel title="Incidents" icon={ShieldAlert}>
          <IncidentReportForm personnel={personnel} onCreated={load} />
          <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
            {incidents.map(i => (
              <IncidentCard key={i.id} incident={i} onChanged={load} />
            ))}
            {incidents.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No incidents yet.</div>}
          </div>
        </Panel>

        <Panel title="PAM site-visit audits" icon={ClipboardList}>
          <PamAuditForm personnel={personnel} onCreated={loadAudits} />
          <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
            {audits.map(a => (
              <div key={a.id} className="px-4 py-2.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <Link to={`/protocols/${a.protocol_id}`} className="text-[#0176D3] font-medium hover:underline">
                    {a.protocol_id}
                  </Link>
                  <span className="text-gray-500">{a.audit_date}</span>
                  {a.auditor_name && <span className="text-gray-500">· {a.auditor_name}</span>}
                </div>
                {a.site_visits && <div className="text-[12px] text-gray-600 mt-1">Visited: {a.site_visits}</div>}
                {a.findings && <div className="text-[12px] text-gray-600 mt-0.5">Findings: {a.findings}</div>}
                {a.report && <div className="text-[12px] text-gray-600 mt-0.5">{a.report}</div>}
              </div>
            ))}
            {audits.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No audits logged yet.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
