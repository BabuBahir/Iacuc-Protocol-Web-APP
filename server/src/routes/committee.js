import { Router } from "express";
import { db } from "../db.js";
import { audit, resolveActor } from "../audit.js";

export const router = Router();

const VOTE_OPTIONS = ["Approve", "Request Modifications", "Table", "Withhold Approval"];
export const REVIEW_METHODS = ["FCR", "DMR"];
export const ASSIGNMENT_ROLES = ["Primary Reviewer", "Secondary Reviewer", "Designated Member"];
export const REVIEW_SECTIONS = ["overall", "summaries", "procedures", "drugs", "animal_use", "experiments", "alternatives"];

function tallyFor(protocolId) {
  const votes = db.prepare(`
    SELECT protocol_votes.vote, protocol_votes.comment, personnel.name AS voter_name,
           roles.name AS role_name, protocol_votes.voted_at
    FROM protocol_votes
    JOIN personnel ON personnel.id = protocol_votes.personnel_id
    JOIN roles ON roles.id = personnel.role_id
    WHERE protocol_votes.protocol_id = ?
    ORDER BY protocol_votes.voted_at DESC
  `).all(protocolId);

  const counts = Object.fromEntries(VOTE_OPTIONS.map(v => [v, 0]));
  for (const v of votes) counts[v.vote] = (counts[v.vote] || 0) + 1;

  return { votes, counts, totalVotes: votes.length };
}

function assignmentsFor(protocolId) {
  return db.prepare(`
    SELECT protocol_review_assignments.role, protocol_review_assignments.assigned_at,
           personnel.id AS personnel_id, personnel.name AS reviewer_name
    FROM protocol_review_assignments
    JOIN personnel ON personnel.id = protocol_review_assignments.personnel_id
    WHERE protocol_review_assignments.protocol_id = ?
    ORDER BY protocol_review_assignments.assigned_at, personnel.name
  `).all(protocolId);
}

function commentsFor(protocolId) {
  return db.prepare(`
    SELECT protocol_review_comments.id, protocol_review_comments.section,
           protocol_review_comments.comment, protocol_review_comments.created_at,
           personnel.id AS personnel_id, personnel.name AS commenter_name
    FROM protocol_review_comments
    JOIN personnel ON personnel.id = protocol_review_comments.personnel_id
    WHERE protocol_review_comments.protocol_id = ?
    ORDER BY protocol_review_comments.created_at, protocol_review_comments.id
  `).all(protocolId);
}

// Cast or update a single vote. Returns { status, body } so both the /votes
// (tally-only) and /reviews (full-history) POST handlers can reuse it.
function castVote(protocolId, { personnel_id, vote, comment }) {
  if (!personnel_id || !vote) {
    return { status: 400, body: { error: "personnel_id and vote are required" } };
  }
  if (!VOTE_OPTIONS.includes(vote)) {
    return { status: 400, body: { error: `vote must be one of: ${VOTE_OPTIONS.join(", ")}` } };
  }

  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(protocolId);
  if (!protocol) return { status: 404, body: { error: "Protocol not found" } };

  const voter = db.prepare(`
    SELECT personnel.*, roles.is_committee
    FROM personnel JOIN roles ON roles.id = personnel.role_id
    WHERE personnel.id = ?
  `).get(Number(personnel_id));
  if (!voter) return { status: 400, body: { error: "Unknown personnel_id" } };
  if (!voter.is_committee) {
    return { status: 403, body: { error: `${voter.name}'s role is not eligible to cast an FCR vote.` } };
  }

  db.prepare(`
    INSERT INTO protocol_votes (protocol_id, personnel_id, vote, comment)
    VALUES (@protocol_id, @personnel_id, @vote, @comment)
    ON CONFLICT(protocol_id, personnel_id) DO UPDATE SET
      vote = excluded.vote, comment = excluded.comment, voted_at = datetime('now')
  `).run({
    protocol_id: protocolId,
    personnel_id: Number(personnel_id),
    vote,
    comment: comment || null,
  });

  audit({
    action: "vote.cast",
    entityType: "protocol",
    entityId: protocolId,
    actor: voter.name,
    details: { vote, comment: comment || null },
  });

  return { status: 201, body: tallyFor(protocolId) };
}

