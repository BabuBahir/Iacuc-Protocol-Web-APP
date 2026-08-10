import { test, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const app = createApp();

describe("API documentation", () => {
  test("serves the Swagger UI at /api-docs/", async () => {
    const res = await request(app).get("/api-docs/");
    assert.equal(res.status, 200);
    assert.match(res.text, /swagger-ui/);
  });

  test("serves the raw spec at /api-docs/spec.json", async () => {
    const res = await request(app).get("/api-docs/spec.json");
    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, "3.0.3");
    assert.equal(res.body.info.title, "IACUC Protocol Review App");
    assert.ok(res.body.paths["/api/protocols"]);
  });

  test("spec documents every implemented endpoint", async () => {
    const res = await request(app).get("/api-docs/spec.json");
    const paths = Object.keys(res.body.paths);
    const expected = [
      "/api/health",
      "/api/protocols",
      "/api/protocols/{id}",
      "/api/protocols/{id}/procedures",
      "/api/protocols/{id}/drugs",
      "/api/protocols/{id}/animal-use",
      "/api/protocols/{id}/experiments",
      "/api/protocols/{id}/rrr",
      "/api/protocols/{id}/alternatives",
      "/api/protocols/{id}/validation",
      "/api/protocols/{id}/options",
      "/api/protocols/{id}/sections",
      "/api/protocols/{id}/sections/{sectionKey}",
      "/api/protocols/{id}/animal-usage",
      "/api/admin/species",
      "/api/admin/roles",
      "/api/admin/personnel",
      "/api/committee/protocols",
      "/api/committee/protocols/{id}/votes",
      "/api/personnel/compliance",
      "/api/facilities",
      "/api/facilities/{id}",
      "/api/inspections",
      "/api/inspections/{id}",
      "/api/inspections/{id}/deficiencies",
      "/api/inspections/{id}/deficiencies/{defId}",
      "/api/incidents",
      "/api/incidents/{id}",
      "/api/pam-audits",
      "/api/protocols/{id}/pam-audits",
      "/api/protocols/{id}/amendments",
      "/api/protocols/{id}/amendments/{amendmentId}",
      "/api/protocols/{id}/amendments/{amendmentId}/changes",
      "/api/protocols/{id}/versions",
      "/api/protocols/{id}/renewals",
      "/api/protocols/{id}/renewals/{renewalId}",
      "/api/transfers",
      "/api/transfers/{transferId}",
      "/api/protocols/{id}/transfers",
      "/api/audit",
      "/api/reports",
      "/api/animal-usage",
      "/api/saved-filters",
      "/api/saved-filters/{id}",
    ];
    for (const p of expected) {
      assert.ok(paths.includes(p), `expected spec to document ${p}`);
    }
  });
});
