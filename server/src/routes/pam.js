import { Router } from "express";
import { db } from "../db.js";
import { requireProtocol } from "./protocol-form.js";

// Post-Approval Monitoring (PAM) & incident reporting (Domain E).
//
// Incidents (adverse events / deviations) follow an Open → CAPA → Closed
// lifecycle. The PATCH handler ties the CAPA into the status transition: an
// incident can only move to CAPA/Closed once a corrective_action is recorded,
// so a closed incident always has a documented CAPA.
//
// reported_by / assigned_to are personnel_id columns so RBAC can be layered
// on later without a migration (AGENTS.md §1.5).

export const router = Router();
export const pamRouter = Router();

export const INCIDENT_TYPES = ["Adverse Event", "Deviation", "Noncompliance", "Unanticipated Problem"];
export const INCIDENT_SEVERITIES = ["Minor", "Major", "Immediate"];
export const INCIDENT_STATUSES = ["Open", "CAPA", "Closed"];

async function decorate(incident) {
  if (!incident) return incident;
  return db.get(`
    SELECT incident.id, incident.protocol_id, incident.type, incident.description,
           incident.severity, incident.status, incident.corrective_action,
           incident.closed_at, incident.reported_by, incident.assigned_to, incident.created_at,
           reporter.name AS reported_by_name, assignee.name AS assigned_to_name
    FROM incidents incident
    LEFT JOIN personnel reporter ON reporter.id = incident.reported_by
    LEFT JOIN personnel assignee ON assignee.id = incident.assigned_to
    WHERE incident.id = $1
  `, [incident.id]);
}

async function requireIncident(req, res) {
  const incident = await db.get("SELECT * FROM incidents WHERE id = $1", [Number(req.params.id)]);
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return null;
  }
  return incident;
}

// ---- incidents ----

// GET /api/incidents  (most recent first, with reporter/assignee names)
router.get("/incidents", async (_req, res) => {
  const rows = await db.all("SELECT * FROM incidents ORDER BY created_at DESC, id DESC");
  const out = [];
  for (const row of rows) out.push(await decorate(row));
  res.json(out);
});

