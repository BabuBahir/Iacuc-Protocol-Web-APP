import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid, GitPullRequestArrow, Plus, FileText, RefreshCcw, Check, X,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { api } from "../api";
import type {
  Amendment, AmendmentStatus, Protocol, ProtocolVersion, Renewal, RenewalStatus,
  RenewalType,
} from "../types";
import { RENEWAL_TYPES } from "../types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function Header() {
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
        <Link to="/pam" className="hover:text-white">PAM</Link>
        <span className="text-white border-b-2 border-white pb-2 -mb-2 pt-2">Amendments</span>
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

function statusStyles(status: AmendmentStatus | RenewalStatus): string {
  switch (status) {
    case "Approved": return "bg-emerald-50 text-emerald-700";
    case "Rejected": return "bg-red-50 text-red-700";
    default: return "bg-amber-50 text-amber-700";
  }
}

function AmendmentCard({ amendment, protocolId, onChanged }: { amendment: Amendment; protocolId: string; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiration, setExpiration] = useState("");
  const [change, setChange] = useState({ section: "", field: "", previous_value: "", new_value: "" });

  const recordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!change.section.trim() || !change.field.trim()) return;
    setError(null);
    try {
      await api.addAmendmentChange(protocolId, amendment.id, {
        section: change.section.trim(),
        field: change.field.trim(),
        previous_value: change.previous_value || null,
        new_value: change.new_value || null,
      });
      setChange({ section: "", field: "", previous_value: "", new_value: "" });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const decide = async (status: AmendmentStatus) => {
    setError(null);
    try {
      await api.updateAmendmentStatus(protocolId, amendment.id, status, status === "Approved" && expiration ? expiration : undefined);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-gray-50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] text-gray-900 font-medium">
            {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
            <span>{amendment.reason}</span>
          </div>
          <div className="text-[12px] text-gray-500 mt-0.5 ml-5">
            Started {amendment.created_at?.slice(0, 10)} · {amendment.changes.length} change{amendment.changes.length === 1 ? "" : "s"}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statusStyles(amendment.status)}`}>
          {amendment.status}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {amendment.changes.length > 0 && (
            <div className="divide-y divide-gray-50">
              {amendment.changes.map(c => (
                <div key={c.id} className="py-1.5 text-[12px]">
                  <span className="text-gray-700 font-medium">{c.section} · {c.field}</span>
                  <div className="text-gray-500">
                    <span className="line-through">{c.previous_value || "—"}</span>
                    {" → "}
                    <span className="text-[#0176D3]">{c.new_value || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {amendment.status === "Pending" && (
            <>
              <form onSubmit={recordChange} className="space-y-2 bg-gray-50 rounded p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={change.section}
                    onChange={e => setChange({ ...change, section: e.target.value })}
                    placeholder="Section, e.g. animal_use"
                    className="bg-white border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
                  />
                  <input
                    value={change.field}
                    onChange={e => setChange({ ...change, field: e.target.value })}
                    placeholder="Field, e.g. species_strain"
                    className="bg-white border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
                  />
                  <input
                    value={change.previous_value}
                    onChange={e => setChange({ ...change, previous_value: e.target.value })}
                    placeholder="Previous version"
                    className="bg-white border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
                  />
                  <input
                    value={change.new_value}
                    onChange={e => setChange({ ...change, new_value: e.target.value })}
                    placeholder="Live change (proposed)"
                    className="bg-white border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
                  />
                </div>
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-white border border-gray-300 text-[12px] font-medium hover:bg-gray-50">
                  <Plus size={13} />
                  Record change
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={expiration}
                  onChange={e => setExpiration(e.target.value)}
                  type="date"
                  aria-label="Expiration date for amendment"
                  className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
                />
                <button
                  onClick={() => decide("Approved")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0176D3] text-white text-[12px] font-medium hover:bg-[#0b5cab]"
                >
                  <Check size={13} />
                  Approve amendment
                </button>
                <button
                  onClick={() => decide("Rejected")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-300 bg-white text-[#A32D2D] text-[12px] font-medium hover:bg-gray-50"
                >
                  <X size={13} />
                  Reject
                </button>
              </div>
            </>
          )}
          {error && <div className="text-[12px] text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}

function RenewalRow({ renewal, protocolId, onChanged }: { renewal: Renewal; protocolId: string; onChanged: () => void }) {
  const [approvedUntil, setApprovedUntil] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = async (status: RenewalStatus) => {
    setError(null);
    try {
      await api.updateRenewalStatus(protocolId, renewal.id, status, status === "Approved" ? approvedUntil : undefined);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="px-4 py-2.5 border-b border-gray-100 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-900 font-medium">{renewal.type}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${statusStyles(renewal.status)}`}>
            {renewal.status}
          </span>
        </div>
        <span className="text-[12px] text-gray-500 shrink-0">{renewal.submitted_date ?? ""}</span>
      </div>
      {(renewal.decision_date || renewal.approved_until) && (
        <div className="text-[12px] text-gray-500 mt-0.5">
          {renewal.decision_date ? `Decided ${renewal.decision_date}` : ""}
          {renewal.approved_until ? ` · renewed through ${renewal.approved_until}` : ""}
        </div>
      )}
      {renewal.status === "Pending" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={approvedUntil}
            onChange={e => setApprovedUntil(e.target.value)}
            type="date"
            aria-label="Approved until date for renewal"
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[12px] outline-none focus:border-[#0176D3]"
          />
          <button
            onClick={() => decide("Approved")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0176D3] text-white text-[12px] font-medium hover:bg-[#0b5cab]"
          >
            <Check size={13} />
            Approve renewal
          </button>
          <button
            onClick={() => decide("Rejected")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-300 bg-white text-[#A32D2D] text-[12px] font-medium hover:bg-gray-50"
          >
            <X size={13} />
            Reject
          </button>
        </div>
      )}
      {error && <div className="text-[12px] text-red-600 mt-1">{error}</div>}
    </div>
  );
}

export default function AmendmentsPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [versions, setVersions] = useState<ProtocolVersion[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startReason, setStartReason] = useState("");
  const [renewalType, setRenewalType] = useState<RenewalType>("Continuing Review");

  useEffect(() => {
    api.listProtocols().then(rows => {
      setProtocols(rows);
      if (rows.length > 0) setSelectedId(rows[0].id);
    }).catch(err => setError(errorMessage(err)));
  }, []);

  const loadFor = () => {
    if (!selectedId) return;
    api.listAmendments(selectedId).then(setAmendments).catch(err => setError(errorMessage(err)));
    api.listProtocolVersions(selectedId).then(setVersions).catch(() => {});
    api.listRenewals(selectedId).then(setRenewals).catch(() => {});
  };
  useEffect(loadFor, [selectedId]);

  const startAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !startReason.trim()) return;
    setError(null);
    try {
      await api.createAmendment(selectedId, { reason: startReason.trim() });
      setStartReason("");
      loadFor();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const startRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    try {
      await api.createRenewal(selectedId, { type: renewalType });
      loadFor();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const selected = protocols.find(p => p.id === selectedId);

  return (
    <div>
      <Header />
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Amendments & annual renewals</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Versioned amendment documents (one in flight per protocol at a time, live-diff change records, and a new
          protocol version on approval) plus the distinct Continuing Review and De Novo Review events.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-[13px] text-gray-600 font-medium" htmlFor="amendments-protocol">Protocol</label>
          <select
            id="amendments-protocol"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="bg-white border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {protocols.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
          </select>
          {selected && <span className="text-[12px] text-gray-500 truncate max-w-md">{selected.title}</span>}
        </div>
      </div>
      {error && <div className="px-4 pt-4 text-[12px] text-red-600">{error}</div>}

      {selectedId ? (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <Panel title="Amendments" icon={GitPullRequestArrow}>
            <form onSubmit={startAmendment} className="px-4 py-3 border-b border-gray-100 space-y-2">
              <input
                value={startReason}
                onChange={e => setStartReason(e.target.value)}
                placeholder="Reason for change (required) — e.g. Add a second mouse strain…"
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
              />
              <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]">
                <Plus size={14} />
                Start amendment
              </button>
            </form>
            <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
              {amendments.map(a => (
                <AmendmentCard key={a.id} amendment={a} protocolId={selectedId} onChanged={loadFor} />
              ))}
              {amendments.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No amendments for this protocol yet.</div>}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Protocol versions" icon={FileText}>
              <div className="divide-y divide-gray-100 max-h-[240px] overflow-y-auto">
                {versions.map(v => (
                  <div key={v.id} className="px-4 py-2 text-[13px] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-900 font-medium">{v.version_number}</span>
                      <span className="text-[12px] text-gray-500 truncate">{v.source}</span>
                    </div>
                    <span className="text-[12px] text-gray-500 shrink-0">
                      {v.approved_date ?? ""}{v.expiration_date ? ` → ${v.expiration_date}` : ""}
                    </span>
                  </div>
                ))}
                {versions.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No version lineage yet.</div>}
              </div>
            </Panel>

            <Panel title="Renewals" icon={RefreshCcw}>
              <form onSubmit={startRenewal} className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <select
                  value={renewalType}
                  onChange={e => setRenewalType(e.target.value as RenewalType)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
                >
                  {RENEWAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] shrink-0">
                  <Plus size={14} />
                  Start renewal
                </button>
              </form>
              <div className="max-h-[320px] overflow-y-auto">
                {renewals.map(r => (
                  <RenewalRow key={r.id} renewal={r} protocolId={selectedId} onChanged={loadFor} />
                ))}
                {renewals.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No renewals for this protocol yet.</div>}
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="px-4 py-10 text-center text-gray-400 text-[13px]">No protocols available.</div>
      )}
    </div>
  );
}
