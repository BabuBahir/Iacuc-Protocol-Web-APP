import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables, OFFICE_ACTOR, seedOfficeActor } from "./helpers.js";

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
    status: "Approved",
    animals: 10,
    pain_category: "Category B",
    ...overrides,
  });
}

function insertPersonnel(name = "Dr. New PI") {
  const role = db.prepare("INSERT INTO roles (name) VALUES ('PI')").run();
  return db.prepare("INSERT INTO personnel (name, role_id) VALUES (?, ?)").run(name, role.lastInsertRowid).lastInsertRowid;
}

describe("transfers — single request", () => {
  beforeEach(() => resetTables(db));

  test("POST /api/protocols/:id/transfers creates a pending transfer with a from_pi snapshot", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    const res = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "PI is relocating." });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "Pending");
    assert.equal(res.body.from_pi, "Dr. Test");
    assert.equal(res.body.to_name, "Dr. New PI");
    assert.equal(res.body.protocol_title, "Test protocol");
  });

  test("requires a reason", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    const res = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /reason for transfer is required/);
  });

  test("rejects an unknown personnel id", async () => {
    insertProtocol();
    const res = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: 9999, reason: "X" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Unknown personnel/);
  });

  test("409 when a transfer is already pending for the protocol", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "First." });
    const res = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "Second." });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already pending/);
  });

  test("404 for an unknown protocol", async () => {
    const res = await request(app)
      .post("/api/protocols/NOPE/transfers")
      .send({ to_personnel_id: 1, reason: "X" });
    assert.equal(res.status, 404);
  });
});

describe("transfers — queue", () => {
  beforeEach(() => resetTables(db));

  test("GET /api/transfers lists transfers with protocol title and target name", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "PI is relocating." });

    const res = await request(app).get("/api/transfers");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].protocol_title, "Test protocol");
    assert.equal(res.body[0].to_name, "Dr. New PI");
  });

  test("GET filters by status", async () => {
    insertProtocol();
    seedOfficeActor(db);
    const pid = insertPersonnel();
    const created = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "PI is relocating." });
    await request(app)
      .patch(`/api/transfers/${created.body.id}`)
      .set("X-Actor", OFFICE_ACTOR)
      .send({ status: "Approved" });

    const pending = await request(app).get("/api/transfers?status=Pending");
    assert.equal(pending.body.length, 0);
    const approved = await request(app).get("/api/transfers?status=Approved");
    assert.equal(approved.body.length, 1);
  });

  test("GET rejects an invalid status filter", async () => {
    const res = await request(app).get("/api/transfers?status=Filed");
    assert.equal(res.status, 400);
  });
});

describe("transfers — bulk", () => {
  beforeEach(() => resetTables(db));

  test("POST /api/transfers creates one pending transfer per protocol", async () => {
    insertProtocol();
    insertProtocol({ id: "TEST-0002", pi: "Dr. Other" });
    const pid = insertPersonnel();
    const res = await request(app)
      .post("/api/transfers")
      .send({ protocol_ids: ["TEST-0001", "TEST-0002"], to_personnel_id: pid, reason: "Reorganizing the lab." });
    assert.equal(res.status, 201);
    assert.equal(res.body.length, 2);
    assert.deepEqual(res.body.map(t => t.status), ["Pending", "Pending"]);
    assert.deepEqual(res.body.map(t => t.from_pi), ["Dr. Test", "Dr. Other"]);
  });

  test("requires a non-empty protocol_ids array", async () => {
    const pid = insertPersonnel();
    const res = await request(app)
      .post("/api/transfers")
      .send({ protocol_ids: [], to_personnel_id: pid, reason: "X" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /non-empty array/);
  });

  test("requires a reason", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    const res = await request(app)
      .post("/api/transfers")
      .send({ protocol_ids: ["TEST-0001"], to_personnel_id: pid });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /reason for transfer is required/);
  });

  test("404 when one target protocol is unknown", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    const res = await request(app)
      .post("/api/transfers")
      .send({ protocol_ids: ["TEST-0001", "NOPE"], to_personnel_id: pid, reason: "X" });
    assert.equal(res.status, 404);
    assert.match(res.body.error, /NOPE/);
  });

  test("409 when a target protocol already has a pending transfer (all-or-nothing)", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "First." });
    const res = await request(app)
      .post("/api/transfers")
      .send({ protocol_ids: ["TEST-0001"], to_personnel_id: pid, reason: "Second." });
    assert.equal(res.status, 409);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM protocol_transfers").get().n, 1);
  });
});

describe("transfers — decision", () => {
  beforeEach(() => {
    resetTables(db);
    seedOfficeActor(db); // deciding a transfer is an IACUC-office action (gated)
  });

  // Office persona acts via the X-Actor header; body carries just the status.
  const decide = (id, status) =>
    request(app).patch(`/api/transfers/${id}`).set("X-Actor", OFFICE_ACTOR).send({ status });

  test("approving reassigns the protocol PI, the Personnel label, and adds an approval-history entry", async () => {
    insertProtocol();
    db.prepare(`
      INSERT INTO related_items (protocol_id, list_name, label) VALUES ('TEST-0001', 'Personnel', 'Dr. Test - PI')
    `).run();
    const pid = insertPersonnel("Dr. New PI");
    const created = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "PI is relocating." });

    const res = await decide(created.body.id, "Approved");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Approved");
    assert.ok(res.body.decision_date);

    assert.equal(db.prepare("SELECT pi FROM protocols WHERE id = 'TEST-0001'").get().pi, "Dr. New PI");
    const labels = db.prepare("SELECT label FROM related_items WHERE protocol_id = 'TEST-0001' AND list_name = 'Personnel'").all().map(r => r.label);
    assert.deepEqual(labels, ["Dr. New PI - PI"]);
    const history = db.prepare("SELECT label FROM related_items WHERE protocol_id = 'TEST-0001' AND list_name = 'Approval history'").all().map(r => r.label);
    assert.equal(history.length, 1);
    assert.match(history[0], /Ownership transferred from Dr. Test to Dr. New PI/);
  });

  test("approving works even when the old PI label is absent", async () => {
    insertProtocol();
    const pid = insertPersonnel("Dr. New PI");
    const created = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "PI is relocating." });
    const res = await decide(created.body.id, "Approved");
    assert.equal(res.status, 200);
    assert.equal(db.prepare("SELECT pi FROM protocols WHERE id = 'TEST-0001'").get().pi, "Dr. New PI");
  });

  test("rejecting does not touch the protocol", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    const created = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "Requested by the lab manager." });
    const res = await decide(created.body.id, "Rejected");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Rejected");
    assert.equal(db.prepare("SELECT pi FROM protocols WHERE id = 'TEST-0001'").get().pi, "Dr. Test");
  });

  test("rejects an invalid status", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    const created = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "X" });
    const res = await decide(created.body.id, "Filed");
    assert.equal(res.status, 400);
  });

  test("rejects deciding an already-decided transfer", async () => {
    insertProtocol();
    const pid = insertPersonnel();
    const created = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .send({ to_personnel_id: pid, reason: "X" });
    await decide(created.body.id, "Rejected");
    const res = await decide(created.body.id, "Approved");
    assert.equal(res.status, 400);
    assert.match(res.body.error, /already been decided/);
  });

  test("404 for an unknown transfer", async () => {
    const res = await decide(9999, "Approved");
    assert.equal(res.status, 404);
  });
});
