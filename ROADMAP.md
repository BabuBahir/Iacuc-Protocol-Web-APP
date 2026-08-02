# Roadmap

Planned enhancements, in priority order. Each references the domain
research already captured in `AGENTS.md` §1 — read that section before
starting an item so you're not re-deriving rules that are already
documented there.

Work through these one at a time. When an item is done, check it off and
link the PR/commit.

- [x] **0. Testing infrastructure**
  Backend: `node:test` + `supertest`, 76 tests, 99.46% line coverage.
  Frontend: Vitest + React Testing Library, 23 tests, 65.63% line coverage
  (aggregate — `StatusBadge`/`api.js`/`ListPage` are ~100%, `App.jsx` /
  `CommitteePage.jsx` / `DetailPage.jsx` are untested). Run `npm test` from
  the repo root. See AGENTS.md's Testing section for full numbers, the two
  real bugs this caught, and the test-isolation pattern used.

- [ ] **1. Wire up the Appendix A frontend**
  Backend already exists (`server/src/routes/protocol-form.js`):
  procedures checklist, drug/dosing table, animal-use table, 3Rs/
  alternatives. None of it has UI yet. Add sections to `DetailPage.jsx`
  to display and edit this content. See AGENTS.md §1.3 for the full field
  list and the Category D/E → AV-consultation-required rule.
  **Note:** `DetailPage.jsx` currently has zero test coverage — write
  tests alongside this work rather than after.

- [ ] **2. Amendment workflow with versioning**
  Reason-required start, only one amendment in flight per protocol,
  a three-way diff view (Live Changes / Previous Version / Changes),
  and a Protocol Versions Preview screen listing every approved version
  with its own approval/expiration dates and source. See AGENTS.md §1.1.

- [ ] **3. Continuing Review & De Novo Review as distinct recurring events**
  Continuing Review = lightweight annual check-in on the existing
  protocol. De Novo = full 3-year resubmission, effectively a new
  protocol referencing the old number. These are different things, not
  the same feature at different intervals. See AGENTS.md §1.1.

- [ ] **4. Authentication + role-based access control**
  Currently anyone can vote as anyone or edit anything — no login, no
  session, no enforcement. This is the biggest trust gap before this
  could be used for anything real.

- [ ] **5. Dynamic/conditional Table of Contents**
  The Options-page-driven section model from Cayuse: an initial yes/no
  questionnaire determines which sections even appear on a protocol.
  Bigger architectural lift — sections become data-driven instead of
  hardcoded routes/components. See AGENTS.md §1.2, including the vendor
  quirk about section names not always matching their repurposed content.

- [ ] **6. Register / animal usage ledger**
  Actual procurement/usage transactions per protocol (species, pain
  level, transaction date) — distinct from the *planned* animal-use
  table from item 1. See AGENTS.md §1.4.

- [ ] **7. File attachments**
  Real uploads (protocol narratives, SOPs, training certs) instead of
  filename strings in the Attachments related list.

- [ ] **8. Search filter-builder + saved filters + CSV export**
  Replace the single substring search with a stackable field/operator/
  value filter builder, across protocols and the register. See AGENTS.md
  §1.6.

- [ ] **9. AAALAC-style compliance reports**
  Restraint by species, euthanasia methods by species, surgery
  locations/types, etc. Mostly SQL aggregation once procedures/drugs/
  animal-use data is actually populated through the UI from item 1.

- [ ] **10. Transfer Ownership workflow**
  Reassign a protocol to another PI through an approval queue, with a
  required reason and an audit trail — not an instant reassignment.
  See AGENTS.md §1.1.

- [ ] **11. Audit logging**
  Who accessed/changed what, when. Currently nothing is logged — any
  edit, vote, or admin change is untracked. This is also a hard
  prerequisite for the HIPAA/AI-safety guardrails in AGENTS.md §3: those
  rules (e.g. "log AI-generated content as AI-generated") are only
  enforceable once an audit trail exists. Depends on Item 4
  (authentication) — an audit log is meaningless without a real identity
  behind each action.

- [ ] **12. Upgrade react-router-dom to v7**
  Two moderate CVEs in the current 6.30.4 are only patched in v7 (major,
  breaking API changes). Assessed as low real-world risk for this repo's
  usage pattern — see AGENTS.md's "Known dependency vulnerability"
  section for the full reasoning — but should still be upgraded
  deliberately, with routing behavior re-verified across every page
  afterward, rather than left indefinitely.

