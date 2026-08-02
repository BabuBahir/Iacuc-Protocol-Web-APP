import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api.js";

const PAIN_CATEGORIES = ["Category A", "Category B", "Category C", "Category D", "Category E"];

const INPUT_CLASS = "w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]";

// Shared protocol form used by the Create page (full-page) and the detail
// page's Edit modal. Owns its own state and species lookup; the caller
// supplies initial values, an async onSubmit, and optional field groups:
//   showProtocolNumber — render the protocol-number input (create only)
//   statusOptions      — render the Status dropdown (edit only)
//   showDates          — render submitted/expires date inputs (edit only)
export default function ProtocolForm({
  initialValues,
  onCancel,
  onSubmit,
  submitLabel,
  showProtocolNumber = false,
  statusOptions = null,
  showDates = false,
}) {
  const [species, setSpecies] = useState([]);
  const [form, setForm] = useState({
    id: initialValues.id ?? "",
    title: initialValues.title ?? "",
    pi: initialValues.pi ?? "",
    species: initialValues.species ?? "",
    animals: initialValues.animals ?? "",
    pain_category: initialValues.pain_category ?? "",
    status: initialValues.status ?? "",
    submitted: initialValues.submitted ?? "",
    expires: initialValues.expires ?? "",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listSpecies()
      .then(rows => {
        setSpecies(rows);
        if (rows.length > 0) setForm(f => ({ ...f, species: f.species || rows[0].name }));
      })
      .catch(err => setError(err.message));
  }, []);

  const speciesOptions = species.map(s => s.name);
  if (form.species && !speciesOptions.includes(form.species)) speciesOptions.unshift(form.species);

  const resolvedStatusOptions = statusOptions ? [...statusOptions] : null;
  if (resolvedStatusOptions && form.status && !resolvedStatusOptions.includes(form.status)) {
    resolvedStatusOptions.unshift(form.status);
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.pi.trim() || (showProtocolNumber && !form.id.trim())) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        id: form.id.trim(),
        title: form.title.trim(),
        pi: form.pi.trim(),
        species: form.species || null,
        animals: form.animals ? Number(form.animals) : null,
        pain_category: form.pain_category || null,
        status: form.status || null,
        submitted: form.submitted || null,
        expires: form.expires || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      {showProtocolNumber && (
        <div>
          <label htmlFor="new-protocol-id" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Protocol number</label>
          <input
            id="new-protocol-id"
            value={form.id}
            onChange={set("id")}
            placeholder="e.g. IACUC-2026-0160"
            className={INPUT_CLASS}
          />
        </div>
      )}
      <div>
        <label htmlFor="protocol-form-title" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Title</label>
        <input
          id="protocol-form-title"
          value={form.title}
          onChange={set("title")}
          placeholder="e.g. Effects of X on Y"
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="protocol-form-pi" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Principal investigator</label>
        <input
          id="protocol-form-pi"
          value={form.pi}
          onChange={set("pi")}
          placeholder="e.g. Dr. Raju"
          className={INPUT_CLASS}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="protocol-form-species" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Species</label>
          <select
            id="protocol-form-species"
            value={form.species}
            onChange={set("species")}
            className={INPUT_CLASS}
          >
            {speciesOptions.length === 0 && <option value="">No species available</option>}
            {speciesOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {statusOptions ? (
          <div>
            <label htmlFor="protocol-form-status" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Status</label>
            <select
              id="protocol-form-status"
              value={form.status}
              onChange={set("status")}
              className={INPUT_CLASS}
            >
              {resolvedStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="protocol-form-animals" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Number of animals</label>
            <input
              id="protocol-form-animals"
              value={form.animals}
              onChange={set("animals")}
              type="number"
              min="0"
              placeholder="e.g. 100"
              className={INPUT_CLASS}
            />
          </div>
        )}
      </div>
      {statusOptions ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="protocol-form-animals" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Number of animals</label>
            <input
              id="protocol-form-animals"
              value={form.animals}
              onChange={set("animals")}
              type="number"
              min="0"
              placeholder="e.g. 100"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="protocol-form-pain" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Pain category</label>
            <select
              id="protocol-form-pain"
              value={form.pain_category}
              onChange={set("pain_category")}
              className={INPUT_CLASS}
            >
              <option value="">—</option>
              {PAIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="protocol-form-pain" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Pain category</label>
          <select
            id="protocol-form-pain"
            value={form.pain_category}
            onChange={set("pain_category")}
            className={INPUT_CLASS}
          >
            <option value="">—</option>
            {PAIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      {showDates && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="protocol-form-submitted" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Submitted</label>
            <input
              id="protocol-form-submitted"
              value={form.submitted}
              onChange={set("submitted")}
              type="date"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="protocol-form-expires" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Expires</label>
            <input
              id="protocol-form-expires"
              value={form.expires}
              onChange={set("expires")}
              type="date"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}
      {error && <div className="text-[12px] text-red-600">{error}</div>}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 text-[13px] font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] disabled:opacity-50"
        >
          <Plus size={14} />
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
