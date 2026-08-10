import { Router } from "express";
import { db } from "../db.js";
import { audit, diffObject, resolveActor } from "../audit.js";

export const router = Router();

// Mirrors "2. Procedures to be applied to animals" in Appendix A.
export const PROCEDURE_KEYS = [
  { key: "breeding", label: "Breeding" },
  { key: "animal_id", label: "Animal identification methods" },
  { key: "anesthesia", label: "Anesthesia" },
  { key: "blood_collection", label: "Blood collection" },
  { key: "injections", label: "Injections" },
  { key: "exposure_substance", label: "Exposure to experimental substance" },
  { key: "non_pharma_compounds", label: "Non-pharmaceutical grade compounds" },
  { key: "prolonged_restraint", label: "Devices for prolonged restraint" },
  { key: "pain_distress", label: "Animal pain or distress" },
  { key: "non_survival_surgery", label: "Non-survival surgery" },
  { key: "tissue_collection", label: "Tissues collected after euthanasia" },
  { key: "survival_surgery", label: "Survival surgery" },
  { key: "illness_endpoint", label: "Illness, experimental endpoint, induced disease, or pathological condition" },
  { key: "special_diets", label: "Special diets and/or food or water restriction" },
  { key: "offsite_work", label: "Animal work done at another institution" },
];

// Surgery procedures get an expanded detail block (RAP pp. 7-8): detailed
// surgical description, aseptic preparation, analgesia level, and (for
// survival surgery only) post-operative care & monitoring.
export const SURGERY_KEYS = ["survival_surgery", "non_survival_surgery"];

export const ANALGESIA_LEVELS = ["None", "Mild", "Moderate", "Profound"];

export function requireProtocol(req, res) {
  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id);
  if (!protocol) {
    res.status(404).json({ error: "Protocol not found" });
    return null;
  }
  return protocol;
}

// ---- procedures checklist ----

router.get("/:id/procedures", (req, res) => {
  if (!requireProtocol(req, res)) return;

  // Ensure a row exists for every known procedure key (idempotent).
  const insertDefault = db.prepare(`
    INSERT OR IGNORE INTO protocol_procedures (protocol_id, procedure_key, checked)
    VALUES (?, ?, 0)
  `);
  for (const { key } of PROCEDURE_KEYS) insertDefault.run(req.params.id, key);

  const rows = db.prepare(`
    SELECT procedure_key, checked, description,
      surgical_description, aseptic_preparation, analgesia_level, postop_care
    FROM protocol_procedures WHERE protocol_id = ?
  `).all(req.params.id);

  const byKey = Object.fromEntries(rows.map(r => [r.procedure_key, r]));
  res.json(PROCEDURE_KEYS.map(({ key, label }) => ({
    procedure_key: key,
    label,
    checked: !!(byKey[key]?.checked),
    description: byKey[key]?.description ?? "",
    surgical_description: byKey[key]?.surgical_description ?? "",
    aseptic_preparation: byKey[key]?.aseptic_preparation ?? "",
    analgesia_level: byKey[key]?.analgesia_level ?? "",
    postop_care: byKey[key]?.postop_care ?? "",
  })));
});

// body: { procedures: [{ procedure_key, checked, description,
//   surgical_description, aseptic_preparation, analgesia_level, postop_care }, ...] }
router.put("/:id/procedures", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { procedures } = req.body;
  if (!Array.isArray(procedures)) return res.status(400).json({ error: "procedures must be an array" });

  const validKeys = new Set(PROCEDURE_KEYS.map(p => p.key));
  const upsert = db.prepare(`
    INSERT INTO protocol_procedures (protocol_id, procedure_key, checked, description,
      surgical_description, aseptic_preparation, analgesia_level, postop_care)
    VALUES (@protocol_id, @procedure_key, @checked, @description,
      @surgical_description, @aseptic_preparation, @analgesia_level, @postop_care)
    ON CONFLICT(protocol_id, procedure_key) DO UPDATE SET
      checked = excluded.checked, description = excluded.description,
      surgical_description = excluded.surgical_description,
      aseptic_preparation = excluded.aseptic_preparation,
      analgesia_level = excluded.analgesia_level,
      postop_care = excluded.postop_care
  `);

  db.exec("BEGIN");
  try {
    for (const p of procedures) {
      if (!validKeys.has(p.procedure_key)) continue;
      upsert.run({
        protocol_id: req.params.id,
        procedure_key: p.procedure_key,
        checked: p.checked ? 1 : 0,
        description: p.description || null,
        surgical_description: p.surgical_description || null,
        aseptic_preparation: p.aseptic_preparation || null,
        analgesia_level: p.analgesia_level || null,
        postop_care: p.postop_care || null,
      });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: err.message });
  }

  audit({
    action: "procedures.updated",
    entityType: "protocol",
    entityId: req.params.id,
    actor: resolveActor(req),
    details: { count: procedures.length },
  });
  res.json({ ok: true });
});

