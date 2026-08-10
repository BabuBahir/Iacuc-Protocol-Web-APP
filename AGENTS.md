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
  client/              Vite + React + TypeScript + react-router
    src/pages/            ListPage, DetailPage, AdminPage, CommitteePage, CreatePage
    src/components/       AppHeader, StatusBadge, ProtocolForm (shared)
    src/api.ts            thin typed fetch wrapper, one function per endpoint
    src/types.ts          Protocol/Dashboard/Admin/Committee types + shared constants
```

The client is TypeScript end-to-end (`.tsx`/`.ts`, no `.jsx` remains). Strict
mode is on (`client/tsconfig.json`) and `npm run typecheck` (`tsc --noEmit`)
is part of the workflow — run it after any client change. Vite resolves
`.js` before `.ts`/`.tsx`, so if you ever reintroduce a plain-`.js` file next
to a `.ts`/`.tsx` one, imports will silently pick up the wrong file.

**Shared navigation:** every page with the dark header bar (List, Committee,
Inspections, PAM, Amendments, Admin) renders the same `AppHeader` component
(`client/src/components/AppHeader.tsx`) with the same six tabs —
Protocols/Committee/Inspections/PAM/Amendments/Admin — highlighting the active
one via the `active` prop (`NavKey`). Don't add a new page with an inline
header, and don't add a new top-level tab without adding it to `NAV_TABS`.
Detail/Create/Application pages intentionally use the white breadcrumb bar
instead. Note `AppHeader` hardcodes the "EM" avatar; it's a placeholder for
whatever auth/persona UI comes later (see §1.5).

### Documentation audience (README = non-technical first)

The people who actually read `README.md` for this project are **university
animal research scientists and IACUC research-administration staff**, not
software developers — the ones who will assess/review the product and use
the demo. Keep that audience in mind whenever you touch the README:

- Write the README in **plain language**. Explain the *what* (a protocol
  has an application, review records, and a usage ledger) before any *how*
  (SQL, foreign keys, npm commands). Avoid jargon where a plain word works.
- **Don't let the README balloon with implementation detail.** Technical
  depth belongs in this file (AGENTS.md), in code comments, and in
  `server/src/db.js` / `server/src/openapi.js` — not in the README.
- **README structure**: after the plain-language intro (demo, what this is,
  what you can do), the README has exactly **two major collapsible
  sections**: *Part 1 — Understanding the data* (plain-language schema
  summary + diagram link) and *Part 2 — For developers* (install, run,
  API reference tables, DB swap, deploy). New developer-oriented content
  goes into Part 2's `<details>` block, not into new top-level sections or
  a separate developer doc.
- **Large tables and code blocks must be collapsible** (`<details>`) or
  linked out of line. The API endpoint tables are collapsed; the database
  diagram is intentionally *not* inlined in the README — it lives as a
  standalone image (`docs/database-schema.png`) linked with a
  `target="_blank"` anchor so it opens in its own tab where it can be
  zoomed. The diagram is generated from `docs/database-schema.mmd`
  (mermaid source); to regenerate after a schema change, re-render the mmd
  and commit the new PNG (e.g. `https://mermaid.ink/img/<base64url-of-the-
  mmd>?type=png` — the `?type=png` query is required, the endpoint returns
  JPEG otherwise — or use mermaid-cli) and keep the mmd in sync with
  `server/src/db.js`. Don't commit an SVG instead of the PNG: mermaid SVGs
  contain `<foreignObject>`, so GitHub refuses to preview them. Note GitHub
  strips `target="_blank"` from README HTML, so the anchor is best-effort
  (Ctrl/Cmd+click works everywhere).
- New README sections that are only useful to developers (schema internals,
  migration notes, per-endpoint detail) should default to collapsed or
  linked, and one-line summaries should carry the main message.

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

**E2E: 35 Playwright tests, all passing** (`npm run test:e2e` from the
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
- Transfer ownership seeds two `protocol_transfers` fixtures: 0155 → Dr. Hana
  Sato (Pending — 0155's PI is Dr. Wen Liu, who is deliberately *not* a
  personnel persona, which is exactly why `from_pi` is a text snapshot rather
  than an FK) and 0023 → Dr. Priya Nair (Rejected). The transfer recipient
  (`to`) **must** be a real personnel row — the first e2e run crashed in
  `seed.js` because the Rejected fixture targeted "Dr. Wen Liu". Also, the
  transfer panel's personnel dropdown renders every persona as an `<option>`,
  so `getByText("<person name>")` strict-mode resolves to both the list row and
  the option — admin.spec.js scopes those assertions with `.first()` (the list
  row renders before the transfer panel in DOM order). The same collision
  forced `getAllByText(name)[0]` in `AdminPage.test.tsx` and made the roles
  test's bare `getByRole("checkbox")` ambiguous (now scoped by label).
- The "adding a personnel member" admin spec was flaky under full-suite load:
  it clicked submit before the roles fetch populated the form's `role_id`,
  and `add()` in `AdminPage.tsx` returns early while `role_id` is empty — so
  no POST happened and the new person never appeared. Hardened with
  `await expect(roleSelect).not.toHaveValue("")` before clicking. If you add
  another early-return guard to a form like that, give its e2e spec the same
  wait-for-ready treatment.
- `e2e/tests/create.spec.js` (3 tests) drives the real "create protocol" UI
  flow that nothing else covered: it fills `/protocols/new`, submits, asserts
  it lands on the new Draft's detail page (with a research step carried
  through), asserts the empty-submit inline error, and asserts the duplicate-ID
  409 stays on the page. It created protocols 0999/0997 — safe IDs that don't
  collide with the seeded six or the e2e invariants. **The create flow's one
  real bug was a silent no-op**: `ProtocolForm.tsx`'s submit guard returned
  early on missing protocol number/title/PI with no message, no disabled
  button, and no `required` attributes, so clicking "Create protocol" on an
  incomplete form did literally nothing. Fixed by collecting the missing
  labels into a visible inline error ("Please fill in …"). Same guard is used
  by the detail page's Edit modal, so it covers "Save changes" too.
- Watch out for hand-mangled test fixtures: commit `0fa2676` (navigation)
  accidentally corrupted two lines in `InspectionsPage.test.tsx` — `id:` with
  no value and `toHaveBeenCalledWith(10, )` — which broke `npm run typecheck`
  (TS1109). Both were restored to their pre-commit values (`id: 20`,
  `toHaveBeenCalledWith(10, 20)`). If typecheck ever throws a syntax error in
  a file you didn't touch, diff it against the last commit before assuming the
  error is yours.

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

**CI (`ci.yml`) runs more than the unit suites.** Since Aug 2026 (PR #75), the
`client-tests` job also runs `npm run build:client` and `npm run typecheck`,
and a separate `e2e-tests` job runs the full Playwright suite on Chromium
(installs browsers with `npx playwright install --with-deps chromium`,
caches `~/.cache/ms-playwright` keyed on the lockfile, uploads
`playwright-report`/`test-results` as artifacts; the playwright config's
`webServer` array self-starts both servers). This exists because the tailwind
v4 bump (see §4) broke `vite build` on fresh installs without any unit test
failing — a build/typecheck/e2e gap that nothing on `main` covered.

### Package manager

npm workspaces (`npm install` at root installs both `server/` and
`client/`). We tried pnpm first but reverted — pnpm's build-script
approval gate (`ERR_PNPM_IGNORED_BUILDS`) caused repeated friction on
Windows. Don't reintroduce pnpm without a strong reason.

### Known dependency vulnerability (resolved — react-router v7)

The two moderate CVEs in `react-router-dom@6.30.4` —
[GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)
(open redirect via backslash in `<Link>`/`useNavigate`) and
[GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg)
(arbitrary constructor injection via `deserializeErrors()` in SSR
hydration) — were **resolved by the v7 upgrade (ROADMAP item 12, Aug
2026)**. The app now depends on `react-router@7.x` (the unified package;
`react-router-dom` is only a v7 compatibility re-export and is no longer
a dependency). The migration was a package swap plus an import swap
(`react-router-dom` → `react-router`) across 18 files and 3 `vi.mock`
targets — the app uses only declarative APIs (`BrowserRouter`,
`MemoryRouter`, `Routes`, `Route`, `Link`, `useNavigate`, `useParams`),
which are unchanged in v7. Verified by `tsc --noEmit`, 193 client tests,
and 2 consecutive clean 36-test e2e runs.

Notes from the upgrade, worth remembering:
- **`npm audit` still shows 7 vulnerabilities** (3 moderate, 2 high, 2
  critical) — all in the *dev toolchain* (`vite`, `vitest`, `esbuild`,
  `nanoid`, `@vitest/*`), none in the production `react-router`
  dependency. They were pre-existing, are dev-server/test-only, and are
  not part of item 12; fixing them means a Vite 5→8 + Vitest 3→4 major
  bump with its own regression pass.
- **Don't merge dependabot major bumps on the Vite toolchain piecemeal —
  it breaks the build.** Dependabot opened #58 (`@vitejs/plugin-react`
  4.7.0 → 6.0.5) and #61 (`vitest` 2.1.9 → 4.1.10) independently; both
  were merged into main, and both majors require **Vite ^8** as a peer
  while the repo pins `vite ^5.3.4`. The merged state produced an invalid
  peer tree (`npm ls` → ELSPROBLEMS) and `vite build` died with
  `ERR_PACKAGE_PATH_NOT_EXPORTED` (plugin-react 6.x imports
  `vite/internal`, which Vite 5 doesn't export) — main was red until the
  revert in #65. The fix: `client/package.json` back to plugin-react
  `^4.3.1` / vitest `^2.1.9` / vite `^5.3.4` / coverage-v8 `^2.1.9`, the
  lockfile reset to the last green baseline, and `.github/dependabot.yml`
  now **ignores semver-major updates** on `vite` /
  `@vitejs/plugin-react` / `vitest` / `@vitest/coverage-v8` so all four
  are upgraded together in one deliberate Vite 5→8 migration, not one
  package at a time. If you ever do run that migration, remove the
  ignore rules in the same PR that bumps the four packages. Also note the
  `@vitest/coverage-v8` and `vitest` majors are coupled — coverage-v8
  2.1.9 peer-requires vitest 2.1.9 — so bumping one without the other is
  always invalid.
- **v7 turns on `v7_startTransition` by default** (in v6 it was opt-in):
  route updates now render inside `React.startTransition` (low priority).
  Under cold Vite cache / CPU load, e2e can hit 30s timeouts on
  navigation asserts — observed as intermittent failures across
  dashboard/detail/admin/committee specs right after a fresh `npm
  install`. By 7.18 the `v7_*` opt-out flags are removed (`FutureConfig`
  is empty in the type defs), so this is not revertible from the app; it
  just makes the suite load-sensitive. The Playwright config sets
  `retries: 2`, and that's the cap: a test retries at most twice, and if
  it still fails after those two retries it is reported as a failed test —
  the suite is never rerun wholesale to chase a green. A retry cannot turn
  a deterministic failure green (it only rescues transient load-stall
  timeouts). The stateful specs (committee vote, admin species/personnel
  add, compliance mutations) are seeded to tolerate a re-run of a failed
  test. If flakiness reappears anyway, warm the Vite cache before the
  run.
- **The pre-existing e2e audit.spec race, fixed during this pass:** the
  audit log panel loads on mount with one slow `GET /api/audit`; if that
  fetch resolves *after* a species-add click, the new `species.created`
  entry's diff text (`"Chinchilla"`) collides with the species row, so
  `getByText("<species>")` trips strict mode (2 elements). Reproduced
  identically on the v6 baseline — it was not caused by v7. Fixed by
  scoping the species assertions with `.first()` in `audit.spec.js` and
  `admin.spec.js` (the species row renders above the audit panel, so
  `.first()` resolves to the intended element) and scoping the
  `species.created` asserts to `getByTestId("audit-entries")`. Same
  story as the Alpaca/Chinchilla entries: multiple species created
  earlier in a run can put several `species.created` rows in the panel.

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

**Transfer ownership (AGENTS.md §1.1):** a real approval workflow, not an
instant reassignment. Schema: `protocol_transfers` (protocol_id, `from_pi` —
a text snapshot of `protocols.pi` at request time, so it survives the source
person leaving the org — `to_personnel_id`, `reason`, status
`Pending`/`Approved`/`Rejected`, created_at, decision_date) with "one Pending
per protocol" enforced by a pre-insert `SELECT ... WHERE status='Pending'`
query rather than a partial unique index. Server (`server/src/routes/
transfers.js`): `GET /api/transfers?status=` (the IACUC-office queue;
`decorate()` joins protocol_title + recipient name), `POST /api/transfers`
(bulk, all-or-nothing via explicit BEGIN/COMMIT/ROLLBACK), `POST
/api/protocols/:id/transfers`, `PATCH /api/transfers/:id` (Approve reassigns
`protocols.pi`, rewrites the protocol's related-items "Personnel" PI label to
the recipient, and appends an "Approval history" entry; Reject just closes
the request). Client: a `TransferOwnershipModal` on the detail page
("Transfer ownership" button — shows an amber already-pending notice instead
of the form when a request is in flight) and a `TransferQueuePanel` on the
admin page (Pending queue with Approve/Reject plus a bulk form that selects
multiple protocols, the new PI, and a required reason). `protocol_transfers`
was added to the FK-safe `resetTables` order in `server/test/helpers.js`;
`routes-transfers.test.js` (15 tests) covers create/bulk/decide including the
409 in-flight and 404 paths, and transfers.js is at 100% lines.

**Three-pane amendment live-diff (AGENTS.md §1.1):** the amendment card on
`AmendmentsPage.tsx` now shows the three Loyola views as tabs — **Live
Changes** (proposed `new_value`, highlighted), **Previous Version**
(pre-amendment `previous_value`, struck through), **Changes** (an inline
delta between the two). Editing a field (Record Change / Save change) marks
the card dirty: the submit button swaps to **Save**/**Cancel**, an "Unsaved
changes" warning renders, and the card collapse, the protocol selector, and
the Approve/Reject actions are disabled until the change is explicitly saved
or cancelled; the page also attaches a window `beforeunload` guard while a
card is dirty. Covered by 2 new client tests in `AmendmentsPage.test.tsx`
(tab switching + save/cancel guard).

