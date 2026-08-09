import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables } from "./helpers.js";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const app = createApp();

const ACTIVE_FILTER = [{ field: "status", op: "eq", value: "Active" }];

describe("saved search filters", () => {
  beforeEach(() => resetTables(db));

  test("GET returns an empty list when none saved", async () => {
    const res = await request(app).get("/api/saved-filters");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test("POST creates a saved filter and GET returns it with parsed clauses", async () => {
    const create = await request(app)
      .post("/api/saved-filters")
      .send({ name: "Active protocols", search_type: "protocol", filters: ACTIVE_FILTER });
    assert.equal(create.status, 201);
    assert.equal(create.body.name, "Active protocols");
    assert.equal(create.body.search_type, "protocol");
    assert.deepEqual(create.body.filters, ACTIVE_FILTER);
    assert.ok(create.body.id);

    const list = await request(app).get("/api/saved-filters");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.deepEqual(list.body[0].filters, ACTIVE_FILTER);
  });

  test("GET scopes by search_type", async () => {
    await request(app).post("/api/saved-filters").send({ name: "P", search_type: "protocol", filters: ACTIVE_FILTER });
    await request(app).post("/api/saved-filters").send({ name: "R", search_type: "register", filters: [{ field: "type", op: "eq", value: "order" }] });

    const protocols = await request(app).get("/api/saved-filters?search_type=protocol");
    assert.equal(protocols.body.length, 1);
    assert.equal(protocols.body[0].name, "P");

    const register = await request(app).get("/api/saved-filters?search_type=register");
    assert.equal(register.body.length, 1);
    assert.equal(register.body[0].name, "R");
  });

  test("rejects an unknown search_type in the query", async () => {
    const res = await request(app).get("/api/saved-filters?search_type=nope");
    assert.equal(res.status, 400);
    assert.match(res.body.error, /search_type/);
  });

  test("requires a name", async () => {
    const res = await request(app).post("/api/saved-filters").send({ search_type: "protocol", filters: ACTIVE_FILTER });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /name is required/);
  });

  test("rejects an unknown search_type in the body", async () => {
    const res = await request(app).post("/api/saved-filters").send({ name: "X", search_type: "nope", filters: [] });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /search_type/);
  });

  test("rejects invalid filter clauses", async () => {
    const res = await request(app)
      .post("/api/saved-filters")
      .send({ name: "X", search_type: "protocol", filters: [{ field: "nope", op: "eq", value: "x" }] });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /unknown filter field/);
  });

  test("DELETE removes a saved filter and 404s when missing", async () => {
    const create = await request(app)
      .post("/api/saved-filters")
      .send({ name: "Temp", search_type: "protocol", filters: ACTIVE_FILTER });
    const id = create.body.id;

    const del = await request(app).delete(`/api/saved-filters/${id}`);
    assert.equal(del.status, 204);

    const list = await request(app).get("/api/saved-filters");
    assert.equal(list.body.length, 0);

    const missing = await request(app).delete(`/api/saved-filters/${id}`);
    assert.equal(missing.status, 404);
  });

  test("create and delete are audited with the X-Actor identity", async () => {
    const create = await request(app)
      .post("/api/saved-filters")
      .set("X-Actor", "Dr. Reviewer")
      .send({ name: "Audited", search_type: "protocol", filters: ACTIVE_FILTER });
    const id = create.body.id;

    const createAudit = db.prepare("SELECT * FROM audit_log WHERE entity_type = 'saved_filter' ORDER BY id DESC LIMIT 1").get();
    assert.equal(createAudit.action, "saved_filter.created");
    assert.equal(createAudit.actor, "Dr. Reviewer");

    await request(app).delete(`/api/saved-filters/${id}`).set("X-Actor", "Dr. Reviewer");
    const delAudit = db.prepare("SELECT * FROM audit_log WHERE entity_type = 'saved_filter' AND action = 'saved_filter.deleted'").get();
    assert.equal(delAudit.actor, "Dr. Reviewer");
    assert.match(delAudit.details, /Audited/);
  });
});
