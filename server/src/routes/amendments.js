import { Router } from "express";
import { db } from "../db.js";
import { requireProtocol } from "./protocol-form.js";
import { audit, resolveActor } from "../audit.js";

// Amendments & annual renewals (Domain B).
//
// Domain rules (AGENTS.md §1.1):
//  - Amendments are versioned documents: only one in-flight per protocol at a
//    time, requires a "Reason for Change", and approved amendments produce a
//    new protocol version (0001, 0002, ...) with its own approval/expiration
//    dates.
//  - Continuing Review (lightweight annual check-in) ≠ De Novo Review (full
//    3-year resubmission referencing the prior protocol number). Both are
//    distinct review events, not a protocol status flip.

export const router = Router();

export const AMENDMENT_STATUSES = ["Pending", "Approved", "Rejected"];
export const RENEWAL_TYPES = ["Continuing Review", "De Novo Review"];
export const RENEWAL_STATUSES = ["Pending", "Approved", "Rejected"];
export const VERSION_SOURCES = ["New Document", "Amendment Document", "De Novo Document"];

// Next protocol version number: max existing + 1, zero-padded to 4 digits.
function nextVersionNumber(protocolId) {
  const row = db.prepare(`
    SELECT version_number FROM protocol_versions
    WHERE protocol_id = ? ORDER BY version_number DESC LIMIT 1
  `).get(protocolId);
  const next = (row ? Number(row.version_number) : 0) + 1;
  return String(next).padStart(4, "0");
}

function changesFor(amendmentId) {
  return db.prepare(`
    SELECT * FROM amendment_changes WHERE amendment_id = ? ORDER BY id
  `).all(amendmentId);
}

function decorate(amendment) {
  if (!amendment) return amendment;
  return { ...amendment, changes: changesFor(amendment.id) };
}

function requireAmendment(req, res) {
  const amendment = db.prepare("SELECT * FROM amendments WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.amendmentId), req.params.id);
  if (!amendment) {
    res.status(404).json({ error: "Amendment not found" });
    return null;
  }
  return amendment;
}

// ---- amendments ----

// GET /api/protocols/:id/amendments
router.get("/:id/amendments", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const rows = db.prepare("SELECT * FROM amendments WHERE protocol_id = ? ORDER BY created_at DESC, id DESC")
    .all(req.params.id);
  res.json(rows.map(decorate));
});

// POST /api/protocols/:id/amendments  { reason }
// Start an amendment. One in-flight (Pending) amendment per protocol at a time;
// a "Reason for Change" is required.
router.post("/:id/amendments", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: "A reason for change is required" });
  }
  const inFlight = db.prepare(`
    SELECT id FROM amendments WHERE protocol_id = ? AND status = 'Pending'
  `).get(req.params.id);
  if (inFlight) {
    return res.status(409).json({ error: "Only one amendment can be in flight per protocol at a time." });
  }

  const result = db.prepare("INSERT INTO amendments (protocol_id, reason) VALUES (?, ?)")
    .run(req.params.id, String(reason).trim());
  audit({
    action: "amendment.created",
    entityType: "amendment",
    entityId: Number(result.lastInsertRowid),
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, reason: String(reason).trim() },
  });
  const created = db.prepare("SELECT * FROM amendments WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(decorate(created));
});

// GET /api/protocols/:id/amendments/:amendmentId — amendment + its changes
router.get("/:id/amendments/:amendmentId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const amendment = requireAmendment(req, res);
  if (!amendment) return;
  res.json(decorate(amendment));
});

