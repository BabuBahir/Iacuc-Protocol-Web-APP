import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables } from "./helpers.js";
import { PROCEDURE_KEYS } from "../src/routes/protocol-form.js";

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
    animals: 10,
    pain_category: "Category B",
    ...overrides,
  });
}

describe("procedures checklist", () => {
  beforeEach(() => resetTables(db));

  test("auto-creates a row for every known procedure key on first access", async () => {
    insertProtocol();
    const res = await request(app).get("/api/protocols/TEST-0001/procedures");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, PROCEDURE_KEYS.length);
    assert.ok(res.body.every((p) => p.checked === false));
  });

  test("is idempotent — fetching twice doesn't duplicate rows", async () => {
    insertProtocol();
    await request(app).get("/api/protocols/TEST-0001/procedures");
    const res = await request(app).get("/api/protocols/TEST-0001/procedures");
    assert.equal(res.body.length, PROCEDURE_KEYS.length);
  });

  test("PUT updates checked state and description for specific keys", async () => {
    insertProtocol();
    await request(app).get("/api/protocols/TEST-0001/procedures"); // seed defaults

    const res = await request(app)
      .put("/api/protocols/TEST-0001/procedures")
      .send({
        procedures: [
          { procedure_key: "anesthesia", checked: true, description: "Isoflurane" },
        ],
      });
    assert.equal(res.status, 200);

    const after = await request(app).get("/api/protocols/TEST-0001/procedures");
    const anesthesia = after.body.find((p) => p.procedure_key === "anesthesia");
    assert.equal(anesthesia.checked, true);
    assert.equal(anesthesia.description, "Isoflurane");

    // other procedures remain unaffected
    const breeding = after.body.find((p) => p.procedure_key === "breeding");
    assert.equal(breeding.checked, false);
  });

  test("ignores unknown procedure keys rather than erroring", async () => {
    insertProtocol();
    const res = await request(app)
      .put("/api/protocols/TEST-0001/procedures")
      .send({ procedures: [{ procedure_key: "not_a_real_key", checked: true }] });
    assert.equal(res.status, 200);
  });

  test("404s for an unknown protocol", async () => {
    const res = await request(app).get("/api/protocols/NOPE/procedures");
    assert.equal(res.status, 404);
  });
});

describe("drug/dosing table", () => {
  beforeEach(() => resetTables(db));

  test("adds and lists drug rows", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/drugs")
      .send({ reason_for_use: "Anesthesia", drug: "Isoflurane", dose: "2-3%", route: "Inhalation" });
    assert.equal(add.status, 201);

    const list = await request(app).get("/api/protocols/TEST-0001/drugs");
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].drug, "Isoflurane");
  });

  test("requires a drug name", async () => {
    insertProtocol();
    const res = await request(app).post("/api/protocols/TEST-0001/drugs").send({ dose: "5mg" });
    assert.equal(res.status, 400);
  });

  test("updates and deletes a drug row", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/drugs")
      .send({ drug: "Ketamine" });

    const patch = await request(app)
      .patch(`/api/protocols/TEST-0001/drugs/${add.body.id}`)
      .send({ dose: "10mg/kg" });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.dose, "10mg/kg");

    const del = await request(app).delete(`/api/protocols/TEST-0001/drugs/${add.body.id}`);
    assert.equal(del.status, 204);
  });
});

describe("animal use table", () => {
  beforeEach(() => resetTables(db));

  test("adds and lists animal-use rows", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/animal-use")
      .send({ species_strain: "C57BL/6J", sex: "Both", approx_age: "8-12 weeks", max_count: 240 });
    assert.equal(add.status, 201);

    const list = await request(app).get("/api/protocols/TEST-0001/animal-use");
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].max_count, 240);
  });

  test("requires species_strain", async () => {
    insertProtocol();
    const res = await request(app).post("/api/protocols/TEST-0001/animal-use").send({ sex: "Male" });
    assert.equal(res.status, 400);
  });

  test("supports multiple rows per protocol (e.g. two strains)", async () => {
    insertProtocol();
    await request(app).post("/api/protocols/TEST-0001/animal-use").send({ species_strain: "C57BL/6J" });
    await request(app).post("/api/protocols/TEST-0001/animal-use").send({ species_strain: "BALB/c" });

    const list = await request(app).get("/api/protocols/TEST-0001/animal-use");
    assert.equal(list.body.length, 2);
  });

  test("updates and deletes an animal-use row", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/animal-use")
      .send({ species_strain: "C57BL/6J", max_count: 100 });

    const patch = await request(app)
      .patch(`/api/protocols/TEST-0001/animal-use/${add.body.id}`)
      .send({ max_count: 150 });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.max_count, 150);

    const del = await request(app).delete(`/api/protocols/TEST-0001/animal-use/${add.body.id}`);
    assert.equal(del.status, 204);
  });

  test("404s patching an unknown animal-use row", async () => {
    insertProtocol();
    const res = await request(app)
      .patch("/api/protocols/TEST-0001/animal-use/9999")
      .send({ max_count: 5 });
    assert.equal(res.status, 404);
  });

  test("400s patching with no updatable fields", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/animal-use")
      .send({ species_strain: "C57BL/6J" });
    const res = await request(app)
      .patch(`/api/protocols/TEST-0001/animal-use/${add.body.id}`)
      .send({});
    assert.equal(res.status, 400);
  });

  test("404s deleting an unknown animal-use row", async () => {
    insertProtocol();
    const res = await request(app).delete("/api/protocols/TEST-0001/animal-use/9999");
    assert.equal(res.status, 404);
  });
});

describe("3 Rs / alternatives", () => {
  beforeEach(() => resetTables(db));

  test("auto-creates an empty row on first access", async () => {
    insertProtocol();
    const res = await request(app).get("/api/protocols/TEST-0001/alternatives");
    assert.equal(res.status, 200);
    assert.equal(res.body.protocol_id, "TEST-0001");
  });

  test(
    "regression: Attending Vet consultation is required for Category D, " +
      "computed server-side from pain_category rather than a manual flag",
    async () => {
      insertProtocol({ pain_category: "Category D" });
      const res = await request(app).get("/api/protocols/TEST-0001/alternatives");
      assert.equal(res.body.av_consultation_required, true);
    }
  );

  test("Attending Vet consultation is NOT required for Category B", async () => {
    insertProtocol({ pain_category: "Category B" });
    const res = await request(app).get("/api/protocols/TEST-0001/alternatives");
    assert.equal(res.body.av_consultation_required, false);
  });

  test("Attending Vet consultation is required for Category E as well as D", async () => {
    insertProtocol({ pain_category: "Category E" });
    const res = await request(app).get("/api/protocols/TEST-0001/alternatives");
    assert.equal(res.body.av_consultation_required, true);
  });

  test("PATCH updates literature search and 3Rs fields", async () => {
    insertProtocol();
    const res = await request(app)
      .patch("/api/protocols/TEST-0001/alternatives")
      .send({
        replacement_text: "Considered in vitro alternatives; not viable for behavioral endpoints.",
        lit_databases: "PubMed, AGRICOLA",
        lit_search_date: "2026-06-15",
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.lit_databases, "PubMed, AGRICOLA");
  });
});