**Audit logging (Roadmap item 11):** an append-only `audit_log` table +
`server/src/audit.js` helper (`audit()` one-liner, `resolveActor(req)`,
`diffObject(before, after)`, and a `GET /api/audit` router with
`entity_type`/`entity_id`/`actor`/`action`/`provenance`/`from`+`to`/`limit`/
`offset` filters, newest first). Every mutation route (~48 handlers across
all 10 route files) calls `audit()` after a successful write; updates log a
field-level `details` diff, deletes look up the row first so the trail
captures what was removed. `actor`/`actor_key` are deliberately NOT FKs to
`personnel` so audit rows survive personnel deletion; `actor_key` is the
reserved home for a Roadmap-item-4 identity. `provenance` (`human`/`ai`/
`system`, CHECK-constrained, default `human`) is where AI-generated-content
labeling from §3.2 lands. `resolveActor(req)` precedence: `X-Actor` header →
`body.actor` → `personnel_id`/`reported_by`/`auditor_id` resolved to the
person's name → `"system"` fallback, so the "who" is reliable only where
identity already flows through the request (votes, comments, assignments,
personnel/OHSP bodies); everything else logs `system` — see §3.3. The admin
page renders an "Audit log" panel (below the transfer queue, no new nav tab)
with the filter inputs and an Apply/refresh control. `audit_log` is first in
the `resetTables` delete order; `routes-audit.test.js` (~26 tests) covers
the helper defaults, actor precedence, GET filters/400s/pagination, and
cross-route verification (protocol create/update diff/delete, species CRUD
with `X-Actor`, `vote.cast` actor = voter name, transfer create/approve,
drug/animal-use creates). One server gap remains: `audit.js` 98.44% lines
(the uncovered `safeParse` catch is untestable without feeding malformed
JSON, and the DB transaction-rollback error path in `protocol-form.js`
stays uncovered per the note above).

