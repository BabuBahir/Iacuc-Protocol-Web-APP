import { Router } from "express";
import { db } from "../db.js";
import { requireProtocol } from "./protocol-form.js";
import { audit } from "../audit.js";

// Personnel compliance (Domain C): CITI-style training records and OHSP
// (Occupational Health & Safety Program) clearance. Two routers are exported —
// one mounted at /api/personnel (per-person training/ohsp data) and one at
// /api/protocols (the computed "are all listed personnel compliant?" check).

export const personnelRouter = Router();
export const protocolPersonnelRouter = Router();

export const OHSP_STATUSES = ["Pending", "Cleared", "Denied"];

function requirePersonnel(req, res) {
  const person = db.prepare(`
    SELECT personnel.id, personnel.name, personnel.email, personnel.role_id, roles.name AS role_name
    FROM personnel JOIN roles ON roles.id = personnel.role_id
    WHERE personnel.id = ?
  `).get(Number(req.params.id));
  if (!person) {
    res.status(404).json({ error: "Personnel not found" });
    return null;
  }
  return person;
}

// A record is "Current" while its expires_date (if any) is today or later.
// A record with no expiry is treated as current indefinitely.
function recordStatus(record) {
  if (!record.expires_date) return "Current";
  const today = new Date();
  const expiry = new Date(record.expires_date);
  return expiry >= today ? "Current" : "Expired";
}

function trainingFor(person) {
  const rows = db.prepare(`
    SELECT id, personnel_id, course, completed_date, expires_date
    FROM personnel_training
    WHERE personnel_id = ?
    ORDER BY completed_date DESC
  `).all(person.id);
  return rows.map(r => ({ ...r, status: recordStatus(r) }));
}

// Overall training status: current if at least one record is still valid;
// expired if records exist but none are valid; otherwise no records on file.
function trainingStatus(person) {
  const rows = trainingFor(person);
  if (rows.length === 0) return "No records";
  return rows.some(r => r.status === "Current") ? "Current" : "Expired";
}

function ohspFor(person) {
  const row = db.prepare("SELECT personnel_id, status, reviewed_date, notes FROM personnel_ohsp WHERE personnel_id = ?").get(person.id);
  return row ?? { personnel_id: person.id, status: "Pending", reviewed_date: null, notes: null };
}

export function complianceFor(person) {
  const ts = trainingStatus(person);
  const ohsp = ohspFor(person);
  return {
    training_status: ts,
    ohsp_status: ohsp.status,
    compliant: ts === "Current" && ohsp.status === "Cleared",
  };
}

// ---- list all personnel with compliance (admin page) ----

personnelRouter.get("/compliance", (_req, res) => {
  const rows = db.prepare(`
    SELECT personnel.id, personnel.name, personnel.role_id, roles.name AS role_name
    FROM personnel JOIN roles ON roles.id = personnel.role_id
    ORDER BY personnel.name
  `).all();
  res.json(rows.map(row => {
    const person = { id: row.id, name: row.name, role_name: row.role_name };
    return { ...person, ...complianceFor(person) };
  }));
});

// ---- per-person training records ----

personnelRouter.get("/:id/training", (req, res) => {
  const person = requirePersonnel(req, res);
  if (!person) return;
  res.json({
    personnel: { id: person.id, name: person.name, role_name: person.role_name },
    courses: trainingFor(person),
    overall_status: trainingStatus(person),
  });
});

// body: { course, completed_date, expires_date? }
personnelRouter.post("/:id/training", (req, res) => {
  const person = requirePersonnel(req, res);
  if (!person) return;
  const { course, completed_date, expires_date } = req.body || {};
  if (!course || !String(course).trim()) return res.status(400).json({ error: "course is required" });
  if (!completed_date) return res.status(400).json({ error: "completed_date is required" });

  const result = db.prepare(`
    INSERT INTO personnel_training (personnel_id, course, completed_date, expires_date)
    VALUES (?, ?, ?, ?)
  `).run(person.id, String(course).trim(), completed_date, expires_date || null);

  audit({
    action: "training.added",
    entityType: "training",
    entityId: Number(result.lastInsertRowid),
    actor: person.name,
    details: { personnel: person.name, course: String(course).trim() },
  });

  const row = db.prepare(`
    SELECT id, personnel_id, course, completed_date, expires_date
    FROM personnel_training WHERE id = ?
  `).get(Number(result.lastInsertRowid));
  res.status(201).json({ ...row, status: recordStatus(row) });
});

