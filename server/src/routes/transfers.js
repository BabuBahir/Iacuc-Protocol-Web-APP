import { Router } from "express";
import { db } from "../db.js";
import { requireProtocol } from "./protocol-form.js";
import { audit, resolveActor } from "../audit.js";

// Transfer Ownership (Domain B depth — AGENTS.md §1.1). Transfer is its own
// approval workflow, not an instant reassignment: a request sits Pending in
// the transfer queue until the IACUC office approves it, requires a reason,
// and can bulk-transfer multiple protocols from one PI to another at once.
// Approval reassigns protocols.pi and the related_items "Personnel" label.

export const router = Router();

export const TRANSFER_STATUSES = ["Pending", "Approved", "Rejected"];

function decorate(row) {
  if (!row) return row;
  const protocol = db.prepare("SELECT title FROM protocols WHERE id = ?").get(row.protocol_id);
  const person = db.prepare("SELECT name FROM personnel WHERE id = ?").get(row.to_personnel_id);
  return {
    ...row,
    protocol_title: protocol ? protocol.title : null,
    to_name: person ? person.name : null,
  };
}

// Create one pending transfer. Returns { ok, status, error?, row? }.
// onFlightError: a protocol already has a pending transfer request.
function createTransfer(protocolId, toPersonnelId, reason, onFlightError, req) {
  const protocol = db.prepare("SELECT id, pi FROM protocols WHERE id = ?").get(protocolId);
  if (!protocol) return { ok: false, status: 404, error: "Protocol not found" };
  const person = db.prepare("SELECT id, name FROM personnel WHERE id = ?").get(toPersonnelId);
  if (!person) return { ok: false, status: 400, error: "Unknown personnel" };
  const inFlight = db.prepare(`
    SELECT id FROM protocol_transfers WHERE protocol_id = ? AND status = 'Pending'
  `).get(protocolId);
  if (inFlight) {
    return onFlightError
      ? { ok: false, status: 409, error: `A transfer request is already pending for protocol ${protocolId}` }
      : { ok: false, status: 409, error: "A transfer request is already pending for this protocol." };
  }

  const result = db.prepare(`
    INSERT INTO protocol_transfers (protocol_id, from_pi, to_personnel_id, reason)
    VALUES (?, ?, ?, ?)
  `).run(protocolId, protocol.pi, toPersonnelId, String(reason).trim());
  audit({
    action: "transfer.created",
    entityType: "transfer",
    entityId: Number(result.lastInsertRowid),
    actor: resolveActor(req),
    details: { protocol_id: protocolId, from_pi: protocol.pi, to: person.name },
  });
  return { ok: true, row: decorate(db.prepare("SELECT * FROM protocol_transfers WHERE id = ?").get(Number(result.lastInsertRowid))) };
}

// GET /api/transfers?status=Pending — the ownership queue (all transfers,
// newest first; filter by status when given).
router.get("/transfers", (req, res) => {
  const { status } = req.query;
  if (status && !TRANSFER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${TRANSFER_STATUSES.join(", ")}` });
  }
  const rows = status
    ? db.prepare("SELECT * FROM protocol_transfers WHERE status = ? ORDER BY created_at DESC, id DESC").all(status)
    : db.prepare("SELECT * FROM protocol_transfers ORDER BY created_at DESC, id DESC").all();
  res.json(rows.map(decorate));
});

// POST /api/transfers  { protocol_ids: string[], to_personnel_id, reason }
// Bulk-transfer request: creates one pending transfer per protocol. All-or-
// nothing — 409 if any target protocol already has a pending request.
router.post("/transfers", (req, res) => {
  const { protocol_ids, to_personnel_id, reason } = req.body || {};
  if (!Array.isArray(protocol_ids) || protocol_ids.length === 0) {
    return res.status(400).json({ error: "protocol_ids must be a non-empty array" });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: "A reason for transfer is required" });
  }
  const person = db.prepare("SELECT id FROM personnel WHERE id = ?").get(Number(to_personnel_id));
  if (!person) return res.status(400).json({ error: "Unknown personnel" });

  for (const pid of protocol_ids) {
    const protocol = db.prepare("SELECT id FROM protocols WHERE id = ?").get(pid);
    if (!protocol) return res.status(404).json({ error: `Protocol ${pid} not found` });
    const inFlight = db.prepare(`
      SELECT id FROM protocol_transfers WHERE protocol_id = ? AND status = 'Pending'
    `).get(pid);
    if (inFlight) return res.status(409).json({ error: `A transfer request is already pending for protocol ${pid}` });
  }

  const created = [];
  for (const pid of protocol_ids) {
    const result = createTransfer(pid, to_personnel_id, reason, true, req);
    if (result.ok) created.push(result.row);
  }
  res.status(201).json(created);
});

// POST /api/protocols/:id/transfers  { to_personnel_id, reason }
router.post("/protocols/:id/transfers", (req, res) => {
  if (!requireProtocol(req, res)) return;
  const { to_personnel_id, reason } = req.body || {};
  if (!to_personnel_id) return res.status(400).json({ error: "to_personnel_id is required" });
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: "A reason for transfer is required" });
  const result = createTransfer(req.params.id, Number(to_personnel_id), reason, false, req);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.row);
});

// PATCH /api/transfers/:id  { status: 'Approved' | 'Rejected' }
// Approving reassigns the protocol: protocols.pi + the related_items Personnel
// label, plus an "Approval history" entry.
router.patch("/transfers/:id", (req, res) => {
  const transfer = db.prepare("SELECT * FROM protocol_transfers WHERE id = ?").get(Number(req.params.id));
  if (!transfer) return res.status(404).json({ error: "Transfer request not found" });
  const { status } = req.body || {};
  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ error: "status must be 'Approved' or 'Rejected'" });
  }
  if (transfer.status !== "Pending") {
    return res.status(400).json({ error: "This transfer request has already been decided" });
  }

  if (status === "Approved") {
    const person = db.prepare("SELECT name FROM personnel WHERE id = ?").get(transfer.to_personnel_id);
    db.prepare("UPDATE protocols SET pi = ? WHERE id = ?").run(person.name, transfer.protocol_id);

    const labels = db.prepare(`
      SELECT id, label FROM related_items WHERE protocol_id = ? AND list_name = 'Personnel'
    `).all(transfer.protocol_id);
    const oldLabel = labels.find(r => r.label.startsWith(transfer.from_pi));
    if (oldLabel) {
      db.prepare("UPDATE related_items SET label = ? WHERE id = ?")
        .run(`${person.name} - PI`, oldLabel.id);
    }
    db.prepare(`
      INSERT INTO related_items (protocol_id, list_name, label)
      VALUES (?, 'Approval history', ?)
    `).run(transfer.protocol_id, `Ownership transferred from ${transfer.from_pi} to ${person.name}`);
  }

  db.prepare("UPDATE protocol_transfers SET status = ?, decision_date = ? WHERE id = ?")
    .run(status, new Date().toISOString().slice(0, 10), transfer.id);

  const person = db.prepare("SELECT name FROM personnel WHERE id = ?").get(transfer.to_personnel_id);
  audit({
    action: status === "Approved" ? "transfer.approved" : "transfer.rejected",
    entityType: "transfer",
    entityId: transfer.id,
    actor: resolveActor(req),
    details: { protocol_id: transfer.protocol_id, from_pi: transfer.from_pi, to: person ? person.name : null },
  });

  res.status(200).json(decorate(db.prepare("SELECT * FROM protocol_transfers WHERE id = ?").get(transfer.id)));
});
