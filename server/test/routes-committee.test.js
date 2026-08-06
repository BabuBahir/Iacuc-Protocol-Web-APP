import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables } from "./helpers.js";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const app = createApp();

async function insertProtocol(overrides = {}) {
  const params = {
    id: "TEST-0001",
    title: "Test protocol",
    pi: "Dr. Test",
    species: "Mouse",
    status: "IACUC Review",
    animals: 10,
    pain_category: "Category B",
    ...overrides,
  };
  await db.run(
    `
    INSERT INTO protocols (id, title, pi, species, status, animals, pain_category)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `,
    [params.id, params.title, params.pi, params.species, params.status, params.animals, params.pain_category]
  );
}

async function insertPersonnel(name, roleName, isCommittee) {
  let roleId = (await db.get("SELECT id FROM roles WHERE name = $1", [roleName]))?.id;
  if (!roleId) {
    const role = await request(app)
      .post("/api/admin/roles")
      .send({ name: roleName, is_committee: isCommittee });
    roleId = role.body.id;
  }
  const person = await request(app)
    .post("/api/admin/personnel")
    .send({ name, role_id: roleId });
  return person.body.id;
}

describe("GET /api/committee/protocols", () => {
  beforeEach(async () => { await resetTables(db); });

  test("only returns protocols in a review stage", async () => {
    await insertProtocol({ id: "IN-REVIEW", status: "IACUC Review" });
    await insertProtocol({ id: "ACTIVE", status: "Active" });
    await insertProtocol({ id: "DRAFT", status: "Draft" });

    const res = await request(app).get("/api/committee/protocols");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, "IN-REVIEW");
  });

  test("includes a vote tally with zero counts when no votes exist", async () => {
    await insertProtocol();
    const res = await request(app).get("/api/committee/protocols");
    assert.equal(res.body[0].totalVotes, 0);
    assert.equal(res.body[0].counts.Approve, 0);
  });
});

describe("GET /api/committee/voters", () => {
  beforeEach(async () => { await resetTables(db); });

  test("only returns personnel whose role is committee-eligible", async () => {
    await insertPersonnel("Dr. PI", "Principal Investigator", false);
    await insertPersonnel("Dr. Chair", "IACUC Chair", true);

    const res = await request(app).get("/api/committee/voters");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].name, "Dr. Chair");
  });
});

describe("GET /api/committee/protocols/:id/votes", () => {
  beforeEach(async () => { await resetTables(db); });

  test("returns the protocol and its tally", async () => {
    await insertProtocol();
    const res = await request(app).get("/api/committee/protocols/TEST-0001/votes");
    assert.equal(res.status, 200);
    assert.equal(res.body.protocol.id, "TEST-0001");
    assert.equal(res.body.totalVotes, 0);
  });

  test("404s for an unknown protocol", async () => {
    const res = await request(app).get("/api/committee/protocols/NOPE/votes");
    assert.equal(res.status, 404);
  });
});

