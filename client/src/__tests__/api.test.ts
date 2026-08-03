import { describe, test, expect, vi, beforeEach } from "vitest";
import { api } from "../api";

function mockFetchOnce(status: number, body: unknown, { json = true }: { json?: boolean } = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => (json ? body : undefined),
  });
}

describe("api.ts request wrapper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("GET requests hit the correct path with JSON content-type header", async () => {
    mockFetchOnce(200, [{ id: "A" }]);
    await api.listProtocols();

    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    );
  });

  test("search query is URL-encoded and appended as ?q=", async () => {
    mockFetchOnce(200, []);
    await api.listProtocols("mouse study");

    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols?q=mouse%20study",
      expect.anything()
    );
  });

  test("empty search query omits the ?q= param entirely", async () => {
    mockFetchOnce(200, []);
    await api.listProtocols("");

    expect(fetch).toHaveBeenCalledWith("/api/protocols", expect.anything());
  });

  test("POST requests send method and JSON-stringified body", async () => {
    mockFetchOnce(201, { id: "NEW-1" });
    await api.createSpecies("Ferret");

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/species",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Ferret" }),
      })
    );
  });

  test("a non-ok response throws using the server's error message", async () => {
    mockFetchOnce(409, { error: "That species already exists." });

    await expect(api.createSpecies("Mouse")).rejects.toThrow(
      "That species already exists."
    );
  });

  test("a non-ok response with no parseable JSON body falls back to a generic error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(api.deleteSpecies(1)).rejects.toThrow("Request failed: 500");
  });

  test("a 204 No Content response resolves to null instead of trying to parse a body", async () => {
    mockFetchOnce(204, undefined, { json: false });
    const result = await api.deleteSpecies(1);
    expect(result).toBeNull();
  });

  test("castVote posts to the correct nested committee endpoint", async () => {
    mockFetchOnce(201, { totalVotes: 1 });
    await api.castVote("IACUC-2026-0001", { personnel_id: 5, vote: "Approve", comment: null });

    expect(fetch).toHaveBeenCalledWith(
      "/api/committee/protocols/IACUC-2026-0001/votes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ personnel_id: 5, vote: "Approve", comment: null }),
      })
    );
  });

  test("Appendix A endpoints hit the correct nested protocol paths", async () => {
    mockFetchOnce(200, []);
    await api.listProcedures("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/procedures", expect.anything());

    mockFetchOnce(200, { ok: true });
    await api.updateProcedures("P-1", [{ procedure_key: "anesthesia", checked: true, description: "Isoflurane" }]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/procedures",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ procedures: [{ procedure_key: "anesthesia", checked: true, description: "Isoflurane" }] }),
      })
    );

    mockFetchOnce(200, []);
    await api.listDrugs("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/drugs", expect.anything());

    mockFetchOnce(201, { id: 1 });
    await api.createDrug("P-1", { drug: "Ketamine" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/drugs",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ drug: "Ketamine" }) })
    );

    mockFetchOnce(200, { id: 1 });
    await api.updateDrug("P-1", 1, { dose: "80 mg/kg" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/drugs/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ dose: "80 mg/kg" }) })
    );

    mockFetchOnce(204, undefined, { json: false });
    await api.deleteDrug("P-1", 1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/drugs/1",
      expect.objectContaining({ method: "DELETE" })
    );

    mockFetchOnce(200, []);
    await api.listAnimalUse("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/animal-use", expect.anything());

    mockFetchOnce(201, { id: 1 });
    await api.createAnimalUse("P-1", { species_strain: "C57BL/6 mouse", max_count: 10 });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/animal-use",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ species_strain: "C57BL/6 mouse", max_count: 10 }) })
    );

    mockFetchOnce(200, { id: 1 });
    await api.updateAnimalUse("P-1", 1, { sex: "Female" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/animal-use/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ sex: "Female" }) })
    );

    mockFetchOnce(204, undefined, { json: false });
    await api.deleteAnimalUse("P-1", 1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/animal-use/1",
      expect.objectContaining({ method: "DELETE" })
    );

    mockFetchOnce(200, { av_consultation_required: true });
    await api.getAlternatives("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/alternatives", expect.anything());

    mockFetchOnce(200, { av_consult_date: "2026-07-01" });
    await api.updateAlternatives("P-1", { av_consult_date: "2026-07-01" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/alternatives",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ av_consult_date: "2026-07-01" }) })
    );
  });
});
