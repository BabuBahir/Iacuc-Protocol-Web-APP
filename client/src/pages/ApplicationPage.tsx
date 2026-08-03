import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft, Plus, Trash2, Pencil, X, Save, BookOpen,
  ClipboardList, Syringe, FlaskConical, Search, ShieldCheck,
  Microscope, CheckCircle2, AlertTriangle, Send,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import { ANALGESIA_LEVELS, RRR_LABELS, RRR_TYPES, SURGERY_PROCEDURE_KEYS } from "../types";
import type {
  Alternatives,
  AlternativesInput,
  AnimalUseInput,
  AnimalUseRow,
  DrugInput,
  DrugRow,
  ExperimentInput,
  ExperimentRow,
  Procedure,
  RrrEntry,
  RrrInput,
  RrrType,
  ValidationResult,
} from "../types";

const INPUT_CLASS = "w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]";
const LABEL_CLASS = "block text-[11px] uppercase tracking-wide text-gray-500 mb-1";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function Card({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 font-semibold text-gray-800 text-sm">
        <Icon size={15} className="text-gray-500" />
        {title}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close modal" className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function SaveRow({ onSave, saving, status, label }: { onSave: () => void; saving: boolean; status: string | null; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        type="button"
        aria-label={label}
        disabled={saving}
        onClick={onSave}
        className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] disabled:opacity-50"
      >
        <Save size={14} />
        {saving ? "Saving…" : "Save"}
      </button>
      {status && (
        <span className={status.startsWith("Saved") ? "text-[12px] text-green-600" : "text-[12px] text-red-600"}>{status}</span>
      )}
    </div>
  );
}

interface DrugDraft {
  reason_for_use: string;
  drug: string;
  dose: string;
  route: string;
  duration: string;
}

const BLANK_DRUG: DrugDraft = { reason_for_use: "", drug: "", dose: "", route: "", duration: "" };

