import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables, OFFICE_ACTOR, seedOfficeActor, insertPersonnelDirect } from "./helpers.js";

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

function insertPerson(name, roleName, isCommittee = false) {
  return insertPersonnelDirect(db, { name, roleName, isCommittee });
}

// Every privileged surface, represented by one canonical request. The gate
// runs before any 404/validation logic, so no fixtures are needed to see the
// 401/403 behavior — but the votes route resolves its own actor, so it is
// exercised with a committee persona where the test asserts a success.
describe("graduated access control (Roadmap item 4)", () => {
  beforeEach(() => resetTables(db));

  test("anonymous writes to every gated surface return 401 with a pick-an-identity hint", async () => {
    insertProtocol();
    const office = seedOfficeActor(db);

    // Identity-bearing bodies (personnel_id) intentionally resolve to that
    // persona, so the anonymous-401 checks send payloads with no identity.
    const anonymousRequests = [
      request(app).post("/api/admin/species").send({ name: "Ferret" }),
      request(app).post("/api/admin/roles").send({ name: "New Role" }),
      request(app).post("/api/admin/personnel").send({ name: "Dr. X", role_id: 1 }),
      request(app).patch("/api/committee/protocols/TEST-0001/assign").send({}),
      request(app).patch("/api/committee/protocols/TEST-0001/review-method").send({ review_method: "FCR" }),
      request(app).post("/api/committee/protocols/TEST-0001/comments").send({ section: "overall", comment: "hi" }),
      request(app).post("/api/committee/protocols/TEST-0001/votes").send({ vote: "Approve" }),
      request(app).patch("/api/transfers/1").send({ status: "Approved" }),
      request(app).post(`/api/personnel/${office}/training`).send({ course: "C", completed_date: "2026-01-01" }),
      request(app).post(`/api/personnel/${office}/ohsp`).send({ status: "Cleared" }),
    ];

    for (const req of anonymousRequests) {
      const res = await req;
      assert.equal(res.status, 401, `expected 401 for ${req.method} ${req.url}`);
      assert.match(res.body.error, /Pick who you're acting as/);
    }
  });

  test("an unknown X-Actor name is rejected with 401", async () => {
    const res = await request(app)
      .post("/api/admin/species")
      .set("x-actor", "Nobody Here")
      .send({ name: "Ferret" });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Pick who you're acting as/);
  });

  test("a non-office persona is rejected with 403 and a role hint on office surfaces", async () => {
    seedOfficeActor(db);
    const pi = insertPerson("Dr. PI", "Principal Investigator");

    const species = await request(app)
      .post("/api/admin/species")
      .set("x-actor", "Dr. PI")
      .send({ name: "Ferret" });
    assert.equal(species.status, 403);
    assert.match(species.body.error, /doesn't have permission/);
    assert.match(species.body.error, /IACUC Coordinator, IACUC Chair/);

    const assign = await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .set("x-actor", "Dr. PI")
      .send({ personnel_id: pi, role: "Primary Reviewer" });
    assert.equal(assign.status, 403);

    const training = await request(app)
      .post(`/api/personnel/${pi}/training`)
      .set("x-actor", "Dr. PI")
      .send({ course: "C", completed_date: "2026-01-01" });
    assert.equal(training.status, 403);
  });

  test("a non-committee persona is rejected with 403 on committee surfaces", async () => {
    insertProtocol();
    const pi = insertPerson("Dr. PI", "Principal Investigator");

    // requireCommittee path (POST comments)
    const comment = await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .set("x-actor", "Dr. PI")
      .send({ personnel_id: pi, section: "overall", comment: "hi" });
    assert.equal(comment.status, 403);
    assert.match(comment.body.error, /isn't eligible to take part in protocol review/);

    // castVote inline path (POST votes)
    const vote = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .set("x-actor", "Dr. PI")
      .send({ personnel_id: pi, vote: "Approve" });
    assert.equal(vote.status, 403);
    assert.match(vote.body.error, /isn't eligible to cast an FCR vote/);
  });

  test("the office persona can act on every office-gated surface", async () => {
    insertProtocol();
    seedOfficeActor(db);
    const recipient = insertPerson("Dr. New PI", "Principal Investigator");
    const reviewer = insertPerson("Dr. Review", "Committee Member", true);

    const species = await request(app).post("/api/admin/species").set("x-actor", OFFICE_ACTOR).send({ name: "Ferret" });
    assert.equal(species.status, 201);

    const assign = await request(app)
      .patch("/api/committee/protocols/TEST-0001/assign")
      .set("x-actor", OFFICE_ACTOR)
      .send({ personnel_id: reviewer, role: "Primary Reviewer" });
    assert.equal(assign.status, 200);
    assert.equal(assign.body.role, "Primary Reviewer");

    const method = await request(app)
      .patch("/api/committee/protocols/TEST-0001/review-method")
      .set("x-actor", OFFICE_ACTOR)
      .send({ review_method: "DMR" });
    assert.equal(method.status, 200);
    assert.equal(method.body.review_method, "DMR");

    const created = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: recipient, reason: "Relocating." });
    assert.equal(created.status, 201);
    const decided = await request(app)
      .patch(`/api/transfers/${created.body.id}`)
      .set("x-actor", OFFICE_ACTOR)
      .send({ status: "Approved" });
    assert.equal(decided.status, 200);
    assert.equal(decided.body.status, "Approved");

    const am = await request(app).post("/api/protocols/TEST-0001/amendments").send({ reason: "Add a strain." });
    assert.equal(am.status, 201);
    const amDecided = await request(app)
      .patch(`/api/protocols/TEST-0001/amendments/${am.body.id}`)
      .set("x-actor", OFFICE_ACTOR)
      .send({ status: "Approved", expiration_date: "2029-01-01" });
    assert.equal(amDecided.status, 200);

    const renewal = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    assert.equal(renewal.status, 201);
    const renewalDecided = await request(app)
      .patch(`/api/protocols/TEST-0001/renewals/${renewal.body.id}`)
      .set("x-actor", OFFICE_ACTOR)
      .send({ status: "Approved", approved_until: "2029-01-01" });
    assert.equal(renewalDecided.status, 200);

    const training = await request(app)
      .post(`/api/personnel/${recipient}/training`)
      .set("x-actor", OFFICE_ACTOR)
      .send({ course: "Rodent Surgery", completed_date: "2026-02-01" });
    assert.equal(training.status, 201);

    const ohsp = await request(app)
      .post(`/api/personnel/${recipient}/ohsp`)
      .set("x-actor", OFFICE_ACTOR)
      .send({ status: "Cleared" });
    assert.equal(ohsp.status, 200);
  });

  test("persona can be resolved from body.actor instead of the header", async () => {
    seedOfficeActor(db);
    const office = db.prepare("SELECT id FROM personnel WHERE name = ?").get(OFFICE_ACTOR);

    const species = await request(app)
      .post("/api/admin/species")
      .send({ name: "Ferret", actor: OFFICE_ACTOR });
    assert.equal(species.status, 201);
    assert.equal(species.body.name, "Ferret");

    insertProtocol();
    const committee = insertPerson("Dr. Kim", "Committee Member", true);
    const comment = await request(app)
      .post("/api/committee/protocols/TEST-0001/comments")
      .send({ personnel_id: committee, section: "overall", comment: "Nice.", actor: "Dr. Kim" });
    assert.equal(comment.status, 201);

    const personnelIdOnly = await request(app)
      .post("/api/admin/species")
      .send({ name: "Rabbit", personnel_id: office.id });
    assert.equal(personnelIdOnly.status, 201);
  });

  test("committee-eligible and office personas can cast votes and comment", async () => {
    insertProtocol();
    const committee = insertPerson("Dr. Kim", "Committee Member", true);
    const otherMember = insertPerson("Dr. Lee", "Committee Member", true);
    seedOfficeActor(db);

    const vote = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .set("x-actor", "Dr. Kim")
      .send({ personnel_id: committee, vote: "Approve", comment: "Solid." });
    assert.equal(vote.status, 201);
    assert.equal(vote.body.totalVotes, 1);

    // The office role is also committee-eligible even though is_committee = 0.
    // A different voter id avoids the per-person upsert and adds a new row.
    const officeVote = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .set("x-actor", OFFICE_ACTOR)
      .send({ personnel_id: otherMember, vote: "Request Modifications" });
    assert.equal(officeVote.status, 201);
    assert.equal(officeVote.body.totalVotes, 2);
  });

  test("gate passes but field validation still 400s a known persona's bad payload", async () => {
    insertProtocol();
    const committee = insertPerson("Dr. Kim", "Committee Member", true);

    const missingVote = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .set("x-actor", "Dr. Kim")
      .send({ personnel_id: committee });
    assert.equal(missingVote.status, 400);

    const unknownVoter = await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .set("x-actor", "Dr. Kim")
      .send({ personnel_id: 99999, vote: "Approve" });
    assert.equal(unknownVoter.status, 400);
  });

  test("reads are never gated, even anonymously", async () => {
    seedOfficeActor(db);
    const res = await request(app).get("/api/admin/species");
    assert.equal(res.status, 200);
  });
});
