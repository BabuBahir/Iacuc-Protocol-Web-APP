import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables } from "./helpers.js";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const app = createApp();

// Insert the minimum rows each report derives from. `research_steps` is the
// JSON text column on protocols; procedures/drugs/animal-use/experiments are
// the Appendix A child tables.
async function insertProtocol(id, overrides = {}) {
  await request(app).post("/api/protocols").send({
    id,
    title: `Protocol ${id}`,
    pi: "Dr. Test",
    species: "Mouse",
    ...overrides,
  });
}

async function insertProcedure(protocolId, key, checked, description) {
  await request(app)
    .put(`/api/protocols/${protocolId}/procedures`)
    .send({ procedures: [{ procedure_key: key, checked, description }] });
}

async function insertDrug(protocolId, reasonForUse, drug) {
  await request(app).post(`/api/protocols/${protocolId}/drugs`).send({ reason_for_use: reasonForUse, drug });
}

async function insertAnimalUse(protocolId, speciesStrain) {
  await request(app).post(`/api/protocols/${protocolId}/animal-use`).send({ species_strain: speciesStrain });
}

async function insertExperiment(protocolId, name, multipleSurgicalEvents) {
  await request(app).post(`/api/protocols/${protocolId}/experiments`).send({
    name,
    multiple_surgical_events: multipleSurgicalEvents ? 1 : 0,
  });
}

function getReport() {
  return request(app).get("/api/reports");
}