// body: any of { course, completed_date, expires_date }
personnelRouter.patch("/:id/training/:trainingId", (req, res) => {
  const person = requirePersonnel(req, res);
  if (!person) return;
  const record = db.prepare("SELECT * FROM personnel_training WHERE id = ? AND personnel_id = ?")
    .get(Number(req.params.trainingId), person.id);
  if (!record) return res.status(404).json({ error: "Training record not found" });

  const { course, completed_date, expires_date } = req.body || {};
  const fields = {};
  if (course !== undefined) fields.course = String(course).trim();
  if (completed_date !== undefined) fields.completed_date = completed_date;
  if (expires_date !== undefined) fields.expires_date = expires_date || null;
  if (fields.course === "") return res.status(400).json({ error: "course cannot be empty" });
  if (fields.completed_date === "") return res.status(400).json({ error: "completed_date cannot be empty" });

  db.prepare(`
    UPDATE personnel_training
    SET course = @course, completed_date = @completed_date, expires_date = @expires_date
    WHERE id = @id
  `).run({ id: record.id, course: record.course, completed_date: record.completed_date, expires_date: record.expires_date, ...fields });

  audit({
    action: "training.updated",
    entityType: "training",
    entityId: record.id,
    actor: person.name,
    details: { personnel: person.name, course: fields.course ?? record.course },
  });

  const row = db.prepare(`
    SELECT id, personnel_id, course, completed_date, expires_date
    FROM personnel_training WHERE id = ?
  `).get(record.id);
  res.json({ ...row, status: recordStatus(row) });
});

personnelRouter.delete("/:id/training/:trainingId", (req, res) => {
  const person = requirePersonnel(req, res);
  if (!person) return;
  const existing = db.prepare("SELECT course FROM personnel_training WHERE id = ? AND personnel_id = ?")
    .get(Number(req.params.trainingId), person.id);
  if (!existing) return res.status(404).json({ error: "Training record not found" });
  audit({
    action: "training.deleted",
    entityType: "training",
    entityId: Number(req.params.trainingId),
    actor: person.name,
    details: { personnel: person.name, course: existing.course },
  });
  db.prepare("DELETE FROM personnel_training WHERE id = ? AND personnel_id = ?")
    .run(Number(req.params.trainingId), person.id);
  res.status(204).end();
});

// ---- per-person OHSP clearance ----

personnelRouter.get("/:id/ohsp", (req, res) => {
  const person = requirePersonnel(req, res);
  if (!person) return;
  res.json(ohspFor(person));
});

// body: { status, reviewed_date?, notes? } — upsert
personnelRouter.post("/:id/ohsp", (req, res) => {
  const person = requirePersonnel(req, res);
  if (!person) return;
  const { status, reviewed_date, notes } = req.body || {};
  if (!OHSP_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${OHSP_STATUSES.join(", ")}` });
  }
  db.prepare(`
    INSERT INTO personnel_ohsp (personnel_id, status, reviewed_date, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(personnel_id) DO UPDATE SET
      status = excluded.status,
      reviewed_date = excluded.reviewed_date,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).run(person.id, status, reviewed_date || null, notes || null);
  audit({
    action: "ohsp.updated",
    entityType: "ohsp",
    entityId: person.id,
    actor: person.name,
    details: { personnel: person.name, status },
  });
  res.json(ohspFor(person));
});

// ---- computed protocol personnel compliance ----

// Maps a related_items "Personnel" label ("Dr. Elena Marsh — PI") to the
// personnel row it names, then returns per-person compliance. A person with no
// matching personnel profile is flagged as non-compliant ("No profile").
protocolPersonnelRouter.get("/:id/personnel", (req, res) => {
  const protocol = requireProtocol(req, res);
  if (!protocol) return;

  const labels = db.prepare(`
    SELECT label FROM related_items
    WHERE protocol_id = ? AND list_name = 'Personnel'
    ORDER BY id
  `).all(protocol.id).map(r => r.label);

  const personnel = labels.map(label => {
    const [name, role] = label.split(" — ").map(s => (s || "").trim());
    const person = db.prepare("SELECT * FROM personnel WHERE name = ?").get(name);
    if (!person) {
      return {
        label, name, role: role || null, personnel_id: null,
        compliance: { training_status: "No profile", ohsp_status: "No profile", compliant: false },
      };
    }
    return {
      label, name, role: role || null, personnel_id: person.id,
      compliance: complianceFor(person),
    };
  });

  res.json({
    protocol_id: protocol.id,
    personnel,
    all_compliant: personnel.length > 0 && personnel.every(p => p.compliance.compliant),
  });
});