// ---- drug / dosing table ----

router.get("/:id/drugs", (req, res) => {
  if (!requireProtocol(req, res)) return;
  res.json(db.prepare("SELECT * FROM protocol_drugs WHERE protocol_id = ? ORDER BY id").all(req.params.id));
});

router.post("/:id/drugs", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { reason_for_use, drug, dose, route, duration } = req.body;
  if (!drug) return res.status(400).json({ error: "drug is required" });

  const result = db.prepare(`
    INSERT INTO protocol_drugs (protocol_id, reason_for_use, drug, dose, route, duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, reason_for_use || null, drug, dose || null, route || null, duration || null);

  const rowId = Number(result.lastInsertRowid);
  audit({
    action: "drug.created",
    entityType: "drug",
    entityId: rowId,
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, drug },
  });
  res.status(201).json(db.prepare("SELECT * FROM protocol_drugs WHERE id = ?").get(rowId));
});

router.patch("/:id/drugs/:drugId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const existing = db.prepare("SELECT * FROM protocol_drugs WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.drugId), req.params.id);
  if (!existing) return res.status(404).json({ error: "Drug row not found" });

  const fields = ["reason_for_use", "drug", "dose", "route", "duration"];
  const updates = fields.filter(f => f in req.body);
  if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

  const params = { id: Number(req.params.drugId) };
  for (const f of updates) params[f] = req.body[f];
  const setClause = updates.map(f => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE protocol_drugs SET ${setClause} WHERE id = @id`).run(params);

  const changed = {};
  for (const f of updates) changed[f] = params[f];
  audit({
    action: "drug.updated",
    entityType: "drug",
    entityId: Number(req.params.drugId),
    actor: resolveActor(req),
    details: diffObject(existing, changed),
  });

  res.json(db.prepare("SELECT * FROM protocol_drugs WHERE id = ?").get(Number(req.params.drugId)));
});

router.delete("/:id/drugs/:drugId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const existing = db.prepare("SELECT drug FROM protocol_drugs WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.drugId), req.params.id);
  if (!existing) return res.status(404).json({ error: "Drug row not found" });
  audit({
    action: "drug.deleted",
    entityType: "drug",
    entityId: Number(req.params.drugId),
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, drug: existing.drug },
  });
  db.prepare("DELETE FROM protocol_drugs WHERE id = ? AND protocol_id = ?")
    .run(Number(req.params.drugId), req.params.id);
  res.status(204).end();
});

// ---- animal use table ----

router.get("/:id/animal-use", (req, res) => {
  if (!requireProtocol(req, res)) return;
  res.json(db.prepare("SELECT * FROM protocol_animal_use WHERE protocol_id = ? ORDER BY id").all(req.params.id));
});

