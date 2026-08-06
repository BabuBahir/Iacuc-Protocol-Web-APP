import { Router } from "express";
import { db } from "../db.js";
import { requireProtocol } from "./protocol-form.js";

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
async function nextVersionNumber(protocolId) {
  const row = await db.get(`
    SELECT version_number FROM protocol_versions
    WHERE protocol_id = $1 ORDER BY version_number DESC LIMIT 1
  `, [protocolId]);
  const next = (row ? Number(row.version_number) : 0) + 1;
  return String(next).padStart(4, "0");
}

function changesFor(amendmentId) {
  return db.all(`
    SELECT * FROM amendment_changes WHERE amendment_id = $1 ORDER BY id
  `, [amendmentId]);
}

async function decorate(amendment) {
  if (!amendment) return amendment;
  return { ...amendment, changes: await changesFor(amendment.id) };
}

async function requireAmendment(req, res) {
  const amendment = await db.get("SELECT * FROM amendments WHERE id = $1 AND protocol_id = $2",
    [Number(req.params.amendmentId), req.params.id]);
  if (!amendment) {
    res.status(404).json({ error: "Amendment not found" });
    return null;
  }
  return amendment;
}

// ---- amendments ----

// GET /api/protocols/:id/amendments
router.get("/:id/amendments", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const rows = await db.all("SELECT * FROM amendments WHERE protocol_id = $1 ORDER BY created_at DESC, id DESC", [req.params.id]);
  const out = [];
  for (const row of rows) out.push(await decorate(row));
  res.json(out);
});

// POST /api/protocols/:id/amendments  { reason }
// Start an amendment. One in-flight (Pending) amendment per protocol at a time;
// a "Reason for Change" is required.
router.post("/:id/amendments", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: "A reason for change is required" });
  }
  const inFlight = await db.get(
    "SELECT id FROM amendments WHERE protocol_id = $1 AND status = 'Pending'",
    [req.params.id]
  );
  if (inFlight) {
    return res.status(409).json({ error: "Only one amendment can be in flight per protocol at a time." });
  }

  const created = await db.get(
    "INSERT INTO amendments (protocol_id, reason) VALUES ($1, $2) RETURNING *",
    [req.params.id, String(reason).trim()]
  );
  res.status(201).json(await decorate(created));
});

// GET /api/protocols/:id/amendments/:amendmentId — amendment + its changes
router.get("/:id/amendments/:amendmentId", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const amendment = await requireAmendment(req, res);
  if (!amendment) return;
  res.json(await decorate(amendment));
});

// POST /api/protocols/:id/amendments/:amendmentId/changes  { section, field, previous_value?, new_value? }
// Record one field-level change on the amendment (the diff snapshot material).
router.post("/:id/amendments/:amendmentId/changes", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const amendment = await requireAmendment(req, res);
  if (!amendment) return;
  if (amendment.status !== "Pending") {
    return res.status(400).json({ error: "Only a pending amendment can accept changes" });
  }
  const { section, field, previous_value, new_value } = req.body || {};
  if (!section || !String(section).trim() || !field || !String(field).trim()) {
    return res.status(400).json({ error: "section and field are required" });
  }

  const row = await db.get(`
    INSERT INTO amendment_changes (amendment_id, section, field, previous_value, new_value)
    VALUES ($1, $2, $3, $4, $5) RETURNING *
  `, [
    amendment.id,
    String(section).trim(),
    String(field).trim(),
    previous_value ?? null,
    new_value ?? null,
  ]);
  res.status(201).json(row);
});

// PATCH /api/protocols/:id/amendments/:amendmentId  { status, expiration_date? }
// Approve (→ creates a new protocol version with its own approval/expiration
// dates) or reject a pending amendment.
router.patch("/:id/amendments/:amendmentId", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const amendment = await requireAmendment(req, res);
  if (!amendment) return;
  const { status, expiration_date } = req.body || {};

  if (!AMENDMENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${AMENDMENT_STATUSES.join(", ")}` });
  }
  if (amendment.status !== "Pending") {
    return res.status(400).json({ error: "This amendment has already been decided" });
  }

  await db.run("UPDATE amendments SET status = $1 WHERE id = $2", [status, amendment.id]);

  if (status === "Approved") {
    const approvedDate = new Date().toISOString().slice(0, 10);
    const exp = expiration_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    await db.run(`
      INSERT INTO protocol_versions (protocol_id, version_number, source, approved_date, expiration_date)
      VALUES ($1, $2, 'Amendment Document', $3, $4)
    `, [amendment.protocol_id, await nextVersionNumber(amendment.protocol_id), approvedDate, exp]);
    await db.run("UPDATE protocols SET expires = $1 WHERE id = $2", [exp, amendment.protocol_id]);
  }

  const updated = await db.get("SELECT * FROM amendments WHERE id = $1", [amendment.id]);
  res.status(200).json(await decorate(updated));
});

// ---- protocol version lineage ----

// GET /api/protocols/:id/versions
router.get("/:id/versions", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  res.json(await db.all(`
    SELECT * FROM protocol_versions WHERE protocol_id = $1 ORDER BY version_number DESC
  `, [req.params.id]));
});

// ---- renewals (continuing review / de novo review) ----

// GET /api/protocols/:id/renewals
router.get("/:id/renewals", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  res.json(await db.all(`
    SELECT * FROM renewals WHERE protocol_id = $1 ORDER BY submitted_date DESC, id DESC
  `, [req.params.id]));
});

// POST /api/protocols/:id/renewals  { type }
// Start a continuing-review or de-novo-review event. One in-flight per protocol.
router.post("/:id/renewals", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const { type } = req.body || {};
  if (!RENEWAL_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${RENEWAL_TYPES.join(", ")}` });
  }
  const inFlight = await db.get(
    "SELECT id FROM renewals WHERE protocol_id = $1 AND status = 'Pending'",
    [req.params.id]
  );
  if (inFlight) {
    return res.status(409).json({ error: "A renewal is already in flight for this protocol" });
  }

  const row = await db.get(
    "INSERT INTO renewals (protocol_id, type) VALUES ($1, $2) RETURNING *",
    [req.params.id, type]
  );
  res.status(201).json(row);
});

// PATCH /api/protocols/:id/renewals/:renewalId  { status, approved_until? }
// Approve (→ new protocol version + updated expiration) or reject a renewal.
router.patch("/:id/renewals/:renewalId", async (req, res) => {
  if (!(await requireProtocol(req, res))) return;
  const renewal = await db.get("SELECT * FROM renewals WHERE id = $1 AND protocol_id = $2",
    [Number(req.params.renewalId), req.params.id]);
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

  await db.run(`
    UPDATE renewals SET status = $1, decision_date = $2, approved_until = $3 WHERE id = $4
  `, [status, new Date().toISOString().slice(0, 10), status === "Approved" ? approved_until : null, renewal.id]);

  if (status === "Approved") {
    const source = renewal.type === "De Novo Review" ? "De Novo Document" : "Amendment Document";
    await db.run(`
      INSERT INTO protocol_versions (protocol_id, version_number, source, approved_date, expiration_date)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      renewal.protocol_id,
      await nextVersionNumber(renewal.protocol_id),
      source,
      new Date().toISOString().slice(0, 10),
      approved_until,
    ]);
    await db.run("UPDATE protocols SET expires = $1 WHERE id = $2", [approved_until, renewal.protocol_id]);
  }

  res.status(200).json(await db.get("SELECT * FROM renewals WHERE id = $1", [renewal.id]));
});
