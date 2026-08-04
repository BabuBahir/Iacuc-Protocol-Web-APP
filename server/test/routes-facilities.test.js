import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables } from "./helpers.js";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const app = createApp();

async function insertFacility(overrides = {}) {
  const res = await request(app)
    .post("/api/facilities")
    .send({ name: "Vivarium Room 1", type: "Housing Room", ...overrides });
  return res.body;
}

describe("GET /api/facilities", () => {
  beforeEach(() => resetTables(db));

  test("returns facilities sorted by name", async () => {
    await insertFacility({ name: "Beta Lab", type: "Lab" });
    await insertFacility({ name: "Alpha Suite", type: "Surgical Suite" });

    const res = await request(app).get("/api/facilities");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(f => f.name), ["Alpha Suite", "Beta Lab"]);
  });
});

describe("POST /api/facilities", () => {
  beforeEach(() => resetTables(db));

  test("creates a facility", async () => {
    const res = await request(app)
      .post("/api/facilities")
      .send({ name: "Aquatics", type: "Housing Room", species: "Zebrafish" });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, "Aquatics");
    assert.equal(res.body.type, "Housing Room");
    assert.equal(res.body.species, "Zebrafish");
    assert.ok(res.body.id);
  });

  test("rejects a missing name", async () => {
    const res = await request(app).post("/api/facilities").send({ type: "Lab" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /name is required/);
  });

  test("rejects an invalid type", async () => {
    const res = await request(app).post("/api/facilities").send({ name: "X", type: "Basement" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /type must be one of/);
  });
});

describe("DELETE /api/facilities/:id", () => {
  beforeEach(() => resetTables(db));

  test("deletes a facility and cascades its inspections", async () => {
    const facility = await insertFacility();
    const insp = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-02-10", result: "Pass" });
    assert.equal(insp.status, 201);

    const del = await request(app).delete(`/api/facilities/${facility.id}`);
    assert.equal(del.status, 204);
    const list = await request(app).get("/api/inspections");
    assert.equal(list.body.length, 0);
  });

  test("404s for an unknown facility", async () => {
    const res = await request(app).delete("/api/facilities/9999");
    assert.equal(res.status, 404);
  });
});

describe("GET /api/inspections", () => {
  beforeEach(() => resetTables(db));

  test("returns inspections with facility names, most recent first", async () => {
    const facility = await insertFacility({ name: "Surgical Suite A" });
    await request(app).post("/api/inspections").send({ facility_id: facility.id, inspection_date: "2026-01-15" });
    await request(app).post("/api/inspections").send({ facility_id: facility.id, inspection_date: "2026-07-15" });

    const res = await request(app).get("/api/inspections");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].inspection_date, "2026-07-15");
    assert.equal(res.body[0].facility_name, "Surgical Suite A");
  });
});

describe("POST /api/inspections", () => {
  beforeEach(() => resetTables(db));

  test("creates an inspection defaulting to Pending", async () => {
    const facility = await insertFacility();
    const res = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-05-20", report: "Walkthrough done." });
    assert.equal(res.status, 201);
    assert.equal(res.body.result, "Pending");
    assert.deepEqual(res.body.deficiencies, []);
  });

  test("rejects missing fields", async () => {
    const res = await request(app).post("/api/inspections").send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /facility_id and inspection_date are required/);
  });

  test("rejects an unknown facility", async () => {
    const res = await request(app)
      .post("/api/inspections")
      .send({ facility_id: 9999, inspection_date: "2026-05-20" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Unknown facility_id/);
  });

  test("rejects an invalid result enum", async () => {
    const facility = await insertFacility();
    const res = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-05-20", result: "Nope" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /result must be one of/);
  });
});