router.post("/:id/animal-use", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { species_strain, sex, approx_age, max_count } = req.body;
  if (!species_strain) return res.status(400).json({ error: "species_strain is required" });

  const result = db.prepare(`
    INSERT INTO protocol_animal_use (protocol_id, species_strain, sex, approx_age, max_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, species_strain, sex || null, approx_age || null, max_count ?? null);

  const rowId = Number(result.lastInsertRowid);
  audit({
    action: "animal_use.created",
    entityType: "animal_use",
    entityId: rowId,
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, species_strain },
  });
  res.status(201).json(db.prepare("SELECT * FROM protocol_animal_use WHERE id = ?").get(rowId));
});

router.patch("/:id/animal-use/:rowId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const existing = db.prepare("SELECT * FROM protocol_animal_use WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.rowId), req.params.id);
  if (!existing) return res.status(404).json({ error: "Animal-use row not found" });

  const fields = ["species_strain", "sex", "approx_age", "max_count"];
  const updates = fields.filter(f => f in req.body);
  if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

  const params = { id: Number(req.params.rowId) };
  for (const f of updates) params[f] = req.body[f];
  const setClause = updates.map(f => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE protocol_animal_use SET ${setClause} WHERE id = @id`).run(params);

  const changed = {};
  for (const f of updates) changed[f] = params[f];
  audit({
    action: "animal_use.updated",
    entityType: "animal_use",
    entityId: Number(req.params.rowId),
    actor: resolveActor(req),
    details: diffObject(existing, changed),
  });

  res.json(db.prepare("SELECT * FROM protocol_animal_use WHERE id = ?").get(Number(req.params.rowId)));
});

router.delete("/:id/animal-use/:rowId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const existing = db.prepare("SELECT species_strain FROM protocol_animal_use WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.rowId), req.params.id);
  if (!existing) return res.status(404).json({ error: "Animal-use row not found" });
  audit({
    action: "animal_use.deleted",
    entityType: "animal_use",
    entityId: Number(req.params.rowId),
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, species_strain: existing.species_strain },
  });
  db.prepare("DELETE FROM protocol_animal_use WHERE id = ? AND protocol_id = ?")
    .run(Number(req.params.rowId), req.params.id);
  res.status(204).end();
});

// ---- experiments (1:N per protocol) ----

router.get("/:id/experiments", (req, res) => {
  if (!requireProtocol(req, res)) return;
  res.json(db.prepare("SELECT * FROM protocol_experiments WHERE protocol_id = ? ORDER BY id").all(req.params.id));
});

router.post("/:id/experiments", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { name, description, multiple_surgical_events, humane_endpoints, persistent_clinical_signs_justification, monitoring_plan, husbandry_exceptions } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const result = db.prepare(`
    INSERT INTO protocol_experiments (
      protocol_id, name, description, multiple_surgical_events,
      humane_endpoints, persistent_clinical_signs_justification,
      monitoring_plan, husbandry_exceptions
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    name,
    description || null,
    multiple_surgical_events ? 1 : 0,
    humane_endpoints || null,
    persistent_clinical_signs_justification || null,
    monitoring_plan || null,
    husbandry_exceptions || null,
  );

  const rowId = Number(result.lastInsertRowid);
  audit({
    action: "experiment.created",
    entityType: "experiment",
    entityId: rowId,
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, name },
  });
  res.status(201).json(db.prepare("SELECT * FROM protocol_experiments WHERE id = ?").get(rowId));
});

router.patch("/:id/experiments/:expId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const existing = db.prepare("SELECT * FROM protocol_experiments WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.expId), req.params.id);
  if (!existing) return res.status(404).json({ error: "Experiment row not found" });

  const fields = [
    "name", "description", "multiple_surgical_events",
    "humane_endpoints", "persistent_clinical_signs_justification",
    "monitoring_plan", "husbandry_exceptions",
  ];
  const updates = fields.filter(f => f in req.body);
  if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

  const params = { id: Number(req.params.expId) };
  for (const f of updates) params[f] = f === "multiple_surgical_events" ? (req.body[f] ? 1 : 0) : req.body[f];
  const setClause = updates.map(f => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE protocol_experiments SET ${setClause} WHERE id = @id`).run(params);

  const changed = {};
  for (const f of updates) changed[f] = params[f];
  audit({
    action: "experiment.updated",
    entityType: "experiment",
    entityId: Number(req.params.expId),
    actor: resolveActor(req),
    details: diffObject(existing, changed),
  });

  res.json(db.prepare("SELECT * FROM protocol_experiments WHERE id = ?").get(Number(req.params.expId)));
});

