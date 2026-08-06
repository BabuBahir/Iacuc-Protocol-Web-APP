import { Router } from "express";
import { db } from "./db.js";

// Audit trail (Roadmap item 11). Every mutation route calls audit() with a
// one-liner so the append-only audit_log gets an entry for each successful
// write. GET /api/audit exposes the trail with filters for the admin page.
//
// Honest caveat (documented in AGENTS.md §3.3): there is no auth yet, so the
// trail's "who" is only as strong as the identity a request already carries —
// an X-Actor header, an explicit body.actor, or a personnel_id that maps to a
// real person (votes/comments/assignments/reporters/auditors). Everything else
// is recorded as 'system'. "What"/"when" are always reliable. actor_key is the
// future home of the Roadmap item 4 identity, so auth can be layered on
// without a migration.

export const AUDIT_PROVENANCES = ["human", "ai", "system"];

export function audit({
  action,
  entityType,
  entityId,
  actor = "system",
  actorKey = null,
  details = null,
  provenance = "human",
}) {
  db.prepare(`
    INSERT INTO audit_log (action, entity_type, entity_id, actor, actor_key, details, provenance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    action,
    entityType,
    entityId != null ? String(entityId) : null,
    actor,
    actorKey ?? null,
    details ? JSON.stringify(details) : null,
    provenance,
  );
}

// Best-effort actor resolution for a request. Priority: X-Actor header, an
// explicit body.actor override, then any identity-bearing body field
// (personnel_id → reported_by → auditor_id) resolved to the person's name.
export function resolveActor(req) {
  const header = req.get && req.get("x-actor");
  if (header && String(header).trim()) return String(header).trim();

  if (req.body) {
    const bodyActor = req.body.actor;
    if (bodyActor && String(bodyActor).trim()) return String(bodyActor).trim();

    for (const key of ["personnel_id", "reported_by", "auditor_id"]) {
      const id = req.body[key];
      if (id != null && id !== "") {
        const person = db.prepare("SELECT name FROM personnel WHERE id = ?").get(Number(id));
        if (person) return person.name;
      }
    }
  }
  return "system";
}

// Field-level before/after diff. `after` should contain just the changed keys
// (a partial), so only genuinely-changed fields show up in the trail.
export function diffObject(before, after) {
  if (!before || !after) return null;
  const out = {};
  for (const key of Object.keys(after)) {
    const b = before[key];
    const a = after[key];
    if (b === a) continue;
    if (b == null && a == null) continue;
    out[key] = [b ?? null, a ?? null];
  }
  return Object.keys(out).length ? out : null;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const router = Router();

// GET /api/audit?entity_type=&entity_id=&actor=&action=&provenance=&from=&to=&limit=&offset=
// Most recent first. Returns a plain array like the other list endpoints.
router.get("/audit", (req, res) => {
  const { entity_type, entity_id, actor, action, provenance, from, to, limit, offset } = req.query;

  const parsedLimit = limit === undefined ? 100 : Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
    return res.status(400).json({ error: "limit must be an integer between 1 and 500" });
  }
  const parsedOffset = offset === undefined ? 0 : Number(offset);
  if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
    return res.status(400).json({ error: "offset must be a non-negative integer" });
  }
  if (provenance && !AUDIT_PROVENANCES.includes(provenance)) {
    return res.status(400).json({ error: `provenance must be one of: ${AUDIT_PROVENANCES.join(", ")}` });
  }
  if ((from && !to) || (to && !from)) {
    return res.status(400).json({ error: "from and to must be provided together" });
  }

  const where = [];
  const params = [];
  if (entity_type) { where.push("entity_type = ?"); params.push(String(entity_type)); }
  if (entity_id) { where.push("entity_id = ?"); params.push(String(entity_id)); }
  if (actor) { where.push("actor LIKE ?"); params.push(`%${String(actor)}%`); }
  if (action) { where.push("action LIKE ?"); params.push(`%${String(action)}%`); }
  if (provenance) { where.push("provenance = ?"); params.push(String(provenance)); }
  if (from && to) {
    where.push("substr(created_at, 1, 10) BETWEEN ? AND ?");
    params.push(String(from), String(to));
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT * FROM audit_log ${clause}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parsedLimit, parsedOffset);

  res.json(rows.map(r => ({ ...r, details: r.details ? safeParse(r.details) : null })));
});