describe("POST /api/committee/protocols/:id/votes", () => {
  beforeEach(async () => { await resetTables(db); });

  test("a committee-eligible person can cast a vote", async () => {
    await insertProtocol();
    const voterId = await insertPersonnel("Dr. Committee", "Committee Member", true);

    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: voterId, vote: "Approve", comment: "Looks good" });

    assert.equal(res.status, 201);
    assert.equal(res.body.counts.Approve, 1);
    assert.equal(res.body.totalVotes, 1);
  });

  test(
    "regression: a non-committee role is rejected with 403, not silently allowed to vote",
    async () => {
      await insertProtocol();
      const piId = await insertPersonnel("Dr. PI", "Principal Investigator", false);

      const res = await request(app)
        .post("/api/committee/protocols/TEST-0001/votes")
        .send({ personnel_id: piId, vote: "Approve" });

      assert.equal(res.status, 403);
    }
  );

  test(
    "regression: voting again as the same person updates the existing vote instead of duplicating it",
    async () => {
      await insertProtocol();
      const voterId = await insertPersonnel("Dr. Committee", "Committee Member", true);

      await request(app)
        .post("/api/committee/protocols/TEST-0001/votes")
        .send({ personnel_id: voterId, vote: "Approve" });

      const second = await request(app)
        .post("/api/committee/protocols/TEST-0001/votes")
        .send({ personnel_id: voterId, vote: "Table", comment: "Changed my mind" });

      assert.equal(second.status, 201);
      assert.equal(second.body.totalVotes, 1, "expected 1 total vote, not 2, after re-voting");
      assert.equal(second.body.counts.Approve, 0);
      assert.equal(second.body.counts.Table, 1);
    }
  );

  test("rejects an invalid vote value", async () => {
    await insertProtocol();
    const voterId = await insertPersonnel("Dr. Committee", "Committee Member", true);

    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: voterId, vote: "Maybe" });

    assert.equal(res.status, 400);
  });

  test("400s when personnel_id or vote is missing", async () => {
    await insertProtocol();
    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ vote: "Approve" }); // missing personnel_id
    assert.equal(res.status, 400);
  });

  test("404s for an unknown protocol", async () => {
    const voterId = await insertPersonnel("Dr. Committee", "Committee Member", true);
    const res = await request(app)
      .post("/api/committee/protocols/NOPE/votes")
      .send({ personnel_id: voterId, vote: "Approve" });
    assert.equal(res.status, 404);
  });

  test("400s for an unknown personnel_id", async () => {
    await insertProtocol();
    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: 99999, vote: "Approve" });
    assert.equal(res.status, 400);
  });

  test("multiple different voters accumulate in the tally", async () => {
    await insertProtocol();
    const voter1 = await insertPersonnel("Dr. One", "Committee Member", true);
    const voter2 = await insertPersonnel("Dr. Two", "Committee Member", true);

    await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: voter1, vote: "Approve" });
    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: voter2, vote: "Approve" });

    assert.equal(res.body.totalVotes, 2);
    assert.equal(res.body.counts.Approve, 2);
  });

  test(
    "regression: vote comments round-trip through the list and tally endpoints " +
      "(they were previously dropped from the tally query, so the UI could never show them)",
    async () => {
      await insertProtocol();
      const voterId = await insertPersonnel("Dr. Commenter", "Committee Member", true);
      await request(app)
        .post("/api/committee/protocols/TEST-0001/votes")
        .send({ personnel_id: voterId, vote: "Approve", comment: "Looks good." });

      const list = await request(app).get("/api/committee/protocols");
      assert.equal(list.body[0].votes[0].comment, "Looks good.");

      const detail = await request(app).get("/api/committee/protocols/TEST-0001/votes");
      assert.equal(detail.body.votes[0].comment, "Looks good.");
    }
  );
});