// GET /api/committee/protocols
// Protocols currently in a committee-review stage, each with its vote tally,
// reviewer assignments, and section comments.
router.get("/protocols", (_req, res) => {
  const protocols = db.prepare(`
    SELECT * FROM protocols
    WHERE status IN ('IACUC Review', 'Veterinary Review')
    ORDER BY submitted DESC
  `).all();

  const withTallies = protocols.map(p => ({
    ...p,
    ...tallyFor(p.id),
    assignments: assignmentsFor(p.id),
    comments: commentsFor(p.id),
  }));
  res.json(withTallies);
});

// GET /api/committee/voters
// Personnel eligible to cast an FCR vote (roles flagged is_committee = 1).
router.get("/voters", (_req, res) => {
  const rows = db.prepare(`
    SELECT personnel.id, personnel.name, roles.name AS role_name
    FROM personnel
    JOIN roles ON roles.id = personnel.role_id
    WHERE roles.is_committee = 1
    ORDER BY personnel.name
  `).all();
  res.json(rows);
});

// GET /api/committee/protocols/:id/votes
router.get("/protocols/:id/votes", (req, res) => {
  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id);
  if (!protocol) return res.status(404).json({ error: "Protocol not found" });
  res.json({
    protocol,
    ...tallyFor(req.params.id),
    assignments: assignmentsFor(req.params.id),
    comments: commentsFor(req.params.id),
  });
});

// POST /api/committee/protocols/:id/votes  { personnel_id, vote, comment }
// One vote per person per protocol — voting again updates the existing vote.
router.post("/protocols/:id/votes", (req, res) => {
  const { status, body } = castVote(req.params.id, req.body);
  res.status(status).json(body);
});

// ---- Domain A: review workflow depth ----

// GET /api/committee/protocols/:id/reviews
// Full review history for one protocol: votes (with tally), assignments, comments.
router.get("/protocols/:id/reviews", (req, res) => {
  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id);
  if (!protocol) return res.status(404).json({ error: "Protocol not found" });
  res.json({
    protocol,
    ...tallyFor(req.params.id),
    assignments: assignmentsFor(req.params.id),
    comments: commentsFor(req.params.id),
  });
});

// POST /api/committee/protocols/:id/reviews  { personnel_id, vote, comment }
// Cast a committee review — the review-history alias of the vote endpoint.
// Returns the full review history so the UI can refresh in one call.
router.post("/protocols/:id/reviews", (req, res) => {
  const { status, body } = castVote(req.params.id, req.body);
  if (status !== 201) return res.status(status).json(body);
  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(req.params.id);
  res.status(201).json({
    protocol,
    ...body,
    assignments: assignmentsFor(req.params.id),
    comments: commentsFor(req.params.id),
  });
});