describe("GET /api/inspections/:id", () => {
  beforeEach(() => resetTables(db));

  test("returns the inspection with its deficiencies", async () => {
    const facility = await insertFacility();
    const insp = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-03-15", result: "Re-inspection required" });
    await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Major", description: "Autoclave indicator overdue.", remediation_deadline: "2026-04-15" });
    await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Minor", description: "Glove box needs restock." });

    const res = await request(app).get(`/api/inspections/${insp.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.deficiencies.length, 2);
    assert.equal(res.body.deficiencies[0].severity, "Major");
    assert.equal(res.body.facility_name, "Vivarium Room 1");
  });

  test("404s for an unknown inspection", async () => {
    const res = await request(app).get("/api/inspections/9999");
    assert.equal(res.status, 404);
  });
});

describe("GET /api/inspections/:id/deficiencies", () => {
  beforeEach(() => resetTables(db));

  test("returns the deficiency set, Major first", async () => {
    const facility = await insertFacility();
    const insp = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-03-15" });
    await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Minor", description: "Glove box." });
    await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Major", description: "Autoclave." });

    const res = await request(app).get(`/api/inspections/${insp.body.id}/deficiencies`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].severity, "Major");
  });

  test("404s for an unknown inspection", async () => {
    const res = await request(app).get("/api/inspections/9999/deficiencies");
    assert.equal(res.status, 404);
  });
});

describe("POST /api/inspections/:id/deficiencies", () => {
  beforeEach(() => resetTables(db));

  test("creates a deficiency", async () => {
    const facility = await insertFacility();
    const insp = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-03-15" });

    const res = await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Minor", description: "Fume hood label illegible.", remediation_deadline: "2026-06-15" });
    assert.equal(res.status, 201);
    assert.equal(res.body.severity, "Minor");
    assert.equal(res.body.remediation_deadline, "2026-06-15");
  });

  test("rejects an invalid severity", async () => {
    const facility = await insertFacility();
    const insp = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-03-15" });

    const res = await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Critical", description: "X" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /severity must be one of/);
  });

  test("rejects a missing description", async () => {
    const facility = await insertFacility();
    const insp = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-03-15" });

    const res = await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Minor" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /description is required/);
  });

  test("404s when the inspection does not exist", async () => {
    const res = await request(app)
      .post("/api/inspections/9999/deficiencies")
      .send({ severity: "Minor", description: "X" });
    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/inspections/:id/deficiencies/:defId", () => {
  beforeEach(() => resetTables(db));

  test("marks a deficiency remediated", async () => {
    const facility = await insertFacility();
    const insp = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-03-15" });
    const def = await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Major", description: "Autoclave indicator overdue." });

    const res = await request(app).patch(`/api/inspections/${insp.body.id}/deficiencies/${def.body.id}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.remediated_at);
  });

  test("rejects remediating an already-remediated deficiency", async () => {
    const facility = await insertFacility();
    const insp = await request(app)
      .post("/api/inspections")
      .send({ facility_id: facility.id, inspection_date: "2026-03-15" });
    const def = await request(app)
      .post(`/api/inspections/${insp.body.id}/deficiencies`)
      .send({ severity: "Minor", description: "X" });
    await request(app).patch(`/api/inspections/${insp.body.id}/deficiencies/${def.body.id}`);

    const res = await request(app).patch(`/api/inspections/${insp.body.id}/deficiencies/${def.body.id}`);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /already remediated/);
  });

  test("404s for a deficiency belonging to another inspection", async () => {
    const facility = await insertFacility();
    const a = await request(app).post("/api/inspections").send({ facility_id: facility.id, inspection_date: "2026-01-01" });
    const b = await request(app).post("/api/inspections").send({ facility_id: facility.id, inspection_date: "2026-07-01" });
    const def = await request(app)
      .post(`/api/inspections/${a.body.id}/deficiencies`)
      .send({ severity: "Minor", description: "X" });

    const res = await request(app).patch(`/api/inspections/${b.body.id}/deficiencies/${def.body.id}`);
    assert.equal(res.status, 404);
  });
});
