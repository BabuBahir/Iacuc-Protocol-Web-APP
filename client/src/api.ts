import type {
  Alternatives,
  AlternativesInput,
  AnimalUseInput,
  AnimalUseRow,
  CommitteeProtocol,
  CommitteeTally,
  DrugInput,
  DrugRow,
  Personnel,
  PersonnelInput,
  Procedure,
  ProcedureInput,
  Protocol,
  ProtocolDetail,
  ProtocolInput,
  ProtocolUpdateInput,
  ProtocolVotesResponse,
  Role,
  Species,
  Summary,
  VoteInput,
  Voter,
} from "./types";

// Thin wrapper around fetch calls to the Express API.
// In dev, Vite proxies /api -> http://localhost:4000 (see vite.config.js),
// so no base URL is needed here.

interface ErrorBody {
  error?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const api = {
  listProtocols: (query = ""): Promise<Protocol[]> =>
    request(`/protocols${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  getSummary: (): Promise<Summary> => request("/protocols/summary"),
  getProtocol: (id: string): Promise<ProtocolDetail> => request(`/protocols/${id}`),
  createProtocol: (data: ProtocolInput): Promise<Protocol> =>
    request("/protocols", { method: "POST", body: JSON.stringify(data) }),
  updateProtocol: (id: string, data: Partial<ProtocolUpdateInput>): Promise<Protocol> =>
    request(`/protocols/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProtocol: (id: string): Promise<null> => request(`/protocols/${id}`, { method: "DELETE" }),

  // admin: species
  listSpecies: (): Promise<Species[]> => request("/admin/species"),
  createSpecies: (name: string): Promise<Species> =>
    request("/admin/species", { method: "POST", body: JSON.stringify({ name }) }),
  deleteSpecies: (id: number): Promise<null> => request(`/admin/species/${id}`, { method: "DELETE" }),

  // admin: roles
  listRoles: (): Promise<Role[]> => request("/admin/roles"),
  createRole: (name: string, isCommittee: boolean): Promise<Role> =>
    request("/admin/roles", { method: "POST", body: JSON.stringify({ name, is_committee: isCommittee }) }),
  deleteRole: (id: number): Promise<null> => request(`/admin/roles/${id}`, { method: "DELETE" }),

  // admin: personnel (personas)
  listPersonnel: (): Promise<Personnel[]> => request("/admin/personnel"),
  createPersonnel: (data: PersonnelInput): Promise<Personnel> =>
    request("/admin/personnel", { method: "POST", body: JSON.stringify(data) }),
  deletePersonnel: (id: number): Promise<null> => request(`/admin/personnel/${id}`, { method: "DELETE" }),

  // committee: FCR voting
  listCommitteeProtocols: (): Promise<CommitteeProtocol[]> => request("/committee/protocols"),
  listVoters: (): Promise<Voter[]> => request("/committee/voters"),
  getProtocolVotes: (id: string): Promise<ProtocolVotesResponse> =>
    request(`/committee/protocols/${id}/votes`),
  castVote: (id: string, data: VoteInput): Promise<CommitteeTally> =>
    request(`/committee/protocols/${id}/votes`, { method: "POST", body: JSON.stringify(data) }),

  // Appendix A application content
  listProcedures: (id: string): Promise<Procedure[]> => request(`/protocols/${id}/procedures`),
  updateProcedures: (id: string, procedures: ProcedureInput[]): Promise<{ ok: boolean }> =>
    request(`/protocols/${id}/procedures`, { method: "PUT", body: JSON.stringify({ procedures }) }),
  listDrugs: (id: string): Promise<DrugRow[]> => request(`/protocols/${id}/drugs`),
  createDrug: (id: string, data: DrugInput): Promise<DrugRow> =>
    request(`/protocols/${id}/drugs`, { method: "POST", body: JSON.stringify(data) }),
  updateDrug: (id: string, drugId: number, data: Partial<DrugInput>): Promise<DrugRow> =>
    request(`/protocols/${id}/drugs/${drugId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDrug: (id: string, drugId: number): Promise<null> =>
    request(`/protocols/${id}/drugs/${drugId}`, { method: "DELETE" }),
  listAnimalUse: (id: string): Promise<AnimalUseRow[]> => request(`/protocols/${id}/animal-use`),
  createAnimalUse: (id: string, data: AnimalUseInput): Promise<AnimalUseRow> =>
    request(`/protocols/${id}/animal-use`, { method: "POST", body: JSON.stringify(data) }),
  updateAnimalUse: (id: string, rowId: number, data: Partial<AnimalUseInput>): Promise<AnimalUseRow> =>
    request(`/protocols/${id}/animal-use/${rowId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAnimalUse: (id: string, rowId: number): Promise<null> =>
    request(`/protocols/${id}/animal-use/${rowId}`, { method: "DELETE" }),
  getAlternatives: (id: string): Promise<Alternatives> => request(`/protocols/${id}/alternatives`),
  updateAlternatives: (id: string, data: AlternativesInput): Promise<Alternatives> =>
    request(`/protocols/${id}/alternatives`, { method: "PATCH", body: JSON.stringify(data) }),
};
