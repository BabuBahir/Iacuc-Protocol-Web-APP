import { Router } from "express";
import { db } from "../db.js";

export const router = Router();

const VOTE_OPTIONS = ["Approve", "Request Modifications", "Table", "Withhold Approval"];

function tallyFor(protocolId) {
  const votes = db.prepare(`
    SELECT protocol_votes.vote, personnel.name AS voter_name, roles.name AS role_name, protocol_votes.voted_at
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

// GET /api/committee/protocols
// Protocols currently in a committee-review stage, each with its vote tally.
router.get("/protocols", (_req, res) => {
  const protocols = db.prepare(`
    SELECT * FROM protocols
    WHERE status IN ('IACUC Review', 'Veterinary Review')
    ORDER BY submitted DESC
  `).all();

  const withTallies = protocols.map(p => ({ ...p, ...tallyFor(p.id) }));
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
  res.json({ protocol, ...tallyFor(req.params.id) });
});

// POST /api/committee/protocols/:id/votes  { personnel_id, vote, comment }
// One vote per person per protocol — voting again updates the existing vote.
router.post("/protocols/:id/votes", (req, res) => {
  const { personnel_id, vote, comment } = req.body;
  const protocolId = req.params.id;

  if (!personnel_id || !vote) {
    return res.status(400).json({ error: "personnel_id and vote are required" });
  }
  if (!VOTE_OPTIONS.includes(vote)) {
    return res.status(400).json({ error: `vote must be one of: ${VOTE_OPTIONS.join(", ")}` });
  }

  const protocol = db.prepare("SELECT * FROM protocols WHERE id = ?").get(protocolId);
  if (!protocol) return res.status(404).json({ error: "Protocol not found" });

  const voter = db.prepare(`
    SELECT personnel.*, roles.is_committee
    FROM personnel JOIN roles ON roles.id = personnel.role_id
    WHERE personnel.id = ?
  `).get(Number(personnel_id));
  if (!voter) return res.status(400).json({ error: "Unknown personnel_id" });
  if (!voter.is_committee) {
    return res.status(403).json({ error: `${voter.name}'s role is not eligible to cast an FCR vote.` });
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

  res.status(201).json(tallyFor(protocolId));
});
