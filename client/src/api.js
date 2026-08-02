// Thin wrapper around fetch calls to the Express API.
// In dev, Vite proxies /api -> http://localhost:4000 (see vite.config.js),
// so no base URL is needed here.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listProtocols: (query = "") => request(`/protocols${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  getSummary: () => request("/protocols/summary"),
  getProtocol: (id) => request(`/protocols/${id}`),
  createProtocol: (data) => request("/protocols", { method: "POST", body: JSON.stringify(data) }),
  updateProtocol: (id, data) => request(`/protocols/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProtocol: (id) => request(`/protocols/${id}`, { method: "DELETE" }),

  // admin: species
  listSpecies: () => request("/admin/species"),
  createSpecies: (name) => request("/admin/species", { method: "POST", body: JSON.stringify({ name }) }),
  deleteSpecies: (id) => request(`/admin/species/${id}`, { method: "DELETE" }),

  // admin: roles
  listRoles: () => request("/admin/roles"),
  createRole: (name, isCommittee) =>
    request("/admin/roles", { method: "POST", body: JSON.stringify({ name, is_committee: isCommittee }) }),
  deleteRole: (id) => request(`/admin/roles/${id}`, { method: "DELETE" }),

  // admin: personnel (personas)
  listPersonnel: () => request("/admin/personnel"),
  createPersonnel: (data) => request("/admin/personnel", { method: "POST", body: JSON.stringify(data) }),
  deletePersonnel: (id) => request(`/admin/personnel/${id}`, { method: "DELETE" }),

  // committee: FCR voting
  listCommitteeProtocols: () => request("/committee/protocols"),
  listVoters: () => request("/committee/voters"),
  getProtocolVotes: (id) => request(`/committee/protocols/${id}/votes`),
  castVote: (id, data) =>
    request(`/committee/protocols/${id}/votes`, { method: "POST", body: JSON.stringify(data) }),
};
