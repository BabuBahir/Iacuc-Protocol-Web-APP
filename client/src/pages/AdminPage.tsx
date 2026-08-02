import React, { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Plus, Trash2, PawPrint, Shield, Users, type LucideIcon } from "lucide-react";
import { api } from "../api";
import type { Personnel, Role, Species } from "../types";

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

function PersonnelPanel({ roles }: { roles: Role[] }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [form, setForm] = useState<PersonnelFormState>({ name: "", email: "", role_id: "" });
  const [error, setError] = useState<string | null>(null);

  const load = () => api.listPersonnel().then(setPersonnel).catch(err => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);

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
        {personnel.map(p => (
          <div key={p.id} className="px-4 py-2.5 flex items-center justify-between text-[13px]">
            <div>
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
            </div>
            <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {personnel.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-[13px]">No personnel yet.</div>}
      </div>
    </Panel>
  );
}

export default function AdminPage() {
  const [roles, setRoles] = useState<Role[]>([]);

  return (
    <div>
      <div className="bg-[#032D60] text-white px-4 py-2 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-[14px] hover:opacity-90">
          <LayoutGrid size={16} />
          IACUC Protocols
        </Link>
        <div className="flex items-center gap-5 text-[13px] text-gray-200 ml-4">
          <Link to="/" className="hover:text-white">Protocols</Link>
          <Link to="/committee" className="hover:text-white">Committee</Link>
          <span className="text-white border-b-2 border-white pb-2 -mb-2 pt-2">Admin</span>
        </div>
      </div>

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
