import { Router } from "express";
import { db } from "../db.js";
import { validateCompleteness } from "./protocol-form.js";
import { audit, diffObject, resolveActor } from "../audit.js";

export const router = Router();

const STAGES = ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"];

// research_steps is stored as JSON text in SQLite; expose it to the client as
// a real array of structured step objects so the UI never has to parse strings.
// Legacy databases hold steps as plain strings — normalize those to objects on
// read so both old and new data render identically.
function normalizeStep(entry) {
  if (typeof entry === "string") {
    return {
      description: entry,
      duration: "",
      frequency: "",
      species: "",
      pain_category: "",
      anesthesia: "No",
      location: "",
      personnel: "",
      notes: "",
    };
  }
  const s = entry && typeof entry === "object" ? entry : {};
  return {
    description: String(s.description ?? ""),
    duration: String(s.duration ?? ""),
    frequency: String(s.frequency ?? ""),
    species: String(s.species ?? ""),
    pain_category: String(s.pain_category ?? ""),
    anesthesia: s.anesthesia === "Yes" ? "Yes" : "No",
    location: String(s.location ?? ""),
    personnel: String(s.personnel ?? ""),
    notes: String(s.notes ?? ""),
  };
}

function parseResearchSteps(raw) {
  if (!raw) return [];
  try {
    return JSON.parse(raw).map(normalizeStep);
  } catch {
    return [];
  }
}

function shape(row) {
  if (!row) return row;
  return { ...row, research_steps: parseResearchSteps(row.research_steps) };
}

function normalizeResearchSteps(value) {
  if (!Array.isArray(value)) return value;
  return JSON.stringify(value.map(normalizeStep));
}

// GET /api/protocols?q=search
router.get("/", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const rows = db.prepare("SELECT * FROM protocols ORDER BY updated_at DESC").all();
  const filtered = q
    ? rows.filter(p => `${p.id} ${p.title} ${p.pi} ${p.species} ${p.status}`.toLowerCase().includes(q))
    : rows;
  res.json(filtered.map(shape));
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

  res.json({ ...shape(protocol), stages: STAGES, related });
});

// POST /api/protocols  -> create a new protocol (starts as Draft)
router.post("/", (req, res) => {
  const { id, title, pi } = req.body;
  if (!id || !title || !pi) {
    return res.status(400).json({ error: "id, title, and pi are required" });
  }
  try {
    db.prepare(`
      INSERT INTO protocols (
        id, title, pi, pi_proxy, ptm_member, protocol_type, species, status, animals,
        pain_category, anesthesia_required, housing, disposal, npg, research_steps,
        purpose_summary, harm_benefit_analysis, scientific_summary
      )
      VALUES (
        @id, @title, @pi, @pi_proxy, @ptm_member, @protocol_type, @species, 'Draft', @animals,
        @pain_category, @anesthesia_required, @housing, @disposal, @npg, @research_steps,
        @purpose_summary, @harm_benefit_analysis, @scientific_summary
      )
    `).run({
      id,
      title,
      pi,
      pi_proxy: req.body.pi_proxy ?? null,
      ptm_member: req.body.ptm_member ?? null,
      protocol_type: req.body.protocol_type ?? null,
      species: req.body.species ?? null,
      animals: req.body.animals ?? null,
      pain_category: req.body.pain_category ?? null,
      anesthesia_required: req.body.anesthesia_required ? 1 : 0,
      housing: req.body.housing ?? null,
      disposal: req.body.disposal ?? null,
      npg: req.body.npg ?? null,
      research_steps: normalizeResearchSteps(req.body.research_steps) ?? null,
      purpose_summary: req.body.purpose_summary ?? null,
      harm_benefit_analysis: req.body.harm_benefit_analysis ?? null,
      scientific_summary: req.body.scientific_summary ?? null,
    });
    audit({ action: "protocol.created", entityType: "protocol", entityId: id, actor: resolveActor(req) });
    res.status(201).json(shape(db.prepare("SELECT * FROM protocols WHERE id = ?").get(id)));
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// PATCH /api/protocols/:id  -> update fields, e.g. advance workflow status
router.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Protocol not found" });

  const fields = [
    "title", "pi", "pi_proxy", "ptm_member", "protocol_type", "species", "status",
    "animals", "pain_category", "anesthesia_required", "housing", "disposal", "npg",
    "research_steps", "submitted", "expires",
    "purpose_summary", "harm_benefit_analysis", "scientific_summary",
  ];
  const updates = fields.filter(f => f in req.body);
  if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

  // Server-side enforcement of the Cayuse/Cornell submit rule: a protocol may
  // not move into "Submitted" until every Appendix A section is complete.
  // The client also surfaces this via GET /:id/validation, but the check must
  // live here so direct API calls can't bypass it.
  if (updates.includes("status") && req.body.status === "Submitted") {
    const validation = validateCompleteness(req.params.id);
    if (!validation.overall) {
      return res.status(400).json({
        error: "Cannot submit: complete all required sections first",
        validation,
      });
    }
  }

  const setClause = updates.map(f => `${f} = @${f}`).join(", ");
  const params = { id: req.params.id };
  for (const f of updates) {
    params[f] = f === "research_steps" ? normalizeResearchSteps(req.body[f]) : req.body[f];
  }

  db.prepare(`UPDATE protocols SET ${setClause}, updated_at = datetime('now') WHERE id = @id`)
    .run(params);

  const changed = {};
  for (const f of updates) changed[f] = params[f];
  audit({
    action: "protocol.updated",
    entityType: "protocol",
    entityId: req.params.id,
    actor: resolveActor(req),
    details: diffObject(existing, changed),
  });

  res.json(shape(db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id)));
});

// DELETE /api/protocols/:id
router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT id, title FROM protocols WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Protocol not found" });
  audit({
    action: "protocol.deleted",
    entityType: "protocol",
    entityId: req.params.id,
    actor: resolveActor(req),
    details: { title: existing.title },
  });
  db.prepare("DELETE FROM protocols WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
