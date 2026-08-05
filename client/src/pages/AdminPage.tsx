import React, { useEffect, useState, type ReactNode } from "react";
import {
  Plus, Trash2, PawPrint, Shield, Users, X, GraduationCap,
  ClipboardCheck, type LucideIcon,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import { api } from "../api";
import type {
  Personnel, PersonnelCompliance, PersonnelOhsp, Role, Species,
  OhspStatus, TrainingRecord,
} from "../types";
import { OHSP_STATUSES } from "../types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
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

function SpeciesPanel() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => api.listSpecies().then(setSpecies).catch(err => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await api.createSpecies(name.trim());
      setName("");
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteSpecies(id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Panel title="Animal species" icon={PawPrint}>
      <form onSubmit={add} className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Guinea pig"
          className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]">
          <Plus size={14} />
          Add
        </button>
      </form>
      {error && <div className="px-4 py-2 text-[12px] text-red-600">{error}</div>}
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {species.map(s => (
          <div key={s.id} className="px-4 py-2 flex items-center justify-between text-[13px] text-gray-700">
            {s.name}
            <button onClick={() => remove(s.id)} className="text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {species.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No species yet.</div>}
      </div>
    </Panel>
  );
}

function RolesPanel({ onRolesChange }: { onRolesChange: (roles: Role[]) => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [isCommittee, setIsCommittee] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.listRoles().then(rows => { setRoles(rows); onRolesChange(rows); }).catch(err => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await api.createRole(name.trim(), isCommittee);
      setName("");
      setIsCommittee(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (id: number) => {
    setError(null);
    try {
      await api.deleteRole(id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Panel title="IACUC roles" icon={Shield}>
      <form onSubmit={add} className="px-4 py-3 border-b border-gray-100 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Attending Veterinarian"
            className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          />
          <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] shrink-0">
            <Plus size={14} />
            Add
          </button>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-gray-600">
          <input type="checkbox" checked={isCommittee} onChange={e => setIsCommittee(e.target.checked)} />
          Eligible to cast Full Committee Review (FCR) votes
        </label>
      </form>
      {error && <div className="px-4 py-2 text-[12px] text-red-600">{error}</div>}
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {roles.map(r => (
          <div key={r.id} className="px-4 py-2 flex items-center justify-between text-[13px] text-gray-700">
            <div className="flex items-center gap-2">
              {r.name}
              {!!r.is_committee && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#E6F1FB] text-[#185FA5] text-[11px] font-medium">
                  Committee
                </span>
              )}
            </div>
            <button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {roles.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No roles yet.</div>}
      </div>
    </Panel>
  );
}

interface PersonnelFormState {
  name: string;
  email: string;
  role_id: string;
}

function trainingStatusChip(status: string) {
  const tone =
    status === "Current"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Expired"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${tone}`}>
      Training: {status}
    </span>
  );
}

function ohspStatusChip(status: string) {
  const tone =
    status === "Cleared"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Denied"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700";
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${tone}`}>
      OHSP: {status}
    </span>
  );
}

interface ComplianceModalProps {
  person: Personnel;
  onClose: () => void;
  onChanged: () => void;
}

function ComplianceModal({ person, onClose, onChanged }: ComplianceModalProps) {
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [ohsp, setOhsp] = useState<PersonnelOhsp | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [course, setCourse] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [expiresDate, setExpiresDate] = useState("");

  const load = () => {
    setError(null);
    api.getPersonnelTraining(person.id)
      .then(res => setTraining(res.courses))
      .catch(err => setError(errorMessage(err)));
    api.getPersonnelOhsp(person.id)
      .then(setOhsp)
      .catch(err => setError(errorMessage(err)));
  };

  useEffect(() => { load(); }, [person.id]);

  const addTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course.trim() || !completedDate) return;
    setError(null);
    try {
      await api.createTrainingRecord(person.id, {
        course: course.trim(),
        completed_date: completedDate,
        expires_date: expiresDate || null,
      });
      setCourse("");
      setCompletedDate("");
      setExpiresDate("");
      load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeTraining = async (id: number) => {
    try {
      await api.deleteTrainingRecord(person.id, id);
      load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const setOhspStatus = async (status: OhspStatus) => {
    setError(null);
    try {
      await api.setPersonnelOhsp(person.id, { status });
      load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const inputCls = "bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900 text-sm">Compliance — {person.name}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {error && <div className="text-[12px] text-red-600">{error}</div>}

          <div>
            <div className="flex items-center gap-1.5 font-medium text-gray-800 text-[13px] mb-2">
              <GraduationCap size={15} className="text-gray-500" /> CITI / training
            </div>
            <div className="space-y-1.5">
              {training.length === 0 && (
                <div className="text-[12px] text-gray-400">No training records on file.</div>
              )}
              {training.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <div className="min-w-0">
                    <div className="text-gray-900 truncate">{t.course}</div>
                    <div className="text-[11px] text-gray-500">
                      Completed {t.completed_date}{t.expires_date ? ` · Expires ${t.expires_date}` : " · No expiry"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {trainingStatusChip(t.status)}
                    <button onClick={() => removeTraining(t.id)} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${t.course}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={addTraining} className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={course} onChange={e => setCourse(e.target.value)} placeholder="Course name" className={inputCls} aria-label="Course name" />
              <input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} className={inputCls} aria-label="Completed date" />
              <input type="date" value={expiresDate} onChange={e => setExpiresDate(e.target.value)} className={inputCls} aria-label="Expires date" />
              <button className="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]">
                <Plus size={14} /> Add training
              </button>
            </form>
          </div>

          <div>
            <div className="flex items-center gap-1.5 font-medium text-gray-800 text-[13px] mb-2">
              <ClipboardCheck size={15} className="text-gray-500" /> OHSP clearance
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {OHSP_STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => setOhspStatus(status)}
                  className={[
                    "px-3 py-1 rounded-full text-[12px] font-medium border",
                    ohsp?.status === status
                      ? "bg-[#032D60] text-white border-[#032D60]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {status}
                </button>
              ))}
            </div>
            {ohsp?.reviewed_date && (
              <div className="text-[11px] text-gray-500 mt-1.5">
                Last reviewed {ohsp.reviewed_date}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonnelPanel({ roles }: { roles: Role[] }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [compliance, setCompliance] = useState<Record<number, PersonnelCompliance>>({});
  const [form, setForm] = useState<PersonnelFormState>({ name: "", email: "", role_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState<Personnel | null>(null);

  const load = () => api.listPersonnel().then(setPersonnel).catch(err => setError(errorMessage(err)));
  const loadCompliance = () => api.listPersonnelCompliance()
    .then(rows => {
      const map: Record<number, PersonnelCompliance> = {};
      for (const row of rows) map[row.id] = row;
      setCompliance(map);
    })
    .catch(() => {});
  useEffect(() => {
    load();
    loadCompliance();
  }, []);

  useEffect(() => {
    if (!form.role_id && roles.length > 0) {
      setForm(f => ({ ...f, role_id: String(roles[0].id) }));
    }
  }, [roles]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.role_id) return;
    setError(null);
    try {
      await api.createPersonnel({ name: form.name.trim(), email: form.email.trim() || null, role_id: Number(form.role_id) });
      setForm(f => ({ ...f, name: "", email: "" }));
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (id: number) => {
    try {
      await api.deletePersonnel(id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Panel title="Personnel (personas)" icon={Users}>
      <form onSubmit={add} className="px-4 py-3 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="Full name"
          className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        <input
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="Email (optional)"
          className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        <div className="flex items-center gap-2">
          <select
            value={form.role_id}
            onChange={e => setForm({ ...form, role_id: e.target.value })}
            className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] shrink-0">
            <Plus size={14} />
          </button>
        </div>
      </form>
      {error && <div className="px-4 py-2 text-[12px] text-red-600">{error}</div>}
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {personnel.map(p => {
          const c = compliance[p.id];
          return (
            <div key={p.id} className="px-4 py-2.5 flex items-center justify-between text-[13px]">
              <div className="min-w-0">
                <div className="text-gray-900 font-medium">{p.name}</div>
                <div className="text-gray-500 text-[12px] flex items-center gap-1.5">
                  {p.role_name}
                  {!!p.is_committee && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#E6F1FB] text-[#185FA5] text-[11px] font-medium">
                      Committee
                    </span>
                  )}
                  {p.email && <span>· {p.email}</span>}
                </div>
                {c && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {trainingStatusChip(c.training_status)}
                    {ohspStatusChip(c.ohsp_status)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setManaging(p)}
                  className="px-2.5 py-1 rounded border border-gray-300 bg-white text-[#0176D3] text-[12px] font-medium hover:bg-gray-50"
                >
                  Manage compliance
                </button>
                <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {personnel.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No personnel yet.</div>}
      </div>

      {managing && (
        <ComplianceModal
          person={managing}
          onClose={() => setManaging(null)}
          onChanged={loadCompliance}
        />
      )}
    </Panel>
  );
}

export default function AdminPage() {
  const [roles, setRoles] = useState<Role[]>([]);

  return (
    <div>
      <AppHeader active="admin" />

      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Manage the lookup lists used across protocols: animal species, IACUC roles, and the
          personnel (personas) assigned to those roles — vets, committee members, coordinators, etc.
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <SpeciesPanel />
        <RolesPanel onRolesChange={setRoles} />
        <PersonnelPanel roles={roles} />
      </div>
    </div>
  );
}