describe("GET /api/reports", () => {
  beforeEach(() => resetTables(db));

  test("returns an empty payload (all report keys, empty arrays) on an empty database", async () => {
    const res = await getReport();
    assert.equal(res.status, 200);
    assert.ok(res.body.generated_at);
    assert.deepEqual(res.body.reports, {
      restraint_by_species: [],
      euthanasia_by_species: [],
      surgery_locations: [],
      multiple_major_recovery_surgery: [],
      analgesic_anesthetic_drugs: [],
      use_locations_by_species: [],
    });
  });

  test("restraint by species lists checked prolonged_restraint procedures with species", async () => {
    await insertProtocol("P-1", { species: "Rat" });
    await insertProcedure("P-1", "prolonged_restraint", 1, "Holding-tube restraint during stimulation.");
    await insertProcedure("P-1", "breeding", 1, "Unrelated procedure, must not appear.");

    const res = await getReport();
    assert.deepEqual(res.body.reports.restraint_by_species, [
      { protocol_id: "P-1", species: "Rat", restraint_method: "Holding-tube restraint during stimulation." },
    ]);
  });

  test("restraint by species ignores unchecked restraint procedures", async () => {
    await insertProtocol("P-1");
    await insertProcedure("P-1", "prolonged_restraint", 0, "");

    const res = await getReport();
    assert.deepEqual(res.body.reports.restraint_by_species, []);
  });

  test("restraint by species falls back to the animal-use species when present", async () => {
    await insertProtocol("P-1", { species: "Mouse" });
    await insertAnimalUse("P-1", "Rat / Sprague Dawley");
    await insertProcedure("P-1", "prolonged_restraint", 1, "Tube restraint.");

    const res = await getReport();
    assert.equal(res.body.reports.restraint_by_species[0].species, "Rat / Sprague Dawley");
  });

  test("euthanasia by species derives the method from the drug's reason_for_use", async () => {
    await insertProtocol("P-1", { species: "Mouse" });
    await insertProtocol("P-2", { species: "Zebrafish" });
    await insertDrug("P-1", "Euthanasia", "Carbon dioxide");
    await insertDrug("P-1", "Anesthesia", "Isoflurane"); // must not appear in the euthanasia report
    await insertDrug("P-2", "euthanasia", "Tricaine");

    const res = await getReport();
    assert.deepEqual(res.body.reports.euthanasia_by_species, [
      { protocol_id: "P-1", species: "Mouse", method: "Carbon dioxide", dose: null, route: null },
      { protocol_id: "P-2", species: "Zebrafish", method: "Tricaine", dose: null, route: null },
    ]);
  });

  test("surgery locations cross-references checked surgery procedures with research-plan locations", async () => {
    await insertProtocol("P-1", {
      species: "Rat",
      research_steps: JSON.stringify([
        { description: "Implant electrodes.", duration: "90 min", location: "Surgical suite B" },
        { description: "Monitor.", duration: "4 weeks", location: "Behavior suite" },
      ]),
    });
    await insertProcedure("P-1", "survival_surgery", 1, "DBS electrode implantation.");

    const res = await getReport();
    const rows = res.body.reports.surgery_locations.map(r => r.location).sort();
    assert.deepEqual(rows, ["Behavior suite", "Surgical suite B"]);
    assert.ok(res.body.reports.surgery_locations.every(r => r.surgery_type === "Survival surgery" && r.protocol_id === "P-1"));
  });

  test("surgery locations emit a row per surgery type and per location", async () => {
    await insertProtocol("P-1", {
      species: "Rat",
      research_steps: JSON.stringify([{ description: "a", location: "Suite A" }, { description: "b", location: "Suite B" }]),
    });
    await insertProcedure("P-1", "survival_surgery", 1, "s");
    await insertProcedure("P-1", "non_survival_surgery", 1, "ns");

    const res = await getReport();
    const rows = res.body.reports.surgery_locations;
    assert.equal(rows.length, 4); // 2 types × 2 locations
    assert.ok(rows.every(r => r.protocol_id === "P-1"));
  });

  test("surgery locations tolerate malformed research_steps JSON", async () => {
    await insertProtocol("P-1", { species: "Rat", research_steps: "not json" });
    await insertProcedure("P-1", "survival_surgery", 1, "s");

    const res = await getReport();
    assert.deepEqual(res.body.reports.surgery_locations, []);
  });

  test("multiple major recovery surgery lists experiments flagged with multiple_surgical_events", async () => {
    await insertProtocol("P-1", { species: "Mouse" });
    await insertProtocol("P-2", { species: "Rat" });
    await insertExperiment("P-1", "Single procedure", 0);
    await insertExperiment("P-2", "Repeat thoracotomy", 1);

    const res = await getReport();
    assert.equal(res.body.reports.multiple_major_recovery_surgery.length, 1);
    assert.equal(res.body.reports.multiple_major_recovery_surgery[0].experiment, "Repeat thoracotomy");
    assert.equal(res.body.reports.multiple_major_recovery_surgery[0].protocol_id, "P-2");
  });

  test("analgesic/anesthetic drugs lists anesthesia and analgesia reasons but not other drugs", async () => {
    await insertProtocol("P-1", { species: "Mouse" });
    await insertDrug("P-1", "Anesthesia", "Isoflurane");
    await insertDrug("P-1", "Analgesia", "Buprenorphine");
    await insertDrug("P-1", "Euthanasia", "Carbon dioxide");
    await insertDrug("P-1", "Tumor induction", "B16-F10 cells");

    const res = await getReport();
    const drugs = res.body.reports.analgesic_anesthetic_drugs.map(r => r.drug).sort();
    assert.deepEqual(drugs, ["Buprenorphine", "Isoflurane"]);
  });

  test("use locations by species aggregates research steps by location and species", async () => {
    await insertProtocol("P-1", {
      research_steps: JSON.stringify([
        { description: "a", location: "Vivarium", species: "Mouse" },
        { description: "b", location: "Vivarium", species: "Mouse" },
        { description: "c", location: "Surgical suite A", species: "Rat" },
      ]),
    });
    await insertProtocol("P-2", {
      research_steps: JSON.stringify([{ description: "d", location: "Vivarium", species: "Mouse" }]),
    });

    const res = await getReport();
    const rows = res.body.reports.use_locations_by_species;
    const vivariumMouse = rows.find(r => r.location === "Vivarium" && r.species === "Mouse");
    assert.equal(vivariumMouse.protocol_count, 2);
    assert.deepEqual(vivariumMouse.protocol_ids, ["P-1", "P-2"]);
    assert.equal(rows.find(r => r.location === "Surgical suite A").protocol_count, 1);
  });
});
