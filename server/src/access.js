import { db } from "./db.js";

// Graduated access control (Roadmap item 4). Deliberately NOT authentication —
// per product decision the app stays anonymous-friendly, with no login wall
// and no passwords. Identities are self-declared via the same signal the audit
// trail already trusts (X-Actor header / body.actor / body.personnel_id), so
// this enforces nothing against a determined caller; what it adds is the demo
// behavior of *graduated* access:
//
//   - Anonymous users can read everything and author ordinary protocol content
//     (create/edit protocols, Appendix A sections, the usage register, etc.).
//   - Governance actions require acting as a known persona:
//       • committee review (votes, comments)      → committee-eligible role
//       • admin lookups, review assignments, and
//         transfer / amendment / renewal decisions → an IACUC office role
//
// This builds on item 17's ActorPicker: picking a persona in the header is
// the "sign in", and it costs nothing until a privileged action needs it.

export const IACUC_OFFICE_ROLES = ["IACUC Coordinator", "IACUC Chair"];

export function isOfficeRole(roleName) {
  return IACUC_OFFICE_ROLES.includes(roleName);
}

const PERSON_SELECT = `
  SELECT personnel.id, personnel.name, personnel.role_id,
         roles.name AS role_name, roles.is_committee
  FROM personnel JOIN roles ON roles.id = personnel.role_id
`;

function personByName(name) {
  return db.prepare(`${PERSON_SELECT} WHERE personnel.name = ?`).get(name) ?? null;
}

function personById(id) {
  if (!Number.isFinite(id)) return null;
  return db.prepare(`${PERSON_SELECT} WHERE personnel.id = ?`).get(id) ?? null;
}

// Resolve the acting persona to a full personnel row (with role + committee
// flag). Precedence mirrors audit.js's resolveActor(): X-Actor header, then an
// explicit body.actor, then any identity-bearing body field. Returns null when
// the request doesn't resolve to a known persona.
export function resolvePerson(req) {
  const header = req.get && req.get("x-actor");
  if (header && String(header).trim()) {
    return personByName(String(header).trim());
  }
  if (req.body) {
    const bodyActor = req.body.actor;
    if (bodyActor && String(bodyActor).trim()) {
      return personByName(String(bodyActor).trim());
    }
    for (const key of ["personnel_id", "reported_by", "auditor_id"]) {
      const id = req.body[key];
      if (id != null && id !== "") {
        return personById(Number(id));
      }
    }
  }
  return null;
}

const ANONYMOUS_MESSAGE =
  "Pick who you're acting as to do that — choose an identity from the menu in the top-right header. " +
  "This demo has no passwords: anyone can pick any name.";

// Any write that needs an identity. Sends a 401 and returns null when no known
// persona is acting; otherwise returns the persona row.
export function requirePersona(req, res) {
  const person = resolvePerson(req);
  if (!person) {
    res.status(401).json({ error: ANONYMOUS_MESSAGE });
    return null;
  }
  return person;
}

// The acting persona must hold one of the named roles. Returns null (after
// sending a 401/403) when not authorized.
export function requireRoles(...roleNames) {
  const allowed = new Set(roleNames);
  return (req, res) => {
    const person = requirePersona(req, res);
    if (!person) return null;
    if (!allowed.has(person.role_name)) {
      res.status(403).json({
        error:
          `${person.name}'s role (${person.role_name}) doesn't have permission for this action. ` +
          `Pick an identity whose role is one of: ${roleNames.join(", ")}.`,
      });
      return null;
    }
    return person;
  };
}

// Any IACUC office role (admin lookups, review assignments, decisions).
export const requireOfficeRole = requireRoles(...IACUC_OFFICE_ROLES);

// The acting persona must be eligible to take part in committee review:
// a committee-flagged role (roles.is_committee = 1) or the IACUC office.
export function requireCommittee(req, res) {
  const person = requirePersona(req, res);
  if (!person) return null;
  if (!person.is_committee && !isOfficeRole(person.role_name)) {
    res.status(403).json({
      error: `${person.name}'s role (${person.role_name}) isn't eligible to take part in protocol review.`,
    });
    return null;
  }
  return person;
}
