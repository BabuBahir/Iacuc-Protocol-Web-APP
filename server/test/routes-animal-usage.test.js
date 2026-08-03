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
    status: "Draft",
    animals: 240,
    pain_category: "Category D",
    ...overrides,
  });
}

function insertAllowance(species_strain, max_count) {
  db.prepare(`
    INSERT INTO protocol_animal_use (protocol_id, species_strain, max_count)
    VALUES (?, ?, ?)
  `).run("TEST-0001", species_strain, max_count);
}

describe("animal usage register", () => {
  beforeEach(() => resetTables(db));

  test("GET returns empty tallies for a protocol with no transactions", async () => {
    insertProtocol();
    insertAllowance("C57BL/6 mouse", 240);

    const res = await request(app).get("/api/protocols/TEST-0001/animal-usage");
    assert.equal(res.status, 200);
    assert.equal(res.body.transactions.length, 0);
    assert.equal(res.body.by_species.length, 1);
    assert.equal(res.body.by_species[0].allowance, 240);
    assert.equal(res.body.by_species[0].over_allowance, false);
  });

  test("POST creates a transaction and GET splits ordered vs used per species", async () => {
    insertProtocol();
    insertAllowance("C57BL/6 mouse", 240);

    const order = await request(app)
      .post("/api/protocols/TEST-0001/animal-usage")
      .send({
        transaction_date: "2026-07-01",
        species_strain: "C57BL/6 mouse",
        pain_level: "C",
        quantity: 60,
        type: "order",
      });
    assert.equal(order.status, 201);
    assert.equal(order.body.type, "order");

    const use = await request(app)
      .post("/api/protocols/TEST-0001/animal-usage")
      .send({
        transaction_date: "2026-07-10",
        species_strain: "C57BL/6 mouse",
        pain_level: "C",
        quantity: 55,
        type: "use",
        procedure_key: "injections",
        notes: "Weekly cohort",
      });
    assert.equal(use.status, 201);

    const res = await request(app).get("/api/protocols/TEST-0001/animal-usage");
    const species = res.body.by_species.find(s => s.species_strain === "C57BL/6 mouse");
    assert.equal(species.ordered, 60);
    assert.equal(species.used, 55);
    assert.equal(species.remaining, 125);
    assert.equal(species.over_allowance, false);
    assert.deepEqual(
      res.body.by_pain_category.find(c => c.pain_level === "C"),
      { pain_level: "C", count: 115 },
    );
    assert.deepEqual(
      res.body.by_procedure.find(c => c.procedure_key === "injections"),
      { procedure_key: "injections", count: 55 },
    );
  });

  test("flags a species as over its allowance when total transactions exceed it", async () => {
    insertProtocol();
    insertAllowance("Rabbit", 60);

    await request(app)
      .post("/api/protocols/TEST-0001/animal-usage")
      .send({ transaction_date: "2026-07-01", species_strain: "Rabbit", quantity: 30, type: "order" });
    await request(app)
      .post("/api/protocols/TEST-0001/animal-usage")
      .send({ transaction_date: "2026-07-05", species_strain: "Rabbit", quantity: 40, type: "use" });

    const res = await request(app).get("/api/protocols/TEST-0001/animal-usage");
    const rabbit = res.body.by_species.find(s => s.species_strain === "Rabbit");
    assert.equal(rabbit.remaining, 0);
    assert.equal(rabbit.over_allowance, true);
  });

  test("POST defaults type to 'use' when omitted", async () => {
    insertProtocol();

    const res = await request(app)
      .post("/api/protocols/TEST-0001/animal-usage")
      .send({ transaction_date: "2026-07-01", species_strain: "C57BL/6 mouse", quantity: 10 });
    assert.equal(res.status, 201);
    assert.equal(res.body.type, "use");
    assert.equal(res.body.pain_level, null);
  });

  test("POST validates required fields and enums", async () => {
    insertProtocol();

    let res = await request(app).post("/api/protocols/TEST-0001/animal-usage").send({ species_strain: "Mouse", quantity: 1 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /transaction_date/);

    res = await request(app).post("/api/protocols/TEST-0001/animal-usage").send({ transaction_date: "2026-07-01", quantity: 1 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /species_strain/);

    res = await request(app).post("/api/protocols/TEST-0001/animal-usage").send({ transaction_date: "2026-07-01", species_strain: "Mouse", quantity: 0 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /positive integer/);

    res = await request(app).post("/api/protocols/TEST-0001/animal-usage").send({ transaction_date: "2026-07-01", species_strain: "Mouse", quantity: 2.5 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /positive integer/);

    res = await request(app).post("/api/protocols/TEST-0001/animal-usage").send({ transaction_date: "2026-07-01", species_strain: "Mouse", quantity: 1, type: "weigh" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /type must be one of/);

    res = await request(app).post("/api/protocols/TEST-0001/animal-usage").send({ transaction_date: "2026-07-01", species_strain: "Mouse", quantity: 1, pain_level: "A" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /pain_level must be one of/);

    res = await request(app).post("/api/protocols/TEST-0001/animal-usage").send({ transaction_date: "2026-07-01", species_strain: "Mouse", quantity: 1, procedure_key: "not_a_procedure" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /unknown procedure_key/);
  });

  test("POST 404s for an unknown protocol", async () => {
    const res = await request(app)
      .post("/api/protocols/NOPE/animal-usage")
      .send({ transaction_date: "2026-07-01", species_strain: "Mouse", quantity: 1 });
    assert.equal(res.status, 404);
  });

  test("GET 404s for an unknown protocol", async () => {
    const res = await request(app).get("/api/protocols/NOPE/animal-usage");
    assert.equal(res.status, 404);
  });

  test("deleting a protocol cascades its usage transactions", async () => {
    insertProtocol();
    insertAllowance("C57BL/6 mouse", 240);
    await request(app)
      .post("/api/protocols/TEST-0001/animal-usage")
      .send({ transaction_date: "2026-07-01", species_strain: "C57BL/6 mouse", quantity: 10, type: "use" });

    db.prepare("DELETE FROM protocols WHERE id = ?").run("TEST-0001");

    const count = db.prepare("SELECT COUNT(*) AS c FROM animal_usage_transactions").get();
    assert.equal(count.c, 0);
  });
});
