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
    status: "Approved",
    animals: 10,
    pain_category: "Category B",
    ...overrides,
  });
}

async function insertPersonnel(name, roleName) {
  let roleId = db.prepare("SELECT id FROM roles WHERE name = ?").get(roleName)?.id;
  if (!roleId) {
    await request(app).post("/api/admin/roles").send({ name: roleName, is_committee: 0 });
    roleId = db.prepare("SELECT id FROM roles WHERE name = ?").get(roleName).id;
  }
  const person = await request(app).post("/api/admin/personnel").send({ name, role_id: roleId });
  return person.body.id;
}

async function insertIncident(overrides = {}) {
  insertProtocol();
  const res = await request(app)
    .post("/api/incidents")
    .send({ protocol_id: "TEST-0001", type: "Deviation", description: "Analgesia logged late.", ...overrides });
  return res.body;
}

describe("GET /api/incidents", () => {
  beforeEach(() => resetTables(db));

  test("returns incidents most recent first with reporter/assignee names", async () => {
    const reporter = await insertPersonnel("Dr. Reporter", "Attending Veterinarian");
    await request(app).post("/api/incidents").send({
      type: "Adverse Event",
      description: "First event",
      reported_by: reporter,
      created_at: "2026-07-01",
    });
    await request(app).post("/api/incidents").send({
      type: "Deviation",
      description: "Second event",
      created_at: "2026-07-10",
    });

    const res = await request(app).get("/api/incidents");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].description, "Second event");
    assert.equal(res.body[1].reported_by_name, "Dr. Reporter");
    assert.equal(res.body[1].status, "Open");
  });
});

