import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables } from "./helpers.js";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const app = createApp();

function insertProtocol(overrides = {}) {
  db.prepare(`
    INSERT INTO protocols (id, title, pi, species, status, animals, pain_category, submitted, expires)
    VALUES (@id, @title, @pi, @species, @status, @animals, @pain_category, @submitted, @expires)
  `).run({
    id: "TEST-0001",
    title: "Test protocol",
    pi: "Dr. Test",
    species: "Mouse",
    status: "Draft",
    animals: 10,
    pain_category: "Category B",
    submitted: null,
    expires: null,
    ...overrides,
  });
}

describe("GET /api/protocols", () => {
  beforeEach(() => resetTables(db));

  test("returns an empty array when no protocols exist", async () => {
    const res = await request(app).get("/api/protocols");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test("returns seeded protocols", async () => {
    insertProtocol();
    const res = await request(app).get("/api/protocols");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, "TEST-0001");
  });

  test("search matches species (regression: search previously ignored species/status)", async () => {
    insertProtocol({ id: "A", title: "Foo", species: "Zebrafish", status: "Draft" });
    insertProtocol({ id: "B", title: "Bar", species: "Mouse", status: "Draft" });
    const res = await request(app).get("/api/protocols?q=zebrafish");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, "A");
  });

  test("search matches on id, title, and pi", async () => {
    insertProtocol({ id: "IACUC-2026-0099", title: "Special study", pi: "Dr. Unique Name" });
    for (const q of ["2026-0099", "special", "unique name"]) {
      const res = await request(app).get(`/api/protocols?q=${encodeURIComponent(q)}`);
      assert.equal(res.body.length, 1, `expected a match for query "${q}"`);
    }
  });
});

describe("GET /api/protocols/summary", () => {
  beforeEach(() => resetTables(db));

  test("computes counts from actual protocol data", async () => {
    insertProtocol({ id: "A", status: "Active" });
    insertProtocol({ id: "B", status: "Active" });
    insertProtocol({ id: "C", status: "IACUC Review" });
    insertProtocol({ id: "D", status: "Approved" });

    const res = await request(app).get("/api/protocols/summary");
    assert.equal(res.status, 200);
    assert.equal(res.body.active, 2);
    assert.equal(res.body.pendingReview, 1);
    assert.equal(res.body.approvedThisQuarter, 1);
  });
});

describe("GET /api/protocols/:id", () => {
  beforeEach(() => resetTables(db));

  test("404s for an unknown protocol", async () => {
    const res = await request(app).get("/api/protocols/DOES-NOT-EXIST");
    assert.equal(res.status, 404);
  });

  test("returns the protocol with stages and grouped related items", async () => {
    insertProtocol();
    db.prepare("INSERT INTO related_items (protocol_id, list_name, label) VALUES (?, ?, ?)")
      .run("TEST-0001", "Personnel", "Dr. Test — PI");

    const res = await request(app).get("/api/protocols/TEST-0001");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.stages));
    assert.deepEqual(res.body.related.Personnel, ["Dr. Test — PI"]);
  });
});

