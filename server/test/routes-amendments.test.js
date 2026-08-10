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

async function startAmendment(reason = "Add a strain.") {
  const res = await request(app).post("/api/protocols/TEST-0001/amendments").send({ reason });
  assert.equal(res.status, 201);
  return res.body;
}

// Deciding an amendment/renewal is an IACUC-office action (gated).
const decide = (url, body) =>
  request(app).patch(url).set("X-Actor", OFFICE_ACTOR).send(body);

describe("amendments — listing & creation", () => {
  beforeEach(() => resetTables(db));

  test("GET returns amendments with their changes, most recent first", async () => {
    insertProtocol();
    const am = await startAmendment();
    await request(app)
      .post(`/api/protocols/TEST-0001/amendments/${am.id}/changes`)
      .send({ section: "animal_use", field: "species_strain", previous_value: "A", new_value: "B" });

    const res = await request(app).get("/api/protocols/TEST-0001/amendments");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].changes.length, 1);
    assert.equal(res.body[0].changes[0].section, "animal_use");
    assert.equal(res.body[0].status, "Pending");
  });

  test("POST requires a reason for change", async () => {
    insertProtocol();
    const res = await request(app).post("/api/protocols/TEST-0001/amendments").send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /reason for change is required/);
  });

  test("POST rejects a second in-flight amendment with 409", async () => {
    insertProtocol();
    await startAmendment();
    const res = await request(app).post("/api/protocols/TEST-0001/amendments").send({ reason: "Another change." });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /one amendment can be in flight/);
  });

  test("POST 404s for an unknown protocol", async () => {
    const res = await request(app).post("/api/protocols/NOPE/amendments").send({ reason: "X" });
    assert.equal(res.status, 404);
  });
});

