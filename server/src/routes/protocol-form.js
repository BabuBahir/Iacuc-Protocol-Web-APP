import { Router } from "express";
import { db } from "../db.js";

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

function requireProtocol(req, res) {
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
    SELECT procedure_key, checked, description FROM protocol_procedures WHERE protocol_id = ?
  `).all(req.params.id);

  const byKey = Object.fromEntries(rows.map(r => [r.procedure_key, r]));
  res.json(PROCEDURE_KEYS.map(({ key, label }) => ({
    procedure_key: key,
    label,
    checked: !!(byKey[key]?.checked),
    description: byKey[key]?.description ?? "",
  })));
});

// body: { procedures: [{ procedure_key, checked, description }, ...] }
router.put("/:id/procedures", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { procedures } = req.body;
  if (!Array.isArray(procedures)) return res.status(400).json({ error: "procedures must be an array" });

  const validKeys = new Set(PROCEDURE_KEYS.map(p => p.key));
  const upsert = db.prepare(`
    INSERT INTO protocol_procedures (protocol_id, procedure_key, checked, description)
    VALUES (@protocol_id, @procedure_key, @checked, @description)
    ON CONFLICT(protocol_id, procedure_key) DO UPDATE SET
      checked = excluded.checked, description = excluded.description
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
      });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: err.message });
  }

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

  res.status(201).json(db.prepare("SELECT * FROM protocol_drugs WHERE id = ?").get(Number(result.lastInsertRowid)));
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

  res.json(db.prepare("SELECT * FROM protocol_drugs WHERE id = ?").get(Number(req.params.drugId)));
});

router.delete("/:id/drugs/:drugId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const result = db.prepare("DELETE FROM protocol_drugs WHERE id = ? AND protocol_id = ?")
    .run(Number(req.params.drugId), req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Drug row not found" });
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

  res.status(201).json(db.prepare("SELECT * FROM protocol_animal_use WHERE id = ?").get(Number(result.lastInsertRowid)));
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

  res.json(db.prepare("SELECT * FROM protocol_animal_use WHERE id = ?").get(Number(req.params.rowId)));
});

router.delete("/:id/animal-use/:rowId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const result = db.prepare("DELETE FROM protocol_animal_use WHERE id = ? AND protocol_id = ?")
    .run(Number(req.params.rowId), req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Animal-use row not found" });
  res.status(204).end();
});

// ---- 3 Rs / alternatives (one row per protocol) ----

const ALTERNATIVES_FIELDS = [
  "replacement_text", "refinement_text", "reduction_text",
  "lit_databases", "lit_years_from", "lit_years_to", "lit_search_date",
  "lit_keywords", "lit_summary",
  "colleague_name", "colleague_date", "colleague_notes",
  "av_consult_date",
];

router.get("/:id/alternatives", (req, res) => {
  const protocol = requireProtocol(req, res);
  if (!protocol) return;

  db.prepare(`INSERT OR IGNORE INTO protocol_alternatives (protocol_id) VALUES (?)`).run(req.params.id);
  const row = db.prepare("SELECT * FROM protocol_alternatives WHERE protocol_id = ?").get(req.params.id);

  // Category D/E protocols require an Attending Veterinarian consultation (per Appendix A, section 3).
  // Bug fix: a naive /[DE]/i.test(pain_category) matches the E in the word
  // "Category" itself, so it was true for every category, not just D/E.
  // Check the actual trailing category letter instead.
  const categoryLetter = (protocol.pain_category || "").trim().slice(-1).toUpperCase();
  const avRequired = categoryLetter === "D" || categoryLetter === "E";

  res.json({ ...row, av_consultation_required: avRequired });
});

router.patch("/:id/alternatives", (req, res) => {
  if (!requireProtocol(req, res)) return;
  db.prepare(`INSERT OR IGNORE INTO protocol_alternatives (protocol_id) VALUES (?)`).run(req.params.id);

  const updates = ALTERNATIVES_FIELDS.filter(f => f in req.body);
  if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

  const params = { protocol_id: req.params.id };
  for (const f of updates) params[f] = req.body[f];
  const setClause = updates.map(f => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE protocol_alternatives SET ${setClause} WHERE protocol_id = @protocol_id`).run(params);

  res.json(db.prepare("SELECT * FROM protocol_alternatives WHERE protocol_id = ?").get(req.params.id));
});