describe("POST /api/protocols", () => {
  beforeEach(() => resetTables(db));

  test("creates a new protocol in Draft status", async () => {
    const res = await request(app)
      .post("/api/protocols")
      .send({ id: "NEW-0001", title: "New study", pi: "Dr. New" });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "Draft");
  });

  test("rejects missing required fields", async () => {
    const res = await request(app).post("/api/protocols").send({ title: "No id or pi" });
    assert.equal(res.status, 400);
  });

  test("rejects a duplicate id", async () => {
    insertProtocol();
    const res = await request(app)
      .post("/api/protocols")
      .send({ id: "TEST-0001", title: "Dup", pi: "Dr. Dup" });
    assert.equal(res.status, 409);
  });

  test("stores the full IACUC application fields and returns research_steps as an array", async () => {
    const res = await request(app)
      .post("/api/protocols")
      .send({
        id: "NEW-0002",
        title: "Full study",
        pi: "Dr. New",
        pi_proxy: "Sam Whitfield",
        ptm_member: "Dr. Priya Nair",
        protocol_type: "Research",
        species: "Mouse",
        animals: 100,
        pain_category: "Category D",
        anesthesia_required: true,
        housing: "Group housing in ventilated cages",
        disposal: "Carbon dioxide euthanasia followed by carcass incineration",
        npg: "Sigma-Aldrich custom peptide (98% purity)",
        research_steps: [
          {
            description: "Habituate animals for 7 days",
            duration: "7 days",
            frequency: "Daily",
            species: "Mouse",
            pain_category: "Category B",
            anesthesia: "No",
            location: "Behavior suite",
            personnel: "Sam Whitfield",
            notes: "Gentle handling",
          },
          {
            description: "Administer stressor for 21 days",
            duration: "21 days",
            frequency: "Daily",
            species: "Mouse",
            pain_category: "Category D",
            anesthesia: "No",
            location: "Vivarium",
            personnel: "Dr. New",
            notes: "",
          },
        ],
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.pi_proxy, "Sam Whitfield");
    assert.equal(res.body.ptm_member, "Dr. Priya Nair");
    assert.equal(res.body.protocol_type, "Research");
    assert.equal(res.body.anesthesia_required, 1);
    assert.equal(res.body.housing, "Group housing in ventilated cages");
    assert.equal(res.body.npg, "Sigma-Aldrich custom peptide (98% purity)");
    assert.deepEqual(res.body.research_steps, [
      {
        description: "Habituate animals for 7 days",
        duration: "7 days",
        frequency: "Daily",
        species: "Mouse",
        pain_category: "Category B",
        anesthesia: "No",
        location: "Behavior suite",
        personnel: "Sam Whitfield",
        notes: "Gentle handling",
      },
      {
        description: "Administer stressor for 21 days",
        duration: "21 days",
        frequency: "Daily",
        species: "Mouse",
        pain_category: "Category D",
        anesthesia: "No",
        location: "Vivarium",
        personnel: "Dr. New",
        notes: "",
      },
    ]);
  });

  test("stores the Appendix A summary fields on create", async () => {
    const res = await request(app)
      .post("/api/protocols")
      .send({
        id: "NEW-0003",
        title: "Summary study",
        pi: "Dr. New",
        purpose_summary: "Lay-language purpose",
        harm_benefit_analysis: "Harm vs. benefit",
        scientific_summary: "Scientific summary of aims",
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.purpose_summary, "Lay-language purpose");
    assert.equal(res.body.harm_benefit_analysis, "Harm vs. benefit");
    assert.equal(res.body.scientific_summary, "Scientific summary of aims");
  });
});

describe("PATCH /api/protocols/:id", () => {
  beforeEach(() => resetTables(db));

  test("updates only the provided fields", async () => {
    insertProtocol({ title: "Original title" });
    const res = await request(app)
      .patch("/api/protocols/TEST-0001")
      .send({ status: "Active" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Active");
    assert.equal(res.body.title, "Original title");
  });

  test("updates the new Appendix A summary fields", async () => {
    insertProtocol();
    const res = await request(app)
      .patch("/api/protocols/TEST-0001")
      .send({ purpose_summary: "Lay purpose text", harm_benefit_analysis: "Harm/benefit text" });
    assert.equal(res.status, 200);
    assert.equal(res.body.purpose_summary, "Lay purpose text");
    assert.equal(res.body.harm_benefit_analysis, "Harm/benefit text");
  });

  test("round-trips research_steps and the IACUC application fields through PATCH", async () => {
    insertProtocol();
    const res = await request(app)
      .patch("/api/protocols/TEST-0001")
      .send({
        pi_proxy: "Sam Whitfield",
        protocol_type: "Teaching",
        anesthesia_required: 1,
        housing: "Individually ventilated cages",
        disposal: "Injectable overdose then incineration",
        npg: "Vendored lot no. 4471",
        research_steps: [
          {
            description: "Pre-test on 2 animals",
            duration: "1 day",
            frequency: "Once",
            species: "Mouse",
            pain_category: "Category C",
            anesthesia: "Yes",
            location: "Procedure room",
            personnel: "Sam Whitfield",
            notes: "Aseptic prep",
          },
          {
            description: "Run the procedure",
            duration: "~2 hours",
            frequency: "Once",
            species: "Mouse",
            pain_category: "Category D",
            anesthesia: "Yes",
            location: "Surgical suite",
            personnel: "Dr. New",
            notes: "",
          },
        ],
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.pi_proxy, "Sam Whitfield");
    assert.equal(res.body.anesthesia_required, 1);
    assert.deepEqual(res.body.research_steps, [
      {
        description: "Pre-test on 2 animals",
        duration: "1 day",
        frequency: "Once",
        species: "Mouse",
        pain_category: "Category C",
        anesthesia: "Yes",
        location: "Procedure room",
        personnel: "Sam Whitfield",
        notes: "Aseptic prep",
      },
      {
        description: "Run the procedure",
        duration: "~2 hours",
        frequency: "Once",
        species: "Mouse",
        pain_category: "Category D",
        anesthesia: "Yes",
        location: "Surgical suite",
        personnel: "Dr. New",
        notes: "",
      },
    ]);
  });

  test("normalizes legacy string research_steps into structured objects on read", async () => {
    insertProtocol();
    const res = await request(app)
      .post("/api/protocols")
      .send({
        id: "LEGACY-0001",
        title: "Legacy study",
        pi: "Dr. Old",
        research_steps: ["Step one", "Step two"],
      });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.research_steps, [
      {
        description: "Step one",
        duration: "",
        frequency: "",
        species: "",
        pain_category: "",
        anesthesia: "No",
        location: "",
        personnel: "",
        notes: "",
      },
      {
        description: "Step two",
        duration: "",
        frequency: "",
        species: "",
        pain_category: "",
        anesthesia: "No",
        location: "",
        personnel: "",
        notes: "",
      },
    ]);
  });

  test(
    "regression: does not throw on extra unrelated body fields " +
      "(node:sqlite rejects unknown named params if the whole body is spread into params)",
    async () => {
      insertProtocol();
      const res = await request(app)
        .patch("/api/protocols/TEST-0001")
        .send({ status: "Active", some_unrelated_field_the_client_might_send: "whatever" });
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "Active");
    }
  );

  test("404s for an unknown protocol", async () => {
    const res = await request(app).patch("/api/protocols/NOPE").send({ status: "Active" });
    assert.equal(res.status, 404);
  });

  test("400s when no updatable fields are provided", async () => {
    insertProtocol();
    const res = await request(app).patch("/api/protocols/TEST-0001").send({});
    assert.equal(res.status, 400);
  });

  function fillCompleteProtocol() {
    insertProtocol();
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

  test("rejects transitioning to Submitted while sections are incomplete", async () => {
    insertProtocol();
    const res = await request(app)
      .patch("/api/protocols/TEST-0001")
      .send({ status: "Submitted", submitted: "2026-07-15" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Cannot submit: complete all required sections first");
    assert.equal(res.body.validation.overall, false);

    const after = await request(app).get("/api/protocols/TEST-0001");
    assert.equal(after.body.status, "Draft");
  });

  test("allows transitioning to Submitted once every section is complete", async () => {
    fillCompleteProtocol();
    const res = await request(app)
      .patch("/api/protocols/TEST-0001")
      .send({ status: "Submitted", submitted: "2026-07-15" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Submitted");
  });
});

describe("DELETE /api/protocols/:id", () => {
  beforeEach(() => resetTables(db));

  test("deletes an existing protocol", async () => {
    insertProtocol();
    const res = await request(app).delete("/api/protocols/TEST-0001");
    assert.equal(res.status, 204);
    assert.equal(db.prepare("SELECT * FROM protocols WHERE id = ?").get("TEST-0001"), undefined);
  });

  test("404s for an unknown protocol", async () => {
    const res = await request(app).delete("/api/protocols/NOPE");
    assert.equal(res.status, 404);
  });
});
