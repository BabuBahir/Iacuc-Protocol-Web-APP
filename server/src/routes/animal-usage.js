import { Router } from "express";
import { db } from "../db.js";
import { PROCEDURE_KEYS, requireProtocol } from "./protocol-form.js";
import { audit, resolveActor } from "../audit.js";
import { applyFilters, validateFilters, REGISTER_FILTER_FIELDS } from "./filter.js";

export const router = Router();

// Cross-protocol register search (Roadmap item 8): flattened ledger
// transactions across every protocol, filterable with the shared builder.
// Mounted at /api (see app.js) so the path is GET /api/animal-usage — the
// per-protocol ledger above stays at /api/protocols/:id/animal-usage.
export const searchRouter = Router();

searchRouter.get("/animal-usage", (req, res) => {
  let filters = [];
  if (req.query.filters) {
    try {
      filters = JSON.parse(req.query.filters);
    } catch {
      return res.status(400).json({ error: "filters must be a JSON array" });
    }
    const invalid = validateFilters(filters, REGISTER_FILTER_FIELDS);
    if (invalid) return res.status(400).json({ error: invalid });
  }
  const rows = db
    .prepare(`
      SELECT t.*, p.title AS protocol_title
      FROM animal_usage_transactions t
      LEFT JOIN protocols p ON p.id = t.protocol_id
      ORDER BY t.transaction_date DESC, t.id DESC
    `)
    .all();
  res.json(applyFilters(rows, filters, REGISTER_FILTER_FIELDS));
});

// USDA pain categories used on the animal usage register (B/C/D/E map to the
// protocol's "Category B".."Category E"; "Category A" is not applicable to
// animal ordering/usage transactions).
export const PAIN_LEVELS = ["B", "C", "D", "E"];

export const USAGE_TYPES = ["order", "use"];

const PROCEDURE_KEY_SET = new Set(PROCEDURE_KEYS.map(p => p.key));

// ---- animal usage register (actual orders/uses against the approved allowance) ----

router.get("/:id/animal-usage", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const protocolId = req.params.id;

  const transactions = db.prepare(`
    SELECT * FROM animal_usage_transactions
    WHERE protocol_id = ? ORDER BY transaction_date DESC, id DESC
  `).all(protocolId);

  // The approved allowance per species is the sum of the *planned* animal-use
  // table's max_count (protocol_animal_use), kept distinct from the ledger.
  const allowanceRows = db.prepare(`
    SELECT species_strain, SUM(max_count) AS allowance
    FROM protocol_animal_use
    WHERE protocol_id = ? GROUP BY species_strain
  `).all(protocolId);
  const allowanceBySpecies = new Map(allowanceRows.map(r => [r.species_strain, r.allowance]));

  const bySpeciesMap = new Map();
  for (const t of transactions) {
    if (!bySpeciesMap.has(t.species_strain)) {
      bySpeciesMap.set(t.species_strain, { ordered: 0, used: 0 });
    }
    const bucket = bySpeciesMap.get(t.species_strain);
    bucket[t.type === "order" ? "ordered" : "used"] += t.quantity;
  }
  // Include allowance species even when there are no transactions yet.
  for (const species of allowanceBySpecies.keys()) {
    if (!bySpeciesMap.has(species)) bySpeciesMap.set(species, { ordered: 0, used: 0 });
  }

  const by_species = [...bySpeciesMap.entries()].map(([species, { ordered, used }]) => {
    const allowance = allowanceBySpecies.get(species) ?? 0;
    const total = ordered + used;
    return {
      species_strain: species,
      allowance,
      ordered,
      used,
      remaining: Math.max(0, allowance - total),
      over_allowance: total > allowance,
    };
  }).sort((a, b) => a.species_strain.localeCompare(b.species_strain));

  const tallyBy = (field) => {
    const counts = {};
    for (const t of transactions) {
      const key = t[field] || "(unspecified)";
      counts[key] = (counts[key] ?? 0) + t.quantity;
    }
    return Object.entries(counts).map(([key, count]) => ({ [field]: key, count }));
  };

  res.json({
    transactions,
    by_species,
    by_pain_category: tallyBy("pain_level"),
    by_procedure: tallyBy("procedure_key"),
  });
});

// body: { transaction_date, species_strain, pain_level, quantity, type, procedure_key, notes }
router.post("/:id/animal-usage", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const protocolId = req.params.id;
  const { transaction_date, species_strain, pain_level, quantity, type, procedure_key, notes } = req.body;

  if (!transaction_date) return res.status(400).json({ error: "transaction_date is required" });
  if (!species_strain) return res.status(400).json({ error: "species_strain is required" });
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "quantity must be a positive integer" });
  }
  if (type !== undefined && !USAGE_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${USAGE_TYPES.join(", ")}` });
  }
  if (pain_level !== undefined && pain_level !== null && pain_level !== "" && !PAIN_LEVELS.includes(pain_level)) {
    return res.status(400).json({ error: `pain_level must be one of: ${PAIN_LEVELS.join(", ")}` });
  }
  if (procedure_key && !PROCEDURE_KEY_SET.has(procedure_key)) {
    return res.status(400).json({ error: "unknown procedure_key" });
  }

  const result = db.prepare(`
    INSERT INTO animal_usage_transactions
      (protocol_id, transaction_date, species_strain, pain_level, quantity, type, procedure_key, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    protocolId,
    transaction_date,
    species_strain,
    pain_level || null,
    quantity,
    type || "use",
    procedure_key || null,
    notes || null,
  );

  const rowId = Number(result.lastInsertRowid);
  audit({
    action: "animal_usage.created",
    entityType: "animal_usage",
    entityId: rowId,
    actor: resolveActor(req),
    details: { protocol_id: protocolId, species_strain, quantity, type: type || "use" },
  });
  res.status(201).json(db.prepare("SELECT * FROM animal_usage_transactions WHERE id = ?").get(rowId));
});