// POST /api/protocols/:id/amendments/:amendmentId/changes  { section, field, previous_value?, new_value? }
// Record one field-level change on the amendment (the diff snapshot material).
router.post("/:id/amendments/:amendmentId/changes", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const amendment = requireAmendment(req, res);
  if (!amendment) return;
  if (amendment.status !== "Pending") {
    return res.status(400).json({ error: "Only a pending amendment can accept changes" });
  }
  const { section, field, previous_value, new_value } = req.body || {};
  if (!section || !String(section).trim() || !field || !String(field).trim()) {
    return res.status(400).json({ error: "section and field are required" });
  }

  const result = db.prepare(`
    INSERT INTO amendment_changes (amendment_id, section, field, previous_value, new_value)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    amendment.id,
    String(section).trim(),
    String(field).trim(),
    previous_value ?? null,
    new_value ?? null,
  );
  audit({
    action: "amendment_change.created",
    entityType: "amendment",
    entityId: amendment.id,
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, section: String(section).trim(), field: String(field).trim() },
  });
  res.status(201).json(
    db.prepare("SELECT * FROM amendment_changes WHERE id = ?").get(Number(result.lastInsertRowid))
  );
});

// PATCH /api/protocols/:id/amendments/:amendmentId  { status, expiration_date? }
// Approve (→ creates a new protocol version with its own approval/expiration
// dates) or reject a pending amendment.
router.patch("/:id/amendments/:amendmentId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const amendment = requireAmendment(req, res);
  if (!amendment) return;
  const { status, expiration_date } = req.body || {};

  if (!AMENDMENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${AMENDMENT_STATUSES.join(", ")}` });
  }
  if (amendment.status !== "Pending") {
    return res.status(400).json({ error: "This amendment has already been decided" });
  }

  db.prepare("UPDATE amendments SET status = ? WHERE id = ?").run(status, amendment.id);

  if (status === "Approved") {
    const approvedDate = new Date().toISOString().slice(0, 10);
    const exp = expiration_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO protocol_versions (protocol_id, version_number, source, approved_date, expiration_date)
      VALUES (?, ?, 'Amendment Document', ?, ?)
    `).run(amendment.protocol_id, nextVersionNumber(amendment.protocol_id), approvedDate, exp);
    db.prepare("UPDATE protocols SET expires = ? WHERE id = ?").run(exp, amendment.protocol_id);
    audit({
      action: "protocol_version.created",
      entityType: "protocol",
      entityId: amendment.protocol_id,
      actor: resolveActor(req),
      details: { source: "Amendment Document", expiration_date: exp },
    });
  }
  audit({
    action: "amendment.updated",
    entityType: "amendment",
    entityId: amendment.id,
    actor: resolveActor(req),
    details: { protocol_id: amendment.protocol_id, status },
  });

  const updated = db.prepare("SELECT * FROM amendments WHERE id = ?").get(amendment.id);
  res.status(200).json(decorate(updated));
});

// ---- protocol version lineage ----

// GET /api/protocols/:id/versions
router.get("/:id/versions", (req, res) => {
  if (!requireProtocol(req, res)) return;
  res.json(db.prepare(`
    SELECT * FROM protocol_versions WHERE protocol_id = ? ORDER BY version_number DESC
  `).all(req.params.id));
});

// ---- renewals (continuing review / de novo review) ----

// GET /api/protocols/:id/renewals
router.get("/:id/renewals", (req, res) => {
  if (!requireProtocol(req, res)) return;
  res.json(db.prepare(`
    SELECT * FROM renewals WHERE protocol_id = ? ORDER BY submitted_date DESC, id DESC
  `).all(req.params.id));
});

// POST /api/protocols/:id/renewals  { type }
// Start a continuing-review or de-novo-review event. One in-flight per protocol.
router.post("/:id/renewals", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { type } = req.body || {};
  if (!RENEWAL_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${RENEWAL_TYPES.join(", ")}` });
  }
  const inFlight = db.prepare(`
    SELECT id FROM renewals WHERE protocol_id = ? AND status = 'Pending'
  `).get(req.params.id);
  if (inFlight) {
    return res.status(409).json({ error: "A renewal is already in flight for this protocol" });
  }

  const result = db.prepare("INSERT INTO renewals (protocol_id, type) VALUES (?, ?)")
    .run(req.params.id, type);
  audit({
    action: "renewal.created",
    entityType: "renewal",
    entityId: Number(result.lastInsertRowid),
    actor: resolveActor(req),
    details: { protocol_id: req.params.id, type },
  });
  res.status(201).json(
    db.prepare("SELECT * FROM renewals WHERE id = ?").get(Number(result.lastInsertRowid))
  );
});

// PATCH /api/protocols/:id/renewals/:renewalId  { status, approved_until? }
// Approve (→ new protocol version + updated expiration) or reject a renewal.
router.patch("/:id/renewals/:renewalId", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const renewal = db.prepare("SELECT * FROM renewals WHERE id = ? AND protocol_id = ?")
    .get(Number(req.params.renewalId), req.params.id);
  if (!renewal) return res.status(404).json({ error: "Renewal not found" });
  const { status, approved_until } = req.body || {};

  if (!RENEWAL_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${RENEWAL_STATUSES.join(", ")}` });
  }
  if (renewal.status !== "Pending") {
    return res.status(400).json({ error: "This renewal has already been decided" });
  }
  if (status === "Approved" && !approved_until) {
    return res.status(400).json({ error: "approved_until is required when approving a renewal" });
  }

  db.prepare(`
    UPDATE renewals SET status = ?, decision_date = ?, approved_until = ? WHERE id = ?
  `).run(status, new Date().toISOString().slice(0, 10), status === "Approved" ? approved_until : null, renewal.id);

  if (status === "Approved") {
    const source = renewal.type === "De Novo Review" ? "De Novo Document" : "Amendment Document";
    db.prepare(`
      INSERT INTO protocol_versions (protocol_id, version_number, source, approved_date, expiration_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      renewal.protocol_id,
      nextVersionNumber(renewal.protocol_id),
      source,
      new Date().toISOString().slice(0, 10),
      approved_until,
    );
    db.prepare("UPDATE protocols SET expires = ? WHERE id = ?").run(approved_until, renewal.protocol_id);
    audit({
      action: "protocol_version.created",
      entityType: "protocol",
      entityId: renewal.protocol_id,
      actor: resolveActor(req),
      details: { source, expiration_date: approved_until },
    });
  }
  audit({
    action: "renewal.updated",
    entityType: "renewal",
    entityId: renewal.id,
    actor: resolveActor(req),
    details: { protocol_id: renewal.protocol_id, type: renewal.type, status },
  });

  res.status(200).json(
    db.prepare("SELECT * FROM renewals WHERE id = ?").get(renewal.id)
  );
});
