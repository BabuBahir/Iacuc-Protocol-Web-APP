import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft, Star, Printer, MoreHorizontal, Check, X,
  Users, FileText, Clock, Paperclip, Mail, Phone, Building2,
  Syringe, ClipboardList, type LucideIcon,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import ProtocolForm from "../components/ProtocolForm";
import { api } from "../api";
import type { ProtocolDetail, ProtocolFormValues } from "../types";

const LIST_ICONS: Record<string, LucideIcon> = {
  Personnel: Users,
  Amendments: FileText,
  "Approval history": Clock,
  Attachments: Paperclip,
};

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
            <button onClick={() => setShowEdit(true)} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-[#0176D3] text-[13px] font-medium hover:bg-gray-50">Edit</button>
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

          <SectionBlock icon={Syringe} title="Animal care & use">
            <InfoRow label="Anesthesia" value={protocol.anesthesia_required ? "Yes" : "No"} />
            <InfoRow label="Non-pharmaceutical-grade compounds" value={protocol.npg || "None"} />
            <InfoRow label="Housing" value={protocol.housing || "—"} />
            <InfoRow label="Disposal" value={protocol.disposal || "—"} />
          </SectionBlock>

          <SectionBlock icon={ClipboardList} title="Research plan">
            {protocol.research_steps.length > 0 ? (
              <ol className="space-y-1.5">
                {protocol.research_steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-gray-800">
                    <span className="font-medium text-gray-500 shrink-0">Step {i + 1}.</span>
                    {step}
                  </li>
                ))}
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
                  {rows.map(row => <div key={row} className="px-4 py-2 text-[13px] text-gray-700">{row}</div>)}
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
    </div>
  );
}
