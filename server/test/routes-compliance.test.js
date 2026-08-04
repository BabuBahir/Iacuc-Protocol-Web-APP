import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables } from "./helpers.js";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const app = createApp();

async function insertRole(name, isCommittee = false) {
  const role = await request(app)
    .post("/api/admin/roles")
    .send({ name, is_committee: isCommittee });
  return role.body.id;
}

async function insertPerson(name, roleName = "Lab Technician") {
  const roleId = await insertRole(roleName);
  const person = await request(app)
    .post("/api/admin/personnel")
    .send({ name, role_id: roleId });
  return person.body.id;
}

function insertProtocol(overrides = {}) {
  db.prepare(`
    INSERT INTO protocols (id, title, pi, species, status, animals, pain_category)
    VALUES (@id, @title, @pi, @species, @status, @animals, @pain_category)
  `).run({
    id: "TEST-0001",
    title: "Test protocol",
    pi: "Dr. Test",
    species: "Mouse",
    status: "Draft",
    animals: 10,
    pain_category: "Category B",
    ...overrides,
  });
}

function insertRelated(protocolId, label) {
  db.prepare("INSERT INTO related_items (protocol_id, list_name, label) VALUES (?, 'Personnel', ?)")
    .run(protocolId, label);
}

describe("GET /api/personnel/compliance", () => {
  beforeEach(() => resetTables(db));

  test("lists every person with derived compliance status", async () => {
    const a = await insertPerson("Dr. A", "Principal Investigator");
    const b = await insertPerson("Dr. B", "Lab Technician");
    await request(app).post(`/api/personnel/${a}/ohsp`).send({ status: "Cleared" });
    db.prepare(`
      INSERT INTO personnel_training (personnel_id, course, completed_date)
      VALUES (?, ?, ?)
    `).run(a, "Course", "2025-01-01");

    const res = await request(app).get("/api/personnel/compliance");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    const byName = Object.fromEntries(res.body.map(r => [r.name, r]));
    assert.equal(byName["Dr. A"].compliant, true);
    assert.equal(byName["Dr. A"].training_status, "Current");
    assert.equal(byName["Dr. A"].ohsp_status, "Cleared");
    assert.equal(byName["Dr. B"].compliant, false);
    assert.equal(byName["Dr. B"].ohsp_status, "Pending");
  });
});

describe("GET /api/personnel/:id/training", () => {
  beforeEach(() => resetTables(db));

  test("returns the person with their training records and overall status", async () => {
    const id = await insertPerson("Dr. Alice", "Principal Investigator");
    db.prepare(`
      INSERT INTO personnel_training (personnel_id, course, completed_date, expires_date)
      VALUES (?, ?, ?, ?)
    `).run(id, "Working with the IACUC", "2025-01-15", "2028-01-15");

    const res = await request(app).get(`/api/personnel/${id}/training`);
    assert.equal(res.status, 200);
    assert.equal(res.body.personnel.name, "Dr. Alice");
    assert.equal(res.body.overall_status, "Current");
    assert.equal(res.body.courses.length, 1);
    assert.equal(res.body.courses[0].status, "Current");
  });

  test("marks a record with a past expiry as Expired and the overall status as Expired", async () => {
    const id = await insertPerson("Dr. Bob");
    db.prepare(`
      INSERT INTO personnel_training (personnel_id, course, completed_date, expires_date)
      VALUES (?, ?, ?, ?)
    `).run(id, "Old Course", "2021-01-01", "2022-01-01");

    const res = await request(app).get(`/api/personnel/${id}/training`);
    assert.equal(res.body.overall_status, "Expired");
    assert.equal(res.body.courses[0].status, "Expired");
  });

  test("treats a record with no expiry as current forever", async () => {
    const id = await insertPerson("Dr. Carol");
    db.prepare(`
      INSERT INTO personnel_training (personnel_id, course, completed_date)
      VALUES (?, ?, ?)
    `).run(id, "Refinement Course", "2025-01-15");

    const res = await request(app).get(`/api/personnel/${id}/training`);
    assert.equal(res.body.overall_status, "Current");
    assert.equal(res.body.courses[0].status, "Current");
  });

  test("returns No records when the person has no training", async () => {
    const id = await insertPerson("Dr. Dave");
    const res = await request(app).get(`/api/personnel/${id}/training`);
    assert.equal(res.body.overall_status, "No records");
    assert.deepEqual(res.body.courses, []);
  });

  test("404s for an unknown person", async () => {
    const res = await request(app).get("/api/personnel/9999/training");
    assert.equal(res.status, 404);
  });
});

