# Roadmap

Planned enhancements, in priority order. Each references the domain
research already captured in `AGENTS.md` §1 — read that section before
starting an item so you're not re-deriving rules that are already
documented there.

Work through these one at a time. When an item is done, check it off in
the SAME PR/commit that implements it, with a one-line pointer to the
file(s) that did it — this file has gone stale relative to shipped work
more than once already; keeping the checkbox update inside the feature
PR (not a separate cleanup pass) is the fix.

- [x] **0. Testing infrastructure**
  `node:test` + `supertest` on the backend, Vitest + React Testing
  Library on the frontend (client is now TypeScript). Run `npm test`
  from the repo root for both. See AGENTS.md's Testing section for
  current coverage numbers and the test-isolation pattern used.

- [x] **1. Wire up the Appendix A frontend**
  `client/src/pages/ApplicationPage.tsx` — procedures checklist, drug/
  dosing table, animal-use table, 3 Rs/alternatives (including the
  Category D/E → AV-consultation-required banner), plus structured RRR
  entries and experiments beyond the original scope. See
  `docs/UI-EXPANSION-PLAN.md` for the reference material this was built
  against and any noted gaps vs. that material.

- [x] **2. Amendment workflow with versioning**
  `server/src/routes/amendments.js` + `client/src/pages/
  AmendmentsPage.tsx`. Reason-required start, one amendment in flight
  per protocol, field-level change diffs, and a protocol version
  history view. See AGENTS.md §1.1 for the domain rules this
  implements.

- [x] **3. Continuing Review & De Novo Review as distinct recurring events**
  Same file as item 2 (`amendments.js`) — renewal endpoints correctly
  model Continuing Review (annual check-in) and De Novo Review (full
  3-year resubmission) as distinct event types, not a status flip. See
  AGENTS.md §1.1.

- [ ] **4. Authentication + role-based access control**
  **Product decision: this app stays anonymous-friendly, no login wall
  — see item 17 below before starting this.** Real auth is still
  genuinely absent (anyone can vote as anyone, edit anything, no
  session, no enforcement), so this item stays open. But it needs to be
  designed as *optional/graduated* access control, not a login
  requirement to use the app at all — item 17's `ActorPicker` already
  proves the audit-attribution half of what auth would give you,
  without the friction. Whatever this becomes, it should build on that
  pattern (e.g. an optional "sign in to unlock admin actions" rather
  than a wall on page load). This is also a stated prerequisite for the
  HIPAA/AI-safety guardrails in AGENTS.md §3 to mean anything as
  *enforcement* rather than just documentation.

- [ ] **5. Dynamic/conditional Table of Contents**
  The Options-page-driven section model from Cayuse: an initial yes/no
  questionnaire determines which sections even appear on a protocol.
  Bigger architectural lift — sections become data-driven instead of
  hardcoded routes/components. See AGENTS.md §1.2, including the vendor
  quirk about section names not always matching their repurposed
  content. Not to be confused with item 14 (FCR vs. DMR review
  assignment) — that's about *who* reviews a protocol, this is about
  *which sections even exist* on it.

- [x] **6. Register / animal usage ledger**
  `server/src/routes/animal-usage.js`. Actual procurement/usage
  transactions per protocol, distinct from the *planned* animal-use
  table from item 1. See AGENTS.md §1.4.

- [ ] **7. File attachments**
  Real uploads (protocol narratives, SOPs, training certs) instead of
  filename strings in the Attachments related list.

- [ ] **8. Search filter-builder + saved filters + CSV export**
  Replace the single substring search with a stackable field/operator/
  value filter builder, across protocols and the register (item 6, now
  done). See AGENTS.md §1.6.

- [ ] **9. AAALAC-style compliance reports**
  Restraint by species, euthanasia methods by species, surgery
  locations/types, etc. Mostly SQL aggregation once procedures/drugs/
  animal-use data is populated through the UI — which it now is, via
  item 1. **Not the same thing as item 13** (personnel training/OHSP
  compliance, already done) — don't mark this done because a file is
  named `compliance.js`; that file implements item 13, not this.

- [x] **10. Transfer Ownership workflow**
  `server/src/routes/transfers.js`. Reassign a protocol to another PI
  through an approval queue, with a required reason and an audit trail
  — not an instant reassignment. See AGENTS.md §1.1.

