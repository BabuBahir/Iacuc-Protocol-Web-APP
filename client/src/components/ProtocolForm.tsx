import React, { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { PAIN_CATEGORIES, PROTOCOL_TYPES, STEP_FREQUENCIES, type ProtocolFormValues, type ResearchStep, type Species } from "../types";

const INPUT_CLASS = "w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]";
const LABEL_CLASS = "block text-[11px] uppercase tracking-wide text-gray-500 mb-1";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="pt-3 border-t border-gray-100 text-[11px] uppercase tracking-wide text-[#0176D3] font-semibold">
      {children}
    </div>
  );
}

interface ProtocolFormProps {
  initialValues: Partial<ProtocolFormValues>;
  onCancel?: () => void;
  onSubmit: (values: ProtocolFormValues) => Promise<void>;
  submitLabel: string;
  showProtocolNumber?: boolean;
  statusOptions?: string[] | null;
  showDates?: boolean;
}

interface FormState {
  id: string;
  title: string;
  pi: string;
  pi_proxy: string;
  ptm_member: string;
  protocol_type: string;
  species: string;
  animals: string;
  pain_category: string;
  anesthesia_required: string;
  housing: string;
  disposal: string;
  npg: string;
  npg_detail: string;
  purpose_summary: string;
  harm_benefit_analysis: string;
  scientific_summary: string;
  status: string;
  submitted: string;
  expires: string;
}

interface StepModalProps {
  initial: ResearchStep;
  index: number | null;
  speciesOptions: string[];
  onSave: (step: ResearchStep) => void;
  onClose: () => void;
}

const EMPTY_STEP: ResearchStep = {
  description: "",
  duration: "",
  frequency: "Once",
  species: "",
  pain_category: "",
  anesthesia: "No",
  location: "",
  personnel: "",
  notes: "",
};

// Defensive normalization: legacy databases and older API payloads store steps
// as plain strings; the server also normalizes, but the client should never
// assume that when rendering the form.
function normalizeStep(step: string | ResearchStep): ResearchStep {
  if (typeof step === "string") return { ...EMPTY_STEP, description: step };
  return { ...EMPTY_STEP, ...step, anesthesia: step.anesthesia === "Yes" ? "Yes" : "No" };
}