// POST /api/incidents  { protocol_id?, type, description, severity?, reported_by?, assigned_to? }
router.post("/incidents", async (req, res) => {
  const { protocol_id, type, description, severity, reported_by, assigned_to } = req.body || {};
  if (!INCIDENT_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${INCIDENT_TYPES.join(", ")}` });
  }
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: "description is required" });
  }
  if (severity !== undefined && severity !== null && !INCIDENT_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${INCIDENT_SEVERITIES.join(", ")}` });
  }
  if (protocol_id) {
    const protocol = await db.get("SELECT id FROM protocols WHERE id = $1", [protocol_id]);
    if (!protocol) return res.status(400).json({ error: "Unknown protocol_id" });
  }
  if (reported_by) {
    const reporter = await db.get("SELECT id FROM personnel WHERE id = $1", [Number(reported_by)]);
    if (!reporter) return res.status(400).json({ error: "Unknown reported_by personnel_id" });
  }
  if (assigned_to) {
    const assignee = await db.get("SELECT id FROM personnel WHERE id = $1", [Number(assigned_to)]);
    if (!assignee) return res.status(400).json({ error: "Unknown assigned_to personnel_id" });
  }

  const created = await db.get(`
    INSERT INTO incidents (protocol_id, type, description, severity, reported_by, assigned_to)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [
    protocol_id || null,
    type,
    String(description).trim(),
    severity || "Minor",
    reported_by ? Number(reported_by) : null,
    assigned_to ? Number(assigned_to) : null,
  ]);
  res.status(201).json(await decorate(created));
});

// GET /api/incidents/:id
router.get("/incidents/:id", async (req, res) => {
  const incident = await requireIncident(req, res);
  if (!incident) return;
  res.json(await decorate(incident));
});

// PATCH /api/incidents/:id  { status?, corrective_action?, assigned_to? }
// Log a CAPA and/or move the incident through the lifecycle. Closing requires
// a CAPA recorded first.
router.patch("/incidents/:id", async (req, res) => {
  const incident = await requireIncident(req, res);
  if (!incident) return;
  const { status, corrective_action, assigned_to } = req.body || {};

  if (status !== undefined && status !== null && !INCIDENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${INCIDENT_STATUSES.join(", ")}` });
  }
  if (assigned_to !== undefined && assigned_to !== null) {
    const assignee = await db.get("SELECT id FROM personnel WHERE id = $1", [Number(assigned_to)]);
    if (!assignee) return res.status(400).json({ error: "Unknown assigned_to personnel_id" });
  }

  const nextStatus = status || incident.status;
  const nextCapa = corrective_action !== undefined
    ? (corrective_action === null || corrective_action === "" ? null : String(corrective_action).trim())
    : incident.corrective_action;

  // Recording a CAPA on an Open incident moves it into the CAPA state.
  if (nextStatus === "Open" && nextCapa && incident.status === "Open" && !status) {
    await db.run("UPDATE incidents SET corrective_action = $1 WHERE id = $2", [nextCapa, incident.id]);
    await db.run("UPDATE incidents SET status = 'CAPA' WHERE id = $1", [incident.id]);
    return res.status(200).json(await decorate(await db.get("SELECT * FROM incidents WHERE id = $1", [incident.id])));
  }

  if (nextStatus === "CAPA" || nextStatus === "Closed") {
    if (!nextCapa) {
      return res.status(400).json({ error: "A corrective action (CAPA) must be recorded before the incident can move to CAPA or Closed." });
    }
  }

  await db.run(`
    UPDATE incidents
    SET status = $1, corrective_action = $2, closed_at = $3, assigned_to = $4
    WHERE id = $5
  `, [
    nextStatus,
    nextCapa,
    nextStatus === "Closed" ? (new Date().toISOString()) : null,
    assigned_to !== undefined ? (assigned_to ? Number(assigned_to) : null) : incident.assigned_to,
    incident.id,
  ]);

  res.status(200).json(await decorate(await db.get("SELECT * FROM incidents WHERE id = $1", [incident.id])));
});

// ---- PAM audits (per protocol) ----

async function decorateAudit(audit) {
  if (!audit) return audit;
  const auditor = await db.get("SELECT name FROM personnel WHERE id = $1", [audit.auditor_id]);
  return { ...audit, auditor_name: auditor ? auditor.name : null };
}

// GET /api/pam-audits — every PAM audit across protocols (most recent first),
// for the PAM dashboard view.
router.get("/pam-audits", async (_req, res) => {
  const rows = await db.all("SELECT * FROM pam_audits ORDER BY audit_date DESC, id DESC");
  const out = [];
  for (const row of rows) out.push(await decorateAudit(row));
  res.json(out);
});

// GET /api/protocols/:id/pam-audits — PAM history + site-visit reports
pamRouter.get("/:id/pam-audits", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const rows = await db.all("SELECT * FROM pam_audits WHERE protocol_id = $1 ORDER BY audit_date DESC, id DESC", [req.params.id]);
  const out = [];
  for (const row of rows) out.push(await decorateAudit(row));
  res.json(out);
});

// POST /api/protocols/:id/pam-audits  { audit_date, auditor_id?, site_visits?, findings?, report? }
pamRouter.post("/:id/pam-audits", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const { audit_date, auditor_id, site_visits, findings, report } = req.body || {};
  if (!audit_date) return res.status(400).json({ error: "audit_date is required" });
  if (auditor_id) {
    const auditor = await db.get("SELECT id FROM personnel WHERE id = $1", [Number(auditor_id)]);
    if (!auditor) return res.status(400).json({ error: "Unknown auditor_id" });
  }

  const created = await db.get(`
    INSERT INTO pam_audits (protocol_id, audit_date, auditor_id, site_visits, findings, report)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [
    req.params.id,
    audit_date,
    auditor_id ? Number(auditor_id) : null,
    site_visits || null,
    findings || null,
    report || null,
  ]);
  res.status(201).json(await decorateAudit(created));
});
