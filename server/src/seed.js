import "dotenv/config";
import { db } from "./db.js";

const protocols = [
  { id: "IACUC-2026-0142", title: "Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice", pi: "Dr. Elena Marsh", species: "Mouse", status: "IACUC Review", animals: 240, pain_category: "Category D", submitted: "2026-06-30", expires: null },
  { id: "IACUC-2026-0139", title: "Cardiac Regeneration Following Induced Myocardial Infarction", pi: "Dr. Raj Patel", species: "Rat", status: "Approved", animals: 80, pain_category: "Category C", submitted: "2026-06-12", expires: "2029-06-12" },
  { id: "IACUC-2025-0098", title: "Vaccine Efficacy Trial for Avian Influenza Strains", pi: "Dr. Wen Liu", species: "Chicken", status: "Active", animals: 150, pain_category: "Category B", submitted: "2025-01-08", expires: "2026-08-04" },
  { id: "IACUC-2025-0091", title: "Longitudinal Study of Diet-Induced Obesity in Zebrafish", pi: "Dr. Sofia Ramos", species: "Zebrafish", status: "Expiring soon", animals: 500, pain_category: "Category B", submitted: "2025-02-02", expires: "2026-09-01" },
  { id: "IACUC-2026-0021", title: "Wound Healing Comparison Across Rabbit Breeds", pi: "Dr. Marcus Chen", species: "Rabbit", status: "Draft", animals: 60, pain_category: "Category C", submitted: null, expires: null },
  { id: "IACUC-2025-0064", title: "Behavioral Enrichment Impact on Non-Human Primate Welfare", pi: "Dr. Amara Osei", species: "Macaque", status: "Active", animals: 24, pain_category: "Category B", submitted: "2025-11-20", expires: "2027-11-20" },
];

const relatedItems = [
  { protocol_id: "IACUC-2026-0142", list_name: "Personnel", label: "Dr. Elena Marsh — PI" },
  { protocol_id: "IACUC-2026-0142", list_name: "Personnel", label: "Dr. Raj Patel — Co-I" },
  { protocol_id: "IACUC-2026-0142", list_name: "Personnel", label: "Sam Whitfield — Lab tech" },
  { protocol_id: "IACUC-2026-0142", list_name: "Amendments", label: "AM-01 — Add second mouse strain (Pending)" },
  { protocol_id: "IACUC-2026-0142", list_name: "Approval history", label: "Submitted — Jun 30, 2026" },
  { protocol_id: "IACUC-2026-0142", list_name: "Approval history", label: "Vet pre-review passed — Jul 5, 2026" },
  { protocol_id: "IACUC-2026-0142", list_name: "Approval history", label: "Assigned to full committee — Jul 10, 2026" },
  { protocol_id: "IACUC-2026-0142", list_name: "Attachments", label: "Protocol_Narrative_v3.pdf" },
  { protocol_id: "IACUC-2026-0142", list_name: "Attachments", label: "Statistical_Justification.pdf" },
  { protocol_id: "IACUC-2026-0139", list_name: "Personnel", label: "Dr. Raj Patel — PI" },
  { protocol_id: "IACUC-2026-0139", list_name: "Approval history", label: "Approved by full committee — Jun 18, 2026" },
];

const species = [
  "Mouse", "Rat", "Rabbit", "Guinea pig", "Zebrafish", "Chicken",
  "Macaque", "Sheep", "Pig", "Dog", "Cat", "Ferret",
];

// is_committee = 1 means this role is eligible to cast an FCR vote
const roles = [
  { name: "Principal Investigator", is_committee: 0 },
  { name: "Co-Investigator", is_committee: 0 },
  { name: "Lab Technician", is_committee: 0 },
  { name: "Attending Veterinarian", is_committee: 1 },
  { name: "IACUC Chair", is_committee: 1 },
  { name: "Committee Member", is_committee: 1 },
  { name: "Non-Affiliated Member", is_committee: 1 },
  { name: "Non-Scientist Member", is_committee: 1 },
  { name: "IACUC Coordinator", is_committee: 0 },
];

const personnel = [
  { name: "Dr. Elena Marsh", email: "e.marsh@university.edu", role: "Principal Investigator" },
  { name: "Dr. Raj Patel", email: "r.patel@university.edu", role: "Co-Investigator" },
  { name: "Sam Whitfield", email: "s.whitfield@university.edu", role: "Lab Technician" },
  { name: "Dr. Priya Nair", email: "p.nair@university.edu", role: "Attending Veterinarian" },
  { name: "Dr. Harold Kim", email: "h.kim@university.edu", role: "IACUC Chair" },
  { name: "Dr. Sofia Ramos", email: "s.ramos@university.edu", role: "Committee Member" },
  { name: "Dr. Marcus Chen", email: "m.chen@university.edu", role: "Committee Member" },
  { name: "Jordan Blake", email: "j.blake@community.org", role: "Non-Affiliated Member" },
  { name: "Dr. Amara Osei", email: "a.osei@university.edu", role: "Non-Scientist Member" },
];

const insertProtocol = db.prepare(`
  INSERT INTO protocols (id, title, pi, species, status, animals, pain_category, submitted, expires)
  VALUES (@id, @title, @pi, @species, @status, @animals, @pain_category, @submitted, @expires)
  ON CONFLICT(id) DO UPDATE SET
    title=excluded.title, pi=excluded.pi, species=excluded.species, status=excluded.status,
    animals=excluded.animals, pain_category=excluded.pain_category,
    submitted=excluded.submitted, expires=excluded.expires, updated_at=datetime('now')
`);

const insertRelated = db.prepare(`
  INSERT INTO related_items (protocol_id, list_name, label) VALUES (?, ?, ?)
`);

const insertSpecies = db.prepare(`INSERT OR IGNORE INTO species (name) VALUES (?)`);
const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (name, is_committee) VALUES (?, ?)`);
const getRoleId = db.prepare(`SELECT id FROM roles WHERE name = ?`);
const insertPersonnel = db.prepare(`
  INSERT INTO personnel (name, email, role_id) VALUES (?, ?, ?)
`);

db.exec("BEGIN");
try {
  db.exec("DELETE FROM protocol_votes; DELETE FROM personnel; DELETE FROM roles; DELETE FROM species;");
  db.exec("DELETE FROM related_items; DELETE FROM protocols;");

  for (const p of protocols) insertProtocol.run(p);
  for (const r of relatedItems) insertRelated.run(r.protocol_id, r.list_name, r.label);
  for (const s of species) insertSpecies.run(s);
  for (const r of roles) insertRole.run(r.name, r.is_committee ? 1 : 0);
  for (const p of personnel) {
    const role = getRoleId.get(p.role);
    insertPersonnel.run(p.name, p.email, role.id);
  }

  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

console.log(
  `Seeded ${protocols.length} protocols, ${relatedItems.length} related items, ` +
  `${species.length} species, ${roles.length} roles, ${personnel.length} personnel.`
);
