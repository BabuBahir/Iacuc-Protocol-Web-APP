import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables } from "./helpers.js";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const app = createApp();

function insertProtocol(overrides = {}) {
  db.prepare(`
    INSERT INTO protocols (id, title, pi, species, status, animals, pain_category)
    VALUES (@id, @title, @pi, @species, @status, @animals, @pain_category)
  `).run({
    id: "TEST-0001",
    title: "Test protocol",
    pi: "Dr. Test",
    species: "Mouse",
    status: "IACUC Review",
    animals: 10,
    pain_category: "Category B",
    ...overrides,
  });
}

async function insertPersonnel(name, roleName, isCommittee) {
  let roleId = db.prepare("SELECT id FROM roles WHERE name = ?").get(roleName)?.id;
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
  beforeEach(() => resetTables(db));

  test("only returns protocols in a review stage", async () => {
    insertProtocol({ id: "IN-REVIEW", status: "IACUC Review" });
    insertProtocol({ id: "ACTIVE", status: "Active" });
    insertProtocol({ id: "DRAFT", status: "Draft" });

    const res = await request(app).get("/api/committee/protocols");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, "IN-REVIEW");
  });

  test("includes a vote tally with zero counts when no votes exist", async () => {
    insertProtocol();
    const res = await request(app).get("/api/committee/protocols");
    assert.equal(res.body[0].totalVotes, 0);
    assert.equal(res.body[0].counts.Approve, 0);
  });
});

describe("GET /api/committee/voters", () => {
  beforeEach(() => resetTables(db));

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
  beforeEach(() => resetTables(db));

  test("returns the protocol and its tally", async () => {
    insertProtocol();
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
  beforeEach(() => resetTables(db));

  test("a committee-eligible person can cast a vote", async () => {
    insertProtocol();
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
      insertProtocol();
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
      insertProtocol();
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
    insertProtocol();
    const voterId = await insertPersonnel("Dr. Committee", "Committee Member", true);

    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: voterId, vote: "Maybe" });

    assert.equal(res.status, 400);
  });

  test("400s when personnel_id or vote is missing", async () => {
    insertProtocol();
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
    insertProtocol();
    const res = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: 99999, vote: "Approve" });
    assert.equal(res.status, 400);
  });

  test("multiple different voters accumulate in the tally", async () => {
    insertProtocol();
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
});