- [x] **11. Audit logging**
  Who accessed/changed what, when. Every mutation route now records an
  append-only entry in the `audit_log` table (see `server/src/audit.js`),
  surfaced through `GET /api/audit` and the admin page's "Audit log"
  panel. The `provenance` field (`human`/`ai`/`system`) gives the
  HIPAA/AI-safety guardrails in AGENTS.md §3 something to hang "log
  AI-generated content as AI-generated" on. Partial: without a real
  identity behind each action, the "who" is only trustworthy where the
  request already carries one (votes/comments/assignments/personnel-body
  fields); the rest is recorded as `system`. Once Item 4 (authentication)
  lands, route the verified identity through the reserved `actor_key`
  column — no migration needed.

- [x] **12. Upgrade react-router-dom to v7**
  Two moderate CVEs in the current 6.26.0 are only patched in v7 (major,
  breaking API changes). Assessed as low real-world risk for this repo's
  usage pattern — see AGENTS.md's "Known dependency vulnerability"
  section for the full reasoning — but should still be upgraded
  deliberately, with routing behavior re-verified across every page
  afterward, rather than left indefinitely.
  **Done (Aug 2026):** migrated to `react-router@7.18.2` (the unified v7
  package; `react-router-dom` remains only as a v7 compatibility
  re-export). The app only used declarative APIs (BrowserRouter,
  MemoryRouter, Routes, Route, Link, useNavigate, useParams), so the
  migration was a package swap plus updating all 18 imports + 3 `vi.mock`
  targets to `react-router`. Verified: `tsc --noEmit` clean, 193 client
  tests pass, and the 36-test e2e suite passes (2 consecutive full runs)
  covering every page. Note: v7's `v7_startTransition` default makes
  route renders low-priority work, which shows up as e2e timeouts under
  cold-cache/load conditions (see AGENTS.md); the `v7_*` opt-out flags are
  gone by 7.18 so this is not reversible from the app. The e2e config now
  sets `retries: 2` to absorb the load-induced timeouts (a test that still
  fails after two retries is reported as failed — never rerun to chase a
  green).

- [x] **13. Personnel compliance tracking (training + OHSP)**
  Not on the original roadmap — added independently. CITI-style
  training records (course, completed/expiry dates, Current/Expired
  status) and Occupational Health & Safety Program clearance per
  person, plus a computed "are all personnel listed on this protocol
  compliant?" check. `server/src/routes/compliance.js`,
  `client/src/pages/AdminPage.tsx`.

- [x] **14. Review workflow depth: FCR vs. DMR assignment + section comments**
  Not on the original roadmap — added independently, but genuinely
  implements the FCR-vs-DMR distinction noted in AGENTS.md §1.1.
  Reviewer assignment (Primary/Secondary Reviewer, Designated Member),
  a `review_method` column on `protocols` (`FCR` | `DMR`), and section-
  scoped inline review comments — all in `server/src/routes/
  committee.js`. Distinct from item 2 (amendment versioning): this is
  about *who reviews a protocol and how*, not about *tracking changes
  to an approved protocol over time*.

- [x] **15. Facilities & inspections**
  Not on the original roadmap. Semi-annual facility inspection tracking
  with deficiency logging. `server/src/routes/facilities.js`,
  `client/src/pages/InspectionsPage.tsx`.

- [x] **16. Post-Approval Monitoring (PAM) / incident reporting**
  Not on the original roadmap. Open → CAPA → Closed incident lifecycle
  tied to a protocol. `server/src/routes/pam.js`, `client/src/pages/
  PamPage.tsx`.

- [x] **17. Lightweight self-declared identity for audit attribution**
  Not on the original roadmap. **Deliberately not authentication** —
  product decision was to stay anonymous-friendly, no login wall
  (login fatigue kills first-time trial of a demo product). An
  optional `ActorPicker` dropdown in the header lets a user pick who
  they're acting as (from the existing personnel list, no password),
  which attaches an `X-Actor` header to every request. This is the
  exact header `server/src/audit.js`'s `resolveActor()` already
  checked first — the backend side was already built as part of item
  11; this closed the frontend gap. Zero security: anyone can pick any
  name. `client/src/identity.ts`, `client/src/components/
  ActorPicker.tsx`. See item 4's updated note — this is not a
  substitute for real auth, just the attribution half of it, done in a
  way that costs no friction.