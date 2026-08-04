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

function requireFacility(req, res) {
  const facility = db.prepare("SELECT * FROM facilities WHERE id = ?").get(Number(req.params.id));
  if (!facility) {
    res.status(404).json({ error: "Facility not found" });
    return null;
  }
  return facility;
}

function requireInspection(req, res) {
  const inspection = db.prepare("SELECT * FROM inspections WHERE id = ?").get(Number(req.params.id));
  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return null;
  }
  return inspection;
}

// Decorate an inspection row with its facility's name.
function withFacilityName(row) {
  if (!row) return row;
  const facility = db.prepare("SELECT name FROM facilities WHERE id = ?").get(row.facility_id);
  return { ...row, facility_name: facility ? facility.name : null };
}

function deficienciesFor(inspectionId) {
  return db.prepare(`
    SELECT * FROM inspection_deficiencies
    WHERE inspection_id = ?
    ORDER BY CASE severity WHEN 'Major' THEN 0 ELSE 1 END, id
  `).all(inspectionId);
}

// GET /api/facilities
router.get("/facilities", (_req, res) => {
  res.json(db.prepare("SELECT * FROM facilities ORDER BY name").all());
});

// POST /api/facilities  { name, type, species? }
router.post("/facilities", (req, res) => {
  const { name, type, species } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
  if (!FACILITY_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${FACILITY_TYPES.join(", ")}` });
  }

  const result = db.prepare("INSERT INTO facilities (name, type, species) VALUES (?, ?, ?)")
    .run(String(name).trim(), type, species || null);
  res.status(201).json(db.prepare("SELECT * FROM facilities WHERE id = ?").get(Number(result.lastInsertRowid)));
});

// DELETE /api/facilities/:id  (cascades to its inspections + deficiencies)
router.delete("/facilities/:id", (req, res) => {
  if (!requireFacility(req, res)) return;
  db.prepare("DELETE FROM facilities WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});

// GET /api/inspections  (most recent first, each with its facility name)
router.get("/inspections", (_req, res) => {
  const rows = db.prepare("SELECT * FROM inspections ORDER BY inspection_date DESC, id DESC").all();
  res.json(rows.map(withFacilityName));
});

// POST /api/inspections  { facility_id, inspection_date, report?, result? }
// Records a semi-annual facility inspection.
router.post("/inspections", (req, res) => {
  const { facility_id, inspection_date, report, result } = req.body || {};
  if (!facility_id || !inspection_date) {
    return res.status(400).json({ error: "facility_id and inspection_date are required" });
  }
  const facility = db.prepare("SELECT id FROM facilities WHERE id = ?").get(Number(facility_id));
  if (!facility) return res.status(400).json({ error: "Unknown facility_id" });
  if (result !== undefined && result !== null && !INSPECTION_RESULTS.includes(result)) {
    return res.status(400).json({ error: `result must be one of: ${INSPECTION_RESULTS.join(", ")}` });
  }

  const insert = db.prepare(`
    INSERT INTO inspections (facility_id, inspection_date, report, result)
    VALUES (?, ?, ?, ?)
  `).run(Number(facility_id), inspection_date, report || null, result || "Pending");

  const created = db.prepare("SELECT * FROM inspections WHERE id = ?").get(Number(insert.lastInsertRowid));
  res.status(201).json({ ...withFacilityName(created), deficiencies: [] });
});

// GET /api/inspections/:id  — the inspection plus its deficiencies
router.get("/inspections/:id", (req, res) => {
  const inspection = requireInspection(req, res);
  if (!inspection) return;
  res.json({ ...withFacilityName(inspection), deficiencies: deficienciesFor(inspection.id) });
});

// GET /api/inspections/:id/deficiencies  — filtered read of deficiencies
router.get("/inspections/:id/deficiencies", (req, res) => {
  const inspection = requireInspection(req, res);
  if (!inspection) return;
  res.json(deficienciesFor(inspection.id));
});

// POST /api/inspections/:id/deficiencies  { severity, description, remediation_deadline? }
router.post("/inspections/:id/deficiencies", (req, res) => {
  const inspection = requireInspection(req, res);
  if (!inspection) return;
  const { severity, description, remediation_deadline } = req.body || {};
  if (!DEFICIENCY_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${DEFICIENCY_SEVERITIES.join(", ")}` });
  }
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: "description is required" });
  }

  const result = db.prepare(`
    INSERT INTO inspection_deficiencies (inspection_id, severity, description, remediation_deadline)
    VALUES (?, ?, ?, ?)
  `).run(inspection.id, severity, String(description).trim(), remediation_deadline || null);

  res.status(201).json(
    db.prepare("SELECT * FROM inspection_deficiencies WHERE id = ?").get(Number(result.lastInsertRowid))
  );
});

// PATCH /api/inspections/:id/deficiencies/:defId  — mark a deficiency remediated.
// The remediation deadline feeds the "due / remediation overdue" dashboards.
router.patch("/inspections/:id/deficiencies/:defId", (req, res) => {
  const inspection = requireInspection(req, res);
  if (!inspection) return;
  const deficiency = db.prepare("SELECT * FROM inspection_deficiencies WHERE id = ? AND inspection_id = ?")
    .get(Number(req.params.defId), inspection.id);
  if (!deficiency) return res.status(404).json({ error: "Deficiency not found" });

  if (deficiency.remediated_at) {
    return res.status(400).json({ error: "Deficiency is already remediated" });
  }
  db.prepare("UPDATE inspection_deficiencies SET remediated_at = datetime('now') WHERE id = ?").run(deficiency.id);
  res.status(200).json(
    db.prepare("SELECT * FROM inspection_deficiencies WHERE id = ?").get(deficiency.id)
  );
});
