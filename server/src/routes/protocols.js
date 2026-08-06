import { Router } from "express";
import { db } from "../db.js";
import { validateCompleteness } from "./protocol-form.js";

export const router = Router();

const STAGES = ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"];

// research_steps is stored as JSON text in the database; expose it to the
// client as a real array of structured step objects so the UI never has to
// parse strings. Legacy databases hold steps as plain strings — normalize
// those to objects on read so both old and new data render identically.
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
router.get("/", async (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const rows = await db.all("SELECT * FROM protocols ORDER BY updated_at DESC");
  const filtered = q
    ? rows.filter(p => `${p.id} ${p.title} ${p.pi} ${p.species} ${p.status}`.toLowerCase().includes(q))
    : rows;
  res.json(filtered.map(shape));
});

// GET /api/protocols/summary  -> metric counts for the dashboard cards
router.get("/summary", async (_req, res) => {
  const all = await db.all("SELECT status, expires FROM protocols");
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
router.get("/:id", async (req, res) => {
  const protocol = await db.get("SELECT * FROM protocols WHERE id = $1", [req.params.id]);
  if (!protocol) return res.status(404).json({ error: "Protocol not found" });

  const items = await db.all(
    "SELECT list_name, label FROM related_items WHERE protocol_id = $1",
    [req.params.id]
  );

  const related = {};
  for (const item of items) {
    (related[item.list_name] ??= []).push(item.label);
  }

  res.json({ ...shape(protocol), stages: STAGES, related });
});

// POST /api/protocols  -> create a new protocol (starts as Draft)
router.post("/", async (req, res) => {
  const { id, title, pi } = req.body;
  if (!id || !title || !pi) {
    return res.status(400).json({ error: "id, title, and pi are required" });
  }
  try {
    await db.get(
      `
      INSERT INTO protocols (
        id, title, pi, pi_proxy, ptm_member, protocol_type, species, status, animals,
        pain_category, anesthesia_required, housing, disposal, npg, research_steps,
        purpose_summary, harm_benefit_analysis, scientific_summary
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'Draft', $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17
      )
      RETURNING *
      `,
      [
        id,
        title,
        pi,
        req.body.pi_proxy ?? null,
        req.body.ptm_member ?? null,
        req.body.protocol_type ?? null,
        req.body.species ?? null,
        req.body.animals ?? null,
        req.body.pain_category ?? null,
        req.body.anesthesia_required ? 1 : 0,
        req.body.housing ?? null,
        req.body.disposal ?? null,
        req.body.npg ?? null,
        normalizeResearchSteps(req.body.research_steps) ?? null,
        req.body.purpose_summary ?? null,
        req.body.harm_benefit_analysis ?? null,
        req.body.scientific_summary ?? null,
      ]
    );
    res.status(201).json(shape(await db.get("SELECT * FROM protocols WHERE id = $1", [id])));
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// PATCH /api/protocols/:id  -> update fields, e.g. advance workflow status
router.patch("/:id", async (req, res) => {
  const existing = await db.get("SELECT * FROM protocols WHERE id = $1", [req.params.id]);
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
    const validation = await validateCompleteness(req.params.id);
    if (!validation.overall) {
      return res.status(400).json({
        error: "Cannot submit: complete all required sections first",
        validation,
      });
    }
  }

  const setClause = updates.map((f, i) => `${f} = $${i + 1}`).join(", ");
  const values = updates.map(f =>
    f === "research_steps" ? normalizeResearchSteps(req.body[f]) : req.body[f]
  );
  values.push(req.params.id);

  await db.run(
    `UPDATE protocols SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${updates.length + 1}`,
    values
  );

  res.json(shape(await db.get("SELECT * FROM protocols WHERE id = $1", [req.params.id])));
});

// DELETE /api/protocols/:id
router.delete("/:id", async (req, res) => {
  const result = await db.run("DELETE FROM protocols WHERE id = $1", [req.params.id]);
  if (result.changes === 0) return res.status(404).json({ error: "Protocol not found" });
  res.status(204).end();
});
