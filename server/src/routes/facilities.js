import { Router } from "express";
import { db } from "../db.js";

// Facility & semi-annual inspection program (Domain F): three standalone
// tables with no protocol dependency. Facilities are the physical spaces
// (housing rooms / labs / surgical suites) inspected every six months; the
// semi-annual cadence is a computation on inspection dates, not stored state.

export const router = Router();

export const FACILITY_TYPES = ["Housing Room", "Lab", "Surgical Suite"];
export const INSPECTION_RESULTS = ["Pending", "Pass", "Fail", "Re-inspection required"];
export const DEFICIENCY_SEVERITIES = ["Minor", "Major"];

async function requireFacility(req, res) {
  const facility = await db.get("SELECT * FROM facilities WHERE id = $1", [Number(req.params.id)]);
  if (!facility) {
    res.status(404).json({ error: "Facility not found" });
    return null;
  }
  return facility;
}

async function requireInspection(req, res) {
  const inspection = await db.get("SELECT * FROM inspections WHERE id = $1", [Number(req.params.id)]);
  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return null;
  }
  return inspection;
}

// Decorate an inspection row with its facility's name.
async function withFacilityName(row) {
  if (!row) return row;
  const facility = await db.get("SELECT name FROM facilities WHERE id = $1", [row.facility_id]);
  return { ...row, facility_name: facility ? facility.name : null };
}

async function deficienciesFor(inspectionId) {
  return db.all(`
    SELECT * FROM inspection_deficiencies
    WHERE inspection_id = $1
    ORDER BY CASE severity WHEN 'Major' THEN 0 ELSE 1 END, id
  `, [inspectionId]);
}

// GET /api/facilities
router.get("/facilities", async (_req, res) => {
  res.json(await db.all("SELECT * FROM facilities ORDER BY name"));
});

// POST /api/facilities  { name, type, species? }
router.post("/facilities", async (req, res) => {
  const { name, type, species } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
  if (!FACILITY_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${FACILITY_TYPES.join(", ")}` });
  }

  const row = await db.get(
    "INSERT INTO facilities (name, type, species) VALUES ($1, $2, $3) RETURNING *",
    [String(name).trim(), type, species || null]
  );
  res.status(201).json(row);
});

// DELETE /api/facilities/:id  (cascades to its inspections + deficiencies)
router.delete("/facilities/:id", async (req, res) => {
  if (!(await requireFacility(req, res))) return;
  await db.run("DELETE FROM facilities WHERE id = $1", [Number(req.params.id)]);
  res.status(204).end();
});

// GET /api/inspections  (most recent first, each with its facility name)
router.get("/inspections", async (_req, res) => {
  const rows = await db.all("SELECT * FROM inspections ORDER BY inspection_date DESC, id DESC");
  const out = [];
  for (const row of rows) out.push(await withFacilityName(row));
  res.json(out);
});

// POST /api/inspections  { facility_id, inspection_date, report?, result? }
// Records a semi-annual facility inspection.
router.post("/inspections", async (req, res) => {
  const { facility_id, inspection_date, report, result } = req.body || {};
  if (!facility_id || !inspection_date) {
    return res.status(400).json({ error: "facility_id and inspection_date are required" });
  }
  const facility = await db.get("SELECT id FROM facilities WHERE id = $1", [Number(facility_id)]);
  if (!facility) return res.status(400).json({ error: "Unknown facility_id" });
  if (result !== undefined && result !== null && !INSPECTION_RESULTS.includes(result)) {
    return res.status(400).json({ error: `result must be one of: ${INSPECTION_RESULTS.join(", ")}` });
  }

  const created = await db.get(`
    INSERT INTO inspections (facility_id, inspection_date, report, result)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [Number(facility_id), inspection_date, report || null, result || "Pending"]);
  res.status(201).json({ ...(await withFacilityName(created)), deficiencies: [] });
});

// GET /api/inspections/:id  — the inspection plus its deficiencies
router.get("/inspections/:id", async (req, res) => {
  const inspection = await requireInspection(req, res);
  if (!inspection) return;
  res.json({ ...(await withFacilityName(inspection)), deficiencies: await deficienciesFor(inspection.id) });
});

// GET /api/inspections/:id/deficiencies  — filtered read of deficiencies
router.get("/inspections/:id/deficiencies", async (req, res) => {
  const inspection = await requireInspection(req, res);
  if (!inspection) return;
  res.json(await deficienciesFor(inspection.id));
});

// POST /api/inspections/:id/deficiencies  { severity, description, remediation_deadline? }
router.post("/inspections/:id/deficiencies", async (req, res) => {
  const inspection = await requireInspection(req, res);
  if (!inspection) return;
  const { severity, description, remediation_deadline } = req.body || {};
  if (!DEFICIENCY_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${DEFICIENCY_SEVERITIES.join(", ")}` });
  }
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: "description is required" });
  }

  const row = await db.get(`
    INSERT INTO inspection_deficiencies (inspection_id, severity, description, remediation_deadline)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [inspection.id, severity, String(description).trim(), remediation_deadline || null]);
  res.status(201).json(row);
});

// PATCH /api/inspections/:id/deficiencies/:defId  — mark a deficiency remediated.
// The remediation deadline feeds the "due / remediation overdue" dashboards.
router.patch("/inspections/:id/deficiencies/:defId", async (req, res) => {
  const inspection = await requireInspection(req, res);
  if (!inspection) return;
  const deficiency = await db.get(
    "SELECT * FROM inspection_deficiencies WHERE id = $1 AND inspection_id = $2",
    [Number(req.params.defId), inspection.id]
  );
  if (!deficiency) return res.status(404).json({ error: "Deficiency not found" });

  if (deficiency.remediated_at) {
    return res.status(400).json({ error: "Deficiency is already remediated" });
  }
  await db.run("UPDATE inspection_deficiencies SET remediated_at = CURRENT_TIMESTAMP WHERE id = $1", [deficiency.id]);
  res.status(200).json(await db.get("SELECT * FROM inspection_deficiencies WHERE id = $1", [deficiency.id]));
});
