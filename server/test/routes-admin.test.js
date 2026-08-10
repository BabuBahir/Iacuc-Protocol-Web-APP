import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables, OFFICE_ACTOR, seedOfficeActor, insertPersonnelDirect } from "./helpers.js";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const app = createApp();

// Every write to the admin lookups now requires acting as an IACUC office
// persona (see server/src/access.js). Seed the conventional office fixture and
// attach its X-Actor header to each write so the tests exercise the
// authorized path; the gate itself is covered in routes-access.test.js.
const post = (url) => request(app).post(url).set("X-Actor", OFFICE_ACTOR);
const delReq = (url) => request(app).delete(url).set("X-Actor", OFFICE_ACTOR);

describe("species", () => {
  beforeEach(() => { resetTables(db); seedOfficeActor(db); });

  test("creates and lists species", async () => {
    const create = await post("/api/admin/species").send({ name: "Ferret" });
    assert.equal(create.status, 201);

    const list = await request(app).get("/api/admin/species");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].name, "Ferret");
  });

  test("rejects an empty name", async () => {
    const res = await post("/api/admin/species").send({ name: "  " });
    assert.equal(res.status, 400);
  });

  test("rejects a missing name field entirely", async () => {
    const res = await post("/api/admin/species").send({});
    assert.equal(res.status, 400);
  });

  test("rejects a duplicate species (unique constraint)", async () => {
    await post("/api/admin/species").send({ name: "Ferret" });
    const res = await post("/api/admin/species").send({ name: "Ferret" });
    assert.equal(res.status, 409);
  });

  test("deletes a species", async () => {
    const create = await post("/api/admin/species").send({ name: "Ferret" });
    const del = await delReq(`/api/admin/species/${create.body.id}`);
    assert.equal(del.status, 204);
  });

  test("404s deleting an unknown species", async () => {
    const res = await delReq("/api/admin/species/9999");
    assert.equal(res.status, 404);
  });
});

describe("roles", () => {
  beforeEach(() => { resetTables(db); seedOfficeActor(db); });

  test("creates a role with is_committee flag", async () => {
    const res = await post("/api/admin/roles")
      .send({ name: "IACUC Chair", is_committee: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.is_committee, 1);
  });

  test("defaults is_committee to 0 when omitted", async () => {
    const res = await post("/api/admin/roles").send({ name: "Lab Technician" });
    assert.equal(res.body.is_committee, 0);
  });

  test("rejects a missing role name", async () => {
    const res = await post("/api/admin/roles").send({});
    assert.equal(res.status, 400);
  });

  test("rejects a duplicate role name (unique constraint)", async () => {
    await post("/api/admin/roles").send({ name: "Duplicate Role" });
    const res = await post("/api/admin/roles").send({ name: "Duplicate Role" });
    assert.equal(res.status, 409);
  });

  test(
    "regression: deleting a role still assigned to personnel is blocked by FK RESTRICT " +
      "(requires PRAGMA foreign_keys = ON, which SQLite disables by default)",
    async () => {
      const role = await post("/api/admin/roles").send({ name: "PI" });
      await post("/api/admin/personnel")
        .send({ name: "Dr. Someone", role_id: role.body.id });

      const del = await delReq(`/api/admin/roles/${role.body.id}`);
      assert.equal(del.status, 409);

      // and the role should still exist
      const roles = await request(app).get("/api/admin/roles");
      assert.ok(roles.body.some((r) => r.id === role.body.id));
    }
  );

  test("allows deleting a role with no personnel assigned", async () => {
    const role = await post("/api/admin/roles").send({ name: "Unused Role" });
    const del = await delReq(`/api/admin/roles/${role.body.id}`);
    assert.equal(del.status, 204);
  });
});

describe("personnel", () => {
  beforeEach(() => { resetTables(db); seedOfficeActor(db); });

  test("creates personnel with a valid role and returns joined role info", async () => {
    const role = await post("/api/admin/roles")
      .send({ name: "Attending Veterinarian", is_committee: true });

    const res = await post("/api/admin/personnel")
      .send({ name: "Dr. Vet", email: "vet@example.edu", role_id: role.body.id });

    assert.equal(res.status, 201);
    assert.equal(res.body.role_name, "Attending Veterinarian");
    assert.equal(res.body.is_committee, 1);
  });

  test("rejects an unknown role_id", async () => {
    const res = await post("/api/admin/personnel")
      .send({ name: "Dr. Ghost", role_id: 99999 });
    assert.equal(res.status, 400);
  });

  test("rejects missing name or role_id", async () => {
    const res = await post("/api/admin/personnel").send({ name: "No role" });
    assert.equal(res.status, 400);
  });

  test("list includes role_name via join", async () => {
    const role = await post("/api/admin/roles").send({ name: "Co-Investigator" });
    await post("/api/admin/personnel").send({ name: "Dr. Co", role_id: role.body.id });

    const list = await request(app).get("/api/admin/personnel");
    const co = list.body.find(p => p.name === "Dr. Co");
    assert.ok(co, "expected Dr. Co to be listed");
    assert.equal(co.role_name, "Co-Investigator");
  });

  test("deletes personnel", async () => {
    const role = await post("/api/admin/roles").send({ name: "Some Role" });
    const person = await post("/api/admin/personnel")
      .send({ name: "Dr. Temp", role_id: role.body.id });

    const del = await delReq(`/api/admin/personnel/${person.body.id}`);
    assert.equal(del.status, 204);

    const list = await request(app).get("/api/admin/personnel");
    // The seeded office fixture (Maya Patel) remains after Dr. Temp is deleted.
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].name, OFFICE_ACTOR);
  });

  test("404s deleting unknown personnel", async () => {
    const res = await delReq("/api/admin/personnel/9999");
    assert.equal(res.status, 404);
  });
});

describe("admin access gate (graduated access control)", () => {
  beforeEach(() => resetTables(db));

  test("anonymous writes are rejected with 401 and a pick-an-identity hint", async () => {
    const res = await request(app).post("/api/admin/species").send({ name: "Ferret" });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /acting as/i);
  });

  test("an unknown X-Actor name is rejected with 401", async () => {
    const res = await request(app).post("/api/admin/species").set("x-actor", "Nobody Here").send({ name: "Ferret" });
    assert.equal(res.status, 401);
  });

  test("a non-office persona is rejected with 403 and a role hint", async () => {
    insertPersonnelDirect(db, { name: "Dr. PI", roleName: "Principal Investigator" });
    const res = await request(app).post("/api/admin/species").set("x-actor", "Dr. PI").send({ name: "Ferret" });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /IACUC Coordinator/);
  });

  test("reads are never gated, even anonymously", async () => {
    const res = await request(app).get("/api/admin/species");
    assert.equal(res.status, 200);
  });
});
