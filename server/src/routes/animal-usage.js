import { Router } from "express";
import { db } from "../db.js";
import { PROCEDURE_KEYS, requireProtocol } from "./protocol-form.js";

export const router = Router();

// USDA pain categories used on the animal usage register (B/C/D/E map to the
// protocol's "Category B".."Category E"; "Category A" is not applicable to
// animal ordering/usage transactions).
export const PAIN_LEVELS = ["B", "C", "D", "E"];

export const USAGE_TYPES = ["order", "use"];

const PROCEDURE_KEY_SET = new Set(PROCEDURE_KEYS.map(p => p.key));

// ---- animal usage register (actual orders/uses against the approved allowance) ----

router.get("/:id/animal-usage", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const protocolId = req.params.id;

  const transactions = await db.all(`
    SELECT * FROM animal_usage_transactions
    WHERE protocol_id = $1 ORDER BY transaction_date DESC, id DESC
  `, [protocolId]);

  // The approved allowance per species is the sum of the *planned* animal-use
  // table's max_count (protocol_animal_use), kept distinct from the ledger.
  const allowanceRows = await db.all(`
    SELECT species_strain, SUM(max_count) AS allowance
    FROM protocol_animal_use
    WHERE protocol_id = $1 GROUP BY species_strain
  `, [protocolId]);
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
router.post("/:id/animal-usage", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
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

  const row = await db.get(`
    INSERT INTO animal_usage_transactions
      (protocol_id, transaction_date, species_strain, pain_level, quantity, type, procedure_key, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [
    protocolId,
    transaction_date,
    species_strain,
    pain_level || null,
    quantity,
    type || "use",
    procedure_key || null,
    notes || null,
  ]);

  res.status(201).json(row);
});
