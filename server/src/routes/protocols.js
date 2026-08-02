import { Router } from "express";
import { db } from "../db.js";

export const router = Router();

const STAGES = ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"];

// GET /api/protocols?q=search
router.get("/", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const rows = db.prepare("SELECT * FROM protocols ORDER BY updated_at DESC").all();
  const filtered = q
    ? rows.filter(p => `${p.id} ${p.title} ${p.pi} ${p.species} ${p.status}`.toLowerCase().includes(q))
    : rows;
  res.json(filtered);
});

// GET /api/protocols/summary  -> metric counts for the dashboard cards
router.get("/summary", (_req, res) => {
  const all = db.prepare("SELECT status, expires FROM protocols").all();
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  res.json({
    active: all.filter(p => p.status === "Active").length,
    pendingReview: all.filter(p => p.status === "IACUC Review" || p.status === "Veterinary Review").length,
    expiringSoon: all.filter(p => p.expires && new Date(p.expires) <= in60 && new Date(p.expires) >= now).length,
    approvedThisQuarter: all.filter(p => p.status === "Approved").length,
  });
});

// GET /api/protocols/:id  -> full detail + related items grouped by list
router.get("/:id", (req, res) => {
  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id);
  if (!protocol) return res.status(404).json({ error: "Protocol not found" });

  const items = db
    .prepare("SELECT list_name, label FROM related_items WHERE protocol_id = ?")
    .all(req.params.id);

  const related = {};
  for (const item of items) {
    (related[item.list_name] ??= []).push(item.label);
  }

  res.json({ ...protocol, stages: STAGES, related });
});

// POST /api/protocols  -> create a new protocol (starts as Draft)
router.post("/", (req, res) => {
  const { id, title, pi, species, animals, pain_category } = req.body;
  if (!id || !title || !pi) {
    return res.status(400).json({ error: "id, title, and pi are required" });
  }
  try {
    db.prepare(`
      INSERT INTO protocols (id, title, pi, species, status, animals, pain_category)
      VALUES (?, ?, ?, ?, 'Draft', ?, ?)
    `).run(id, title, pi, species ?? null, animals ?? null, pain_category ?? null);
    res.status(201).json(db.prepare("SELECT * FROM protocols WHERE id = ?").get(id));
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// PATCH /api/protocols/:id  -> update fields, e.g. advance workflow status
router.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Protocol not found" });

  const fields = [
    "title", "pi", "species", "status", "animals", "pain_category", "submitted", "expires",
    "purpose_summary", "harm_benefit_analysis", "scientific_summary",
  ];
  const updates = fields.filter(f => f in req.body);
  if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

  const setClause = updates.map(f => `${f} = @${f}`).join(", ");
  const params = { id: req.params.id };
  for (const f of updates) params[f] = req.body[f];

  db.prepare(`UPDATE protocols SET ${setClause}, updated_at = datetime('now') WHERE id = @id`)
    .run(params);

  res.json(db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id));
});

// DELETE /api/protocols/:id
router.delete("/:id", (req, res) => {
  const result = db.prepare("DELETE FROM protocols WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Protocol not found" });
  res.status(204).end();
});
