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
`protocol_alternatives` tables:

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
inventory/procurement tracking than protocol content. **Not implemented.**

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
      protocol-form.js     Appendix A content: procedures/drugs/animal-use/alternatives
      admin.js             species / roles / personnel (personas) CRUD
      committee.js          FCR voting on protocols in review
  client/              Vite + React + react-router-dom
    src/pages/            ListPage, DetailPage, AdminPage, CommitteePage
    src/components/       StatusBadge (shared)
    src/api.js             thin fetch wrapper, one function per endpoint
```

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

**Backend: 81 tests, 98.56% lines / 89.23% branches / 93.44% functions**
(measured on `server/src/`, excluding `test/`). Every route file — protocols,
protocol-form, admin, committee — has both happy-path and edge-case coverage
(FK constraint violations, permission checks, duplicate-key conflicts, 404s).
The one meaningful gap is a database-transaction-rollback error path
(`protocol-form.js` lines 86–88) that's legitimately hard to trigger without
mocking the DB layer — left uncovered rather than writing a contrived test
for it.

Two real bugs were caught by writing these tests, not found any other way:
1. `av_consultation_required` used `/[DE]/i.test(pain_category)`, which
   matches the "E" in the word "Cat**e**gory" itself — every protocol was
   incorrectly flagged as needing AV consultation, not just Category D/E.
   Fixed to check the actual trailing category letter.
2. `AdminPage.jsx`'s three panels all used `useEffect(load, [])`, passing an
   async-returning function directly as the effect callback. React tries to
   call whatever an effect returns as its cleanup function; since `load()`
   returns a Promise, this threw `destroy is not a function` in a stricter
   test environment. Fixed to `useEffect(() => { load(); }, [])` in all
   three places.

**Frontend: 59 tests, 99.93% lines / 95.69% branches** (see
`vite.config.js`'s `test.coverage.exclude` for what's excluded — currently
just `main.jsx` and config files, not test files themselves). Every page —
List, Detail, Admin, Committee — plus `StatusBadge`, `api.js`, and `App.jsx`
routing is covered; the only sub-100% spots are a handful of branch lines in
DetailPage (84.61% branch) and CommitteePage (90.24% branch).

**E2E: 10 Playwright tests, all passing** (`npm run test:e2e` from the
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

Implemented: core protocol CRUD, dashboard metrics, Appendix A content
tables (procedures/drugs/animal-use/alternatives — backend only, **no
frontend UI wired up yet** for these), admin lookup lists (species/roles/
personnel), FCR committee voting with live tallies (including vote comments,
returned by the tally endpoints), and a 10-test Playwright e2e suite covering
dashboard/detail/committee/admin.

Not implemented (see §1 above for the domain detail on each): conditional/
dynamic Table of Contents, Continuing Review vs. De Novo Review as
distinct recurring events, amendment workflow with live-diff view and
protocol versioning, animal usage register/ledger, auth or role-based
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