describe("POST /api/personnel/:id/training", () => {
  beforeEach(() => resetTables(db));

  test("adds a training record and derives its status", async () => {
    const id = await insertPerson("Dr. Eve");
    const res = await request(app)
      .post(`/api/personnel/${id}/training`)
      .send({ course: "Rodent Surgery", completed_date: "2025-02-01", expires_date: "2028-02-01" });
    assert.equal(res.status, 201);
    assert.equal(res.body.course, "Rodent Surgery");
    assert.equal(res.body.status, "Current");

    const list = await request(app).get(`/api/personnel/${id}/training`);
    assert.equal(list.body.overall_status, "Current");
  });

  test("400s when course or completed_date is missing", async () => {
    const id = await insertPerson("Dr. Frank");
    const noCourse = await request(app).post(`/api/personnel/${id}/training`).send({ completed_date: "2025-01-01" });
    assert.equal(noCourse.status, 400);

    const noDate = await request(app).post(`/api/personnel/${id}/training`).send({ course: "Course" });
    assert.equal(noDate.status, 400);
  });

  test("404s for an unknown person", async () => {
    const res = await request(app).post("/api/personnel/9999/training").send({ course: "Course", completed_date: "2025-01-01" });
    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/personnel/:id/training/:trainingId", () => {
  beforeEach(() => resetTables(db));

  test("updates a training record, e.g. extending an expiry", async () => {
    const id = await insertPerson("Dr. Grace");
    const created = await request(app)
      .post(`/api/personnel/${id}/training`)
      .send({ course: "Old Course", completed_date: "2021-01-01", expires_date: "2022-01-01" });

    const res = await request(app)
      .patch(`/api/personnel/${id}/training/${created.body.id}`)
      .send({ expires_date: "2028-01-01" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Current");

    const list = await request(app).get(`/api/personnel/${id}/training`);
    assert.equal(list.body.overall_status, "Current");
  });

  test("404s for a record that belongs to another person or doesn't exist", async () => {
    const other = await insertPerson("Dr. Other");
    const created = await request(app)
      .post(`/api/personnel/${other}/training`)
      .send({ course: "Course", completed_date: "2025-01-01" });

    const wrongOwner = await request(app).patch(`/api/personnel/9999/training/${created.body.id}`).send({ course: "X" });
    assert.equal(wrongOwner.status, 404);

    const missing = await request(app).patch(`/api/personnel/${other}/training/9999`).send({ course: "X" });
    assert.equal(missing.status, 404);
  });

  test("400s when a patch would empty the course name", async () => {
    const id = await insertPerson("Dr. Hank");
    const created = await request(app)
      .post(`/api/personnel/${id}/training`)
      .send({ course: "Course", completed_date: "2025-01-01" });
    const res = await request(app)
      .patch(`/api/personnel/${id}/training/${created.body.id}`)
      .send({ course: "   " });
    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/personnel/:id/training/:trainingId", () => {
  beforeEach(() => resetTables(db));

  test("removes a training record", async () => {
    const id = await insertPerson("Dr. Iris");
    const created = await request(app)
      .post(`/api/personnel/${id}/training`)
      .send({ course: "Course", completed_date: "2025-01-01" });

    const res = await request(app).delete(`/api/personnel/${id}/training/${created.body.id}`);
    assert.equal(res.status, 204);

    const list = await request(app).get(`/api/personnel/${id}/training`);
    assert.deepEqual(list.body.courses, []);
  });

  test("404s for an unknown record", async () => {
    const id = await insertPerson("Dr. Joe");
    const res = await request(app).delete(`/api/personnel/${id}/training/9999`);
    assert.equal(res.status, 404);
  });
});

describe("OHSP clearance", () => {
  beforeEach(() => resetTables(db));

  test("GET returns Pending by default when no clearance is on file", async () => {
    const id = await insertPerson("Dr. Kim");
    const res = await request(app).get(`/api/personnel/${id}/ohsp`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Pending");
    assert.equal(res.body.reviewed_date, null);
  });

  test("POST upserts clearance status", async () => {
    const id = await insertPerson("Dr. Leo");
    const res = await request(app)
      .post(`/api/personnel/${id}/ohsp`)
      .send({ status: "Cleared", reviewed_date: "2026-01-10", notes: "All clear." });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Cleared");

    const updated = await request(app)
      .post(`/api/personnel/${id}/ohsp`)
      .send({ status: "Denied", notes: "Re-evaluate" });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, "Denied");
    assert.equal(updated.body.notes, "Re-evaluate");
  });

  test("400s for an invalid status", async () => {
    const id = await insertPerson("Dr. Mia");
    const res = await request(app)
      .post(`/api/personnel/${id}/ohsp`)
      .send({ status: "Nope" });
    assert.equal(res.status, 400);
  });

  test("404s for an unknown person", async () => {
    const res = await request(app).get("/api/personnel/9999/ohsp");
    assert.equal(res.status, 404);
  });
});

describe("GET /api/protocols/:id/personnel", () => {
  beforeEach(() => resetTables(db));

  test("computes per-person compliance and the all_compliant flag", async () => {
    const compliant = await insertPerson("Dr. Compliant");
    db.prepare(`
      INSERT INTO personnel_training (personnel_id, course, completed_date, expires_date)
      VALUES (?, ?, ?, ?)
    `).run(compliant, "Course", "2025-01-01", "2028-01-01");
    await request(app).post(`/api/personnel/${compliant}/ohsp`).send({ status: "Cleared" });

    const missing = await insertPerson("Dr. Missing");

    insertProtocol();
    insertRelated("TEST-0001", "Dr. Compliant — PI");
    insertRelated("TEST-0001", "Dr. Missing — Co-I");

    const res = await request(app).get("/api/protocols/TEST-0001/personnel");
    assert.equal(res.status, 200);
    assert.equal(res.body.personnel.length, 2);
    assert.equal(res.body.personnel[0].compliance.compliant, true);
    assert.equal(res.body.personnel[0].compliance.training_status, "Current");
    assert.equal(res.body.personnel[0].compliance.ohsp_status, "Cleared");
    assert.equal(res.body.personnel[1].compliance.compliant, false);
    assert.equal(res.body.all_compliant, false);
  });

  test("all_compliant is true only when every listed person is compliant", async () => {
    const a = await insertPerson("Dr. A");
    await request(app).post(`/api/personnel/${a}/ohsp`).send({ status: "Cleared" });
    db.prepare(`
      INSERT INTO personnel_training (personnel_id, course, completed_date)
      VALUES (?, ?, ?)
    `).run(a, "Course", "2025-01-01");

    insertProtocol();
    insertRelated("TEST-0001", "Dr. A — PI");
    insertRelated("TEST-0001", "Someone not in the directory — Vet");

    const res = await request(app).get("/api/protocols/TEST-0001/personnel");
    assert.equal(res.body.all_compliant, false);
    assert.equal(res.body.personnel[1].compliance.compliant, false);
    assert.equal(res.body.personnel[1].compliance.training_status, "No profile");
  });

  test("all_compliant is true when every listed person is compliant", async () => {
    const a = await insertPerson("Dr. A");
    await request(app).post(`/api/personnel/${a}/ohsp`).send({ status: "Cleared" });
    db.prepare(`
      INSERT INTO personnel_training (personnel_id, course, completed_date)
      VALUES (?, ?, ?)
    `).run(a, "Course", "2025-01-01");

    insertProtocol();
    insertRelated("TEST-0001", "Dr. A — PI");

    const res = await request(app).get("/api/protocols/TEST-0001/personnel");
    assert.equal(res.body.all_compliant, true);
  });

  test("404s for an unknown protocol", async () => {
    const res = await request(app).get("/api/protocols/NOPE/personnel");
    assert.equal(res.status, 404);
  });
});
