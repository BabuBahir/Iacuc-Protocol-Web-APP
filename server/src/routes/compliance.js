import { Router } from "express";
import { db } from "../db.js";
import { requireProtocol } from "./protocol-form.js";

// Personnel compliance (Domain C): CITI-style training records and OHSP
// (Occupational Health & Safety Program) clearance. Two routers are exported —
// one mounted at /api/personnel (per-person training/ohsp data) and one at
// /api/protocols (the computed "are all listed personnel compliant?" check).

export const personnelRouter = Router();
export const protocolPersonnelRouter = Router();

export const OHSP_STATUSES = ["Pending", "Cleared", "Denied"];

async function requirePersonnel(req, res) {
  const person = await db.get(`
    SELECT personnel.id, personnel.name, personnel.email, personnel.role_id, roles.name AS role_name
    FROM personnel JOIN roles ON roles.id = personnel.role_id
    WHERE personnel.id = $1
  `, [Number(req.params.id)]);
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

async function trainingFor(person) {
  const rows = await db.all(`
    SELECT id, personnel_id, course, completed_date, expires_date
    FROM personnel_training
    WHERE personnel_id = $1
    ORDER BY completed_date DESC
  `, [person.id]);
  return rows.map(r => ({ ...r, status: recordStatus(r) }));
}

// Overall training status: current if at least one record is still valid;
// expired if records exist but none are valid; otherwise no records on file.
async function trainingStatus(person) {
  const rows = await trainingFor(person);
  if (rows.length === 0) return "No records";
  return rows.some(r => r.status === "Current") ? "Current" : "Expired";
}

async function ohspFor(person) {
  const row = await db.get(
    "SELECT personnel_id, status, reviewed_date, notes FROM personnel_ohsp WHERE personnel_id = $1",
    [person.id]
  );
  return row ?? { personnel_id: person.id, status: "Pending", reviewed_date: null, notes: null };
}

export async function complianceFor(person) {
  const ts = await trainingStatus(person);
  const ohsp = await ohspFor(person);
  return {
    training_status: ts,
    ohsp_status: ohsp.status,
    compliant: ts === "Current" && ohsp.status === "Cleared",
  };
}

// ---- list all personnel with compliance (admin page) ----

personnelRouter.get("/compliance", async (_req, res) => {
  const rows = await db.all(`
    SELECT personnel.id, personnel.name, personnel.role_id, roles.name AS role_name
    FROM personnel JOIN roles ON roles.id = personnel.role_id
    ORDER BY personnel.name
  `);
  const out = [];
  for (const row of rows) {
    const person = { id: row.id, name: row.name, role_name: row.role_name };
    out.push({ ...person, ...(await complianceFor(person)) });
  }
  res.json(out);
});

// ---- per-person training records ----

personnelRouter.get("/:id/training", async (req, res) => {
  const person = await requirePersonnel(req, res);
  if (!person) return;
  res.json({
    personnel: { id: person.id, name: person.name, role_name: person.role_name },
    courses: await trainingFor(person),
    overall_status: await trainingStatus(person),
  });
});

// body: { course, completed_date, expires_date? }
personnelRouter.post("/:id/training", async (req, res) => {
  const person = await requirePersonnel(req, res);
  if (!person) return;
  const { course, completed_date, expires_date } = req.body || {};
  if (!course || !String(course).trim()) return res.status(400).json({ error: "course is required" });
  if (!completed_date) return res.status(400).json({ error: "completed_date is required" });

  const row = await db.get(
    `INSERT INTO personnel_training (personnel_id, course, completed_date, expires_date)
    VALUES ($1, $2, $3, $4)
    RETURNING id, personnel_id, course, completed_date, expires_date`,
    [person.id, String(course).trim(), completed_date, expires_date || null]
  );
  res.status(201).json({ ...row, status: recordStatus(row) });
});

// body: any of { course, completed_date, expires_date }
personnelRouter.patch("/:id/training/:trainingId", async (req, res) => {
  const person = await requirePersonnel(req, res);
  if (!person) return;
  const record = await db.get(
    "SELECT * FROM personnel_training WHERE id = $1 AND personnel_id = $2",
    [Number(req.params.trainingId), person.id]
  );
  if (!record) return res.status(404).json({ error: "Training record not found" });

  const { course, completed_date, expires_date } = req.body || {};
  const fields = {};
  if (course !== undefined) fields.course = String(course).trim();
  if (completed_date !== undefined) fields.completed_date = completed_date;
  if (expires_date !== undefined) fields.expires_date = expires_date || null;
  if (fields.course === "") return res.status(400).json({ error: "course cannot be empty" });
  if (fields.completed_date === "") return res.status(400).json({ error: "completed_date cannot be empty" });

  await db.run(`
    UPDATE personnel_training
    SET course = $1, completed_date = $2, expires_date = $3
    WHERE id = $4
  `, [
    fields.course ?? record.course,
    fields.completed_date ?? record.completed_date,
    fields.expires_date ?? record.expires_date,
    record.id,
  ]);

  const row = await db.get(
    "SELECT id, personnel_id, course, completed_date, expires_date FROM personnel_training WHERE id = $1",
    [record.id]
  );
  res.json({ ...row, status: recordStatus(row) });
});

personnelRouter.delete("/:id/training/:trainingId", async (req, res) => {
  const person = await requirePersonnel(req, res);
  if (!person) return;
  const result = await db.run(
    "DELETE FROM personnel_training WHERE id = $1 AND personnel_id = $2",
    [Number(req.params.trainingId), person.id]
  );
  if (result.changes === 0) return res.status(404).json({ error: "Training record not found" });
  res.status(204).end();
});

// ---- per-person OHSP clearance ----

personnelRouter.get("/:id/ohsp", async (req, res) => {
  const person = await requirePersonnel(req, res);
  if (!person) return;
  res.json(await ohspFor(person));
});

// body: { status, reviewed_date?, notes? } — upsert
personnelRouter.post("/:id/ohsp", async (req, res) => {
  const person = await requirePersonnel(req, res);
  if (!person) return;
  const { status, reviewed_date, notes } = req.body || {};
  if (!OHSP_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${OHSP_STATUSES.join(", ")}` });
  }
  await db.run(`
    INSERT INTO personnel_ohsp (personnel_id, status, reviewed_date, notes)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(personnel_id) DO UPDATE SET
      status = excluded.status,
      reviewed_date = excluded.reviewed_date,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `, [person.id, status, reviewed_date || null, notes || null]);
  res.json(await ohspFor(person));
});

// ---- computed protocol personnel compliance ----

// Maps a related_items "Personnel" label ("Dr. Elena Marsh — PI") to the
// personnel row it names, then returns per-person compliance. A person with no
// matching personnel profile is flagged as non-compliant ("No profile").
protocolPersonnelRouter.get("/:id/personnel", async (req, res) => {
  const protocol = await requireProtocol(req, res);
  if (!protocol) return;

  const labels = (await db.all(`
    SELECT label FROM related_items
    WHERE protocol_id = $1 AND list_name = 'Personnel'
    ORDER BY id
  `, [protocol.id])).map(r => r.label);

  const personnel = [];
  for (const label of labels) {
    const [name, role] = label.split(" — ").map(s => (s || "").trim());
    const person = await db.get("SELECT * FROM personnel WHERE name = $1", [name]);
    if (!person) {
      personnel.push({
        label, name, role: role || null, personnel_id: null,
        compliance: { training_status: "No profile", ohsp_status: "No profile", compliant: false },
      });
    } else {
      personnel.push({
        label, name, role: role || null, personnel_id: person.id,
        compliance: await complianceFor(person),
      });
    }
  }

  res.json({
    protocol_id: protocol.id,
    personnel,
    all_compliant: personnel.length > 0 && personnel.every(p => p.compliance.compliant),
  });
});
