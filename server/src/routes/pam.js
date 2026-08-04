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

function decorate(incident) {
  if (!incident) return incident;
  const withReporters = db.prepare(`
    SELECT incident.id, incident.protocol_id, incident.type, incident.description,
           incident.severity, incident.status, incident.corrective_action,
           incident.closed_at, incident.reported_by, incident.assigned_to, incident.created_at,
           reporter.name AS reported_by_name, assignee.name AS assigned_to_name
    FROM incidents incident
    LEFT JOIN personnel reporter ON reporter.id = incident.reported_by
    LEFT JOIN personnel assignee ON assignee.id = incident.assigned_to
    WHERE incident.id = ?
  `).get(incident.id);
  return withReporters;
}

function requireIncident(req, res) {
  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(Number(req.params.id));
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return null;
  }
  return incident;
}

// ---- incidents ----

// GET /api/incidents  (most recent first, with reporter/assignee names)
router.get("/incidents", (_req, res) => {
  const rows = db.prepare("SELECT * FROM incidents ORDER BY created_at DESC, id DESC").all();
  res.json(rows.map(decorate));
});

// POST /api/incidents  { protocol_id?, type, description, severity?, reported_by?, assigned_to? }
router.post("/incidents", (req, res) => {
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
    const protocol = db.prepare("SELECT id FROM protocols WHERE id = ?").get(protocol_id);
    if (!protocol) return res.status(400).json({ error: "Unknown protocol_id" });
  }
  if (reported_by) {
    const reporter = db.prepare("SELECT id FROM personnel WHERE id = ?").get(Number(reported_by));
    if (!reporter) return res.status(400).json({ error: "Unknown reported_by personnel_id" });
  }
  if (assigned_to) {
    const assignee = db.prepare("SELECT id FROM personnel WHERE id = ?").get(Number(assigned_to));
    if (!assignee) return res.status(400).json({ error: "Unknown assigned_to personnel_id" });
  }

  const result = db.prepare(`
    INSERT INTO incidents (protocol_id, type, description, severity, reported_by, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    protocol_id || null,
    type,
    String(description).trim(),
    severity || "Minor",
    reported_by ? Number(reported_by) : null,
    assigned_to ? Number(assigned_to) : null,
  );

  const created = db.prepare("SELECT * FROM incidents WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(decorate(created));
});

// GET /api/incidents/:id
router.get("/incidents/:id", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  res.json(decorate(incident));
});

// PATCH /api/incidents/:id  { status?, corrective_action?, assigned_to? }
// Log a CAPA and/or move the incident through the lifecycle. Closing requires
// a CAPA recorded first.
router.patch("/incidents/:id", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  const { status, corrective_action, assigned_to } = req.body || {};

  if (status !== undefined && status !== null && !INCIDENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${INCIDENT_STATUSES.join(", ")}` });
  }
  if (assigned_to !== undefined && assigned_to !== null) {
    const assignee = db.prepare("SELECT id FROM personnel WHERE id = ?").get(Number(assigned_to));
    if (!assignee) return res.status(400).json({ error: "Unknown assigned_to personnel_id" });
  }

  const nextStatus = status || incident.status;
  const nextCapa = corrective_action !== undefined
    ? (corrective_action === null || corrective_action === "" ? null : String(corrective_action).trim())
    : incident.corrective_action;

  // Recording a CAPA on an Open incident moves it into the CAPA state.
  if (nextStatus === "Open" && nextCapa && incident.status === "Open" && !status) {
    db.prepare("UPDATE incidents SET corrective_action = ? WHERE id = ?").run(nextCapa, incident.id);
    db.prepare("UPDATE incidents SET status = 'CAPA' WHERE id = ?").run(incident.id);
    return res.status(200).json(decorate(db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident.id)));
  }

  if (nextStatus === "CAPA" || nextStatus === "Closed") {
    if (!nextCapa) {
      return res.status(400).json({ error: "A corrective action (CAPA) must be recorded before the incident can move to CAPA or Closed." });
    }
  }

  db.prepare(`
    UPDATE incidents
    SET status = @status, corrective_action = @corrective_action,
        closed_at = @closed_at, assigned_to = @assigned_to
    WHERE id = @id
  `).run({
    id: incident.id,
    status: nextStatus,
    corrective_action: nextCapa,
    closed_at: nextStatus === "Closed" ? (new Date().toISOString()) : null,
    assigned_to: assigned_to !== undefined ? (assigned_to ? Number(assigned_to) : null) : incident.assigned_to,
  });

  res.status(200).json(decorate(db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident.id)));
});

// ---- PAM audits (per protocol) ----

function decorateAudit(audit) {
  if (!audit) return audit;
  const auditor = db.prepare("SELECT name FROM personnel WHERE id = ?").get(audit.auditor_id);
  return { ...audit, auditor_name: auditor ? auditor.name : null };
}

// GET /api/pam-audits — every PAM audit across protocols (most recent first),
// for the PAM dashboard view.
router.get("/pam-audits", (_req, res) => {
  const rows = db.prepare(`
    SELECT * FROM pam_audits ORDER BY audit_date DESC, id DESC
  `).all();
  res.json(rows.map(decorateAudit));
});

// GET /api/protocols/:id/pam-audits — PAM history + site-visit reports
pamRouter.get("/:id/pam-audits", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const rows = db.prepare(`
    SELECT * FROM pam_audits WHERE protocol_id = ? ORDER BY audit_date DESC, id DESC
  `).all(req.params.id);
  res.json(rows.map(decorateAudit));
});

// POST /api/protocols/:id/pam-audits  { audit_date, auditor_id?, site_visits?, findings?, report? }
pamRouter.post("/:id/pam-audits", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { audit_date, auditor_id, site_visits, findings, report } = req.body || {};
  if (!audit_date) return res.status(400).json({ error: "audit_date is required" });
  if (auditor_id) {
    const auditor = db.prepare("SELECT id FROM personnel WHERE id = ?").get(Number(auditor_id));
    if (!auditor) return res.status(400).json({ error: "Unknown auditor_id" });
  }

  const result = db.prepare(`
    INSERT INTO pam_audits (protocol_id, audit_date, auditor_id, site_visits, findings, report)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    audit_date,
    auditor_id ? Number(auditor_id) : null,
    site_visits || null,
    findings || null,
    report || null,
  );

  const created = db.prepare("SELECT * FROM pam_audits WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(decorateAudit(created));
});