describe("POST /api/incidents", () => {
  beforeEach(() => resetTables(db));

  test("creates an incident with the defaults applied", async () => {
    insertProtocol();
    const reporter = await insertPersonnel("Dr. Reporter", "Attending Veterinarian");
    const res = await request(app)
      .post("/api/incidents")
      .send({ protocol_id: "TEST-0001", type: "Noncompliance", description: "Bedding change skipped.", severity: "Immediate", reported_by: reporter });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "Open");
    assert.equal(res.body.severity, "Immediate");
    assert.equal(res.body.reported_by_name, "Dr. Reporter");
  });

  test("rejects an invalid type", async () => {
    const res = await request(app).post("/api/incidents").send({ type: "Oops", description: "X" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /type must be one of/);
  });

  test("rejects an invalid severity", async () => {
    const res = await request(app).post("/api/incidents").send({ type: "Deviation", description: "X", severity: "Critical" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /severity must be one of/);
  });

  test("rejects a missing description", async () => {
    const res = await request(app).post("/api/incidents").send({ type: "Deviation" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /description is required/);
  });

  test("rejects an unknown protocol", async () => {
    const res = await request(app).post("/api/incidents").send({ protocol_id: "NOPE", type: "Deviation", description: "X" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Unknown protocol_id/);
  });

  test("rejects an unknown reporter", async () => {
    const res = await request(app).post("/api/incidents").send({ type: "Deviation", description: "X", reported_by: 9999 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Unknown reported_by/);
  });

  test("rejects an unknown assignee", async () => {
    const res = await request(app).post("/api/incidents").send({ type: "Deviation", description: "X", assigned_to: 9999 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Unknown assigned_to/);
  });
});

describe("GET /api/incidents/:id", () => {
  beforeEach(() => resetTables(db));

  test("returns a single incident", async () => {
    const incident = await insertIncident();
    const res = await request(app).get(`/api/incidents/${incident.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, incident.id);
    assert.equal(res.body.protocol_id, "TEST-0001");
  });

  test("404s for an unknown incident", async () => {
    const res = await request(app).get("/api/incidents/9999");
    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/incidents/:id — lifecycle", () => {
  beforeEach(() => resetTables(db));

  test("recording a CAPA on an Open incident moves it to CAPA", async () => {
    const incident = await insertIncident();
    const res = await request(app)
      .patch(`/api/incidents/${incident.id}`)
      .send({ corrective_action: "Reduce restraint time." });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "CAPA");
    assert.equal(res.body.corrective_action, "Reduce restraint time.");
  });

  test("an incident cannot be closed without a CAPA", async () => {
    const incident = await insertIncident();
    const res = await request(app).patch(`/api/incidents/${incident.id}`).send({ status: "Closed" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /corrective action .* must be recorded/);
  });

  test("closing an incident with a CAPA sets closed_at", async () => {
    const incident = await insertIncident();
    const res = await request(app)
      .patch(`/api/incidents/${incident.id}`)
      .send({ corrective_action: "Retrained the team.", status: "Closed" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Closed");
    assert.ok(res.body.closed_at);
  });

  test("an already-closed incident can update its CAPA without reopening", async () => {
    const incident = await insertIncident();
    await request(app).patch(`/api/incidents/${incident.id}`).send({ corrective_action: "A", status: "Closed" });
    const res = await request(app).patch(`/api/incidents/${incident.id}`).send({ corrective_action: "B" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Closed");
    assert.equal(res.body.corrective_action, "B");
  });

  test("reassigns the assignee", async () => {
    const incident = await insertIncident();
    const assignee = await insertPersonnel("Dr. Assignee", "IACUC Chair");
    const res = await request(app).patch(`/api/incidents/${incident.id}`).send({ assigned_to: assignee });
    assert.equal(res.status, 200);
    assert.equal(res.body.assigned_to, assignee);
    assert.equal(res.body.assigned_to_name, "Dr. Assignee");
  });

  test("rejects an invalid status", async () => {
    const incident = await insertIncident();
    const res = await request(app).patch(`/api/incidents/${incident.id}`).send({ status: "Resolved" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /status must be one of/);
  });

  test("rejects an unknown assignee", async () => {
    const incident = await insertIncident();
    const res = await request(app).patch(`/api/incidents/${incident.id}`).send({ assigned_to: 9999 });
    assert.equal(res.status, 400);
  });

  test("404s for an unknown incident", async () => {
    const res = await request(app).patch("/api/incidents/9999").send({ status: "Closed" });
    assert.equal(res.status, 404);
  });
});

describe("PAM audits (per protocol)", () => {
  beforeEach(() => resetTables(db));

  test("GET returns audits most recent first with auditor names", async () => {
    insertProtocol();
    const auditor = await insertPersonnel("Dr. Auditor", "IACUC Chair");
    await request(app).post("/api/protocols/TEST-0001/pam-audits").send({
      audit_date: "2026-06-30", auditor_id: auditor, site_visits: "Suite A", findings: "Clean.", report: "Compliant.",
    });
    await request(app).post("/api/protocols/TEST-0001/pam-audits").send({
      audit_date: "2026-07-20", auditor_id: auditor, findings: "Second audit.",
    });

    const res = await request(app).get("/api/protocols/TEST-0001/pam-audits");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].audit_date, "2026-07-20");
    assert.equal(res.body[1].auditor_name, "Dr. Auditor");
  });

  test("POST requires audit_date", async () => {
    insertProtocol();
    const res = await request(app).post("/api/protocols/TEST-0001/pam-audits").send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /audit_date is required/);
  });

  test("POST rejects an unknown auditor", async () => {
    insertProtocol();
    const res = await request(app).post("/api/protocols/TEST-0001/pam-audits").send({ audit_date: "2026-07-01", auditor_id: 9999 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Unknown auditor_id/);
  });

  test("404s for an unknown protocol", async () => {
    const res = await request(app).get("/api/protocols/NOPE/pam-audits");
    assert.equal(res.status, 404);
  });

  test("GET /api/pam-audits lists audits across protocols", async () => {
    insertProtocol();
    const auditor = await insertPersonnel("Dr. Auditor", "IACUC Chair");
    await request(app).post("/api/protocols/TEST-0001/pam-audits").send({
      audit_date: "2026-06-30", auditor_id: auditor, findings: "First.",
    });
    await request(app).post("/api/protocols/TEST-0001/pam-audits").send({
      audit_date: "2026-07-20", findings: "Second.",
    });

    const res = await request(app).get("/api/pam-audits");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].audit_date, "2026-07-20");
    assert.equal(res.body[0].protocol_id, "TEST-0001");
    assert.equal(res.body[1].auditor_name, "Dr. Auditor");
  });
});