// POST /api/committee/protocols/:id/comments  { personnel_id, section, comment }
// Add section-specific inline feedback (distinct from the vote's own comment).
router.post("/protocols/:id/comments", (req, res) => {
  const protocolId = req.params.id;
  const { personnel_id, section, comment } = req.body;

  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(protocolId);
  if (!protocol) return res.status(404).json({ error: "Protocol not found" });

  if (!personnel_id) return res.status(400).json({ error: "personnel_id is required" });
  if (!REVIEW_SECTIONS.includes(section)) {
    return res.status(400).json({ error: `section must be one of: ${REVIEW_SECTIONS.join(", ")}` });
  }
  if (!comment || !String(comment).trim()) {
    return res.status(400).json({ error: "comment is required" });
  }

  const person = db.prepare("SELECT id, name FROM personnel WHERE id = ?").get(Number(personnel_id));
  if (!person) return res.status(400).json({ error: "Unknown personnel_id" });

  const result = db.prepare(`
    INSERT INTO protocol_review_comments (protocol_id, personnel_id, section, comment)
    VALUES (?, ?, ?, ?)
  `).run(protocolId, Number(personnel_id), section, String(comment).trim());

  audit({
    action: "comment.added",
    entityType: "protocol",
    entityId: protocolId,
    actor: person.name,
    details: { section, comment: String(comment).trim() },
  });

  const created = db.prepare(`
    SELECT protocol_review_comments.id, protocol_review_comments.section,
           protocol_review_comments.comment, protocol_review_comments.created_at,
           personnel.id AS personnel_id, personnel.name AS commenter_name
    FROM protocol_review_comments
    JOIN personnel ON personnel.id = protocol_review_comments.personnel_id
    WHERE protocol_review_comments.id = ?
  `).get(Number(result.lastInsertRowid));

  res.status(201).json(created);
});

// PATCH /api/committee/protocols/:id/assign  { personnel_id, role }
// Assign (or reassign) a reviewer to the protocol. Upserts on (protocol, personnel).
router.patch("/protocols/:id/assign", (req, res) => {
  const protocolId = req.params.id;
  const { personnel_id, role } = req.body;

  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(protocolId);
  if (!protocol) return res.status(404).json({ error: "Protocol not found" });

  if (!personnel_id || !role) {
    return res.status(400).json({ error: "personnel_id and role are required" });
  }
  if (!ASSIGNMENT_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ASSIGNMENT_ROLES.join(", ")}` });
  }

  const person = db.prepare("SELECT id, name FROM personnel WHERE id = ?").get(Number(personnel_id));
  if (!person) return res.status(400).json({ error: "Unknown personnel_id" });

  db.prepare(`
    INSERT INTO protocol_review_assignments (protocol_id, personnel_id, role)
    VALUES (@protocol_id, @personnel_id, @role)
    ON CONFLICT(protocol_id, personnel_id) DO UPDATE SET
      role = excluded.role, assigned_at = datetime('now')
  `).run({ protocol_id: protocolId, personnel_id: Number(personnel_id), role });

  audit({
    action: "assignment.updated",
    entityType: "protocol",
    entityId: protocolId,
    actor: person.name,
    details: { role, reviewer: person.name },
  });

  const created = db.prepare(`
    SELECT protocol_review_assignments.role, protocol_review_assignments.assigned_at,
           personnel.id AS personnel_id, personnel.name AS reviewer_name
    FROM protocol_review_assignments
    JOIN personnel ON personnel.id = protocol_review_assignments.personnel_id
    WHERE protocol_review_assignments.protocol_id = ? AND protocol_review_assignments.personnel_id = ?
  `).get(protocolId, Number(personnel_id));

  res.status(200).json(created);
});

// PATCH /api/committee/protocols/:id/review-method  { review_method }
// Set whether the protocol is reviewed by the full committee (FCR) or a
// designated member (DMR). Stored on protocols.review_method (migration-guarded).
router.patch("/protocols/:id/review-method", (req, res) => {
  const protocolId = req.params.id;
  const { review_method } = req.body;

  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(protocolId);
  if (!protocol) return res.status(404).json({ error: "Protocol not found" });

  if (!REVIEW_METHODS.includes(review_method)) {
    return res.status(400).json({ error: `review_method must be one of: ${REVIEW_METHODS.join(", ")}` });
  }

  db.prepare("UPDATE protocols SET review_method = ? WHERE id = ?").run(review_method, protocolId);
  audit({
    action: "review_method.updated",
    entityType: "protocol",
    entityId: protocolId,
    actor: resolveActor(req),
    details: { review_method },
  });
  res.status(200).json(db.prepare("SELECT * FROM protocols WHERE id = ?").get(protocolId));
});