router.delete("/:id/experiments/:expId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const existing = db.prepare("SELECT name FROM protocol_experiments WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.expId), req.params.id);
  if (!existing) return res.status(404).json({ error: "Experiment row not found" });
  audit({
    action: "experiment.deleted",
    entityType: "experiment",
    entityId: Number(req.params.expId),
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, name: existing.name },
  });
  db.prepare("DELETE FROM protocol_experiments WHERE id = ? AND protocol_id = ?")
    .run(Number(req.params.expId), req.params.id);
  res.status(204).end();
});

// ---- 3 Rs justification entries (1:N per protocol) ----

export const RRR_TYPES = ["replacement", "refinement", "reduction"];

export const RRR_LABELS = {
  replacement: "Replacement",
  refinement: "Refinement",
  reduction: "Reduction",
};

router.get("/:id/rrr", (req, res) => {
  if (!requireProtocol(req, res)) return;
  res.json(
    db.prepare("SELECT * FROM protocol_rrr_entries WHERE protocol_id = ? ORDER BY rrr_type, id")
      .all(req.params.id)
  );
});

router.post("/:id/rrr", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { rrr_type, method, explanation } = req.body;
  if (!RRR_TYPES.includes(rrr_type)) {
    return res.status(400).json({ error: `rrr_type must be one of: ${RRR_TYPES.join(", ")}` });
  }
  if (!method) return res.status(400).json({ error: "method is required" });

  const result = db.prepare(`
    INSERT INTO protocol_rrr_entries (protocol_id, rrr_type, method, explanation)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, rrr_type, method, explanation || null);

  const rowId = Number(result.lastInsertRowid);
  audit({
    action: "rrr.created",
    entityType: "rrr",
    entityId: rowId,
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, rrr_type, method },
  });
  res.status(201).json(db.prepare("SELECT * FROM protocol_rrr_entries WHERE id = ?").get(rowId));
});

router.patch("/:id/rrr/:entryId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const existing = db.prepare("SELECT * FROM protocol_rrr_entries WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.entryId), req.params.id);
  if (!existing) return res.status(404).json({ error: "RRR entry not found" });

  const fields = ["rrr_type", "method", "explanation"];
  const updates = fields.filter(f => f in req.body);
  if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });
  if (updates.includes("rrr_type") && !RRR_TYPES.includes(req.body.rrr_type)) {
    return res.status(400).json({ error: `rrr_type must be one of: ${RRR_TYPES.join(", ")}` });
  }

  const params = { id: Number(req.params.entryId) };
  for (const f of updates) params[f] = req.body[f];
  const setClause = updates.map(f => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE protocol_rrr_entries SET ${setClause} WHERE id = @id`).run(params);

  const changed = {};
  for (const f of updates) changed[f] = params[f];
  audit({
    action: "rrr.updated",
    entityType: "rrr",
    entityId: Number(req.params.entryId),
    actor: resolveActor(req),
    details: diffObject(existing, changed),
  });

  res.json(db.prepare("SELECT * FROM protocol_rrr_entries WHERE id = ?").get(Number(req.params.entryId)));
});

router.delete("/:id/rrr/:entryId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const existing = db.prepare("SELECT rrr_type, method FROM protocol_rrr_entries WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.entryId), req.params.id);
  if (!existing) return res.status(404).json({ error: "RRR entry not found" });
  audit({
    action: "rrr.deleted",
    entityType: "rrr",
    entityId: Number(req.params.entryId),
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, ...existing },
  });
  db.prepare("DELETE FROM protocol_rrr_entries WHERE id = ? AND protocol_id = ?")
    .run(Number(req.params.entryId), req.params.id);
  res.status(204).end();
});

// ---- 3 Rs / alternatives (one row per protocol) ----

const ALTERNATIVES_FIELDS = [
  "lit_databases", "lit_years_from", "lit_years_to", "lit_search_date",
  "lit_keywords", "lit_summary",
  "colleague_name", "colleague_date", "colleague_notes",
  "av_consult_date",
];