**Search filter-builder + saved filters + CSV export (Roadmap item 8):** the single substring search now sits alongside a stackable filter-builder on both the dashboard and the register. Server-side (already in place): `server/src/routes/filter.js` exports the whitelisted `PROTOCOL_FILTER_FIELDS`/`REGISTER_FILTER_FIELDS` definitions, `validateFilters`, and `applyFilters`; `GET /api/protocols?filters=[...]` and `GET /api/animal-usage?filters=[...]` both accept the clause array (the register list LEFT JOINs `protocols` so each row carries its `protocol_title`); saved-filters CRUD lives in `server/src/routes/saved-filters.js` (`GET/POST /api/saved-filters`, `DELETE /api/saved-filters/:id`, `search_type` scoping, audited). Client: `client/src/components/FilterBuilder.tsx` is a reusable, field-def-driven clause editor (enum fields render selects, operators constrained by field type via `operatorsFor` in `types.ts`); `ListPage.tsx` hosts it behind a "Filters" toggle with active-clause chips, a "Saved filters" menu (save current / apply / delete, `search_type: "protocol"`), and an "Export CSV" button for the filtered result set. `client/src/utils/csv.ts` holds the shared `downloadCsv`/`csvCell` helpers (extracted from `ReportsPage.tsx`, which still uses them). The client mirrors the server field defs as `PROTOCOL_FILTER_FIELD_DEFS` and `REGISTER_FILTER_FIELD_DEFS` in `types.ts` — keep them in sync with `filter.js`. The register-wide surface lives on the new "Register" nav tab (`client/src/pages/RegisterPage.tsx`, route `/register`): the same builder and saved filters with `search_type: "register"`, CSV export, and a row click that navigates to the protocol's detail page. The client `PROCEDURE_KEYS` in `types.ts` mirrors the server's `PROCEDURE_KEYS` in `protocol-form.js` exactly — the register builder's `procedure_key` enum passes server validation only because the two match.

