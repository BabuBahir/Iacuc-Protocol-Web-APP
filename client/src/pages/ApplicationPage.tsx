import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft, Plus, Trash2, Pencil, X, Save, BookOpen,
  ClipboardList, Syringe, FlaskConical, Search, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import type {
  Alternatives,
  AlternativesInput,
  AnimalUseInput,
  AnimalUseRow,
  DrugInput,
  DrugRow,
  Procedure,
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
  const [alternatives, setAlternatives] = useState<Alternatives | null>(null);

  const [drugModal, setDrugModal] = useState<{ open: boolean; editing: DrugRow | null }>({ open: false, editing: null });
  const [animalModal, setAnimalModal] = useState<{ open: boolean; editing: AnimalUseRow | null }>({ open: false, editing: null });

  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);
  const [summarySaving, setSummarySaving] = useState(false);
  const [proceduresStatus, setProceduresStatus] = useState<string | null>(null);
  const [proceduresSaving, setProceduresSaving] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [alternativesStatus, setAlternativesStatus] = useState<string | null>(null);
  const [alternativesSaving, setAlternativesSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getProtocol(id),
      api.listProcedures(id),
      api.listDrugs(id),
      api.listAnimalUse(id),
      api.getAlternatives(id),
    ])
      .then(([p, procs, dr, au, alt]) => {
        if (cancelled) return;
        setPurpose(p.purpose_summary ?? "");
        setHarmBenefit(p.harm_benefit_analysis ?? "");
        setScientific(p.scientific_summary ?? "");
        setProcedures(procs);
        setDrugs(dr);
        setAnimalUse(au);
        setAlternatives(alt);
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

  const saveProcedures = async () => {
    if (!id) return;
    setProceduresSaving(true);
    setProceduresStatus(null);
    try {
      await api.updateProcedures(id, procedures.map(({ procedure_key, checked, description }) => ({
        procedure_key,
        checked,
        description,
      })));
      setProceduresStatus("Saved procedures");
    } catch (err) {
      setProceduresStatus(errorMessage(err));
    } finally {
      setProceduresSaving(false);
    }
  };

  const runTableAction = async (fn: () => Promise<unknown>) => {
    setTablesError(null);
    try {
      await fn();
      if (id) setDrugs(await api.listDrugs(id));
      if (id) setAnimalUse(await api.listAnimalUse(id));
    } catch (err) {
      setTablesError(errorMessage(err));
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
    await runTableAction(async () => {
      if (drugModal.editing) {
        await api.updateDrug(id!, drugModal.editing.id, payload);
      } else {
        await api.createDrug(id!, payload);
      }
    });
    setDrugModal({ open: false, editing: null });
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
    await runTableAction(async () => {
      if (animalModal.editing) {
        await api.updateAnimalUse(id!, animalModal.editing.id, payload);
      } else {
        await api.createAnimalUse(id!, payload);
      }
    });
    setAnimalModal({ open: false, editing: null });
  };

  const deleteAnimalUse = (row: AnimalUseRow) => {
    void runTableAction(() => api.deleteAnimalUse(id!, row.id));
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
      "replacement_text", "refinement_text", "reduction_text",
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
                  <textarea
                    aria-label={`${p.label} description`}
                    value={p.description}
                    onChange={e => setProcedureDescription(i, e.target.value)}
                    placeholder="Describe this procedure and why it is needed..."
                    rows={2}
                    className={`${INPUT_CLASS} mt-2`}
                  />
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

        <Card icon={Search} title="3 Rs & alternatives">
          <div>
            <label htmlFor="alt-replacement" className={LABEL_CLASS}>Replacement</label>
            <textarea id="alt-replacement" value={alternatives?.replacement_text ?? ""} onChange={setAlternative("replacement_text")} rows={2} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="alt-refinement" className={LABEL_CLASS}>Refinement</label>
            <textarea id="alt-refinement" value={alternatives?.refinement_text ?? ""} onChange={setAlternative("refinement_text")} rows={2} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="alt-reduction" className={LABEL_CLASS}>Reduction</label>
            <textarea id="alt-reduction" value={alternatives?.reduction_text ?? ""} onChange={setAlternative("reduction_text")} rows={2} className={INPUT_CLASS} />
          </div>
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
    </div>
  );
}