// The three replacement/refinement/reduction text blobs were replaced by the
// structured protocol_rrr_entries rows above; keep the DB columns for
// backward compatibility but never expose them through the API.
function shapeAlternatives(row, protocol) {
  const categoryLetter = (protocol.pain_category || "").trim().slice(-1).toUpperCase();
  const avRequired = categoryLetter === "D" || categoryLetter === "E";
  return {
    protocol_id: row.protocol_id,
    lit_databases: row.lit_databases,
    lit_years_from: row.lit_years_from,
    lit_years_to: row.lit_years_to,
    lit_search_date: row.lit_search_date,
    lit_keywords: row.lit_keywords,
    lit_summary: row.lit_summary,
    colleague_name: row.colleague_name,
    colleague_date: row.colleague_date,
    colleague_notes: row.colleague_notes,
    av_consult_date: row.av_consult_date,
    av_consultation_required: avRequired,
  };
}

router.get("/:id/alternatives", (req, res) => {
  const protocol = requireProtocol(req, res);
  if (!protocol) return;

  db.prepare(`INSERT OR IGNORE INTO protocol_alternatives (protocol_id) VALUES (?)`).run(req.params.id);
  const row = db.prepare("SELECT * FROM protocol_alternatives WHERE protocol_id = ?").get(req.params.id);

  res.json(shapeAlternatives(row, protocol));
});