Not implemented (see §1 above for the domain detail on each): conditional/
dynamic Table of Contents, and auth or role-based
access control. (Amendments now
have the three-pane live-diff; protocol version lineage, renewals, Transfer
Ownership, audit logging, the AAALAC compliance reports, and the item-8
filter-builder/saved-filters/CSV surface on both the dashboard and the
register are all implemented above.)

**Roadmap item 7 (file attachments) is intentionally last priority and must
never be proposed or started** — per product decision it is out of scope for
this demo; do not surface it in plans.

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

- **Audit logging** — implemented, with one known gap: the `audit_log`
  table records who/what/when for every write (see the "Audit log"
  section below), but the "who" is only as strong as the identity a
  request already carries. Authentication closes that gap.
- **Authentication + role-based access control** — Roadmap item 4. No
  audit trail is meaningful without knowing who "who" is. The reserved
  `actor_key` column on `audit_log` is where a verified identity goes
  once auth lands — no migration needed.
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

### Reports (Roadmap item 9) — Aug 2026

`GET /api/reports` (`server/src/routes/reports.js`) aggregates six
AAALAC-style reports from Appendix A content, rendered on the new "Reports"
nav tab (`client/src/pages/ReportsPage.tsx`, 7th tab after Amendments) with a
per-report CSV download:

