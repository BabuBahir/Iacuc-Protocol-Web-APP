# AGENTS.md

This file is a knowledge base for anyone (human or AI agent) working on this
repo. It has two parts: **domain knowledge** distilled from real IACUC/IBC
system documentation (so features we build match how these offices actually
work), and **repo-specific notes** (schema conventions, gotchas hit while
building this, and what's implemented vs. not).

Read this before adding a feature — it'll save you from re-deriving domain
rules that are already documented here, and from re-hitting bugs already
solved once.

---

## 1. Domain knowledge (from Cayuse/Loyola/Wright State documentation)

**What an IACUC actually is, and why that constrains this app**: the
Institutional Animal Care and Use Committee is entrusted with assessing the
ethics of proposed projects prior to approval of animal research. Its role
is detailed in legislation and binding rules, which are in turn inspired by
the Three Rs — Replacement, Reduction, and Refinement. Every workflow rule
below (the review lifecycle, the procedures checklist, the mandatory
literature-search-for-alternatives, the Attending Vet consultation gate) is
downstream of this mandate — they aren't arbitrary form design, they're how
a legally-accountable ethics review gets implemented in software. Keep this
in mind before treating any compliance-related field as "just a checkbox":
a missing or wrong default here isn't a UX nit, it's a gap in an ethics
review process.

Sources: Cayuse IACUC Researcher Manual, Cayuse Hazard Safety (IBC)
Instructions, Loyola University Chicago's "Animal Oversight (IACUC) 4-Step
User Manual: Amendments," and NMSU's Appendix A Research IACUC Application
form. These are real institutional documents, not our own design — treat
them as the source of truth for "how IACUC software actually behaves,"
distinct from our own implementation choices.

### 1.1 Protocol lifecycle

Real systems have a richer lifecycle than a simple Draft→Active line:

```
Draft → Submitted → (Veterinary pre-review) → IACUC Review (full committee
  or designated-member) → Approved → Active
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
            Continuing Review    Amendment           Transfer Ownership
            (1st-year check-in)  (mid-cycle change)  (reassign to new PI)
                    │
                    ▼
            De Novo Review (full 3-year resubmission, not just a renewal)
```

Key distinctions our schema doesn't yet capture:
- **Continuing Review** ≠ **De Novo Review**. Continuing Review is a
  lightweight annual check-in (still using the original protocol). De Novo
  is a full resubmission at the 3-year mark — effectively a new protocol
  that references the prior one's number and must summarize 3 years of
  findings.
- **Amendments are versioned documents**, not just a text note. Loyola's
  manual shows:
  - Only one amendment can be in-flight per protocol at a time.
  - Starting one requires a "Reason for Change" (free text, required).
  - Each field being changed shows a live diff: **Live Changes** (proposed
    version, highlighted), **Previous Version** (pre-amendment value),
    **Changes** (delta from the last revision) — three separate views.
  - After any section is touched, the user must explicitly Save or Cancel
    before moving on (can't navigate away with unsaved changes).
  - Approved amendments produce a new protocol **version** with its own
    approval/expiration dates. A "Protocol Versions Preview" screen lists
    every approved version (0001, 0002, 0003...) with columns: Version,
    Approved date, Expiration date, Version Date (when *that* version was
    approved), and Source (New Document / Amendment Document / De Novo
    Document).
- **Transfer Ownership** is its own approval workflow, not an instant
  reassignment — it sits in a "Transfer Ownership" queue until the IACUC
  office approves it, requires a reason, and can bulk-transfer multiple
  protocols from one PI to another at once.

### 1.2 Dynamic, conditional form structure ("Table of Contents")

This is the single biggest architectural difference from what we've built.
Real Cayuse protocols are **not a fixed form** — they're built from an
"Options" page of yes/no questions (funded? human tissues? off-campus work?
housed outside central facility >12hrs? chemicals/radioactive
materials/nanoparticles?). Each "Yes" answer conditionally adds a whole
section to the protocol's Table of Contents. Sections only appear if
triggered; a green checkmark appears next to a section once every required
field in it is filled, and **all** sections must be checked before
submission is allowed.

The Hazard Safety (IBC) module works the same way but with a biosafety-
flavored Options page (recombinant/synthetic nucleic acids? whole
animals/animal material? human & non-human primate material? etc.) — and
per Wright State's FAQ, one quirk worth remembering if we ever clone this
pattern: a section's *internal name* can be hardcoded by the vendor
regardless of what it's used for (their "Nanoparticles" section is
actually reused for all non-biological hazardous agents) — so don't assume
a section's label always matches its content when modeling vendor systems.

Field types seen in both modules: required (visually flagged, often via a
red dotted border), free text, rich text (bold/italic/alignment/bullets),
radio buttons (single choice), checkboxes (multi-choice), dropdowns, and a
recurring **Add from List / Add New / Edit / Delete** pattern for anything
reusable across protocols (funding sources, strains, locations) — i.e. the
PI builds up personal picklists over time rather than retyping.

**We have not implemented conditional sections.** Our protocol form
(`protocol-form.js` routes) is a fixed set of sections (procedures, drugs,
animal use, alternatives) always present on every protocol. If this becomes
a priority, it's a real architecture change: sections would need to be
data-driven from an `options` answer set rather than hardcoded routes.

### 1.3 Appendix A — actual protocol content (what we DID implement)

The NMSU Appendix A form is the concrete field-level content a real IACUC
application needs. We built this out in `protocol-form.js` /
`protocol_procedures`, `protocol_drugs`, `protocol_animal_use`,
`protocol_experiments`, `protocol_alternatives` tables:

- **Purpose/harm-benefit/scientific summary** — three distinct fields, not
  one description blob. Lay purpose, a short harm-vs-benefit comparison,
  and a separate scientific-language summary (with prior-findings summary
  if this is a triennial resubmission).
- **Procedures checklist** (15 items — breeding, animal ID methods,
  anesthesia, blood collection, injections, exposure to experimental
  substance, non-pharma-grade compounds, prolonged restraint devices,
  animal pain/distress, non-survival surgery, tissue collection after
  euthanasia, survival surgery, illness/induced disease/endpoint, special
  diets/food/water restriction, offsite work) — each a yes/no gate with a
  required narrative when checked.
- **Drug/dosing table** — reason for use, drug, dose, route, expected
  duration; anesthesia combinations should be listed as separate rows per
  drug, not combined in one row.
- **Animal use table** — species/strain, sex, approximate age, max count
  — this is per protocol and can have multiple rows (e.g. two strains),
  distinct from a single `species`/`animals` field.
- **3 Rs + alternatives search** — Replacement/Refinement/Reduction
  narrative, plus a *required* literature search (≥2 databases, date
  range, search date, keywords, summary) and an *optional* colleague
  consult. **Attending Veterinarian consultation is mandatory for Category
  D/E protocols** — we encode this as a derived `av_consultation_required`
  flag computed from `pain_category` server-side (see
  `routes/protocol-form.js`), not a manually-set checkbox, so it can't get
  out of sync with the pain category.

### 1.4 Register / animal usage ledger

Distinct from the *planned* animal-use table above: the "Register" is a
ledger of *actual* animal ordering/usage transactions against an approved
protocol — species, pain level, transaction date. This is closer to
inventory/procurement tracking than protocol content. **Implemented** as
`animal_usage_transactions` + `GET/POST /api/protocols/:id/animal-usage`
(see the "Animal usage register" block below).

### 1.5 Multi-role, multi-site access model

Real installations (per Loyola's manual) have investigators switching
between **Site** (e.g. multiple campuses), **Role** (IACUC Committee
Member / IBC Member / Researcher Staff Members — each unlocking different
actions), and **PI Group** (acting on your own protocols vs. protocols
where you're listed as personnel for someone else). This is richer than
our current single-persona-per-vote model in the Committee page. Also
worth noting: IACUC and IBC (biosafety) are parallel, separately-licensed
modules in Cayuse that share a lot of UI/workflow patterns but are
distinct committees with distinct approval chains — "Whole Animals/Animal
Material" is literally a checkbox in the *biosafety* options page too,
since animal work can trigger both IACUC and IBC review simultaneously.
**We only model IACUC; no auth/role-switching implemented.**

### 1.6 Search, filters, and reports

Real systems support a generic filter-builder (field + operator + value,
stackable, with Save/Recall Filters) across four search types (Protocol,
Funding, Continuing Review, Register), CSV export on every result set, and
canned AAALAC compliance reports (restraint by species, euthanasia methods
by species, surgery locations/types, multiple major recovery surgical
procedures, analgesic/anesthetic drugs, use locations by species).
**Not implemented** — our search is a single substring match on the list
page.

---

## 2. This repo — architecture & conventions

```
iacuc-app/
  package.json        npm workspaces root: [server, client]
  server/              Express + node:sqlite
    src/db.js           schema + lightweight migrations
    src/seed.js          sample data
    src/routes/
      protocols.js        core protocol CRUD + summary
      protocol-form.js     Appendix A content: procedures/drugs/animal-use/experiments/alternatives
      admin.js             species / roles / personnel (personas) CRUD
      committee.js          FCR voting on protocols in review
  client/              Vite + React + TypeScript + react-router-dom
    src/pages/            ListPage, DetailPage, AdminPage, CommitteePage, CreatePage
    src/components/       StatusBadge, ProtocolForm (shared)
    src/api.ts            thin typed fetch wrapper, one function per endpoint
    src/types.ts          Protocol/Dashboard/Admin/Committee types + shared constants
```

The client is TypeScript end-to-end (`.tsx`/`.ts`, no `.jsx` remains). Strict
mode is on (`client/tsconfig.json`) and `npm run typecheck` (`tsc --noEmit`)
is part of the workflow — run it after any client change. Vite resolves
`.js` before `.ts`/`.tsx`, so if you ever reintroduce a plain-`.js` file next
to a `.ts`/`.tsx` one, imports will silently pick up the wrong file.

### API documentation (Swagger UI)

`server/src/openapi.js` exports `openapiSpec` (OpenAPI 3.0.3), served by
`swagger-ui-express` at `/api-docs/` (raw spec at `/api-docs/spec.json`,
which is registered **before** the swagger mount in `app.js` so
`express.static`'s trailing-slash redirect doesn't shadow it). The spec is
hand-written and only documents endpoints that actually exist — the
"Planned / future" endpoints in README are deliberately absent. Keep it in
sync when adding a route: new paths/schemas go in `openapi.js`, and the
`routes-docs.test.js` endpoint-list assertion is the backstop. Note
`/api-docs` (no trailing slash) 301-redirects to `/api-docs/`, so tests
must hit the trailing-slash URL.

### Database

- Uses **`node:sqlite`** (Node's built-in module, Node ≥22.5), not
  `better-sqlite3`. This was a deliberate switch — `better-sqlite3` is a
  native addon that fails to install on newer Node versions without a
  prebuilt binary (hit this exact error on Node 24/Windows). `node:sqlite`
  ships in Node itself, so there's nothing to compile.
- `node:sqlite` is **stricter than better-sqlite3** about named parameters:
  passing an object with keys the query doesn't reference throws
  `Unknown named parameter`. Always build a params object containing
  *only* the fields being used — don't spread `req.body` directly into
  `.run()`.
- No `.transaction()` helper — use explicit `db.exec("BEGIN")` /
  `COMMIT` / `ROLLBACK` (see `seed.js`).
- `PRAGMA foreign_keys = ON` is set explicitly in `db.js` — SQLite has
  this off by default, and `ON DELETE CASCADE`/`RESTRICT` silently do
  nothing without it.
- New columns on existing tables go through a manual migration guard in
  `db.js` (`PRAGMA table_info` + conditional `ALTER TABLE ADD COLUMN`) —
  there's no migration framework, so any schema change to an *existing*
  table needs this pattern to avoid breaking a developer's existing
  `data/iacuc.db`.

### Testing

```bash
npm test              # runs both suites
npm run test:server   # node:test + supertest, coverage via --experimental-test-coverage
npm run test:client   # vitest + React Testing Library, coverage via v8
```

**Backend: 158 tests, 99.55% lines / 91.94% branches / 96.00% functions**
(measured on `server/src/`, excluding `test/`). Every route file — protocols,
protocol-form, animal-usage, admin, committee, compliance — has both
happy-path and edge-case
coverage (FK constraint violations, permission checks, duplicate-key conflicts,
404s). `committee.js` and `compliance.js` are at 100% lines. The one meaningful
gap is a database-transaction-rollback error path
(`protocol-form.js` lines 109–112) that's legitimately hard to trigger without
mocking the DB layer — left uncovered rather than writing a contrived test
for it.

Two real bugs were caught by writing these tests, not found any other way:
1. `av_consultation_required` used `/[DE]/i.test(pain_category)`, which
   matches the "E" in the word "Cat**e**gory" itself — every protocol was
   incorrectly flagged as needing AV consultation, not just Category D/E.
   Fixed to check the actual trailing category letter.
2. `AdminPage`'s three panels all used `useEffect(load, [])`, passing an
   async-returning function directly as the effect callback. React tries to
   call whatever an effect returns as its cleanup function; since `load()`
   returns a Promise, this threw `destroy is not a function` in a stricter
   test environment. Fixed to `useEffect(() => { load(); }, [])` in all
   three places.

**Frontend: 118 tests, 98.49% lines / 87.31% branches** (see
`vite.config.js`'s `test.coverage.exclude` for what's excluded — currently
just `src/main.tsx` and config files, not test files themselves). Every page —
List, Detail, Admin, Committee, Create, Application — plus `StatusBadge`,
`api.ts`, `ProtocolForm`, and `App.tsx` routing is covered. `npm run typecheck`
(`tsc --noEmit`) is the gate after any client change. Note:
`vite.config.js` sets `test.testTimeout = 15000` (vitest's 5s default) —
`ApplicationPage.test.tsx`'s heavy RTL tests (full renders + `userEvent.type`)
hit the 5s wall when vitest runs the nine files in parallel under CPU
contention. The failing test always passed standalone, so it was a timeout,
not an assertion failure.

**E2E: 32 Playwright tests, all passing** (`npm run test:e2e` from the
repo root). Infra lives in `e2e/`: `playwright.config.mjs`, specs in
`e2e/tests/`, plus a dedicated API server (`e2e/seed-and-server.mjs`) on
port 4100 that seeds a throwaway `e2e/e2e.db` and a Vite dev server
(`client`'s `dev:e2e` script) on port 4173 proxying `/api` → 4100. Notes
from building it:
- Root `package.json` has no `"type": "module"`, so the Playwright config
  must be `.mjs` (a `.js` config throws `Cannot use 'import.meta' outside
  a module`).
- `fullyParallel: false` on purpose: all specs share one seeded e2e DB
  (fresh per run, not per test), and the committee spec asserts an empty
  vote history before the voting test writes one — parallel execution made
  that assertion race against the vote-casting test.
- The e2e vote-comment test caught a real server bug: `tallyFor()` in
  `committee.js` didn't SELECT the `protocol_votes.comment` column, so
  comments were stored in the DB but never returned to the UI and never
  displayed. Fixed by adding `protocol_votes.comment` to the query, with a
  server regression test ("vote comments round-trip through the list and
  tally endpoints") alongside the e2e one.
- Adding the detail page's "Edit application" button broke the existing
  "edits a protocol from the detail page" spec: Playwright's strict mode
  rejected `getByRole("button", { name: "Edit" })` because it resolved to
  both "Edit" and "Edit application". Fixed with `exact: true` — a reminder
  that any new button whose label is a prefix of an existing one will trip
  strict mode. An application.spec-style test (in `detail.spec.js`) now
  covers the Appendix A page read-only against 0142's seeded content.
- The animal usage register card introduced more "Species / strain" and
  quantity cells, so several existing specs needed scoping: 0142's
  "Mouse / C57BL/6" cell assertion uses `.first()` (the register summary +
  transaction rows also render it), the register tally assertion scopes to
  `getByTestId("usage-species-summary")`, and the log-usage spec asserts on
  a unique note text rather than a numeric cell (the summary's "Used"
  column and the transactions "Qty" column can hold the same number).
  Also, `getByLabel("Notes")` resolves to both the alternatives "Notes"
  and the usage modal's `#usage-notes`, so the spec targets the id.
- `seed.js` now seeds 12 protocols (up from 6) plus Appendix A content
  (procedures/drugs/animal-use/experiments/alternatives) and FCR votes for
  the two non-0142 review protocols. Six protocols (0142, 0139, 0150, 0147,
  0155, 0158) are seeded with *every* application field filled — summaries,
  PI proxy, PTM member, protocol type, anesthesia flag, housing, disposal,
  NPG, research steps — plus their procedures/drugs/animal-use/experiments/
  alternatives rows; the other six are intentionally sparse. Master data: 17
  species, 12 roles, 13 personnel. Two invariants the e2e suite depends on:
  (1) `IACUC-2026-0142` must stay the **latest-submitted** review protocol
  so it sorts first on the Committee page (the vote-casting test drives its
  form), and must stay **vote-free** so "No votes cast yet." renders; and
  (2) `IACUC-2025-0064` must stay a Macaque so the "Mouse" search test
  keeps filtering it out. If you add review protocols, give them submitted
  dates earlier than 2026-06-30 and don't seed votes for 0142. Don't add
  committee-eligible personnel (is_committee = 1) casually — the committee
  vote-casting test selects voters by index and assumes the sorted voter
  list (six voters: Dr. Amara Osei, Dr. Harold Kim, Dr. Marcus Chen,
  Dr. Priya Nair, Dr. Sofia Ramos, Jordan Blake).
- The review-workflow seed (Domain A) sets `review_method` on the three
  review protocols — 0142 = `DMR`, 0150/0147 = `FCR` — plus 5 reviewer
  assignments (0142: Dr. Sofia Ramos as Designated Member; 0150: Dr. Harold
  Kim Primary + Dr. Priya Nair Secondary; 0147: Dr. Marcus Chen Primary +
  Jordan Blake Secondary) and 6 section comments. 0142 is DMR but stays
  vote-free, and the committee spec's combobox indices assume a fixed card
  order: **review method, voter picker, vote, assignee, role, commenter,
  section** — the vote-casting test uses `nth(1)` (voter) and `nth(2)`
  (vote). If you add more selects to the card, update those indices.
- The animal usage register seeds 5 ledger transactions across three
  protocols: 0142 (order 60 / use 55 of a 240 Mouse allowance — the
  "Within allowance" fixture), 0158 (order 100 of an 800 Zebrafish
  allowance), and 0021 (order 30 / use 40 of a 60 Rabbit allowance — the
  "Over allowance" fixture, remaining clamped to 0). Keep 0021 over its
  allowance and 0142/0158 under theirs; the register e2e and css specs
  depend on both states.
- `e2e/tests/css.spec.js` (6 tests) guards against the CSS bundle going
  empty/regressing: it asserts computed styles for the dark header bar
  (`#032D60` bg + white text on dashboard/committee/admin), the primary
  button (`#0176D3`), the detail-page breadcrumb (white bg + gray border),
  and sums all injected `<style>` rules to prove the Tailwind CSS is
  non-empty. The fifth test asserts the register's within-/over-allowance
  badge colors (`text-emerald-700`/`bg-emerald-50` vs
  `text-red-700`/`bg-red-50`) on 0142 and 0021; the sixth asserts the
  review-method badge colors on the committee page (`#EBF5FC` DMR vs
  `#F3F4F6` FCR) on 0142 and 0150. Vite dev injects CSS as
  `<style>` tags, so don't switch these
  checks to `<link>` stylesheets — there are none in dev mode. Note there
  is **no footer** anywhere in the app, so the "footer" check doesn't
  exist; extend `css.spec.js` if one is ever added.
- `e2e/tests/compliance.spec.js` (5 tests) covers Domain C read + write: the
  detail page's per-person compliance chips on 0142 (2 "Compliant" + 1
  "Action needed" — seeded Elena Marsh/Sam Whitfield compliant, Raj Patel
  record-less), the admin page's seeded status spread, opening the compliance
  modal, and two mutations on **Dr. Hana Sato** (adding a training record and
  clearing OHSP). Hana is deliberately the mutation target: she's on no
  protocol's personnel list, so flipping her to fully compliant can't disturb
  the committee/register/detail invariants. Elena/Raj/Sam/Marcus/Jordan keep
  their seeded states because other specs assert on or near them.
- The "adding a personnel member" admin spec was flaky under full-suite load:
  it clicked submit before the roles fetch populated the form's `role_id`,
  and `add()` in `AdminPage.tsx` returns early while `role_id` is empty — so
  no POST happened and the new person never appeared. Hardened with
  `await expect(roleSelect).not.toHaveValue("")` before clicking. If you add
  another early-return guard to a form like that, give its e2e spec the same
  wait-for-ready treatment.

**Test isolation pattern** (see `server/test/helpers.js`): Node's test
runner isolates each test *file* into its own process by default, so a
single top-level `process.env.DB_PATH = ":memory:"` + dynamic import at the
top of a route test file is already isolated from other files — verified
this empirically, not just assumed it. Within one file, multiple `test()`
blocks share that one in-memory db, so a `beforeEach(() => resetTables(db))`
keeps individual tests from seeing each other's rows. The one place a
different pattern is needed is `db.test.js`, which wants *multiple*
independent db instances within a single file — there it uses a cache-
busted dynamic import (`import("../src/db.js?fresh=" + uniqueId)`), since
Node treats a different query string as a different cached module.

### Package manager

npm workspaces (`npm install` at root installs both `server/` and
`client/`). We tried pnpm first but reverted — pnpm's build-script
approval gate (`ERR_PNPM_IGNORED_BUILDS`) caused repeated friction on
Windows. Don't reintroduce pnpm without a strong reason.

### Known dependency vulnerability (assessed, deferred)

`npm install` flags 2 moderate CVEs in `react-router-dom@6.30.4`:
[GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)
(open redirect via backslash in `<Link>`/`useNavigate`) and
[GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg)
(arbitrary constructor injection via `deserializeErrors()` in SSR
hydration). Neither is patched in the 6.x line — the fix requires
react-router v7, which has breaking API changes from v6.

Assessed and deferred rather than blindly force-upgraded, because:
- **SSR CVE doesn't apply**: this is a client-only SPA (`vite build` →
  static files), no server-side rendering anywhere in the stack.
- **Open-redirect CVE requires attacker-controlled URLs** flowing into
  `<Link to={...}>` or `navigate(...)`. Checked every call site in this
  repo (`grep -rn "useNavigate\|<Link\|navigate(" client/src`) — every
  target is either a hardcoded path (`/`, `/committee`, `/admin`) or a
  protocol ID sourced from our own database, never from a URL param,
  query string, or other user-controlled input.
- A v6→v7 major bump has real breaking changes and needs its own
  regression pass across every page — not something to force through as
  a side effect of adding tests.

**Follow-up**: upgrade to react-router v7 as its own deliberate task, with
routing behavior re-verified afterward — don't just bump the version
number and assume it works.

### What's implemented vs. not (as of this file's writing)

Implemented: core protocol CRUD — a dedicated Create page
(`/protocols/new` — the dashboard's "New protocol" button navigates there,
then on success lands on the new protocol's detail page) and an in-UI edit
modal on the detail page (Edit button opens a form editing title/PI/status/
species/animals/pain-category/submitted/expires via `PATCH /api/protocols/:id`,
then refetches). The form now captures a full IACUC application, not just the
dashboard columns: PI proxy, PTM member, type of IACUC protocol, number of
animals, anesthesia yes/no, NPG compounds yes/no + detail textarea, housing
and disposal narratives, and a **research plan** built from a step list driven
by a sub-modal (Add/Edit/Remove step) — all stored in the `protocols` table
(`pi_proxy`, `ptm_member`, `protocol_type`, `anesthesia_required`, `housing`,
`disposal`, `npg`, `research_steps` as JSON text; the server
`shape()`/`normalizeResearchSteps()` helpers map between the array and JSON
representations). **Research steps are structured objects**, not free-text
strings: each step is `{ description, duration, frequency, species,
pain_category, anesthesia, location, personnel, notes }` (`ResearchStep` in
`client/src/types.ts`; `STEP_FREQUENCIES` = Once/Daily/Weekly/Monthly/As
needed/Continuous), captured by the enriched `ResearchStepModal` and rendered
with a duration · frequency · species · location · personnel metadata line on
the detail page. The server (`normalizeStep`/`parseResearchSteps` in
`protocols.js`) coerces legacy string steps into that object shape on read —
and `normalizeResearchSteps` does the same on write — so old DB rows (and any
client still sending strings) render identically; a server regression test
covers the legacy path. Create and edit share one form component —
`client/src/components/ProtocolForm.tsx` — which owns field state and the
species lookup; the Create page renders it full-page (protocol-number field
on), the detail page renders it inside the edit modal (status dropdown +
submitted/expires dates on). Keep using this component for any future
protocol form rather than duplicating fields. Also implemented: dashboard
metrics, admin lookup lists (species/roles/personnel), FCR committee voting
with live tallies (including vote comments, returned by the tally endpoints),
and a Playwright e2e suite covering dashboard/detail/committee/admin/css.

**Appendix A application page** (`client/src/pages/ApplicationPage.tsx`, route
`/protocols/:id/application`, reachable via the detail page's "Edit
application" button): purpose/harm-benefit/scientific summaries (stored on
`protocols` via `PATCH /api/protocols/:id`), the 15-item procedures checklist
(`PUT /api/protocols/:id/procedures`), the drug/dosing table
(`POST`/`PATCH`/`DELETE /api/protocols/:id/drugs[/:drugId]`), the animal-use
table (`/api/protocols/:id/animal-use`), the experiments card
(`GET`/`POST`/`PATCH`/`DELETE /api/protocols/:id/experiments[/:expId]` — a
per-protocol 1:N table with `name` (required), `description`,
`multiple_surgical_events` flag, `humane_endpoints`,
`persistent_clinical_signs_justification`, `monitoring_plan`, and
`husbandry_exceptions`; seeded one experiment per fully-filled protocol and
covered by server/client/e2e tests), and the 3 Rs & alternatives card
(`PATCH /api/protocols/:id/alternatives`) — including the derived
`av_consultation_required` amber banner. The three summary textareas also live
in the shared `ProtocolForm.tsx` (ids `protocol-form-purpose`,
`protocol-form-harm-benefit`, `protocol-form-scientific`), and the server's
`POST /api/protocols` create handler stores them too, so summaries can be
entered at create time and edited later on the application page. All client
Appendix A calls go through the ~20 typed wrappers in `client/src/api.ts`.

**Structured 3 Rs justifications + submission enforcement (plan item 1c):**
the three free-text `replacement_text`/`refinement_text`/`reduction_text`
blobs on `protocol_alternatives` were replaced by a per-protocol
`protocol_rrr_entries` table (one or more rows per R: `rrr_type` CHECK
constrained, `method` required, `explanation` optional) with
`GET/POST /api/protocols/:id/rrr` + `PATCH/DELETE /api/protocols/:id/rrr/:entryId`.
The blob columns are retained in the DB for backward compatibility but the
alternatives API (`shapeAlternatives` in `protocol-form.js`) never reads or
writes them — the rrr rows are the source of truth. The application page
replaces the three textareas with an add/edit/delete list per R (plus a
per-type "Add" button) via `RrrModal`. **Submission gating:** the server
exports `validateCompleteness(protocolId)` returning `{ overall, avRequired,
sections }` (each section `{ complete, missing[] }` for
summaries/procedures/drugs/animal_use/experiments/alternatives), surfaced at
`GET /api/protocols/:id/validation` and enforced in the protocols `PATCH`
handler: transitioning `status → "Submitted"` returns 400 with the validation
payload unless every section is complete. Rules: all three summaries filled;
every **checked** procedure needs a narrative; ≥1 drug, ≥1 animal-use row,
≥1 experiment; literature search with ≥2 databases (comma-counted), years
from/to, search date, keywords, and summary; ≥1 rrr entry per type; and an
AV consultation date when pain category is D/E. The application page renders
a "Submission readiness" panel (green-check/amber-flag per section, missing
items listed) and a "Submit protocol" button that's disabled until `overall`
is true; the server check is the backstop so direct API calls can't bypass it.
Seeded data now includes 27 rrr entries (3 per fully-filled protocol), and
the e2e suite covers submit success on the fully-seeded Draft `IACUC-2026-0158`
and the disabled-button + API-400 path on sparse `IACUC-2026-0021`.

**Surgery-specific procedure details (plan item 1b):** the two surgery
procedures (`survival_surgery`, `non_survival_surgery`) carry an expanded
detail block on the application page — detailed surgical description, aseptic
preparation of animal/surgeon/instruments, analgesia level (select:
None/Mild/Moderate/Profound), and post-operative care & monitoring (rendered
for survival surgery only). Stored as four nullable columns on
`protocol_procedures` (`surgical_description`, `aseptic_preparation`,
`analgesia_level`, `postop_care`; added via the `PRAGMA table_info` migration
guard in `db.js`) and returned/persisted by the existing `GET`/`PUT
/:id/procedures` routes — no new endpoints. `validateCompleteness` requires
surgical description + aseptic preparation + analgesia level for *checked*
surgery procedures and post-op care additionally for survival surgery, so the
procedures section gates submission until surgery detail is complete. Seeded
surgical details for the three surgery-bearing fully-filled protocols (0139,
0150, 0155); 0021's surgery procedures are deliberately left detail-free so it
stays blocked. Server exports `SURGERY_KEYS` and `ANALGESIA_LEVELS`; the client
mirrors them as `SURGERY_PROCEDURE_KEYS`/`ANALGESIA_LEVELS` in `types.ts`.

**Animal usage register (plan item D):** an `animal_usage_transactions` table
(protocol_id, transaction_date, species_strain, pain_level USDA B/C/D/E,
quantity, type `order`/`use`, procedure_key, notes) with `GET`/`POST
/:id/animal-usage` in `server/src/routes/animal-usage.js`. The GET endpoint
keeps the ledger distinct from the *planned* allowance: allowance is summed
from `protocol_animal_use.max_count` per species; the endpoint returns
transactions (date desc), per-species tallies (allowance/ordered/used/
remaining, with `remaining` clamped to ≥0 and an `over_allowance` flag when
total > allowance), plus tallies by pain category and procedure. POST validates
`transaction_date`/`species_strain` required, `quantity` a positive integer,
`type`/`pain_level`/`procedure_key` against enums, and 404s on unknown
protocols. The application page renders an "Animal usage register" card
(per-species summary table + transactions list) with a "Log usage" modal;
`requireProtocol` is exported from `protocol-form.js` and reused here. Client
types mirror the ledger payload and add a full `PROCEDURE_KEYS` constant (the
client previously only had `SURGERY_PROCEDURE_KEYS`). Seeded ledger fixtures:
0142 under (order 60 / use 55 of 240), 0158 under (order 100 of 800), 0021
over its Rabbit allowance (order 30 / use 40 of 60) — the css.spec and
detail.spec e2e tests depend on both states.

**Review workflow depth (plan item A):** the committee page now carries the
full review workflow, not just FCR vote tallies. Schema: `protocols.review_method`
(`FCR` full committee | `DMR` designated member, added via the `PRAGMA
table_info` migration guard), plus `protocol_review_assignments`
(protocol_id, personnel_id, role ∈ Primary/Secondary Reviewer/Designated
Member, UNIQUE(protocol_id, personnel_id)) and `protocol_review_comments`
(protocol_id, personnel_id, section ∈ overall/summaries/procedures/drugs/
animal_use/experiments/alternatives, comment). Server (`committee.js`):
`assignmentsFor`/`commentsFor` helpers, vote logic refactored into a shared
`castVote()` used by both the `/votes` and `/reviews` POST handlers, the
list and votes GETs now include `assignments` + `comments`, and four new
endpoints — `GET/POST /:id/reviews` (full history; the POST returns it so the
UI refreshes in one call), `POST /:id/comments` (validates section enum +
non-blank comment), `PATCH /:id/assign` (upserts on protocol+personnel),
`PATCH /:id/review-method` (validates against `REVIEW_METHODS`). Client:
`CommitteeProtocol` gained `review_method`/`assignments`/`comments`, new
api.ts wrappers, and the protocol card on `CommitteePage.tsx` gained a
review-method selector (colored DMR/FCR badge), an assign-reviewers section,
and a section-comments section. Seed: 0142 = DMR (stays vote-free for e2e),
0150/0147 = FCR, 5 assignments, 6 comments. Server `committee.js` is at 100%
lines; the e2e committee spec covers the DMR badge + seeded assignment/comment
read, assigning + commenting writes, and the method switch.

**Personnel compliance (Domain C):** a `personnel_training` 1:N table
(personnel_id, course, completed_date, expires_date) and a `personnel_ohsp`
one-row-per-person table (status `Pending`/`Cleared`/`Denied`, reviewed_date,
notes; upserted) in `server/src/routes/compliance.js`, which exports two
routers: `personnelRouter` at `/api/personnel` (list `/compliance` with derived
per-person status, `GET/POST /:id/training`, `PATCH/DELETE /:id/training/:id`,
`GET/POST /:id/ohsp`) and `protocolPersonnelRouter` at `/api/protocols`
(`GET /:id/personnel` — maps each `related_items` "Personnel" label to the
named personnel row and returns per-person compliance plus an `all_compliant`
flag; a person with no matching profile is flagged "No profile"). A training
record is **Current** while its `expires_date` (if any) is today or later;
a record with no expiry is current indefinitely; overall training status is
current if any record is valid. Client: new types + api.ts wrappers, per-person
Training/OHSP chips and a "Manage compliance" modal (add/remove courses, OHSP
status buttons) on the admin page's Personnel panel, and green "Compliant" /
amber "Action needed" chips on the detail page's Personnel card. Seed: 7 of 13
personnel have training/OHSP fixtures — Elena Marsh & Sam Whitfield fully
compliant (both on 0142 → the detail page shows both chip colors), Raj Patel
record-less, Marcus Chen current-training-but-ohsp-Pending, Jordan Blake
expired — so the admin page shows a status spread. `compliance.js` is at 100%
lines; server/client tests + 5 e2e tests (`e2e/tests/compliance.spec.js`)
cover reads and two mutations on Dr. Hana Sato (a safe mutation target — she's
on no protocol's personnel list).

Not implemented (see §1 above for the domain detail on each): conditional/
dynamic Table of Contents, Continuing Review vs. De Novo Review as
distinct recurring events, amendment workflow with live-diff view and
protocol versioning, auth or role-based
access control, search filter-builder, compliance reports.

## 3. HIPAA, PHI, and AI-safety guardrails

**Scope note:** IACUC data (animal protocols) is not PHI on its own —
HIPAA governs *human* health information, not animal research. This
section exists for two reasons: (1) institutions running Cayuse-style
systems often run IACUC and IRB (human-subjects) on the same platform or
org, so a PI's protocol history can end up adjacent to genuinely
HIPAA-covered data elsewhere in the institution; and (2) once AI features
touch *any* compliance data — animal or human — the same discipline that
HIPAA demands for PHI is the right bar to hold AI usage to, even where
it's not legally mandated. Treat the rules below as "how we handle
sensitive data near AI," not "this app is HIPAA-regulated."

### 3.1 Data classification

Know what category any given field falls into before deciding how AI can
touch it:

| Category | Examples in this schema | AI-usable? |
|---|---|---|
| PII (personally identifiable) | `personnel.name`, `personnel.email` | Only with the same care as any PII — see 3.3 |
| Institutionally sensitive, not PHI | protocol content, `pain_category`, procedures, drug dosing | Freely usable by AI features within the app; still shouldn't leave the org's infrastructure to an unvetted third party |
| PHI (would only appear if IRB/human-subjects data is ever integrated) | N/A currently — flag immediately if any human-subjects field is added | **Do not send to any AI/LLM API without a signed BAA with that provider.** No exceptions, no "just for testing." |

If this codebase ever grows an IRB module or otherwise starts storing
human-subjects data, **stop and re-classify before wiring any AI feature
to it** — the rules below assume PHI-adjacent code paths get flagged
before they're built, not caught after.

### 3.2 Rules for any AI feature added to this app

These apply the moment anyone adds an LLM call — auto-drafting protocol
narratives, summarizing amendments, flagging missing sections, etc.

- **No PHI in prompts, ever**, per 3.1 — this is a hard rule with no
  "unless it's just a test" exception.
- **Minimize PII in prompts.** If an AI feature needs *some* personnel
  context (e.g. drafting a section that references the PI), pass the
  minimum needed (name only, not email/phone) and never pass a full
  personnel record when a name will do.
- **No PHI/PII in logs, error traces, or telemetry sent to an LLM
  provider for debugging.** If an error needs to be reported upstream,
  redact free-text fields (protocol titles, descriptions, comments) before
  including them in a bug report to a third party.
- **De-identify before any training/fine-tuning.** If this data is ever
  used to fine-tune or evaluate a model, strip the 18 HIPAA identifiers
  as a baseline even though this data isn't PHI — it's a reasonable floor
  for "data leaving its original context."
- **Don't let AI silently expand scope.** An AI drafting a protocol
  summary should only pull fields explicitly passed to it — not query the
  database itself for "helpful" extra context (e.g. a PI's contact info)
  unless that's the explicit, reviewed behavior of the feature.
- **Log AI-generated content as AI-generated.** If an AI drafts or edits
  protocol content, that provenance should be visible in the audit trail
  (see 3.3) — not indistinguishable from human-entered data.

### 3.3 Prerequisites this app doesn't have yet

HIPAA-style controls are enforcement mechanisms, not just policy text —
without the following, this section is documentation only:

- **Audit logging** — who accessed/changed what, when. Not yet
  implemented; see Roadmap item 11.
- **Authentication + role-based access control** — Roadmap item 4. No
  audit trail is meaningful without knowing who "who" is.
- **Encryption in transit** — HTTPS/TLS termination is a deployment
  concern (see README's Deploying section), not something the app code
  itself enforces; make sure it's on wherever this is actually hosted.
- **Encryption at rest** — SQLite file-level; if this ever moves to
  Postgres (per AGENTS.md migration notes), enable encryption at the
  database layer at that point.
- **Data retention/deletion policy** — not defined yet. Worth deciding
  before real PII accumulates (e.g. how long to keep personnel records
  for people no longer affiliated with the institution).

---

## 4. Update this file

When you add a feature or hit a non-obvious bug, add a short note here —
future sessions (agent or human) shouldn't have to rediscover it.
