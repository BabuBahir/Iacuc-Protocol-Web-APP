import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { resetTables, insertPersonnelDirect } from "./helpers.js";

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
    status: "IACUC Review",
    animals: 10,
    pain_category: "Category B",
    ...overrides,
  });
}

// Roles/personnel are created directly in the DB: the HTTP admin API now
// requires an office persona itself (graduated access control).
function insertPersonnel(name, roleName, isCommittee) {
  return insertPersonnelDirect(db, { name, roleName, isCommittee });
}

function insertAudit(action, entityType, entityId, actor, details) {
  db.prepare(`
    INSERT INTO audit_log (action, entity_type, entity_id, actor, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(action, entityType, entityId, actor, JSON.stringify(details));
}

function allAuditRows() {
  return db.prepare("SELECT * FROM audit_log ORDER BY id").all();
}

describe("audit() defaults", () => {
  beforeEach(() => resetTables(db));

  test("writes actor 'system', provenance 'human', and null details by default", async () => {
    // Protocol create is ungated, so an anonymous write still exercises the
    // audit() defaults without tripping the office gate on /api/admin.
    // (create carries no details; the update-diff and GET tests below cover
    // the JSON-details path.)
    const res = await request(app).post("/api/protocols").send({
      id: "AUD-0001",
      title: "Ferret study",
      pi: "Dr. Test",
    });
    assert.equal(res.status, 201);

    const rows = allAuditRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, "protocol.created");
    assert.equal(rows[0].entity_type, "protocol");
    assert.equal(rows[0].entity_id, "AUD-0001");
    assert.equal(rows[0].actor, "system");
    assert.equal(rows[0].actor_key, null);
    assert.equal(rows[0].provenance, "human");
    assert.equal(rows[0].details, null);
  });

  test("supports explicit provenance, actor, and actor_key", async () => {
    db.prepare(`
      INSERT INTO audit_log (action, entity_type, entity_id, actor, actor_key, details, provenance)
      VALUES ('test.write', 'test', 'x1', 'Dr. Kim', 'k-42', '{"note":"hi"}', 'ai')
    `).run();
    const row = allAuditRows()[0];
    assert.equal(row.actor_key, "k-42");
    assert.equal(row.provenance, "ai");
  });
});

describe("resolveActor() precedence", () => {
  beforeEach(() => resetTables(db));

  // The /api/admin writes used to exercise actor resolution are now office-
  // gated, so these drive resolution through ungated protocol create instead.

  test("X-Actor header wins over everything", async () => {
    await request(app)
      .post("/api/protocols")
      .set("x-actor", "Dr. Portal")
      .send({ id: "AUD-0001", title: "Ferret study", pi: "Dr. Test" });
    assert.equal(allAuditRows().at(-1).actor, "Dr. Portal");
  });

  test("body.actor beats a personnel_id", async () => {
    const kimId = await insertPersonnel("Dr. Kim", "IACUC Chair", true);
    await request(app)
      .post("/api/protocols")
      .send({ id: "AUD-0001", title: "Ferret study", pi: "Dr. Test", actor: "Dr. Body", personnel_id: kimId });
    assert.equal(allAuditRows().at(-1).actor, "Dr. Body");
  });

  test("personnel_id resolves to the person's name", async () => {
    const kimId = await insertPersonnel("Dr. Kim", "IACUC Chair", true);
    await request(app)
      .post("/api/protocols")
      .send({ id: "AUD-0001", title: "Ferret study", pi: "Dr. Test", personnel_id: kimId });
    assert.equal(allAuditRows().at(-1).actor, "Dr. Kim");
  });

  test("falls back to 'system' when no identity is present", async () => {
    await request(app).post("/api/protocols").send({ id: "AUD-0001", title: "Ferret study", pi: "Dr. Test" });
    assert.equal(allAuditRows().at(-1).actor, "system");
  });
});

describe("GET /api/audit", () => {
  beforeEach(() => resetTables(db));

  // Seeded directly: species/roles writes are office-gated now, and these
  // tests only exercise the read/filter surface, not the writing routes.
  function seed() {
    insertAudit("species.created", "species", "1", "Dr. Kim", { name: "Ferret" });
    insertAudit("species.created", "species", "2", "Dr. Osei", { name: "Rabbit" });
    insertAudit("role.created", "role", "3", "Dr. Kim", { name: "IACUC Chair" });
  }

  test("returns entries most-recent-first", async () => {
    await seed();
    const res = await request(app).get("/api/audit");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 3);
    assert.equal(res.body[0].action, "role.created");
    assert.equal(res.body[2].action, "species.created");
  });

  test("parses details JSON into an object", async () => {
    await seed();
    const res = await request(app).get("/api/audit");
    assert.deepEqual(res.body[2].details, { name: "Ferret" });
  });

  test("filters by entity_type", async () => {
    await seed();
    const res = await request(app).get("/api/audit?entity_type=species");
    assert.equal(res.body.length, 2);
    assert.ok(res.body.every(r => r.entity_type === "species"));
  });

  test("filters by entity_id", async () => {
    await seed();
    const res = await request(app).get("/api/audit?entity_id=1");
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].details.name, "Ferret");
  });

  test("filters by actor (LIKE)", async () => {
    await seed();
    const res = await request(app).get("/api/audit?actor=Osei");
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].actor, "Dr. Osei");
  });

  test("filters by action (LIKE)", async () => {
    await seed();
    const res = await request(app).get("/api/audit?action=species");
    assert.equal(res.body.length, 2);
    assert.ok(res.body.every(r => r.action.startsWith("species.")));
  });

  test("filters by provenance", async () => {
    await seed();
    const res = await request(app).get("/api/audit?provenance=human");
    assert.equal(res.body.length, 3);
  });

  test("filters by from/to date range (inclusive)", async () => {
    await seed();
    const today = new Date().toISOString().slice(0, 10);
    const inRange = await request(app).get(`/api/audit?from=2000-01-01&to=${today}`);
    assert.equal(inRange.body.length, 3);
    const outOfRange = await request(app).get("/api/audit?from=1990-01-01&to=1991-01-01");
    assert.equal(outOfRange.body.length, 0);
  });

  test("400s on an invalid limit", async () => {
    const res = await request(app).get("/api/audit?limit=abc");
    assert.equal(res.status, 400);
  });

  test("400s on an out-of-range limit", async () => {
    const res = await request(app).get("/api/audit?limit=501");
    assert.equal(res.status, 400);
  });

  test("400s on a negative offset", async () => {
    const res = await request(app).get("/api/audit?offset=-1");
    assert.equal(res.status, 400);
  });

  test("400s on an unknown provenance", async () => {
    const res = await request(app).get("/api/audit?provenance=nope");
    assert.equal(res.status, 400);
  });

  test("400s when only one of from/to is provided", async () => {
    const res = await request(app).get("/api/audit?from=2026-01-01");
    assert.equal(res.status, 400);
  });

  test("respects limit and offset pagination", async () => {
    for (const n of [1, 2, 3, 4, 5]) {
      insertAudit("species.created", "species", String(n), "system", { name: `Species ${n}` });
    }
    const first = await request(app).get("/api/audit?limit=2&offset=0");
    assert.equal(first.body.length, 2);
    assert.equal(first.body[0].details.name, "Species 5");
    const second = await request(app).get("/api/audit?limit=2&offset=2");
    assert.equal(second.body.length, 2);
    assert.equal(second.body[0].details.name, "Species 3");
  });

  test("returns an empty array when nothing matches", async () => {
    await seed();
    const res = await request(app).get("/api/audit?actor=NoOneHere");
    assert.deepEqual(res.body, []);
  });
});

describe("cross-route audit integration", () => {
  beforeEach(() => resetTables(db));

  test("protocol create/update/delete each write an audit row with diffs", async () => {
    await request(app).post("/api/protocols").send({
      id: "AUD-0001",
      title: "Old title",
      pi: "Dr. Test",
    });

    await request(app).patch("/api/protocols/AUD-0001").set("x-actor", "Dr. Kim").send({ title: "New title" });

    await request(app).delete("/api/protocols/AUD-0001").set("x-actor", "Dr. Kim");

    const rows = allAuditRows();
    assert.deepEqual(rows.map(r => r.action), [
      "protocol.created",
      "protocol.updated",
      "protocol.deleted",
    ]);
    assert.equal(rows[0].entity_id, "AUD-0001");

    const updated = JSON.parse(rows[1].details);
    assert.deepEqual(updated.title, ["Old title", "New title"]);
    assert.equal(rows[1].actor, "Dr. Kim");

    const deleted = JSON.parse(rows[2].details);
    assert.equal(deleted.title, "New title");
  });

  test("species CRUD records the X-Actor identity", async () => {
    // Dr. Kim is IACUC Chair — an office role — so the gated admin writes
    // authorize her and the audit trail records her name as the actor.
    await insertPersonnel("Dr. Kim", "IACUC Chair", true);
    const create = await request(app).post("/api/admin/species").set("x-actor", "Dr. Kim").send({ name: "Ferret" });
    await request(app).delete(`/api/admin/species/${create.body.id}`).set("x-actor", "Dr. Kim");

    const rows = allAuditRows();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].action, "species.created");
    assert.equal(rows[1].action, "species.deleted");
    assert.ok(rows.every(r => r.actor === "Dr. Kim"));
  });

  test("vote.cast records the voter's name as actor", async () => {
    insertProtocol();
    const kimId = await insertPersonnel("Dr. Kim", "IACUC Chair", true);
    await request(app)
      .post("/api/committee/protocols/TEST-0001/votes")
      .send({ personnel_id: kimId, vote: "Approve", comment: "Looks fine" });

    const row = allAuditRows().find(r => r.action === "vote.cast");
    assert.equal(row.entity_id, "TEST-0001");
    assert.equal(row.actor, "Dr. Kim");
    const details = JSON.parse(row.details);
    assert.equal(details.vote, "Approve");
    assert.equal(details.comment, "Looks fine");
  });

  test("transfer create + approve each write audit rows", async () => {
    insertProtocol();
    const hanaId = await insertPersonnel("Dr. Hana", "Principal Investigator", false);
    await insertPersonnel("Dr. Kim", "IACUC Chair", true);

    const create = await request(app)
      .post("/api/protocols/TEST-0001/transfers")
      .set("x-actor", "Dr. Kim")
      .send({ to_personnel_id: hanaId, reason: "Leaving the institution" });
    assert.equal(create.status, 201);

    await request(app)
      .patch(`/api/transfers/${create.body.id}`)
      .set("x-actor", "Dr. Kim")
      .send({ status: "Approved" });

    const rows = allAuditRows();
    const created = rows.find(r => r.action === "transfer.created");
    const approved = rows.find(r => r.action === "transfer.approved");
    assert.ok(created);
    assert.ok(approved);
    assert.deepEqual(JSON.parse(created.details), {
      protocol_id: "TEST-0001",
      from_pi: "Dr. Test",
      to: "Dr. Hana",
    });
    assert.deepEqual(JSON.parse(approved.details), {
      protocol_id: "TEST-0001",
      from_pi: "Dr. Test",
      to: "Dr. Hana",
    });
  });

  test("drug and animal-use mutations write rows with protocol context", async () => {
    insertProtocol();
    const drug = await request(app)
      .post("/api/protocols/TEST-0001/drugs")
      .send({ drug: "Ketamine", dose: "50 mg/kg" });
    assert.equal(drug.status, 201);

    const usage = await request(app)
      .post("/api/protocols/TEST-0001/animal-use")
      .send({ species_strain: "Mouse / C57BL/6", max_count: 240 });
    assert.equal(usage.status, 201);

    const rows = allAuditRows();
    const drugRow = rows.find(r => r.action === "drug.created");
    const animalRow = rows.find(r => r.action === "animal_use.created");
    assert.deepEqual(JSON.parse(drugRow.details), { protocol_id: "TEST-0001", drug: "Ketamine" });
    assert.deepEqual(JSON.parse(animalRow.details), { protocol_id: "TEST-0001", species_strain: "Mouse / C57BL/6" });
  });
});
