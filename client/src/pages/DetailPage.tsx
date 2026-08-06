import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft, Star, Printer, MoreHorizontal, Check, X, ArrowRightLeft,
  Users, FileText, Clock, Paperclip, Mail, Phone, Building2,
  Syringe, ClipboardList, type LucideIcon,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import ProtocolForm from "../components/ProtocolForm";
import { api } from "../api";
import type { Personnel, ProtocolDetail, ProtocolFormValues, ProtocolPersonnelEntry, ProtocolTransfer } from "../types";

const LIST_ICONS: Record<string, LucideIcon> = {
  Personnel: Users,
  Amendments: FileText,
  "Approval history": Clock,
  Attachments: Paperclip,
};

function ComplianceChip({ entry }: { entry: ProtocolPersonnelEntry }) {
  const ok = entry.compliance.compliant;
  return (
    <span
      className={[
        "px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0",
        ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {ok ? "Compliant" : "Action needed"}
    </span>
  );
}

interface EditProtocolModalProps {
  protocol: ProtocolDetail;
  onClose: () => void;
  onSaved: () => void;
}

function EditProtocolModal({ protocol, onClose, onSaved }: EditProtocolModalProps) {
  const submit = async (values: ProtocolFormValues) => {
    await api.updateProtocol(protocol.id, values);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900 text-sm">Edit protocol</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ProtocolForm
          initialValues={protocol}
          statusOptions={protocol.stages}
          showDates
          submitLabel="Save changes"
          onCancel={onClose}
          onSubmit={submit}
        />
      </div>
    </div>
  );
}

function TransferOwnershipModal({ protocol, onClose, onSaved }: { protocol: ProtocolDetail; onClose: () => void; onSaved: () => void }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [pending, setPending] = useState<ProtocolTransfer | null>(null);
  const [toPersonnelId, setToPersonnelId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listPersonnel().then(setPersonnel).catch(() => {});
    api.listTransfers("Pending").then(rows => {
      setPending(rows.find(r => r.protocol_id === protocol.id) ?? null);
    }).catch(() => {});
  }, [protocol.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toPersonnelId || !reason.trim() || pending) return;
    setBusy(true);
    setError(null);
    try {
      await api.createTransfer(protocol.id, { to_personnel_id: Number(toPersonnelId), reason: reason.trim() });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900 text-sm">Transfer ownership</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {pending ? (
          <div className="p-4">
            <div className="rounded bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-[13px]">
              A transfer request is already pending for this protocol (requested to {pending.to_name ?? "another investigator"}).
              It will sit in the IACUC-office transfer queue until approved or rejected.
            </div>
            <button onClick={onClose} className="mt-3 w-full px-3 py-1.5 rounded border border-gray-300 bg-white text-[13px] font-medium hover:bg-gray-50">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-4 space-y-3">
            <div>
              <label htmlFor="transfer-to" className="block text-[12px] font-medium text-gray-700 mb-1">New principal investigator</label>
              <select
                id="transfer-to"
                value={toPersonnelId}
                onChange={e => setToPersonnelId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
              >
                <option value="">Select a person…</option>
                {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="transfer-reason" className="block text-[12px] font-medium text-gray-700 mb-1">Reason for transfer (required)</label>
              <textarea
                id="transfer-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Dr. Marsh is leaving the institution; Dr. Sato will take over the study."
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
              />
            </div>
            {error && <div className="text-[12px] text-red-600">{error}</div>}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={busy || !toPersonnelId || !reason.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRightLeft size={14} />
                Request transfer
              </button>
              <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-[13px] font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Transfers aren't instant — the request goes to the IACUC office for approval.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 mb-0.5">{label}</div>
      <div className="text-[13px] text-gray-900">{value}</div>
    </div>
  );
}

function SectionBlock({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 font-semibold text-gray-800 text-sm">
        <Icon size={15} className="text-gray-500" />
        {title}
      </div>
      <div className="p-4 space-y-2.5">{children}</div>
    </div>
  );
}

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [protocol, setProtocol] = useState<ProtocolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [personnel, setPersonnel] = useState<Record<string, ProtocolPersonnelEntry>>({});

  const reload = () => {
    api.getProtocol(id!)
      .then(setProtocol)
      .catch(err => setError(err instanceof Error ? err.message : String(err)));
  };

  useEffect(() => {
    let cancelled = false;
    api.getProtocol(id!)
      .then(data => !cancelled && setProtocol(data))
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    api.getProtocolPersonnel(id!)
      .then(data => {
        if (cancelled) return;
        const byLabel: Record<string, ProtocolPersonnelEntry> = {};
        for (const entry of data.personnel) byLabel[entry.label] = entry;
        setPersonnel(byLabel);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">Couldn't load {id}: {error}</p>
        <Link to="/" className="text-[#0176D3] hover:underline">Back to list</Link>
      </div>
    );
  }
  if (!protocol) return <div className="p-6 text-gray-500">Loading…</div>;

  const stageIndex = Math.max(protocol.stages.indexOf(protocol.status), 0);

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 text-[12px] text-[#0176D3] flex items-center gap-1">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:underline">
          <ChevronLeft size={14} />IACUC Protocols
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">{protocol.id}</span>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 pt-3 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] text-gray-500">IACUC Protocol Application</div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{protocol.id}</h1>
              <Star size={16} className="text-gray-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => navigate(`/protocols/${protocol.id}/application`)} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-[#0176D3] text-[13px] font-medium hover:bg-gray-50">Edit application</button>
            <button onClick={() => setShowEdit(true)} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-[#0176D3] text-[13px] font-medium hover:bg-gray-50">Edit</button>
            <button onClick={() => setShowTransfer(true)} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-[#0176D3] text-[13px] font-medium hover:bg-gray-50">Transfer ownership</button>
            <button className="p-1.5 rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-50"><Printer size={15} /></button>
            <button className="p-1.5 rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-50"><MoreHorizontal size={15} /></button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 pb-3">
          <div><div className="text-[11px] uppercase text-gray-500 mb-0.5">Status</div><StatusBadge status={protocol.status} /></div>
          <div><div className="text-[11px] uppercase text-gray-500 mb-0.5">Principal investigator</div><div className="text-sm font-medium">{protocol.pi}</div></div>
          <div><div className="text-[11px] uppercase text-gray-500 mb-0.5">Species</div><div className="text-sm font-medium">{protocol.species}</div></div>
          <div><div className="text-[11px] uppercase text-gray-500 mb-0.5">Number of animals</div><div className="text-sm font-medium">{protocol.animals}</div></div>
          <div><div className="text-[11px] uppercase text-gray-500 mb-0.5">Pain category</div><div className="text-sm font-medium">{protocol.pain_category}</div></div>
        </div>

        <div className="flex items-stretch border-t border-gray-100 -mx-4 px-4 pt-2 pb-2 bg-gray-50">
          {protocol.stages.map((stage, i) => {
            const done = i < stageIndex;
            const active = i === stageIndex;
            return (
              <div key={stage} className={[
                "relative flex-1 text-center text-[12px] font-medium py-1.5 px-2 first:rounded-l-full last:rounded-r-full",
                done ? "bg-[#97C459] text-[#173404]" : active ? "bg-[#0176D3] text-white" : "bg-gray-200 text-gray-500",
                i !== 0 ? "ml-0.5" : "",
              ].join(" ")}>
                <span className="inline-flex items-center gap-1">{done && <Check size={12} />}{stage}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionBlock icon={FileText} title="Protocol information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="Protocol title" value={protocol.title} />
              <InfoRow label="Protocol type" value={protocol.protocol_type || "—"} />
              <InfoRow label="PI proxy" value={protocol.pi_proxy || "—"} />
              <InfoRow label="PTM member" value={protocol.ptm_member || "—"} />
              <InfoRow label="Submitted" value={protocol.submitted || "—"} />
              <InfoRow label="Expires" value={protocol.expires || "—"} />
            </div>
          </SectionBlock>

          <SectionBlock icon={ClipboardList} title="Purpose & summary">
            <InfoRow label="Lay purpose" value={protocol.purpose_summary || "—"} />
            <InfoRow label="Harm–benefit analysis" value={protocol.harm_benefit_analysis || "—"} />
            <InfoRow label="Scientific summary" value={protocol.scientific_summary || "—"} />
          </SectionBlock>

          <SectionBlock icon={Syringe} title="Animal care & use">
            <InfoRow label="Anesthesia" value={protocol.anesthesia_required ? "Yes" : "No"} />
            <InfoRow label="Non-pharmaceutical-grade compounds" value={protocol.npg || "None"} />
            <InfoRow label="Housing" value={protocol.housing || "—"} />
            <InfoRow label="Disposal" value={protocol.disposal || "—"} />
          </SectionBlock>

          <SectionBlock icon={ClipboardList} title="Research plan">
            {protocol.research_steps.length > 0 ? (
              <ol className="space-y-2">
                {protocol.research_steps.map((step, i) => {
                  const meta = [step.duration, step.frequency, step.species, step.location, step.personnel]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={i} className="text-[13px] text-gray-800">
                      <span className="font-medium text-gray-500 mr-1.5">Step {i + 1}.</span>
                      {step.description}
                      {meta && <div className="text-[12px] text-gray-500 mt-0.5">{meta}</div>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="text-[13px] text-gray-400">No research steps recorded.</div>
            )}
          </SectionBlock>

          {Object.entries(protocol.related || {}).map(([listName, rows]) => {
            const Icon = LIST_ICONS[listName] || FileText;
            return (
              <div key={listName} className="bg-white border border-gray-200 rounded-lg">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
                    <Icon size={15} className="text-gray-500" />
                    {listName} ({rows.length})
                  </div>
                  <button className="text-[#0176D3] text-xs font-medium">View all</button>
                </div>
                <div className="divide-y divide-gray-100">
                  {rows.map(row => {
                    const entry = listName === "Personnel" ? personnel[row] : undefined;
                    return (
                      <div key={row} className="px-4 py-2 text-[13px] text-gray-700 flex items-center justify-between gap-2">
                        <span>{row}</span>
                        {entry && <ComplianceChip entry={entry} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-2.5 border-b border-gray-100 font-semibold text-gray-800 text-sm">Study contact</div>
            <div className="p-4 space-y-2 text-[13px] text-gray-600">
              <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400" /> {(protocol.pi.split(" ")[1] || "contact").toLowerCase()}@university.edu</div>
              <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /> (614) 555-0134</div>
              <div className="flex items-center gap-2"><Building2 size={14} className="text-gray-400" /> Neuroscience, Bldg 4</div>
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditProtocolModal
          protocol={protocol}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); reload(); }}
        />
      )}
      {showTransfer && (
        <TransferOwnershipModal
          protocol={protocol}
          onClose={() => setShowTransfer(false)}
          onSaved={() => { setShowTransfer(false); reload(); }}
        />
      )}
    </div>
  );
}