function DrugModal({ initial, onClose, onSave }: { initial: DrugDraft; onClose: () => void; onSave: (d: DrugDraft) => void }) {
  const [draft, setDraft] = useState<DrugDraft>(initial);
  const set = (field: keyof DrugDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [field]: e.target.value });
  return (
    <Modal title={initial.drug ? "Edit drug" : "Add drug"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label htmlFor="drug-reason" className={LABEL_CLASS}>Reason for use</label>
          <input id="drug-reason" value={draft.reason_for_use} onChange={set("reason_for_use")} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="drug-name" className={LABEL_CLASS}>Drug</label>
          <input id="drug-name" value={draft.drug} onChange={set("drug")} placeholder="e.g. Isoflurane" className={INPUT_CLASS} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="drug-dose" className={LABEL_CLASS}>Dose</label>
            <input id="drug-dose" value={draft.dose} onChange={set("dose")} placeholder="e.g. 2–3%" className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="drug-route" className={LABEL_CLASS}>Route</label>
            <input id="drug-route" value={draft.route} onChange={set("route")} placeholder="e.g. Inhalation" className={INPUT_CLASS} />
          </div>
        </div>
        <div>
          <label htmlFor="drug-duration" className={LABEL_CLASS}>Expected duration</label>
          <input id="drug-duration" value={draft.duration} onChange={set("duration")} className={INPUT_CLASS} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 text-[13px] font-medium hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            aria-label="Save drug"
            onClick={() => onSave(draft)}
            className="px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface AnimalDraft {
  species_strain: string;
  sex: string;
  approx_age: string;
  max_count: string;
}

const BLANK_ANIMAL: AnimalDraft = { species_strain: "", sex: "", approx_age: "", max_count: "" };

function AnimalUseModal({ initial, onClose, onSave }: { initial: AnimalDraft; onClose: () => void; onSave: (d: AnimalDraft) => void }) {
  const [draft, setDraft] = useState<AnimalDraft>(initial);
  const set = (field: keyof AnimalDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [field]: e.target.value });
  return (
    <Modal title={initial.species_strain ? "Edit animal use" : "Add animal use"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label htmlFor="animal-species" className={LABEL_CLASS}>Species / strain</label>
          <input id="animal-species" value={draft.species_strain} onChange={set("species_strain")} placeholder="e.g. C57BL/6 mouse" className={INPUT_CLASS} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="animal-sex" className={LABEL_CLASS}>Sex</label>
            <input id="animal-sex" value={draft.sex} onChange={set("sex")} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="animal-age" className={LABEL_CLASS}>Approx. age</label>
            <input id="animal-age" value={draft.approx_age} onChange={set("approx_age")} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="animal-count" className={LABEL_CLASS}>Max count</label>
            <input id="animal-count" value={draft.max_count} onChange={set("max_count")} type="number" min="0" className={INPUT_CLASS} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 text-[13px] font-medium hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            aria-label="Save animal use"
            onClick={() => onSave(draft)}
            className="px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ExperimentDraft {
  name: string;
  description: string;
  multiple_surgical_events: boolean;
  humane_endpoints: string;
  persistent_clinical_signs_justification: string;
  monitoring_plan: string;
  husbandry_exceptions: string;
}

const BLANK_EXPERIMENT: ExperimentDraft = {
  name: "",
  description: "",
  multiple_surgical_events: false,
  humane_endpoints: "",
  persistent_clinical_signs_justification: "",
  monitoring_plan: "",
  husbandry_exceptions: "",
};

function ExperimentModal({ initial, onClose, onSave }: { initial: ExperimentDraft; onClose: () => void; onSave: (d: ExperimentDraft) => void }) {
  const [draft, setDraft] = useState<ExperimentDraft>(initial);
  const set = (field: keyof ExperimentDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft({ ...draft, [field]: e.target.value });
  return (
    <Modal title={initial.name ? "Edit experiment" : "Add experiment"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label htmlFor="exp-name" className={LABEL_CLASS}>Experiment name</label>
          <input id="exp-name" value={draft.name} onChange={set("name")} placeholder="e.g. Chronic restraint stress" className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="exp-description" className={LABEL_CLASS}>Detailed description</label>
          <textarea id="exp-description" value={draft.description} onChange={set("description")} rows={3} className={INPUT_CLASS} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-gray-800 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.multiple_surgical_events}
            onChange={e => setDraft({ ...draft, multiple_surgical_events: e.target.checked })}
          />
          Multiple surgical events performed on one animal
        </label>
        <div>
          <label htmlFor="exp-endpoints" className={LABEL_CLASS}>Humane endpoints</label>
          <textarea id="exp-endpoints" value={draft.humane_endpoints} onChange={set("humane_endpoints")} rows={2} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="exp-persistent" className={LABEL_CLASS}>Justification for allowing clinical signs to persist (Category E)</label>
          <textarea id="exp-persistent" value={draft.persistent_clinical_signs_justification} onChange={set("persistent_clinical_signs_justification")} rows={2} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="exp-monitoring" className={LABEL_CLASS}>Endpoints & monitoring plan</label>
          <textarea id="exp-monitoring" value={draft.monitoring_plan} onChange={set("monitoring_plan")} rows={2} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="exp-husbandry" className={LABEL_CLASS}>Husbandry exceptions</label>
          <textarea id="exp-husbandry" value={draft.husbandry_exceptions} onChange={set("husbandry_exceptions")} rows={2} className={INPUT_CLASS} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 text-[13px] font-medium hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            aria-label="Save experiment"
            onClick={() => onSave(draft)}
            className="px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface RrrDraft {
  id?: number;
  rrr_type: RrrType;
  method: string;
  explanation: string;
}

const BLANK_RRR: RrrDraft = { rrr_type: "replacement", method: "", explanation: "" };

const SECTION_LABELS: Record<keyof ValidationResult["sections"], string> = {
  summaries: "Purpose & summary",
  procedures: "Procedures",
  drugs: "Drugs / dosing",
  animal_use: "Animal use",
  experiments: "Experiments",
  alternatives: "3 Rs & alternatives",
};

function RrrModal({ initial, onClose, onSave }: { initial: RrrDraft; onClose: () => void; onSave: (d: RrrDraft) => void }) {
  const [draft, setDraft] = useState<RrrDraft>(initial);
  return (
    <Modal title={initial.method ? "Edit 3 Rs justification" : "Add 3 Rs justification"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label htmlFor="rrr-type" className={LABEL_CLASS}>R (Replacement / Refinement / Reduction)</label>
          <select
            id="rrr-type"
            value={draft.rrr_type}
            onChange={e => setDraft({ ...draft, rrr_type: e.target.value as RrrType })}
            className={INPUT_CLASS}
          >
            {RRR_TYPES.map(t => (
              <option key={t} value={t}>{RRR_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rrr-method" className={LABEL_CLASS}>Method</label>
          <input id="rrr-method" value={draft.method} onChange={e => setDraft({ ...draft, method: e.target.value })} placeholder="e.g. In-vitro pre-screening" className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="rrr-explanation" className={LABEL_CLASS}>Explanation</label>
          <textarea id="rrr-explanation" value={draft.explanation} onChange={e => setDraft({ ...draft, explanation: e.target.value })} rows={3} className={INPUT_CLASS} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 text-[13px] font-medium hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            aria-label="Save 3 Rs justification"
            onClick={() => onSave(draft)}
            className="px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab]"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [purpose, setPurpose] = useState("");
  const [harmBenefit, setHarmBenefit] = useState("");
  const [scientific, setScientific] = useState("");

  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [drugs, setDrugs] = useState<DrugRow[]>([]);
  const [animalUse, setAnimalUse] = useState<AnimalUseRow[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
  const [alternatives, setAlternatives] = useState<Alternatives | null>(null);
  const [rrrEntries, setRrrEntries] = useState<RrrEntry[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [status, setStatus] = useState("");

  const [drugModal, setDrugModal] = useState<{ open: boolean; editing: DrugRow | null }>({ open: false, editing: null });
  const [animalModal, setAnimalModal] = useState<{ open: boolean; editing: AnimalUseRow | null }>({ open: false, editing: null });
  const [expModal, setExpModal] = useState<{ open: boolean; editing: ExperimentRow | null }>({ open: false, editing: null });
  const [rrrModal, setRrrModal] = useState<{ open: boolean; editing: RrrDraft | null }>({ open: false, editing: null });

  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);
  const [summarySaving, setSummarySaving] = useState(false);
  const [proceduresStatus, setProceduresStatus] = useState<string | null>(null);
  const [proceduresSaving, setProceduresSaving] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [alternativesStatus, setAlternativesStatus] = useState<string | null>(null);
  const [alternativesSaving, setAlternativesSaving] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitSaving, setSubmitSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getProtocol(id),
      api.listProcedures(id),
      api.listDrugs(id),
      api.listAnimalUse(id),
      api.listExperiments(id),
      api.getAlternatives(id),
      api.listRrrEntries(id),
      api.getValidation(id),
    ])
      .then(([p, procs, dr, au, exps, alt, rrr, v]) => {
        if (cancelled) return;
        setPurpose(p.purpose_summary ?? "");
        setHarmBenefit(p.harm_benefit_analysis ?? "");
        setScientific(p.scientific_summary ?? "");
        setStatus(p.status);
        setProcedures(procs);
        setDrugs(dr);
        setAnimalUse(au);
        setExperiments(exps);
        setAlternatives(alt);
        setRrrEntries(rrr);
        setValidation(v);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(errorMessage(err));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const saveSummaries = async () => {
    if (!id) return;
    setSummarySaving(true);
    setSummaryStatus(null);
    try {
      await api.updateProtocol(id, {
        purpose_summary: purpose.trim() || null,
        harm_benefit_analysis: harmBenefit.trim() || null,
        scientific_summary: scientific.trim() || null,
      });
      await refreshValidation();
      setSummaryStatus("Saved summaries");
    } catch (err) {
      setSummaryStatus(errorMessage(err));
    } finally {
      setSummarySaving(false);
    }
  };

  const toggleProcedure = (i: number) => {
    setProcedures(prev => prev.map((p, idx) => idx === i ? { ...p, checked: !p.checked } : p));
    setProceduresStatus(null);
  };

  const setProcedureDescription = (i: number, description: string) => {
    setProcedures(prev => prev.map((p, idx) => idx === i ? { ...p, description } : p));
    setProceduresStatus(null);
  };

  const setProcedureSurgeryField = (
    i: number,
    field: "surgical_description" | "aseptic_preparation" | "analgesia_level" | "postop_care",
    value: string,
  ) => {
    setProcedures(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
    setProceduresStatus(null);
  };

  const saveProcedures = async () => {
    if (!id) return;
    setProceduresSaving(true);
    setProceduresStatus(null);
    try {
      await api.updateProcedures(id, procedures.map((p) => ({
        procedure_key: p.procedure_key,
        checked: p.checked,
        description: p.description,
        surgical_description: p.surgical_description,
        aseptic_preparation: p.aseptic_preparation,
        analgesia_level: p.analgesia_level,
        postop_care: p.postop_care,
      })));
      await refreshValidation();
      setProceduresStatus("Saved procedures");
    } catch (err) {
      setProceduresStatus(errorMessage(err));
    } finally {
      setProceduresSaving(false);
    }
  };

  const refetchTables = async () => {
    if (!id) return;
    if (id) setDrugs(await api.listDrugs(id));
    if (id) setAnimalUse(await api.listAnimalUse(id));
    if (id) setExperiments(await api.listExperiments(id));
    if (id) setRrrEntries(await api.listRrrEntries(id));
    await refreshValidation();
  };

  const runTableAction = async (fn: () => Promise<unknown>) => {
    setTablesError(null);
    try {
      await fn();
      await refetchTables();
    } catch (err) {
      setTablesError(errorMessage(err));
    }
  };

  const refreshValidation = async () => {
    if (!id) return;
    try {
      setValidation(await api.getValidation(id));
    } catch {
      // non-fatal: the readiness panel keeps its last known state
    }
  };

  const submitProtocol = async () => {
    if (!id) return;
    setSubmitSaving(true);
    setSubmitStatus(null);
    try {
      const fresh = await api.getValidation(id);
      setValidation(fresh);
      if (!fresh.overall) {
        setSubmitStatus({ ok: false, message: "Complete all required sections first." });
        return;
      }
      await api.updateProtocol(id, {
        status: "Submitted",
        submitted: new Date().toISOString().slice(0, 10),
      });
      setStatus("Submitted");
      setSubmitStatus({ ok: true, message: "Protocol submitted for review." });
    } catch (err) {
      setSubmitStatus({ ok: false, message: errorMessage(err) });
    } finally {
      setSubmitSaving(false);
    }
  };

  const saveDrug = async (draft: DrugDraft) => {
    if (!draft.drug.trim()) {
      setTablesError("Drug name is required");
      return;
    }
    const payload: DrugInput = {
      reason_for_use: draft.reason_for_use.trim() || null,
      drug: draft.drug.trim(),
      dose: draft.dose.trim() || null,
      route: draft.route.trim() || null,
      duration: draft.duration.trim() || null,
    };
    setTablesError(null);
    try {
      if (drugModal.editing) {
        await api.updateDrug(id!, drugModal.editing.id, payload);
      } else {
        await api.createDrug(id!, payload);
      }
      setDrugModal({ open: false, editing: null });
      await refetchTables();
    } catch (err) {
      setTablesError(errorMessage(err));
    }
  };

  const deleteDrug = (row: DrugRow) => {
    void runTableAction(() => api.deleteDrug(id!, row.id));
  };

  const saveAnimalUse = async (draft: AnimalDraft) => {
    if (!draft.species_strain.trim()) {
      setTablesError("Species / strain is required");
      return;
    }
    const payload: AnimalUseInput = {
      species_strain: draft.species_strain.trim(),
      sex: draft.sex.trim() || null,
      approx_age: draft.approx_age.trim() || null,
      max_count: draft.max_count ? Number(draft.max_count) : null,
    };
    setTablesError(null);
    try {
      if (animalModal.editing) {
        await api.updateAnimalUse(id!, animalModal.editing.id, payload);
      } else {
        await api.createAnimalUse(id!, payload);
      }
      setAnimalModal({ open: false, editing: null });
      await refetchTables();
    } catch (err) {
      setTablesError(errorMessage(err));
    }
  };

  const deleteAnimalUse = (row: AnimalUseRow) => {
    void runTableAction(() => api.deleteAnimalUse(id!, row.id));
  };

  const saveExperiment = async (draft: ExperimentDraft) => {
    if (!draft.name.trim()) {
      setTablesError("Experiment name is required");
      return;
    }
    const payload: ExperimentInput = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      multiple_surgical_events: draft.multiple_surgical_events ? 1 : 0,
      humane_endpoints: draft.humane_endpoints.trim() || null,
      persistent_clinical_signs_justification: draft.persistent_clinical_signs_justification.trim() || null,
      monitoring_plan: draft.monitoring_plan.trim() || null,
      husbandry_exceptions: draft.husbandry_exceptions.trim() || null,
    };
    setTablesError(null);
    try {
      if (expModal.editing) {
        await api.updateExperiment(id!, expModal.editing.id, payload);
      } else {
        await api.createExperiment(id!, payload);
      }
      setExpModal({ open: false, editing: null });
      await refetchTables();
    } catch (err) {
      setTablesError(errorMessage(err));
    }
  };

  const deleteExperiment = (row: ExperimentRow) => {
    void runTableAction(() => api.deleteExperiment(id!, row.id));
  };

  const saveRrrEntry = async (draft: RrrDraft) => {
    if (!draft.method.trim()) {
      setTablesError("Method is required");
      return;
    }
    const payload: RrrInput = {
      rrr_type: draft.rrr_type,
      method: draft.method.trim(),
      explanation: draft.explanation.trim() || null,
    };
    setTablesError(null);
    try {
      if (rrrModal.editing?.id) {
        await api.updateRrrEntry(id!, rrrModal.editing.id, payload);
      } else {
        await api.createRrrEntry(id!, payload);
      }
      setRrrModal({ open: false, editing: null });
      await refetchTables();
    } catch (err) {
      setTablesError(errorMessage(err));
    }
  };

  const deleteRrrEntry = (row: RrrEntry) => {
    void runTableAction(() => api.deleteRrrEntry(id!, row.id));
  };

  const setAlternative = (field: keyof Alternatives) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setAlternatives(prev => (prev ? { ...prev, [field]: e.target.value } : prev));
    setAlternativesStatus(null);
  };

  const saveAlternatives = async () => {
    if (!id || !alternatives) return;
    setAlternativesSaving(true);
    setAlternativesStatus(null);
    const payload: AlternativesInput = {};
    const fields = [
      "lit_databases", "lit_years_from", "lit_years_to", "lit_search_date",
      "lit_keywords", "lit_summary",
      "colleague_name", "colleague_date", "colleague_notes",
      "av_consult_date",
    ] as const;
    for (const f of fields) {
      payload[f] = (alternatives[f] as string ?? "").trim() || null;
    }
    try {
      const updated = await api.updateAlternatives(id, payload);
      setAlternatives(updated);
      await refreshValidation();
      setAlternativesStatus("Saved 3 Rs & alternatives");
    } catch (err) {
      setAlternativesStatus(errorMessage(err));
    } finally {
      setAlternativesSaving(false);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">Couldn't load application: {error}</p>
        <Link to="/" className="text-[#0176D3] hover:underline">Back to list</Link>
      </div>
    );
  }
  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;

  const avRequired = !!alternatives?.av_consultation_required;

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 text-[12px] text-[#0176D3] flex items-center gap-1">
        <Link to="/" className="flex items-center gap-1 hover:underline">
          <ChevronLeft size={14} />IACUC Protocols
        </Link>
        <span className="text-gray-400">/</span>
        <Link to={`/protocols/${id}`} className="hover:underline">{id}</Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">Application</span>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div>
          <div className="text-[11px] text-gray-500">IACUC Protocol Application</div>
          <h1 className="text-xl font-semibold text-gray-900">Application details — {id}</h1>
        </div>

        <Card icon={ShieldCheck} title="Submission readiness">
          {!validation ? (
            <div className="text-[13px] text-gray-400">Checking completeness…</div>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(validation.sections).map(([key, sec]) => (
                <div key={key} className="flex items-start gap-2 text-[13px]">
                  {sec.complete ? (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-600" />
                  ) : (
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <span className={sec.complete ? "text-gray-700" : "font-medium text-gray-800"}>
                      {SECTION_LABELS[key as keyof ValidationResult["sections"]]}
                    </span>
                    {!sec.complete && sec.missing.length > 0 && (
                      <ul className="text-[12px] text-amber-700 list-disc list-inside">
                        {sec.missing.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
              {status === "Draft" ? (
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                  <span className="text-[12px] text-gray-500">
                    {validation.overall
                      ? "All sections complete — ready for IACUC review."
                      : "Not ready yet — complete the flagged sections."}
                  </span>
                  <button
                    type="button"
                    aria-label="Submit protocol"
                    disabled={!validation.overall || submitSaving}
                    onClick={submitProtocol}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={14} />Submit protocol
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-gray-100 text-[12px] text-gray-500">Status: {status}</div>
              )}
              {submitStatus && (
                <div className={`text-[12px] ${submitStatus.ok ? "text-green-600" : "text-red-600"}`}>{submitStatus.message}</div>
              )}
            </div>
          )}
        </Card>

        <Card icon={BookOpen} title="Purpose & summary">
          <div>
            <label htmlFor="app-purpose" className={LABEL_CLASS}>Lay purpose</label>
            <textarea id="app-purpose" value={purpose} onChange={e => setPurpose(e.target.value)} rows={2} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="app-harm-benefit" className={LABEL_CLASS}>Harm–benefit analysis</label>
            <textarea id="app-harm-benefit" value={harmBenefit} onChange={e => setHarmBenefit(e.target.value)} rows={2} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="app-scientific" className={LABEL_CLASS}>Scientific summary</label>
            <textarea id="app-scientific" value={scientific} onChange={e => setScientific(e.target.value)} rows={3} className={INPUT_CLASS} />
          </div>
          <SaveRow label="Save summaries" onSave={saveSummaries} saving={summarySaving} status={summaryStatus} />
        </Card>

        <Card icon={ClipboardList} title="Procedures applied to animals">
          <div className="space-y-1.5">
            {procedures.map((p, i) => (
              <div key={p.procedure_key} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <label className="flex items-start gap-2 text-[13px] text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.checked}
                    onChange={() => toggleProcedure(i)}
                    className="mt-0.5"
                  />
                  <span className="font-medium">{p.label}</span>
                </label>
                {p.checked && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      aria-label={`${p.label} description`}
                      value={p.description}
                      onChange={e => setProcedureDescription(i, e.target.value)}
                      placeholder="Describe this procedure and why it is needed..."
                      rows={2}
                      className={INPUT_CLASS}
                    />
                    {SURGERY_PROCEDURE_KEYS.includes(p.procedure_key) && (
                      <div className="space-y-2 border-t border-gray-200 pt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Surgical details</p>
                        <div>
                          <label htmlFor={`surgical-desc-${p.procedure_key}`} className={LABEL_CLASS}>Detailed surgical description</label>
                          <textarea
                            id={`surgical-desc-${p.procedure_key}`}
                            aria-label={`${p.label} surgical description`}
                            value={p.surgical_description}
                            onChange={e => setProcedureSurgeryField(i, "surgical_description", e.target.value)}
                            rows={2}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label htmlFor={`aseptic-${p.procedure_key}`} className={LABEL_CLASS}>Aseptic preparation of animal, surgeon, and instruments</label>
                          <textarea
                            id={`aseptic-${p.procedure_key}`}
                            aria-label={`${p.label} aseptic preparation`}
                            value={p.aseptic_preparation}
                            onChange={e => setProcedureSurgeryField(i, "aseptic_preparation", e.target.value)}
                            rows={2}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label htmlFor={`analgesia-${p.procedure_key}`} className={LABEL_CLASS}>Analgesia level</label>
                          <select
                            id={`analgesia-${p.procedure_key}`}
                            aria-label={`${p.label} analgesia level`}
                            value={p.analgesia_level}
                            onChange={e => setProcedureSurgeryField(i, "analgesia_level", e.target.value)}
                            className={INPUT_CLASS}
                          >
                            <option value="">Select…</option>
                            {ANALGESIA_LEVELS.map(level => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                        </div>
                        {p.procedure_key === "survival_surgery" && (
                          <div>
                            <label htmlFor={`postop-${p.procedure_key}`} className={LABEL_CLASS}>Post-operative care & monitoring</label>
                            <textarea
                              id={`postop-${p.procedure_key}`}
                              aria-label={`${p.label} post-operative care`}
                              value={p.postop_care}
                              onChange={e => setProcedureSurgeryField(i, "postop_care", e.target.value)}
                              placeholder="How often animals are monitored and what care they receive after recovery..."
                              rows={2}
                              className={INPUT_CLASS}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <SaveRow label="Save procedures" onSave={saveProcedures} saving={proceduresSaving} status={proceduresStatus} />
        </Card>

        <Card icon={Syringe} title="Drugs / dosing">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500">Anesthesia, analgesia, and euthanasia agents</span>
            <button
              type="button"
              onClick={() => setDrugModal({ open: true, editing: null })}
              className="flex items-center gap-1 text-[#0176D3] text-[13px] font-medium hover:underline"
            >
              <Plus size={14} />Add drug
            </button>
          </div>
          {drugs.length === 0 ? (
            <div className="text-[13px] text-gray-400">No drugs recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-gray-500 border-b border-gray-100">
                    <th className="py-1.5 pr-2 font-medium">Reason</th>
                    <th className="py-1.5 pr-2 font-medium">Drug</th>
                    <th className="py-1.5 pr-2 font-medium">Dose</th>
                    <th className="py-1.5 pr-2 font-medium">Route</th>
                    <th className="py-1.5 pr-2 font-medium">Duration</th>
                    <th className="py-1.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drugs.map(d => (
                    <tr key={d.id}>
                      <td className="py-1.5 pr-2 text-gray-700">{d.reason_for_use || "—"}</td>
                      <td className="py-1.5 pr-2 font-medium">{d.drug}</td>
                      <td className="py-1.5 pr-2">{d.dose || "—"}</td>
                      <td className="py-1.5 pr-2">{d.route || "—"}</td>
                      <td className="py-1.5 pr-2">{d.duration || "—"}</td>
                      <td className="py-1.5 flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          aria-label={`Edit ${d.drug}`}
                          onClick={() => setDrugModal({
                            open: true,
                            editing: d,
                          })}
                          className="text-gray-400 hover:text-[#0176D3]"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${d.drug}`}
                          onClick={() => deleteDrug(d)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card icon={FlaskConical} title="Animal use">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500">Species/strain, sex, age, and max count used</span>
            <button
              type="button"
              onClick={() => setAnimalModal({ open: true, editing: null })}
              className="flex items-center gap-1 text-[#0176D3] text-[13px] font-medium hover:underline"
            >
              <Plus size={14} />Add animal use
            </button>
          </div>
          {animalUse.length === 0 ? (
            <div className="text-[13px] text-gray-400">No animal-use rows recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-gray-500 border-b border-gray-100">
                    <th className="py-1.5 pr-2 font-medium">Species / strain</th>
                    <th className="py-1.5 pr-2 font-medium">Sex</th>
                    <th className="py-1.5 pr-2 font-medium">Age</th>
                    <th className="py-1.5 pr-2 font-medium">Max count</th>
                    <th className="py-1.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {animalUse.map(r => (
                    <tr key={r.id}>
                      <td className="py-1.5 pr-2 font-medium">{r.species_strain}</td>
                      <td className="py-1.5 pr-2">{r.sex || "—"}</td>
                      <td className="py-1.5 pr-2">{r.approx_age || "—"}</td>
                      <td className="py-1.5 pr-2">{r.max_count ?? "—"}</td>
                      <td className="py-1.5 flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          aria-label={`Edit ${r.species_strain}`}
                          onClick={() => setAnimalModal({
                            open: true,
                            editing: r,
                          })}
                          className="text-gray-400 hover:text-[#0176D3]"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${r.species_strain}`}
                          onClick={() => deleteAnimalUse(r)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card icon={Microscope} title="Experiments">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500">Experimental procedures and surgical events per study</span>
            <button
              type="button"
              onClick={() => setExpModal({ open: true, editing: null })}
              className="flex items-center gap-1 text-[#0176D3] text-[13px] font-medium hover:underline"
            >
              <Plus size={14} />Add experiment
            </button>
          </div>
          {experiments.length === 0 ? (
            <div className="text-[13px] text-gray-400">No experiments recorded.</div>
          ) : (
            <div className="space-y-3">
              {experiments.map(e => (
                <div key={e.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-[13px]">{e.name}</div>
                      {e.multiple_surgical_events ? (
                        <span className="inline-block mt-1 text-[11px] font-medium text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.5 rounded">
                          Multiple surgical events
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${e.name}`}
                        onClick={() => setExpModal({ open: true, editing: e })}
                        className="text-gray-400 hover:text-[#0176D3]"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${e.name}`}
                        onClick={() => deleteExperiment(e)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {e.description ? <p className="mt-2 text-[13px] text-gray-600">{e.description}</p> : null}
                  <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[13px]">
                    {e.humane_endpoints ? (
                      <div>
                        <dt className="text-[11px] uppercase text-gray-500 font-medium">Humane endpoints</dt>
                        <dd className="text-gray-700">{e.humane_endpoints}</dd>
                      </div>
                    ) : null}
                    {e.persistent_clinical_signs_justification ? (
                      <div>
                        <dt className="text-[11px] uppercase text-gray-500 font-medium">Persistent clinical signs justification</dt>
                        <dd className="text-gray-700">{e.persistent_clinical_signs_justification}</dd>
                      </div>
                    ) : null}
                    {e.monitoring_plan ? (
                      <div>
                        <dt className="text-[11px] uppercase text-gray-500 font-medium">Monitoring plan</dt>
                        <dd className="text-gray-700">{e.monitoring_plan}</dd>
                      </div>
                    ) : null}
                    {e.husbandry_exceptions ? (
                      <div>
                        <dt className="text-[11px] uppercase text-gray-500 font-medium">Husbandry exceptions</dt>
                        <dd className="text-gray-700">{e.husbandry_exceptions}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card icon={Search} title="3 Rs & alternatives">
          <div className="pt-2 border-t border-gray-100">
            <div className="text-[11px] uppercase tracking-wide text-[#0176D3] font-semibold">3 Rs justifications</div>
          </div>
          {RRR_TYPES.map(t => {
            const entries = rrrEntries.filter(e => e.rrr_type === t);
            return (
              <div key={t}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-gray-700">{RRR_LABELS[t]}</span>
                  <button
                    type="button"
                    aria-label={`Add ${RRR_LABELS[t]} justification`}
                    onClick={() => setRrrModal({ open: true, editing: { ...BLANK_RRR, rrr_type: t } })}
                    className="flex items-center gap-1 text-[#0176D3] text-[13px] font-medium hover:underline"
                  >
                    <Plus size={13} />Add
                  </button>
                </div>
                {entries.length === 0 ? (
                  <div className="text-[13px] text-gray-400">None recorded.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {entries.map(e => (
                      <li key={e.id} className="border border-gray-100 rounded p-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[13px] font-medium">{e.method}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label={`Edit ${e.method}`}
                              onClick={() => setRrrModal({ open: true, editing: { id: e.id, rrr_type: e.rrr_type, method: e.method, explanation: e.explanation ?? "" } })}
                              className="text-gray-400 hover:text-[#0176D3]"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${e.method}`}
                              onClick={() => deleteRrrEntry(e)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {e.explanation ? <p className="mt-1 text-[13px] text-gray-600">{e.explanation}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="pt-2 border-t border-gray-100">
            <div className="text-[11px] uppercase tracking-wide text-[#0176D3] font-semibold">Literature search</div>
          </div>
          <div>
            <label htmlFor="alt-databases" className={LABEL_CLASS}>Databases</label>
            <input id="alt-databases" value={alternatives?.lit_databases ?? ""} onChange={setAlternative("lit_databases")} placeholder="e.g. PubMed, AGRICOLA" className={INPUT_CLASS} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="alt-years-from" className={LABEL_CLASS}>Years from</label>
              <input id="alt-years-from" value={alternatives?.lit_years_from ?? ""} onChange={setAlternative("lit_years_from")} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="alt-years-to" className={LABEL_CLASS}>Years to</label>
              <input id="alt-years-to" value={alternatives?.lit_years_to ?? ""} onChange={setAlternative("lit_years_to")} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="alt-search-date" className={LABEL_CLASS}>Search date</label>
              <input id="alt-search-date" type="date" value={alternatives?.lit_search_date ?? ""} onChange={setAlternative("lit_search_date")} className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label htmlFor="alt-keywords" className={LABEL_CLASS}>Keywords</label>
            <input id="alt-keywords" value={alternatives?.lit_keywords ?? ""} onChange={setAlternative("lit_keywords")} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="alt-lit-summary" className={LABEL_CLASS}>Search summary</label>
            <textarea id="alt-lit-summary" value={alternatives?.lit_summary ?? ""} onChange={setAlternative("lit_summary")} rows={2} className={INPUT_CLASS} />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <div className="text-[11px] uppercase tracking-wide text-[#0176D3] font-semibold">Colleague consultation</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="alt-colleague-name" className={LABEL_CLASS}>Name</label>
              <input id="alt-colleague-name" value={alternatives?.colleague_name ?? ""} onChange={setAlternative("colleague_name")} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="alt-colleague-date" className={LABEL_CLASS}>Date</label>
              <input id="alt-colleague-date" type="date" value={alternatives?.colleague_date ?? ""} onChange={setAlternative("colleague_date")} className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label htmlFor="alt-colleague-notes" className={LABEL_CLASS}>Notes</label>
            <textarea id="alt-colleague-notes" value={alternatives?.colleague_notes ?? ""} onChange={setAlternative("colleague_notes")} rows={2} className={INPUT_CLASS} />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <div className="text-[11px] uppercase tracking-wide text-[#0176D3] font-semibold">Attending Veterinarian</div>
          </div>
          {avRequired && !alternatives?.av_consult_date && (
            <div className="flex items-center gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <ShieldCheck size={14} className="shrink-0" />
              This protocol is Category D/E — an Attending Veterinarian consultation is required.
            </div>
          )}
          <div>
            <label htmlFor="alt-av-date" className={LABEL_CLASS}>AV consultation date</label>
            <input id="alt-av-date" type="date" value={alternatives?.av_consult_date ?? ""} onChange={setAlternative("av_consult_date")} className={INPUT_CLASS} />
          </div>
          <SaveRow label="Save 3 Rs & alternatives" onSave={saveAlternatives} saving={alternativesSaving} status={alternativesStatus} />
        </Card>

        {tablesError && <div className="text-[12px] text-red-600">{tablesError}</div>}
      </div>

      {drugModal.open && (
        <DrugModal
          initial={drugModal.editing
            ? {
                reason_for_use: drugModal.editing.reason_for_use ?? "",
                drug: drugModal.editing.drug,
                dose: drugModal.editing.dose ?? "",
                route: drugModal.editing.route ?? "",
                duration: drugModal.editing.duration ?? "",
              }
            : BLANK_DRUG}
          onClose={() => setDrugModal({ open: false, editing: null })}
          onSave={saveDrug}
        />
      )}
      {animalModal.open && (
        <AnimalUseModal
          initial={animalModal.editing
            ? {
                species_strain: animalModal.editing.species_strain,
                sex: animalModal.editing.sex ?? "",
                approx_age: animalModal.editing.approx_age ?? "",
                max_count: animalModal.editing.max_count == null ? "" : String(animalModal.editing.max_count),
              }
            : BLANK_ANIMAL}
          onClose={() => setAnimalModal({ open: false, editing: null })}
          onSave={saveAnimalUse}
        />
      )}
      {expModal.open && (
        <ExperimentModal
          initial={expModal.editing
            ? {
                name: expModal.editing.name,
                description: expModal.editing.description ?? "",
                multiple_surgical_events: !!expModal.editing.multiple_surgical_events,
                humane_endpoints: expModal.editing.humane_endpoints ?? "",
                persistent_clinical_signs_justification: expModal.editing.persistent_clinical_signs_justification ?? "",
                monitoring_plan: expModal.editing.monitoring_plan ?? "",
                husbandry_exceptions: expModal.editing.husbandry_exceptions ?? "",
              }
            : BLANK_EXPERIMENT}
          onClose={() => setExpModal({ open: false, editing: null })}
          onSave={saveExperiment}
        />
      )}
      {rrrModal.open && (
        <RrrModal
          initial={rrrModal.editing ?? BLANK_RRR}
          onClose={() => setRrrModal({ open: false, editing: null })}
          onSave={saveRrrEntry}
        />
      )}
    </div>
  );
}