1. **Restraint by species** — `protocol_procedures` rows where
   `procedure_key = 'prolonged_restraint'` AND `checked = 1`; the restraint
   narrative is the method.
2. **Euthanasia methods by species** — `protocol_drugs` rows whose
   `reason_for_use` ILIKE `%euthanasi%`; the drug name is the method.
3. **Surgery locations/types** — survival/non-survival surgery checked × the
   protocol's `research_steps[].location` JSON; one row per (protocol,
   surgery type, step location) with no dedupe.
4. **Multiple major recovery surgery** — `protocol_experiments` with
   `multiple_surgical_events = 1`.
5. **Analgesic/anesthetic drugs** — `protocol_drugs` whose `reason_for_use`
   matches `%anesth%`/`%analg%`.
6. **Use locations by species** — `research_steps` grouped by
   (location, species) with `protocol_count` + `protocol_ids` array.

Species resolves `COALESCE(au.species_strain, p.species)` via LEFT JOIN
`protocol_animal_use`, so a protocol's animal-use rows win over the protocol
column. `research_steps` is parsed defensively (malformed JSON → empty list).
Reports are **read-only** — no audit rows, and per AGENTS.md §1.6 they are
intentionally *not* the item-8 filter-builder/saved-filters scope; CSV export
is a client-side `URL.createObjectURL` helper inside `ReportsPage.tsx` (UTF-8
BOM-prefixed, cells quoted when they contain a comma/quote/newline).