describe("amendments — changes", () => {
  beforeEach(() => {
    resetTables(db);
    seedOfficeActor(db); // the "change after decision" guard needs a decided (office-gated) amendment
  });

  test("records a field-level change on a pending amendment", async () => {
    insertProtocol();
    const am = await startAmendment();
    const res = await request(app)
      .post(`/api/protocols/TEST-0001/amendments/${am.id}/changes`)
      .send({ section: "drugs", field: "dose", previous_value: "10 mg/kg", new_value: "5 mg/kg" });
    assert.equal(res.status, 201);
    assert.equal(res.body.previous_value, "10 mg/kg");
  });

  test("rejects a change with missing section or field", async () => {
    insertProtocol();
    const am = await startAmendment();
    const res = await request(app)
      .post(`/api/protocols/TEST-0001/amendments/${am.id}/changes`)
      .send({ section: "drugs" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /section and field are required/);
  });

  test("rejects a change once the amendment is decided", async () => {
    insertProtocol();
    const am = await startAmendment();
    await decide(`/api/protocols/TEST-0001/amendments/${am.id}`, { status: "Approved", expiration_date: "2027-01-01" });

    const res = await request(app)
      .post(`/api/protocols/TEST-0001/amendments/${am.id}/changes`)
      .send({ section: "drugs", field: "dose" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Only a pending amendment/);
  });

  test("404s for an amendment on the wrong protocol", async () => {
    insertProtocol();
    const am = await startAmendment();
    db.prepare("INSERT INTO protocols (id, title, pi, species, status) VALUES ('OTHER', 'Other', 'Dr. X', 'Mouse', 'Active')").run();
    const res = await request(app)
      .post(`/api/protocols/OTHER/amendments/${am.id}/changes`)
      .send({ section: "drugs", field: "dose" });
    assert.equal(res.status, 404);
  });
});

describe("GET /api/protocols/:id/amendments/:amendmentId", () => {
  beforeEach(() => resetTables(db));

  test("returns a single amendment with its changes", async () => {
    insertProtocol();
    const am = await startAmendment();
    await request(app)
      .post(`/api/protocols/TEST-0001/amendments/${am.id}/changes`)
      .send({ section: "drugs", field: "dose", previous_value: "10", new_value: "5" });

    const res = await request(app).get(`/api/protocols/TEST-0001/amendments/${am.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.reason, "Add a strain.");
    assert.equal(res.body.changes.length, 1);
  });

  test("404s for an unknown amendment", async () => {
    insertProtocol();
    const res = await request(app).get("/api/protocols/TEST-0001/amendments/9999");
    assert.equal(res.status, 404);
  });
});

describe("amendments — decision", () => {
  beforeEach(() => {
    resetTables(db);
    seedOfficeActor(db); // approving/rejecting an amendment is an office action (gated)
  });

  test("approving creates a new protocol version and updates expiration", async () => {
    insertProtocol();
    const am = await startAmendment();
    const res = await decide(`/api/protocols/TEST-0001/amendments/${am.id}`, { status: "Approved", expiration_date: "2029-07-01" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Approved");

    const versions = await request(app).get("/api/protocols/TEST-0001/versions");
    assert.equal(versions.body.length, 1);
    assert.equal(versions.body[0].version_number, "0001");
    assert.equal(versions.body[0].source, "Amendment Document");
    assert.equal(versions.body[0].expiration_date, "2029-07-01");
    assert.equal(db.prepare("SELECT expires FROM protocols WHERE id = 'TEST-0001'").get().expires, "2029-07-01");
  });

  test("approving without an explicit expiration defaults to +365 days", async () => {
    insertProtocol();
    const am = await startAmendment();
    await decide(`/api/protocols/TEST-0001/amendments/${am.id}`, { status: "Approved" });
    const versions = await request(app).get("/api/protocols/TEST-0001/versions");
    assert.equal(versions.body.length, 1);
    const exp = new Date(versions.body[0].expiration_date);
    const now = new Date();
    const delta = Math.round((exp - now) / (24 * 3600 * 1000));
    assert.ok(delta >= 364 && delta <= 366, `expected ~365 days out, got ${delta}`);
  });

  test("version numbers increment for consecutive approvals", async () => {
    insertProtocol();
    const first = await startAmendment("First.");
    await decide(`/api/protocols/TEST-0001/amendments/${first.id}`, { status: "Approved", expiration_date: "2027-01-01" });
    const second = await startAmendment("Second.");
    await decide(`/api/protocols/TEST-0001/amendments/${second.id}`, { status: "Approved", expiration_date: "2027-01-01" });

    const versions = await request(app).get("/api/protocols/TEST-0001/versions");
    assert.deepEqual(versions.body.map(v => v.version_number), ["0002", "0001"]);
  });

  test("rejecting an amendment does not create a version", async () => {
    insertProtocol();
    const am = await startAmendment();
    await decide(`/api/protocols/TEST-0001/amendments/${am.id}`, { status: "Rejected" });

    const versions = await request(app).get("/api/protocols/TEST-0001/versions");
    assert.equal(versions.body.length, 0);
    assert.equal(db.prepare("SELECT expires FROM protocols WHERE id = 'TEST-0001'").get().expires, null);
  });

  test("rejects an invalid status", async () => {
    insertProtocol();
    const am = await startAmendment();
    const res = await decide(`/api/protocols/TEST-0001/amendments/${am.id}`, { status: "Filed" });
    assert.equal(res.status, 400);
  });

  test("rejects deciding an already-decided amendment", async () => {
    insertProtocol();
    const am = await startAmendment();
    await decide(`/api/protocols/TEST-0001/amendments/${am.id}`, { status: "Rejected" });
    const res = await decide(`/api/protocols/TEST-0001/amendments/${am.id}`, { status: "Approved" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /already been decided/);
  });
});

describe("renewals", () => {
  beforeEach(() => {
    resetTables(db);
    seedOfficeActor(db); // approving/rejecting a renewal is an office action (gated)
  });

  test("GET and POST a continuing review", async () => {
    insertProtocol();
    const created = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "Pending");

    const res = await request(app).get("/api/protocols/TEST-0001/renewals");
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].type, "Continuing Review");
  });

  test("POST rejects an invalid type", async () => {
    insertProtocol();
    const res = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Extension" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /type must be one of/);
  });

  test("POST rejects a second in-flight renewal with 409", async () => {
    insertProtocol();
    await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    const res = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "De Novo Review" });
    assert.equal(res.status, 409);
  });

  test("approving requires approved_until", async () => {
    insertProtocol();
    const renewal = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    const res = await decide(`/api/protocols/TEST-0001/renewals/${renewal.body.id}`, { status: "Approved" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /approved_until is required/);
  });

  test("approving a continuing review creates a version and updates expiration", async () => {
    insertProtocol();
    const renewal = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    const res = await decide(`/api/protocols/TEST-0001/renewals/${renewal.body.id}`, { status: "Approved", approved_until: "2029-09-01" });
    assert.equal(res.status, 200);
    assert.equal(res.body.approved_until, "2029-09-01");

    const versions = await request(app).get("/api/protocols/TEST-0001/versions");
    assert.equal(versions.body[0].source, "Amendment Document");
    assert.equal(versions.body[0].expiration_date, "2029-09-01");
    assert.equal(db.prepare("SELECT expires FROM protocols WHERE id = 'TEST-0001'").get().expires, "2029-09-01");
  });

  test("approving a de novo review is recorded with the De Novo source", async () => {
    insertProtocol();
    const renewal = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "De Novo Review" });
    await decide(`/api/protocols/TEST-0001/renewals/${renewal.body.id}`, { status: "Approved", approved_until: "2029-09-01" });
    const versions = await request(app).get("/api/protocols/TEST-0001/versions");
    assert.equal(versions.body[0].source, "De Novo Document");
  });

  test("rejecting a renewal does not create a version", async () => {
    insertProtocol();
    const renewal = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    await decide(`/api/protocols/TEST-0001/renewals/${renewal.body.id}`, { status: "Rejected" });
    const versions = await request(app).get("/api/protocols/TEST-0001/versions");
    assert.equal(versions.body.length, 0);
  });

  test("rejects an invalid renewal status", async () => {
    insertProtocol();
    const renewal = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    const res = await decide(`/api/protocols/TEST-0001/renewals/${renewal.body.id}`, { status: "Filed" });
    assert.equal(res.status, 400);
  });

  test("rejects deciding an already-decided renewal", async () => {
    insertProtocol();
    const renewal = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    await decide(`/api/protocols/TEST-0001/renewals/${renewal.body.id}`, { status: "Rejected" });
    const res = await decide(`/api/protocols/TEST-0001/renewals/${renewal.body.id}`, { status: "Approved", approved_until: "2029-09-01" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /already been decided/);
  });

  test("404s for a renewal on the wrong protocol", async () => {
    insertProtocol();
    const renewal = await request(app).post("/api/protocols/TEST-0001/renewals").send({ type: "Continuing Review" });
    const res = await decide(`/api/protocols/OTHER/renewals/${renewal.body.id}`, { status: "Rejected" });
    assert.equal(res.status, 404);
  });
});

describe("protocol versions", () => {
  beforeEach(() => resetTables(db));

  test("GET returns the version lineage newest first", async () => {
    insertProtocol();
    db.prepare(`
      INSERT INTO protocol_versions (protocol_id, version_number, source, approved_date, expiration_date, version_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("TEST-0001", "0001", "New Document", "2026-06-01", "2029-06-01", "2026-06-01");
    db.prepare(`
      INSERT INTO protocol_versions (protocol_id, version_number, source, approved_date, expiration_date, version_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("TEST-0001", "0002", "Amendment Document", "2026-07-01", "2029-06-01", "2026-07-01");

    const res = await request(app).get("/api/protocols/TEST-0001/versions");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(v => v.version_number), ["0002", "0001"]);
  });

  test("404s for an unknown protocol", async () => {
    const res = await request(app).get("/api/protocols/NOPE/versions");
    assert.equal(res.status, 404);
  });
});
