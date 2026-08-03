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

  test("PUT can uncheck a procedure and store an empty description", async () => {
    insertProtocol();
    await request(app)
      .put("/api/protocols/TEST-0001/procedures")
      .send({ procedures: [{ procedure_key: "anesthesia", checked: true, description: "Isoflurane" }] });

    const res = await request(app)
      .put("/api/protocols/TEST-0001/procedures")
      .send({ procedures: [{ procedure_key: "anesthesia", checked: false }] });
    assert.equal(res.status, 200);

    const after = await request(app).get("/api/protocols/TEST-0001/procedures");
    const anesthesia = after.body.find((p) => p.procedure_key === "anesthesia");
    assert.equal(anesthesia.checked, false);
    assert.equal(anesthesia.description, "");
  });

  test("400s when procedures body is not an array", async () => {
    insertProtocol();
    const res = await request(app)
      .put("/api/protocols/TEST-0001/procedures")
      .send({ procedures: "nope" });
    assert.equal(res.status, 400);
  });

  test("GET returns empty surgery-detail fields for a fresh surgery procedure", async () => {
    insertProtocol();
    const res = await request(app).get("/api/protocols/TEST-0001/procedures");
    assert.equal(res.status, 200);
    const surgery = res.body.find(p => p.procedure_key === "survival_surgery");
    assert.equal(surgery.surgical_description, "");
    assert.equal(surgery.aseptic_preparation, "");
    assert.equal(surgery.analgesia_level, "");
    assert.equal(surgery.postop_care, "");
  });

  test("PUT persists the surgery-detail fields and GET returns them", async () => {
    insertProtocol();
    const res = await request(app)
      .put("/api/protocols/TEST-0001/procedures")
      .send({
        procedures: [{
          procedure_key: "survival_surgery",
          checked: true,
          description: "LAD ligation",
          surgical_description: "LAD ligation via thoracotomy",
          aseptic_preparation: "Chlorhexidine prep, sterile instruments",
          analgesia_level: "Moderate",
          postop_care: "Monitored twice daily for 72 h",
        }],
      });
    assert.equal(res.status, 200);

    const after = await request(app).get("/api/protocols/TEST-0001/procedures");
    const surgery = after.body.find(p => p.procedure_key === "survival_surgery");
    assert.equal(surgery.checked, true);
    assert.equal(surgery.surgical_description, "LAD ligation via thoracotomy");
    assert.equal(surgery.aseptic_preparation, "Chlorhexidine prep, sterile instruments");
    assert.equal(surgery.analgesia_level, "Moderate");
    assert.equal(surgery.postop_care, "Monitored twice daily for 72 h");
  });

  test("PUT without surgery fields leaves them empty rather than erroring", async () => {
    insertProtocol();
    const res = await request(app)
      .put("/api/protocols/TEST-0001/procedures")
      .send({ procedures: [{ procedure_key: "breeding", checked: true, description: "Colony maintenance" }] });
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

  test("400s patching a drug row with no updatable fields", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/drugs")
      .send({ drug: "Ketamine" });
    const res = await request(app)
      .patch(`/api/protocols/TEST-0001/drugs/${add.body.id}`)
      .send({});
    assert.equal(res.status, 400);
  });

  test("404s patching and deleting an unknown drug row", async () => {
    insertProtocol();
    const patch = await request(app)
      .patch("/api/protocols/TEST-0001/drugs/9999")
      .send({ dose: "5mg" });
    assert.equal(patch.status, 404);

    const del = await request(app).delete("/api/protocols/TEST-0001/drugs/9999");
    assert.equal(del.status, 404);
  });

  test("404s for an unknown protocol on drug routes", async () => {
    const list = await request(app).get("/api/protocols/NOPE/drugs");
    assert.equal(list.status, 404);
    const add = await request(app).post("/api/protocols/NOPE/drugs").send({ drug: "Ketamine" });
    assert.equal(add.status, 404);
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

  test("404s for an unknown protocol on animal-use routes", async () => {
    const list = await request(app).get("/api/protocols/NOPE/animal-use");
    assert.equal(list.status, 404);
    const add = await request(app).post("/api/protocols/NOPE/animal-use").send({ species_strain: "C57BL/6J" });
    assert.equal(add.status, 404);
  });
});

describe("experiments", () => {
  beforeEach(() => resetTables(db));

  test("adds and lists experiments", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/experiments")
      .send({ name: "Chronic restraint stress", description: "4 weeks of daily restraint", multiple_surgical_events: 1 });
    assert.equal(add.status, 201);

    const list = await request(app).get("/api/protocols/TEST-0001/experiments");
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].name, "Chronic restraint stress");
    assert.equal(list.body[0].multiple_surgical_events, 1);
  });

  test("requires experiment name", async () => {
    insertProtocol();
    const res = await request(app)
      .post("/api/protocols/TEST-0001/experiments")
      .send({ description: "missing a name" });
    assert.equal(res.status, 400);
  });

  test("supports multiple experiments per protocol", async () => {
    insertProtocol();
    await request(app).post("/api/protocols/TEST-0001/experiments").send({ name: "Exp A" });
    await request(app).post("/api/protocols/TEST-0001/experiments").send({ name: "Exp B" });

    const list = await request(app).get("/api/protocols/TEST-0001/experiments");
    assert.equal(list.body.length, 2);
  });

  test("updates and deletes an experiment", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/experiments")
      .send({ name: "Chronic restraint stress" });

    const patch = await request(app)
      .patch(`/api/protocols/TEST-0001/experiments/${add.body.id}`)
      .send({ monitoring_plan: "Daily observation; score 2 = endpoint" });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.monitoring_plan, "Daily observation; score 2 = endpoint");

    const del = await request(app).delete(`/api/protocols/TEST-0001/experiments/${add.body.id}`);
    assert.equal(del.status, 204);
  });

  test("404s patching an unknown experiment", async () => {
    insertProtocol();
    const res = await request(app)
      .patch("/api/protocols/TEST-0001/experiments/9999")
      .send({ name: "X" });
    assert.equal(res.status, 404);
  });

  test("400s patching with no updatable fields", async () => {
    insertProtocol();
    const add = await request(app)
      .post("/api/protocols/TEST-0001/experiments")
      .send({ name: "Chronic restraint stress" });
    const res = await request(app)
      .patch(`/api/protocols/TEST-0001/experiments/${add.body.id}`)
      .send({});
    assert.equal(res.status, 400);
  });

  test("404s deleting an unknown experiment", async () => {
    insertProtocol();
    const res = await request(app).delete("/api/protocols/TEST-0001/experiments/9999");
    assert.equal(res.status, 404);
  });

  test("404s for an unknown protocol on experiments routes", async () => {
    const list = await request(app).get("/api/protocols/NOPE/experiments");
    assert.equal(list.status, 404);
    const add = await request(app).post("/api/protocols/NOPE/experiments").send({ name: "X" });
    assert.equal(add.status, 404);
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

  test("Attending Vet consultation is NOT required when pain_category is null", async () => {
    insertProtocol({ pain_category: null });
    const res = await request(app).get("/api/protocols/TEST-0001/alternatives");
    assert.equal(res.body.av_consultation_required, false);
  });

  test("PATCH with no updatable fields is a 400", async () => {
    insertProtocol();
    const res = await request(app)
      .patch("/api/protocols/TEST-0001/alternatives")
      .send({});
    assert.equal(res.status, 400);
  });

  test("404s for an unknown protocol on alternatives routes", async () => {
    const get = await request(app).get("/api/protocols/NOPE/alternatives");
    assert.equal(get.status, 404);
    const patch = await request(app)
      .patch("/api/protocols/NOPE/alternatives")
      .send({ replacement_text: "n/a" });
    assert.equal(patch.status, 404);
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

  test("regression: legacy 3 Rs blob fields are never returned by the alternatives API", async () => {
    insertProtocol();
    const res = await request(app).get("/api/protocols/TEST-0001/alternatives");
    assert.equal(res.status, 200);
    assert.equal("replacement_text" in res.body, false);
    assert.equal("refinement_text" in res.body, false);
    assert.equal("reduction_text" in res.body, false);
  });
});

describe("3 Rs justifications", () => {
  beforeEach(() => resetTables(db));

  test("GET returns an empty list for a protocol with no entries", async () => {
    insertProtocol();
    const res = await request(app).get("/api/protocols/TEST-0001/rrr");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test("POST creates an entry and GET returns it", async () => {
    insertProtocol();
    const created = await request(app)
      .post("/api/protocols/TEST-0001/rrr")
      .send({ rrr_type: "replacement", method: "Cell culture models", explanation: "Considered" });
    assert.equal(created.status, 201);
    assert.equal(created.body.method, "Cell culture models");
    assert.equal(created.body.explanation, "Considered");

    const list = await request(app).get("/api/protocols/TEST-0001/rrr");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].rrr_type, "replacement");
  });

  test("POST rejects a missing method", async () => {
    insertProtocol();
    const res = await request(app)
      .post("/api/protocols/TEST-0001/rrr")
      .send({ rrr_type: "replacement" });
    assert.equal(res.status, 400);
  });

  test("POST rejects an invalid rrr_type", async () => {
    insertProtocol();
    const res = await request(app)
      .post("/api/protocols/TEST-0001/rrr")
      .send({ rrr_type: "transformation", method: "Foo" });
    assert.equal(res.status, 400);
  });

  test("404s for an unknown protocol on rrr routes", async () => {
    const get = await request(app).get("/api/protocols/NOPE/rrr");
    assert.equal(get.status, 404);
    const post = await request(app)
      .post("/api/protocols/NOPE/rrr")
      .send({ rrr_type: "replacement", method: "Foo" });
    assert.equal(post.status, 404);
  });

  test("PATCH updates an entry", async () => {
    insertProtocol();
    const created = await request(app)
      .post("/api/protocols/TEST-0001/rrr")
      .send({ rrr_type: "replacement", method: "Old method" });
    const res = await request(app)
      .patch(`/api/protocols/TEST-0001/rrr/${created.body.id}`)
      .send({ method: "New method", explanation: "Updated" });
    assert.equal(res.status, 200);
    assert.equal(res.body.method, "New method");
    assert.equal(res.body.explanation, "Updated");
  });

  test("PATCH rejects an invalid rrr_type change", async () => {
    insertProtocol();
    const created = await request(app)
      .post("/api/protocols/TEST-0001/rrr")
      .send({ rrr_type: "replacement", method: "Foo" });
    const res = await request(app)
      .patch(`/api/protocols/TEST-0001/rrr/${created.body.id}`)
      .send({ rrr_type: "bogus" });
    assert.equal(res.status, 400);
  });

  test("PATCH 400s with no updatable fields and 404s for an unknown entry", async () => {
    insertProtocol();
    const missing = await request(app).patch("/api/protocols/TEST-0001/rrr/999").send({});
    assert.equal(missing.status, 404);
    const created = await request(app)
      .post("/api/protocols/TEST-0001/rrr")
      .send({ rrr_type: "replacement", method: "Foo" });
    const noFields = await request(app)
      .patch(`/api/protocols/TEST-0001/rrr/${created.body.id}`)
      .send({});
    assert.equal(noFields.status, 400);
  });

  test("DELETE removes an entry and 404s for a missing one", async () => {
    insertProtocol();
    const created = await request(app)
      .post("/api/protocols/TEST-0001/rrr")
      .send({ rrr_type: "replacement", method: "Foo" });
    const del = await request(app).delete(`/api/protocols/TEST-0001/rrr/${created.body.id}`);
    assert.equal(del.status, 204);
    const missing = await request(app).delete(`/api/protocols/TEST-0001/rrr/${created.body.id}`);
    assert.equal(missing.status, 404);
  });

  test("allows multiple entries per type", async () => {
    insertProtocol();
    await request(app).post("/api/protocols/TEST-0001/rrr").send({ rrr_type: "replacement", method: "A" });
    await request(app).post("/api/protocols/TEST-0001/rrr").send({ rrr_type: "replacement", method: "B" });
    const res = await request(app).get("/api/protocols/TEST-0001/rrr");
    assert.equal(res.body.length, 2);
    assert.ok(res.body.every(e => e.rrr_type === "replacement"));
  });
});

describe("submission-readiness validation", () => {
  beforeEach(() => resetTables(db));

  function fillCompleteProtocol(overrides = {}) {
    insertProtocol(overrides);
    db.prepare(`
      UPDATE protocols SET
        purpose_summary = 'Lay purpose',
        harm_benefit_analysis = 'Harm/benefit',
        scientific_summary = 'Scientific'
      WHERE id = 'TEST-0001'
    `).run();
    db.prepare(`
      INSERT INTO protocol_drugs (protocol_id, reason_for_use, drug, dose, route, duration)
      VALUES ('TEST-0001', 'Anesthesia', 'Isoflurane', '2-3%', 'Inhalation', '15 min')
    `).run();
    db.prepare(`
      INSERT INTO protocol_animal_use (protocol_id, species_strain, sex, approx_age, max_count)
      VALUES ('TEST-0001', 'Mouse', 'F', '8 weeks', 10)
    `).run();
    db.prepare(`INSERT INTO protocol_experiments (protocol_id, name) VALUES ('TEST-0001', 'Main study')`).run();
    db.prepare(`
      INSERT INTO protocol_alternatives (protocol_id, lit_databases, lit_years_from, lit_years_to,
        lit_search_date, lit_keywords, lit_summary)
      VALUES ('TEST-0001', 'PubMed, AGRICOLA', '2019', '2026', '2026-06-01', 'alternatives', 'No full alternatives')
    `).run();
    const rrr = db.prepare(`INSERT INTO protocol_rrr_entries (protocol_id, rrr_type, method) VALUES (?, ?, ?)`);
    rrr.run("TEST-0001", "replacement", "Cell culture models");
    rrr.run("TEST-0001", "refinement", "Refined endpoints");
    rrr.run("TEST-0001", "reduction", "Power analysis");
  }

  test("GET /:id/validation reports every incomplete section with its missing items", async () => {
    insertProtocol();
    const res = await request(app).get("/api/protocols/TEST-0001/validation");
    assert.equal(res.status, 200);
    assert.equal(res.body.overall, false);
    assert.equal(res.body.avRequired, false);
    assert.deepEqual(res.body.sections.summaries.missing, [
      "Lay purpose summary", "Harm–benefit analysis", "Scientific summary",
    ]);
    assert.deepEqual(res.body.sections.drugs.missing, ["At least one drug/dosing row"]);
    assert.deepEqual(res.body.sections.animal_use.missing, ["At least one animal-use row"]);
    assert.deepEqual(res.body.sections.experiments.missing, ["At least one experiment"]);
    assert.ok(res.body.sections.alternatives.missing.includes("Replacement justification"));
    assert.ok(res.body.sections.alternatives.missing.includes("Refinement justification"));
    assert.ok(res.body.sections.alternatives.missing.includes("Reduction justification"));
    assert.equal(res.body.sections.procedures.complete, true);
  });

  test("validation passes once every section is complete", async () => {
    fillCompleteProtocol();
    const res = await request(app).get("/api/protocols/TEST-0001/validation");
    assert.equal(res.status, 200);
    assert.equal(res.body.overall, true);
    for (const s of Object.values(res.body.sections)) assert.equal(s.complete, true);
  });

  test("a checked procedure without a narrative keeps the procedures section incomplete", async () => {
    insertProtocol();
    db.prepare(`
      INSERT INTO protocol_procedures (protocol_id, procedure_key, checked)
      VALUES ('TEST-0001', 'anesthesia', 1)
    `).run();
    const res = await request(app).get("/api/protocols/TEST-0001/validation");
    assert.equal(res.body.sections.procedures.complete, false);
    assert.deepEqual(res.body.sections.procedures.missing, ["Narrative for “Anesthesia”"]);
  });

  test("a checked surgery procedure without its detail fields keeps procedures incomplete", async () => {
    insertProtocol();
    db.prepare(`
      INSERT INTO protocol_procedures (protocol_id, procedure_key, checked, description)
      VALUES ('TEST-0001', 'survival_surgery', 1, 'LAD ligation')
    `).run();
    const res = await request(app).get("/api/protocols/TEST-0001/validation");
    assert.equal(res.body.sections.procedures.complete, false);
    assert.deepEqual(res.body.sections.procedures.missing, [
      "Surgical description for “Survival surgery”",
      "Aseptic preparation for “Survival surgery”",
      "Analgesia level for “Survival surgery”",
      "Post-operative care for “Survival surgery”",
    ]);
  });

  test("a completed non-survival surgery row needs surgical fields but not post-op care", async () => {
    insertProtocol();
    db.prepare(`
      INSERT INTO protocol_procedures (protocol_id, procedure_key, checked, description,
        surgical_description, aseptic_preparation, analgesia_level)
      VALUES ('TEST-0001', 'non_survival_surgery', 1, 'Terminal LAD occlusion',
        'Terminal LAD occlusion under deep anesthesia', 'Chlorhexidine prep', 'None')
    `).run();
    const res = await request(app).get("/api/protocols/TEST-0001/validation");
    assert.equal(res.body.sections.procedures.complete, true);
    assert.deepEqual(res.body.sections.procedures.missing, []);
  });

  test("a completed survival surgery row passes once post-op care is present", async () => {
    insertProtocol();
    db.prepare(`
      INSERT INTO protocol_procedures (protocol_id, procedure_key, checked, description,
        surgical_description, aseptic_preparation, analgesia_level, postop_care)
      VALUES ('TEST-0001', 'survival_surgery', 1, 'LAD ligation',
        'LAD ligation via thoracotomy', 'Chlorhexidine prep', 'Moderate',
        'Monitored twice daily for 72 h')
    `).run();
    const res = await request(app).get("/api/protocols/TEST-0001/validation");
    assert.equal(res.body.sections.procedures.complete, true);
  });

  test("Category D/E requires an AV consultation date", async () => {
    fillCompleteProtocol({ pain_category: "Category D" });
    const res = await request(app).get("/api/protocols/TEST-0001/validation");
    assert.equal(res.body.avRequired, true);
    assert.equal(res.body.sections.alternatives.complete, false);
    assert.deepEqual(res.body.sections.alternatives.missing, ["Attending Veterinarian consultation date"]);
  });

  test("av_consult_date satisfies the Category D/E requirement", async () => {
    fillCompleteProtocol({ pain_category: "Category D" });
    db.prepare(`UPDATE protocol_alternatives SET av_consult_date = '2026-07-01' WHERE protocol_id = 'TEST-0001'`).run();
    const res = await request(app).get("/api/protocols/TEST-0001/validation");
    assert.equal(res.body.sections.alternatives.complete, true);
    assert.equal(res.body.overall, true);
  });

  test("404s for an unknown protocol on the validation route", async () => {
    const res = await request(app).get("/api/protocols/NOPE/validation");
    assert.equal(res.status, 404);
  });
});
