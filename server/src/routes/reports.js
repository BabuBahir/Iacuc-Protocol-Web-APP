import { Router } from "express";
import { db } from "../db.js";

// AAALAC-style compliance reports (Roadmap item 9, AGENTS.md §1.6).
//
// Canned aggregation reports over the Appendix A content that is now
// populated through the UI (procedures, drugs, animal-use, experiments) plus
// the research-plan steps. All read-only aggregations — no audit rows needed
// because nothing is written.
//
// The reports and the fields they derive from:
//   restraint_by_species            protocol_procedures.prolonged_restraint checked → species
//   euthanasia_by_species           protocol_drugs.reason_for_use ILIKE %euthanasi% → drug = method
//   surgery_locations               survival/non-survival surgery checked → research_steps[].location
//   multiple_major_recovery_surgery protocol_experiments.multiple_surgical_events = 1
//   analgesic_anesthetic_drugs      protocol_drugs.reason_for_use IN Anesthesia/Analgesia
//   use_locations_by_species        research_steps grouped by location × species
//
// Species is taken from the protocol's animal-use rows (protocol_animal_use)
// when present, falling back to the protocol-level species column.

export const router = Router();

// Parse the research_steps JSON column defensively (legacy rows may hold
// plain strings or malformed JSON; both should be skipped, not thrown).
function parseSteps(row) {
  if (!row || !row.research_steps) return [];
  try {
    const steps = JSON.parse(row.research_steps);
    return Array.isArray(steps) ? steps : [];
  } catch {
    return [];
  }
}

// Protocols whose animal-use table lists multiple species, or none, still get
// a species via the LEFT JOIN fallback — one row per (protocol × species).
const SPECIES_SELECT = "COALESCE(au.species_strain, p.species) AS species";

// 1. Restraint by species — which species are under prolonged restraint and how.
function restraintBySpecies() {
  return db.prepare(`
    SELECT p.id AS protocol_id, ${SPECIES_SELECT}, pp.description AS restraint_method
    FROM protocol_procedures pp
    JOIN protocols p ON p.id = pp.protocol_id
    LEFT JOIN protocol_animal_use au ON au.protocol_id = p.id
    WHERE pp.procedure_key = 'prolonged_restraint' AND pp.checked = 1
    ORDER BY species, p.id
  `).all();
}

// 2. Euthanasia methods by species — drugs whose reason_for_use mentions
// euthanasia; the drug name is the method.
function euthanasiaBySpecies() {
  return db.prepare(`
    SELECT p.id AS protocol_id, ${SPECIES_SELECT},
           d.drug AS method, d.dose, d.route
    FROM protocol_drugs d
    JOIN protocols p ON p.id = d.protocol_id
    LEFT JOIN protocol_animal_use au ON au.protocol_id = p.id
    WHERE lower(COALESCE(d.reason_for_use, '')) LIKE '%euthanasi%'
    ORDER BY species, d.drug
  `).all();
}

// 3. Surgery locations/types — protocols with survival/non-survival surgery,
// cross-referenced against the research-plan locations where the surgery happens.
function surgeryLocations() {
  const rows = db.prepare(`
    SELECT p.id AS protocol_id, p.species, p.research_steps,
      MAX(CASE WHEN pp.procedure_key = 'survival_surgery' AND pp.checked = 1 THEN 1 ELSE 0 END) AS survival,
      MAX(CASE WHEN pp.procedure_key = 'non_survival_surgery' AND pp.checked = 1 THEN 1 ELSE 0 END) AS non_survival
    FROM protocol_procedures pp
    JOIN protocols p ON p.id = pp.protocol_id
    WHERE pp.procedure_key IN ('survival_surgery', 'non_survival_surgery')
    GROUP BY p.id
  `).all();

  const out = [];
  for (const row of rows) {
    const types = [];
    if (row.survival) types.push("Survival surgery");
    if (row.non_survival) types.push("Non-survival surgery");
    const locations = [...new Set(parseSteps(row).map(s => s.location).filter(Boolean))];
    for (const surgeryType of types) {
      for (const location of locations) {
        out.push({ protocol_id: row.protocol_id, species: row.species, surgery_type: surgeryType, location });
      }
    }
  }
  return out.sort(
    (a, b) => a.surgery_type.localeCompare(b.surgery_type) || String(a.species ?? "").localeCompare(String(b.species ?? "")) || a.protocol_id.localeCompare(b.protocol_id)
  );
}

// 4. Multiple major recovery surgical procedures — experiments flagged as
// performing surgery more than once on the same animal.
function multipleMajorRecoverySurgery() {
  return db.prepare(`
    SELECT p.id AS protocol_id, p.species, e.name AS experiment, e.description
    FROM protocol_experiments e
    JOIN protocols p ON p.id = e.protocol_id
    WHERE e.multiple_surgical_events = 1
    ORDER BY p.id
  `).all();
}

// 5. Analgesic/anesthetic drugs in use, per species.
function analgesicAnestheticDrugs() {
  return db.prepare(`
    SELECT p.id AS protocol_id, ${SPECIES_SELECT}, d.reason_for_use, d.drug, d.dose, d.route
    FROM protocol_drugs d
    JOIN protocols p ON p.id = d.protocol_id
    LEFT JOIN protocol_animal_use au ON au.protocol_id = p.id
    WHERE lower(COALESCE(d.reason_for_use, '')) LIKE '%anesth%'
       OR lower(COALESCE(d.reason_for_use, '')) LIKE '%analg%'
    ORDER BY species, d.reason_for_use, d.drug
  `).all();
}

// 6. Use locations by species — aggregated from the research plan steps.
function useLocationsBySpecies() {
  const rows = db.prepare("SELECT id, research_steps FROM protocols").all();
  const byKey = new Map();
  for (const row of rows) {
    for (const step of parseSteps(row)) {
      if (!step.location) continue;
      const species = step.species || null;
      const key = `${step.location}\u0000${species ?? ""}`;
      if (!byKey.has(key)) byKey.set(key, { location: step.location, species, protocol_ids: new Set() });
      byKey.get(key).protocol_ids.add(row.id);
    }
  }
  return [...byKey.values()]
    .map(({ location, species, protocol_ids }) => ({
      location,
      species,
      protocol_count: protocol_ids.size,
      protocol_ids: [...protocol_ids].sort(),
    }))
    .sort(
      (a, b) =>
        a.location.localeCompare(b.location) || String(a.species ?? "").localeCompare(String(b.species ?? ""))
    );
}

// GET /api/reports — every canned AAALAC report in one payload.
router.get("/reports", (_req, res) => {
  res.json({
    generated_at: new Date().toISOString(),
    reports: {
      restraint_by_species: restraintBySpecies(),
      euthanasia_by_species: euthanasiaBySpecies(),
      surgery_locations: surgeryLocations(),
      multiple_major_recovery_surgery: multipleMajorRecoverySurgery(),
      analgesic_anesthetic_drugs: analgesicAnestheticDrugs(),
      use_locations_by_species: useLocationsBySpecies(),
    },
  });
});