router.patch("/:id/alternatives", (req, res) => {
  if (!requireProtocol(req, res)) return;
  db.prepare(`INSERT OR IGNORE INTO protocol_alternatives (protocol_id) VALUES (?)`).run(req.params.id);

  const updates = ALTERNATIVES_FIELDS.filter(f => f in req.body);
  if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

  const before = db.prepare("SELECT * FROM protocol_alternatives WHERE protocol_id = ?").get(req.params.id);
  const params = { protocol_id: req.params.id };
  for (const f of updates) params[f] = req.body[f];
  const setClause = updates.map(f => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE protocol_alternatives SET ${setClause} WHERE protocol_id = @protocol_id`).run(params);

  const changed = {};
  for (const f of updates) changed[f] = params[f];
  audit({
    action: "alternatives.updated",
    entityType: "protocol",
    entityId: req.params.id,
    actor: resolveActor(req),
    details: diffObject(before, changed),
  });

  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id);
  const row = db.prepare("SELECT * FROM protocol_alternatives WHERE protocol_id = ?").get(req.params.id);
  res.json(shapeAlternatives(row, protocol));
});

// ---- Options questionnaire + conditional sections (Roadmap item 5) ----
// Cayuse-style "Options" page (AGENTS.md §1.2): yes/no answers determine which
// sections even appear on a protocol. A section only renders when its trigger
// option is "Yes", and every *visible* section must be complete (green
// checkmark) before the protocol may be submitted. The registry below is the
// single source of truth for visibility and required fields — the client
// renders from what GET /:id/sections returns rather than mirroring these
// defs, so there's no drift to keep in sync.

export const OPTION_DEFS = [
  { key: "funded", label: "Is this project funded?" },
  { key: "hazardous_materials", label: "Do you use hazardous materials, chemicals, radioactive agents, or nanoparticles?" },
  { key: "off_campus", label: "Will any animal work happen off campus?" },
  { key: "offsite_housing", label: "Will animals be housed outside the central facility for more than 12 hours?" },
  { key: "human_tissues", label: "Does this project use human tissues or samples?" },
];

export const CONDITIONAL_SECTIONS = [
  {
    key: "funding",
    label: "Funding sources",
    description: "External or internal funding that supports this protocol.",
    trigger: { option: "funded", value: true },
    fields: [
      { key: "agency", label: "Funding agency / source", type: "text", required: true },
      { key: "grant_number", label: "Grant number", type: "text", required: false },
      { key: "funding_status", label: "Funding status", type: "select", options: ["Awarded", "Pending", "Submitted"], required: true },
    ],
  },
  {
    key: "hazardous_materials",
    label: "Hazardous materials & nanoparticles",
    description: "Chemicals, radioactive agents, or nanoparticles used on animals.",
    trigger: { option: "hazardous_materials", value: true },
    fields: [
      { key: "materials", label: "Materials used", type: "textarea", required: true },
      { key: "safety_measures", label: "Safety / containment measures", type: "textarea", required: true },
      { key: "disposal", label: "Disposal method", type: "text", required: true },
    ],
  },
  {
    key: "off_campus",
    label: "Off-campus work",
    description: "Animal work performed at another institution or site.",
    trigger: { option: "off_campus", value: true },
    fields: [
      { key: "location", label: "Off-campus location(s)", type: "text", required: true },
      { key: "oversight", label: "Oversight / permissions in place", type: "textarea", required: true },
    ],
  },
  {
    key: "offsite_housing",
    label: "Housing outside central facility",
    description: "Animals housed off-site for more than 12 hours.",
    trigger: { option: "offsite_housing", value: true },
    fields: [
      { key: "facility", label: "Housing facility", type: "text", required: true },
      { key: "justification", label: "Justification for off-site housing", type: "textarea", required: true },
      { key: "veterinary_contact", label: "Veterinary contact", type: "text", required: true },
    ],
  },
  {
    key: "human_tissues",
    label: "Human tissues / samples",
    description: "Human-derived tissues or samples used in the study.",
    trigger: { option: "human_tissues", value: true },
    fields: [
      { key: "source", label: "Tissue source", type: "text", required: true },
      { key: "irb_approval", label: "IRB approval / exemption", type: "text", required: true },
      { key: "handling", label: "Handling & de-identification", type: "textarea", required: true },
    ],
  },
];

const OPTION_KEYS = OPTION_DEFS.map(o => o.key);
const SECTION_BY_KEY = Object.fromEntries(CONDITIONAL_SECTIONS.map(s => [s.key, s]));

// Parse the stored options JSON into a complete { option: boolean } object,
// defaulting every option to false — existing protocols (options column NULL)
// simply have no conditional sections.
export function parseOptions(protocolOrValue) {
  const stored = typeof protocolOrValue === "object" ? protocolOrValue?.options : protocolOrValue;
  const parsed = {};
  for (const { key } of OPTION_DEFS) parsed[key] = false;
  if (typeof stored === "string" && stored) {
    try {
      const obj = JSON.parse(stored);
      for (const key of OPTION_KEYS) {
        if (typeof obj[key] === "boolean") parsed[key] = obj[key];
      }
    } catch {
      // malformed JSON → all defaults
    }
  }
  return parsed;
}

function visibleSections(protocol) {
  const options = parseOptions(protocol);
  return CONDITIONAL_SECTIONS.filter(s => options[s.trigger.option] === s.trigger.value);
}

function sectionData(protocolId, sectionKey) {
  const row = db.prepare("SELECT data FROM protocol_sections WHERE protocol_id = ? AND section_key = ?").get(protocolId, sectionKey);
  if (!row?.data) return {};
  try {
    const parsed = JSON.parse(row.data);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sectionCompleteness(section, data) {
  const missing = section.fields
    .filter(f => f.required && !hasText(data?.[f.key]))
    .map(f => f.label);
  return { complete: missing.length === 0, missing };
}

// GET /api/protocols/:id/options  -> { funded: false, ... }
router.get("/:id/options", (req, res) => {
  const protocol = requireProtocol(req, res);
  if (!protocol) return;
  res.json(parseOptions(protocol));
});

// PATCH /api/protocols/:id/options  body: { funded: true } (any subset)
router.patch("/:id/options", (req, res) => {
  const protocol = requireProtocol(req, res);
  if (!protocol) return;
  const body = req.body || {};
  const keys = Object.keys(body).filter(k => OPTION_KEYS.includes(k));
  if (keys.length === 0) {
    return res.status(400).json({ error: `options must be one of: ${OPTION_KEYS.join(", ")}` });
  }
  if (keys.some(k => typeof body[k] !== "boolean")) {
    return res.status(400).json({ error: "option values must be boolean" });
  }
  const next = parseOptions(protocol);
  for (const k of keys) next[k] = body[k];
  db.prepare("UPDATE protocols SET options = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(next), req.params.id);
  audit({
    action: "options.updated",
    entityType: "protocol",
    entityId: req.params.id,
    actor: resolveActor(req),
    details: Object.fromEntries(keys.map(k => [k, body[k]])),
  });
  res.json(next);
});

// GET /api/protocols/:id/sections  -> visible (triggered) conditional sections
// with their field defs, stored data, and per-section completeness.
router.get("/:id/sections", (req, res) => {
  const protocol = requireProtocol(req, res);
  if (!protocol) return;
  res.json({
    options: parseOptions(protocol),
    visible: visibleSections(protocol).map(s => {
      const data = sectionData(req.params.id, s.key);
      const { complete, missing } = sectionCompleteness(s, data);
      return { key: s.key, label: s.label, description: s.description, fields: s.fields, data, complete, missing };
    }),
  });
});

// PUT /api/protocols/:id/sections/:sectionKey  body: { data: { fieldKey: value } }
router.put("/:id/sections/:sectionKey", (req, res) => {
  const protocol = requireProtocol(req, res);
  if (!protocol) return;
  const section = SECTION_BY_KEY[req.params.sectionKey];
  if (!section) return res.status(404).json({ error: "Unknown section" });
  if (!visibleSections(protocol).some(s => s.key === section.key)) {
    return res.status(400).json({ error: "This section is not active for this protocol" });
  }
  const data = req.body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ error: "data must be an object" });
  }
  const fieldKeys = new Set(section.fields.map(f => f.key));
  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (!fieldKeys.has(k)) continue;
    sanitized[k] = typeof v === "string" ? v.trim() : "";
  }
  db.prepare(`
    INSERT INTO protocol_sections (protocol_id, section_key, data, updated_at)
    VALUES (@protocol_id, @section_key, @data, datetime('now'))
    ON CONFLICT(protocol_id, section_key) DO UPDATE SET
      data = excluded.data, updated_at = datetime('now')
  `).run({ protocol_id: req.params.id, section_key: section.key, data: JSON.stringify(sanitized) });
  audit({
    action: "section.updated",
    entityType: "protocol",
    entityId: req.params.id,
    actor: resolveActor(req),
    details: { section: section.key },
  });
  const { complete, missing } = sectionCompleteness(section, sanitized);
  res.json({ key: section.key, label: section.label, description: section.description, fields: section.fields, data: sanitized, complete, missing });
});

// ---- submission-readiness validation (per-section completeness) ----
// Mirrors the Cayuse/Cornell rule: every section must be complete (green
// checkmark) before a protocol may be submitted. The same function is used
// by GET /:id/validation and by the protocols PATCH handler when a protocol
// is transitioned to "Submitted".

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function countDatabases(value) {
  return String(value || "").split(",").map(s => s.trim()).filter(Boolean).length;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function validateCompleteness(protocolId) {
  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(protocolId);
  if (!protocol) return null;

  // summaries
  const summariesMissing = [];
  if (!hasText(protocol.purpose_summary)) summariesMissing.push("Lay purpose summary");
  if (!hasText(protocol.harm_benefit_analysis)) summariesMissing.push("Harm–benefit analysis");
  if (!hasText(protocol.scientific_summary)) summariesMissing.push("Scientific summary");

  // procedures: rows are auto-created on access; every checked item needs a narrative
  const insertDefault = db.prepare(`
    INSERT OR IGNORE INTO protocol_procedures (protocol_id, procedure_key, checked)
    VALUES (?, ?, 0)
  `);
  for (const { key } of PROCEDURE_KEYS) insertDefault.run(protocolId, key);
  const labelByKey = Object.fromEntries(PROCEDURE_KEYS.map(p => [p.key, p.label]));
  const surgeryKeys = new Set(SURGERY_KEYS);
  const proceduresMissing = [];
  for (const r of db.prepare("SELECT * FROM protocol_procedures WHERE protocol_id = ?").all(protocolId)) {
    if (!r.checked) continue;
    const label = labelByKey[r.procedure_key] || r.procedure_key;
    if (!hasText(r.description)) {
      proceduresMissing.push(`Narrative for “${label}”`);
    }
    if (surgeryKeys.has(r.procedure_key)) {
      if (!hasText(r.surgical_description)) proceduresMissing.push(`Surgical description for “${label}”`);
      if (!hasText(r.aseptic_preparation)) proceduresMissing.push(`Aseptic preparation for “${label}”`);
      if (!hasText(r.analgesia_level)) proceduresMissing.push(`Analgesia level for “${label}”`);
      if (r.procedure_key === "survival_surgery" && !hasText(r.postop_care)) {
        proceduresMissing.push(`Post-operative care for “${label}”`);
      }
    }
  }

  const drugCount = db.prepare("SELECT COUNT(*) AS c FROM protocol_drugs WHERE protocol_id = ?").get(protocolId).c;
  const animalUseCount = db.prepare("SELECT COUNT(*) AS c FROM protocol_animal_use WHERE protocol_id = ?").get(protocolId).c;
  const experimentCount = db.prepare("SELECT COUNT(*) AS c FROM protocol_experiments WHERE protocol_id = ?").get(protocolId).c;

  const drugsMissing = drugCount === 0 ? ["At least one drug/dosing row"] : [];
  const animalUseMissing = animalUseCount === 0 ? ["At least one animal-use row"] : [];
  const experimentsMissing = experimentCount === 0 ? ["At least one experiment"] : [];

  // alternatives (literature search + 3 Rs entries + AV consultation)
  db.prepare(`INSERT OR IGNORE INTO protocol_alternatives (protocol_id) VALUES (?)`).run(protocolId);
  const alt = db.prepare("SELECT * FROM protocol_alternatives WHERE protocol_id = ?").get(protocolId);

  const altMissing = [];
  if (countDatabases(alt.lit_databases) < 2) altMissing.push("Literature search in ≥2 databases");
  if (!hasText(alt.lit_years_from) || !hasText(alt.lit_years_to)) {
    altMissing.push("Literature search date range (years from / to)");
  }
  if (!hasText(alt.lit_search_date)) altMissing.push("Literature search date");
  if (!hasText(alt.lit_keywords)) altMissing.push("Literature search keywords");
  if (!hasText(alt.lit_summary)) altMissing.push("Literature search summary");

  const rrrByType = {};
  for (const r of db.prepare("SELECT rrr_type, COUNT(*) AS c FROM protocol_rrr_entries WHERE protocol_id = ? GROUP BY rrr_type").all(protocolId)) {
    rrrByType[r.rrr_type] = r.c;
  }
  for (const t of RRR_TYPES) {
    if (!rrrByType[t]) altMissing.push(`${capitalize(t)} justification`);
  }

  const categoryLetter = (protocol.pain_category || "").trim().slice(-1).toUpperCase();
  const avRequired = categoryLetter === "D" || categoryLetter === "E";
  if (avRequired && !hasText(alt.av_consult_date)) {
    altMissing.push("Attending Veterinarian consultation date");
  }

  // Conditional sections (Roadmap item 5): every section whose trigger option
  // is "Yes" must be complete before submission. Untriggered sections aren't
  // visible and don't count — the group reads complete (vacuously) for them.
  const conditionalMissing = [];
  for (const section of visibleSections(protocol)) {
    const data = sectionData(protocolId, section.key);
    for (const f of section.fields) {
      if (f.required && !hasText(data[f.key])) {
        conditionalMissing.push(`“${section.label}” — ${f.label}`);
      }
    }
  }

  const sections = {
    summaries: { complete: summariesMissing.length === 0, missing: summariesMissing },
    procedures: { complete: proceduresMissing.length === 0, missing: proceduresMissing },
    drugs: { complete: drugsMissing.length === 0, missing: drugsMissing },
    animal_use: { complete: animalUseMissing.length === 0, missing: animalUseMissing },
    experiments: { complete: experimentsMissing.length === 0, missing: experimentsMissing },
    alternatives: { complete: altMissing.length === 0, missing: altMissing },
    conditional: { complete: conditionalMissing.length === 0, missing: conditionalMissing },
  };
  const overall = Object.values(sections).every(s => s.complete);

  return { overall, avRequired, sections };
}

router.get("/:id/validation", (req, res) => {
  if (!requireProtocol(req, res)) return;
  res.json(validateCompleteness(req.params.id));
});