// Sub-modal for capturing a single step of the research procedure plan.
// Opens from the "Add step" button on the research plan section. Each step
// carries the structured fields the IACUC review needs (duration, frequency,
// species, pain category, anesthesia, location, personnel, notes).
function ResearchStepModal({ initial, index, speciesOptions, onSave, onClose }: StepModalProps) {
  const [step, setStep] = useState<ResearchStep>(initial);
  const set = (key: keyof ResearchStep) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setStep(prev => ({ ...prev, [key]: e.target.value } as ResearchStep));
  const canSave = step.description.trim().length > 0;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">
            {index === null ? "Add research step" : "Edit research step"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close step modal" className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label htmlFor="research-step-text" className={LABEL_CLASS}>Step description</label>
            <textarea
              id="research-step-text"
              value={step.description}
              onChange={set("description")}
              placeholder="Describe what is executed in this step of the research..."
              rows={3}
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="research-step-duration" className={LABEL_CLASS}>Duration</label>
              <input
                id="research-step-duration"
                value={step.duration}
                onChange={set("duration")}
                placeholder="e.g. 7 days, ~30 min"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="research-step-frequency" className={LABEL_CLASS}>Frequency</label>
              <select
                id="research-step-frequency"
                value={step.frequency}
                onChange={set("frequency")}
                className={INPUT_CLASS}
              >
                {STEP_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="research-step-species" className={LABEL_CLASS}>Species involved</label>
              <select
                id="research-step-species"
                value={step.species}
                onChange={set("species")}
                className={INPUT_CLASS}
              >
                <option value="">—</option>
                {speciesOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="research-step-pain" className={LABEL_CLASS}>Pain category</label>
              <select
                id="research-step-pain"
                value={step.pain_category}
                onChange={set("pain_category")}
                className={INPUT_CLASS}
              >
                <option value="">—</option>
                {PAIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="research-step-anesthesia" className={LABEL_CLASS}>Anesthesia / sedation</label>
              <select
                id="research-step-anesthesia"
                value={step.anesthesia}
                onChange={set("anesthesia")}
                className={INPUT_CLASS}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div>
              <label htmlFor="research-step-location" className={LABEL_CLASS}>Location</label>
              <input
                id="research-step-location"
                value={step.location}
                onChange={set("location")}
                placeholder="e.g. Surgical suite A"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div>
            <label htmlFor="research-step-personnel" className={LABEL_CLASS}>Personnel</label>
            <input
              id="research-step-personnel"
              value={step.personnel}
              onChange={set("personnel")}
              placeholder="Who performs this step"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="research-step-notes" className={LABEL_CLASS}>Notes</label>
            <textarea
              id="research-step-notes"
              value={step.notes}
              onChange={set("notes")}
              placeholder="Optional details, PI approval, refinements..."
              rows={2}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 text-[13px] font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => onSave(step)}
              className="px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] disabled:opacity-50"
            >
              Save step
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
}: ProtocolFormProps) {
  const [species, setSpecies] = useState<Species[]>([]);
  const [form, setForm] = useState<FormState>({
    id: initialValues.id ?? "",
    title: initialValues.title ?? "",
    pi: initialValues.pi ?? "",
    pi_proxy: initialValues.pi_proxy ?? "",
    ptm_member: initialValues.ptm_member ?? "",
    protocol_type: initialValues.protocol_type ?? "",
    species: initialValues.species ?? "",
    animals: initialValues.animals == null ? "" : String(initialValues.animals),
    pain_category: initialValues.pain_category ?? "",
    anesthesia_required: initialValues.anesthesia_required ? "true" : "false",
    housing: initialValues.housing ?? "",
    disposal: initialValues.disposal ?? "",
    npg: initialValues.npg ? "true" : "false",
    npg_detail: initialValues.npg ?? "",
    purpose_summary: initialValues.purpose_summary ?? "",
    harm_benefit_analysis: initialValues.harm_benefit_analysis ?? "",
    scientific_summary: initialValues.scientific_summary ?? "",
    status: initialValues.status ?? "",
    submitted: initialValues.submitted ?? "",
    expires: initialValues.expires ?? "",
  });
  const [researchSteps, setResearchSteps] = useState<ResearchStep[]>(
    (initialValues.research_steps ?? []).map(normalizeStep)
  );
  const [stepModal, setStepModal] = useState<{ open: boolean; index: number | null; initial: ResearchStep }>({
    open: false,
    index: null,
    initial: EMPTY_STEP,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listSpecies()
      .then(rows => {
        setSpecies(rows);
        if (rows.length > 0) setForm(f => ({ ...f, species: f.species || rows[0].name }));
      })
      .catch(err => setError(errorMessage(err)));
  }, []);

  const speciesOptions = species.map(s => s.name);
  if (form.species && !speciesOptions.includes(form.species)) speciesOptions.unshift(form.species);

  const resolvedStatusOptions = statusOptions ? [...statusOptions] : null;
  if (resolvedStatusOptions && form.status && !resolvedStatusOptions.includes(form.status)) {
    resolvedStatusOptions.unshift(form.status);
  }

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const openAddStep = () => {
    setStepModal({ open: true, index: null, initial: { ...EMPTY_STEP, species: form.species } });
  };
  const openEditStep = (i: number) => {
    setStepModal({ open: true, index: i, initial: researchSteps[i] });
  };
  const saveStep = (step: ResearchStep) => {
    if (!step.description.trim()) {
      setStepModal({ open: false, index: null, initial: EMPTY_STEP });
      return;
    }
    setResearchSteps(prev => {
      if (stepModal.index === null) return [...prev, normalizeStep(step)];
      const next = [...prev];
      next[stepModal.index] = normalizeStep(step);
      return next;
    });
    setStepModal({ open: false, index: null, initial: EMPTY_STEP });
  };
  const removeStep = (i: number) => setResearchSteps(prev => prev.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.pi.trim() || (showProtocolNumber && !form.id.trim())) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        id: form.id.trim(),
        title: form.title.trim(),
        pi: form.pi.trim(),
        pi_proxy: form.pi_proxy.trim() || null,
        ptm_member: form.ptm_member.trim() || null,
        protocol_type: form.protocol_type || null,
        species: form.species || null,
        animals: form.animals ? Number(form.animals) : null,
        pain_category: form.pain_category || null,
        anesthesia_required: form.anesthesia_required === "true" ? 1 : 0,
        housing: form.housing.trim() || null,
        disposal: form.disposal.trim() || null,
        npg: form.npg === "true" ? (form.npg_detail.trim() || null) : null,
        research_steps: researchSteps.filter(s => s.description.trim()).map(normalizeStep),
        purpose_summary: form.purpose_summary.trim() || null,
        harm_benefit_analysis: form.harm_benefit_analysis.trim() || null,
        scientific_summary: form.scientific_summary.trim() || null,
        status: form.status || null,
        submitted: form.submitted || null,
        expires: form.expires || null,
      });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      {showProtocolNumber && (
        <div>
          <label htmlFor="new-protocol-id" className={LABEL_CLASS}>Protocol number</label>
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
        <label htmlFor="protocol-form-title" className={LABEL_CLASS}>Title</label>
        <input
          id="protocol-form-title"
          value={form.title}
          onChange={set("title")}
          placeholder="e.g. Effects of X on Y"
          className={INPUT_CLASS}
        />
      </div>

      <SectionTitle>Purpose &amp; summary</SectionTitle>
      <div>
        <label htmlFor="protocol-form-purpose" className={LABEL_CLASS}>Lay purpose</label>
        <textarea
          id="protocol-form-purpose"
          value={form.purpose_summary}
          onChange={set("purpose_summary")}
          placeholder="Plain-language statement of why the study is being done..."
          rows={2}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="protocol-form-harm-benefit" className={LABEL_CLASS}>Harm–benefit analysis</label>
        <textarea
          id="protocol-form-harm-benefit"
          value={form.harm_benefit_analysis}
          onChange={set("harm_benefit_analysis")}
          placeholder="Short comparison of potential harm to animals vs. expected benefit..."
          rows={2}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="protocol-form-scientific" className={LABEL_CLASS}>Scientific summary</label>
        <textarea
          id="protocol-form-scientific"
          value={form.scientific_summary}
          onChange={set("scientific_summary")}
          placeholder="Scientific-language summary of the project and aims..."
          rows={2}
          className={INPUT_CLASS}
        />
      </div>

      <SectionTitle>Key personnel</SectionTitle>
      <div>
        <label htmlFor="protocol-form-pi" className={LABEL_CLASS}>Principal investigator</label>
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
          <label htmlFor="protocol-form-pi-proxy" className={LABEL_CLASS}>PI proxy</label>
          <input
            id="protocol-form-pi-proxy"
            value={form.pi_proxy}
            onChange={set("pi_proxy")}
            placeholder="e.g. Sam Whitfield"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="protocol-form-ptm" className={LABEL_CLASS}>PTM member</label>
          <input
            id="protocol-form-ptm"
            value={form.ptm_member}
            onChange={set("ptm_member")}
            placeholder="Protocol team member"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <SectionTitle>Protocol details</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="protocol-form-type" className={LABEL_CLASS}>Type of IACUC protocol</label>
          <select
            id="protocol-form-type"
            value={form.protocol_type}
            onChange={set("protocol_type")}
            className={INPUT_CLASS}
          >
            <option value="">—</option>
            {PROTOCOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="protocol-form-species" className={LABEL_CLASS}>Species</label>
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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="protocol-form-animals" className={LABEL_CLASS}>Number of animals</label>
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
          <label htmlFor="protocol-form-pain" className={LABEL_CLASS}>Pain category</label>
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

      <SectionTitle>Animal care &amp; use</SectionTitle>
      <div>
        <span className={LABEL_CLASS}>Will anesthesia be administered?</span>
        <div className="flex gap-4">
          {["true", "false"].map(v => (
            <label key={v} className="flex items-center gap-1.5 text-[13px] text-gray-700">
              <input
                type="radio"
                name="anesthesia"
                value={v}
                checked={form.anesthesia_required === v}
                onChange={set("anesthesia_required")}
              />
              {v === "true" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className={LABEL_CLASS}>Are non-pharmaceutical-grade (NPG) compounds used?</span>
        <div className="flex gap-4">
          {["true", "false"].map(v => (
            <label key={v} className="flex items-center gap-1.5 text-[13px] text-gray-700">
              <input
                type="radio"
                name="npg"
                value={v}
                checked={form.npg === v}
                onChange={set("npg")}
              />
              {v === "true" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </div>
      {form.npg === "true" && (
        <div>
          <label htmlFor="protocol-form-npg-detail" className={LABEL_CLASS}>NPG compounds &amp; source</label>
          <textarea
            id="protocol-form-npg-detail"
            value={form.npg_detail}
            onChange={set("npg_detail")}
            placeholder="List the non-pharmaceutical-grade compounds, purity, and supplier..."
            rows={2}
            className={INPUT_CLASS}
          />
        </div>
      )}
      <div>
        <label htmlFor="protocol-form-housing" className={LABEL_CLASS}>How will the animals be housed?</label>
        <textarea
          id="protocol-form-housing"
          value={form.housing}
          onChange={set("housing")}
          placeholder="Caging, group size, environment, enrichment..."
          rows={2}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="protocol-form-disposal" className={LABEL_CLASS}>How will the animals be disposed of?</label>
        <textarea
          id="protocol-form-disposal"
          value={form.disposal}
          onChange={set("disposal")}
          placeholder="Euthanasia method and carcass disposition..."
          rows={2}
          className={INPUT_CLASS}
        />
      </div>

      <SectionTitle>Research plan</SectionTitle>
      {researchSteps.length > 0 && (
        <ol className="space-y-1.5">
          {researchSteps.map((step, i) => {
            const meta = [step.duration, step.frequency, step.species, step.location, step.personnel]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={i} className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-gray-800">
                    <span className="font-medium text-gray-500 mr-1.5">Step {i + 1}.</span>
                    {step.description}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => openEditStep(i)} className="text-[#0176D3] hover:underline text-xs">Edit</button>
                    <button type="button" onClick={() => removeStep(i)} aria-label={`Remove step ${i + 1}`} className="text-gray-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
                {meta && <div className="text-[12px] text-gray-500 truncate mt-0.5">{meta}</div>}
              </li>
            );
          })}
        </ol>
      )}
      <button
        type="button"
        onClick={openAddStep}
        className="flex items-center gap-1 text-[#0176D3] text-[13px] font-medium hover:underline"
      >
        <Plus size={14} />
        Add step
      </button>

      {statusOptions && (
        <>
          <SectionTitle>Workflow</SectionTitle>
          <div>
            <label htmlFor="protocol-form-status" className={LABEL_CLASS}>Status</label>
            <select
              id="protocol-form-status"
              value={form.status}
              onChange={set("status")}
              className={INPUT_CLASS}
            >
              {resolvedStatusOptions!.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {showDates && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="protocol-form-submitted" className={LABEL_CLASS}>Submitted</label>
                <input
                  id="protocol-form-submitted"
                  value={form.submitted}
                  onChange={set("submitted")}
                  type="date"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="protocol-form-expires" className={LABEL_CLASS}>Expires</label>
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
        </>
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

      {stepModal.open && (
        <ResearchStepModal
          initial={stepModal.initial}
          index={stepModal.index}
          speciesOptions={speciesOptions}
          onSave={saveStep}
          onClose={() => setStepModal({ open: false, index: null, initial: EMPTY_STEP })}
        />
      )}
    </form>
  );
}
