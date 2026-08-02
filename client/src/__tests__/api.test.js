import { describe, test, expect, vi, beforeEach } from "vitest";
import { api } from "../api.js";

function mockFetchOnce(status, body, { json = true } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => (json ? body : undefined),
  });
}

describe("api.js request wrapper", () => {
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
    global.fetch = vi.fn().mockResolvedValue({
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
    await api.castVote("IACUC-2026-0001", { personnel_id: 5, vote: "Approve" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/committee/protocols/IACUC-2026-0001/votes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ personnel_id: 5, vote: "Approve" }),
      })
    );
  });
});