E2E seed fixtures the spec depends on: 0150's prolonged-restraint narrative
("holding tube"), euthanasia drugs CO2/Pentobarbital/Tricaine (MS-222),
"Surgical suite A"/"Surgical suite B" step locations on 0139/0155/0150, and
two `multiple_surgical_events = 1` experiments. Keep those seeded if you
touch the seed; the reports spec asserts on them. The client test stubs
`URL.createObjectURL`/`revokeObjectURL` + `HTMLAnchorElement.prototype.click`
to assert the CSV content without a real download.

### Acting-as access banners — Aug 2026

The admin and committee pages now render an amber `AccessBanner`
(`client/src/components/AccessBanner.tsx`) when the acting persona (or lack
of one) isn't who those pages are for. It's a **courtesy signal, not access
control** — this app still has no auth (see §3.3), and the banner never
disables anything; it just tells a researcher who wandered onto the admin
page to pick an office persona. Eligibility is decided entirely client-side
from `getActingAs()` (`personnelId` + `roleName` only — the persona record
doesn't carry an `is_committee` flag):

- **Admin page** (`mode="office"`): allowed only when the persona's
  `roleName` is in `OFFICE_ROLES = ["IACUC Coordinator", "IACUC Chair"]`
  (mirrors server-side `IACUC_OFFICE_ROLES` in `committee.js`/`admin.js`).
- **Committee page** (`mode="committee"`): allowed when the persona is an
  office role **or** its `personnelId` is in the committee-eligible voter
  list — that's why `CommitteePage` passes `committeePersonnelIds={voters.map(v => v.id)}`.
- Anonymous (no persona picked) → banner always shows.

Two things worth remembering if you extend this:
1. `identity.ts` gained a tiny pub-sub (`onActingAsChange()`, called from
   `setActingAs()`) so the banner re-renders live when the header's
   `ActorPicker` changes the persona — localStorage alone gives no change
   notification, and the pages don't otherwise re-render on persona change.
2. When asserting on banner text in page tests, the persona **name** also
   appears in the `ActorPicker` header button, so `getByText(name)` is
   ambiguous — scope with `within(screen.getByTestId("access-banner"))`
   (the banner root carries `data-testid="access-banner"`). Same-name
   collision as the personnel-dropdown-vs-row issue noted in the e2e notes.

### Graduated access + e2e acting-as helper — Aug 2026

The server gained a graduated access gate (`server/src/access.js`): anonymous
users can read everything and author ordinary protocol content, but governance
writes need a known persona — committee review (votes/comments) needs a
committee-eligible role or office, admin CRUD / review assignments / transfer
& amendment decisions need an office role. Identity resolves (precedence) from
`X-Actor` → `body.actor` → `personnel_id`/`reported_by`/`auditor_id`, and the
client attaches `X-Actor` from `getActingAs()` in `api.ts`'s central `request`
wrapper. This is deliberately *not* auth — a self-declared name still passes.

**e2e**: governance-mutation specs must act as a persona before the page
loads. `e2e/utils/acting-as.js` exports `actAsOffice(request, page)`, which
resolves the seeded **Maya Patel** (IACUC Coordinator) and injects
`iacuc.actingAs` via `addInitScript` (so it's set before the app's own JS runs).
It's wired into every e2e mutation whose body carries **no identity** (they'd
401 otherwise): admin species/personnel add, audit species add, compliance
training/OHSP, and the committee review-method switch. Committee
vote/assign/comment tests need no helper — their bodies carry
`personnel_id` (the voter/assignee/commenter), which `resolvePerson` turns
into the acting identity. Gotchas from building this:
- The Playwright `request` fixture's default baseURL is the Vite dev server,
  whose SPA fallback returns index.html for unknown paths; the API also
  returns an HTML body for unknown routes (Express default 404). Either way
  `res.json()` throws `Unexpected token '<'`. Hit the API server directly
  (`http://localhost:4100/api/...`, absolute URL) — same pattern as
  `dashboard.spec.js`.