describe("review workflow depth (Domain A)", () => {
  beforeEach(async () => { await resetTables(db); });

  test("GET /protocols includes review_method, assignments, and comments per protocol", async () => {
    await insertProtocol();
    const reviewerId = await insertPersonnel("Dr. Review", "Committee Member", true);
    const commenterId = await insertPersonnel("Dr. Comment", "Committee Member", true);

    await request(app)
      .patch("/api/committee/protocols/TEST-0001/review-method")
      .send({ review_method: "DMR" });
    await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ personnel_id: reviewerId, role: "Designated Member" });
    await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .send({ personnel_id: commenterId, section: "procedures", comment: "Add a scoring rubric." });

    const res = await request(app).get("/api/committee/protocols");
    assert.equal(res.body[0].review_method, "DMR");
    assert.equal(res.body[0].assignments.length, 1);
    assert.equal(res.body[0].assignments[0].reviewer_name, "Dr. Review");
    assert.equal(res.body[0].comments.length, 1);
    assert.equal(res.body[0].comments[0].section, "procedures");
  });

  test("PATCH review-method sets FCR or DMR on the protocol", async () => {
    await insertProtocol();
    const res = await request(app)
      .patch("/api/committee/protocols/TEST-0001/review-method")
      .send({ review_method: "DMR" });
    assert.equal(res.status, 200);
    assert.equal(res.body.review_method, "DMR");

    const list = await request(app).get("/api/committee/protocols");
    assert.equal(list.body[0].review_method, "DMR");
  });

  test("PATCH review-method rejects unknown methods and unknown protocols", async () => {
    await insertProtocol();
    const bad = await request(app)
      .patch("/api/committee/protocols/TEST-0001/review-method")
      .send({ review_method: "EMAIL" });
    assert.equal(bad.status, 400);

    const missing = await request(app)
      .patch("/api/committee/protocols/TEST-0001/review-method")
      .send({});
    assert.equal(missing.status, 400);

    const nope = await request(app)
      .patch("/api/committee/protocols/NOPE/review-method")
      .send({ review_method: "FCR" });
    assert.equal(nope.status, 404);
  });

  test("PATCH assign creates a reviewer assignment and upserts instead of duplicating", async () => {
    await insertProtocol();
    const reviewerId = await insertPersonnel("Dr. Review", "Committee Member", true);

    const first = await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ personnel_id: reviewerId, role: "Primary Reviewer" });
    assert.equal(first.status, 200);
    assert.equal(first.body.role, "Primary Reviewer");

    // Same reviewer reassigned: role changes, no duplicate row.
    const second = await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ personnel_id: reviewerId, role: "Designated Member" });
    assert.equal(second.body.role, "Designated Member");

    const count = await db.get("SELECT COUNT(*) AS c FROM protocol_review_assignments");
    assert.equal(count.c, 1);
  });

  test("PATCH assign validates role, personnel, and protocol", async () => {
    await insertProtocol();
    const reviewerId = await insertPersonnel("Dr. Review", "Committee Member", true);

    let res = await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ role: "Primary Reviewer" }); // missing personnel_id
    assert.equal(res.status, 400);

    res = await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ personnel_id: reviewerId }); // missing role
    assert.equal(res.status, 400);

    res = await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ personnel_id: reviewerId, role: "Villain" });
    assert.equal(res.status, 400);

    res = await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ personnel_id: 99999, role: "Primary Reviewer" });
    assert.equal(res.status, 400);

    res = await request(app)
      .patch("/api/committee/protocols/NOPE/assign")
      .send({ personnel_id: reviewerId, role: "Primary Reviewer" });
    assert.equal(res.status, 404);
  });

  test("POST comments adds a section-specific comment", async () => {
    await insertProtocol();
    const commenterId = await insertPersonnel("Dr. Comment", "Committee Member", true);

    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .send({ personnel_id: commenterId, section: "alternatives", comment: "  Use a second database.  " });
    assert.equal(res.status, 201);
    assert.equal(res.body.section, "alternatives");
    assert.equal(res.body.comment, "Use a second database.");
    assert.equal(res.body.commenter_name, "Dr. Comment");
  });

  test("POST comments validates section, comment text, personnel, and protocol", async () => {
    await insertProtocol();
    const commenterId = await insertPersonnel("Dr. Comment", "Committee Member", true);

    let res = await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .send({ personnel_id: commenterId, section: "nonsense", comment: "hi" });
    assert.equal(res.status, 400);

    res = await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .send({ personnel_id: commenterId, section: "overall", comment: "   " });
    assert.equal(res.status, 400);

    res = await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .send({ personnel_id: 99999, section: "overall", comment: "hi" });
    assert.equal(res.status, 400);

    res = await request(app)
      .post("/api/committee/protocols/NOPE/comments")
      .send({ personnel_id: commenterId, section: "overall", comment: "hi" });
    assert.equal(res.status, 404);
  });

  test("GET reviews returns the full review history", async () => {
    await insertProtocol();
    const voterId = await insertPersonnel("Dr. Voter", "Committee Member", true);
    const reviewerId = await insertPersonnel("Dr. Review", "Committee Member", true);

    await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: voterId, vote: "Approve", comment: "ok" });
    await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ personnel_id: reviewerId, role: "Primary Reviewer" });
    await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .send({ personnel_id: voterId, section: "overall", comment: "Solid plan." });

    const res = await request(app).get("/api/committee/protocols/TEST-0001/reviews");
    assert.equal(res.status, 200);
    assert.equal(res.body.protocol.id, "TEST-0001");
    assert.equal(res.body.totalVotes, 1);
    assert.equal(res.body.votes[0].vote, "Approve");
    assert.equal(res.body.assignments.length, 1);
    assert.equal(res.body.comments.length, 1);

    const nope = await request(app).get("/api/committee/protocols/NOPE/reviews");
    assert.equal(nope.status, 404);
  });

  test("POST reviews casts a vote and returns the full history", async () => {
    await insertProtocol();
    const voterId = await insertPersonnel("Dr. Voter", "Committee Member", true);

    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/reviews")
      .send({ personnel_id: voterId, vote: "Request Modifications", comment: "Needs work" });

    assert.equal(res.status, 201);
    assert.equal(res.body.totalVotes, 1);
    assert.equal(res.body.protocol.id, "TEST-0001");
    assert.ok(Array.isArray(res.body.assignments));
    assert.ok(Array.isArray(res.body.comments));
  });

  test("POST reviews rejects a non-committee reviewer with 403", async () => {
    await insertProtocol();
    const piId = await insertPersonnel("Dr. PI", "Principal Investigator", false);

    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/reviews")
      .send({ personnel_id: piId, vote: "Approve" });
    assert.equal(res.status, 403);
  });

  test("deleting a protocol cascades its assignments and comments", async () => {
    await insertProtocol();
    const reviewerId = await insertPersonnel("Dr. Review", "Committee Member", true);

    await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .send({ personnel_id: reviewerId, role: "Primary Reviewer" });
    await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .send({ personnel_id: reviewerId, section: "overall", comment: "Great." });

    await db.run("DELETE FROM protocols WHERE id = $1", ["TEST-0001"]);

    const assignments = await db.get("SELECT COUNT(*) AS c FROM protocol_review_assignments");
    const comments = await db.get("SELECT COUNT(*) AS c FROM protocol_review_comments");
    assert.equal(assignments.c, 0);
    assert.equal(comments.c, 0);
  });
});