- There is **no bare `GET /api/personnel` list route** — the persona list is
  `GET /api/admin/personnel`. Don't guess the path.
- The committee review-method select (`changeMethod` in `CommitteePage.tsx`)
  is **optimistic**: it sets local state before the PATCH and never reverts on
  error, so a 401'd review-method switch test passes spuriously. That's why
  the review-method e2e test needs `actAsOffice` — without it the assertion
  only proves UI optimism, not a server write.
- `e2e/storageState.json` deliberately holds no persona (just the disclaimer
  dismiss); per-test `addInitScript` is the only place a persona is set, so
  specs stay independent.

### Tailwind v4 bump reverted + CSS/build coverage closed — Aug 2026

**Tailwind stays on v3 (`^3.4.19`).** Dependabot PR #69 bumped `tailwindcss`
3.4.19 → 4.3.3 and it was merged piecemeal. It broke `vite build` on any fresh
install, because v4 moved the PostCSS plugin into a separate
`@tailwindcss/postcss` package and dropped the v3 `@tailwind base/components/
utilities` directives, while this repo's `postcss.config.js` / `index.css` /
`tailwind.config.js` are still v3 wiring. Local `node_modules` was still on
3.4.19, so dev kept working and no test caught it. Reverted in PR #75 via
`git revert -m 1` of the merge (the lockfile conflicted because the postcss/
express/dotenv bumps landed after — resolved by restoring `^3.4.19` in
`client/package.json` and regenerating with `npm install --package-lock-only`,
which surgically downgrades only the tailwind entries). A real v4 migration is
a deliberate pass (install `@tailwindcss/postcss`, `@import "tailwindcss"`,
CSS-first `@theme` config), and dependabot is told to hold the major.

**Why it slipped through, and the three fixes:**
1. **Vitest stubbed CSS.** The `test` block in `client/vite.config.js` had no
   `css` option (default = imports stubbed, never postcss-processed), and
   `index.css` was imported only by `main.tsx`. Now `css: true` makes vitest
   process CSS through Vite's postcss pipeline (tailwind) and inject it into
   jsdom, and `client/src/__tests__/styles.test.tsx` imports `index.css` and
   asserts the injected `<style>` is non-empty and contains a real generated
   utility (`#032D60`). Verified it goes **red** with a broken postcss plugin
   and green on v3 — a future v4-ish breakage now fails the unit suite.
2. **CI ran neither build nor e2e.** `ci.yml`'s `client-tests` job now also
   runs `npm run build:client` and `npm run typecheck`; a new `e2e-tests` job
   runs the full Playwright suite on Chromium (see the Testing section). Root
   `package.json` gained a `typecheck` script (`--workspace=client`).
3. **Dependabot could reopen it.** `.github/dependabot.yml` now ignores
   semver-major for `tailwindcss`, `express`, and `dotenv` (same pattern as the
   Vite toolchain) until deliberate migration passes.

**Express 5 + dotenv 17 audit (kept, no revert).** PRs #71/#70 merged express
4.22.2 → 5.2.1 and dotenv 16.6.1 → 17.4.2 — both pure version bumps, no code.
Verdict after review: safe. All query params are scalars or single URL-encoded
JSON strings (`filters` sent via `URLSearchParams`, `JSON.parse(req.query
.filters)` server-side), so Express 5's default query-parser change
(extended → simple) doesn't apply; there are no `app.del`/wildcard/regex
routes or `app.param`; and dotenv is used only as `import "dotenv/config"`
(`server/src/index.js`, `seed.js`). The full server + e2e suites pass on both.
If a *future* express/dotenv major ever lands, re-audit before un-ignoring.
