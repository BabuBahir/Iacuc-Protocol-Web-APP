# UI Expansion Plan — IACUC Research (Appendix A) & Review Workflow

Draft plan for what to add to the UI next, based on the reference material
below and the domain rules already in `AGENTS.md` §1. This is a *plan*, not
implementation — nothing here is wired up yet. It exists so the work can be
scoped, reviewed, and split into PRs. Each item lists the source it comes
from and the tests that must ship with it.

## Source material reviewed

| Source | What it is | Use |
|---|---|---|
| UC RAP Navigation Cheat-sheet (PDF, `researchhow2.uc.edu`, 15 pp) | Navigation + field-level descriptions of the UC IACUC RAP (Cayuse-based) | Protocol homepage tabs, Experiments & Procedures field detail, view/compare, offspring reporting |
| Cornell "Create an IACUC Protocol" guide (`guide.rass.cornell.edu`) | Step-by-step Cayuse protocol creation | Species Table, Housing/Use Locations, Substances list, Personnel tabs, Table-of-Contents checkmarks, submit rules |
| Cornell "Researcher Guide: Understanding the Desktop" | Cayuse desktop + status From→To→Action table | Left-menu workspace (Draft/Approved/Submitted/Reviews), review workflow states |
| Cornell training PNGs (`Desktop-Training.1/.3`) | Screenshots of the above | (Images — used via the Cornell guide text, see the two rows above) |
| UTMB IACUC Protocol Review Process Flowchart + FAQ + Policies | Review methods & lifecycle | FCR vs DMR vs Admin Review vs VVC, RMTSA, triennial review, amendment types |
| MSU `IACUC-protocol-intro-researchers.pdf` | — | **Blocked**: served behind Incapsula bot protection (download returned an HTML challenge page, not a PDF). Re-fetch in a browser or find an alternate mirror if needed. |

## How the 3 Rs (RRR) is implemented today

The Three Rs — **Replacement, Refinement, Reduction** — are the ethical
foundation of IACUC (§1 of AGENTS.md). Current implementation is one
`protocol_alternatives` row per protocol:

- **Schema** (`server/src/db.js`): `protocol_alternatives` PK = `protocol_id`.
  Fields: `replacement_text`, `refinement_text`, `reduction_text`,
  `lit_databases`, `lit_years_from`, `lit_years_to`, `lit_search_date`,
  `lit_keywords`, `lit_summary`, `colleague_name`, `colleague_date`,
  `colleague_notes`, `av_consult_date`.
- **Server** (`server/src/routes/protocol-form.js`, "3 Rs / alternatives"):
  `GET /:id/alternatives` does an `INSERT OR IGNORE` upsert then returns the
  row plus a **derived** `av_consultation_required` flag (true iff the
  trailing pain-category letter is D or E — the `/[DE]/i` bug that matched
  the "E" in "Cat**e**gory" is fixed). `PATCH` writes any whitelisted
  field, no `av_consult_date` is required by the server yet (only warned
  about client-side).
- **Client** (`client/src/pages/ApplicationPage.tsx`, card "3 Rs &
  alternatives"): three textareas (Replacement / Refinement / Reduction),
  a Literature search block (databases, years from/to, search date,
  keywords, summary), a Colleague consultation block (name/date/notes), and
  an Attending Veterinarian block (amber banner if D/E and no date; date
  input). Saved via `PATCH` through `api.updateAlternatives`.
- **Tests**: server `routes-protocol-form.test.js` covers the 3 Rs block
  (upsert-get, D/E derivation, patch fields, 404s). Client
  `ApplicationPage.test.tsx` covers rendering, save of `av_consult_date`,
  and the D/E banner. E2E `detail.spec.js` asserts seeded alternatives
  text renders on the Appendix A page.

**Gap vs. the reference material**: the RAP cheat-sheet is explicit that the
literature search is *required* (≥2 databases, date range, search date,
keywords, summary), the colleague consult is *optional*, and Category D/E
protocols *must* document an Attending Vet consultation — but none of these
is enforced server-side today. RRR narratives also deserve per-item
structure (see item 1c below) so reviewers can actually assess the 3 Rs,
which is the whole point of the mandate.

---

## Proposed additions (in suggested order)

### 1. Deepen the research/application page (ApplicationPage.tsx + protocol-form.js)

> **Status: DONE (1a, 1b, 1c).** Experiments (1a) landed as a `protocol_experiments`
> 1:N table with an experiments card on the application page (see AGENTS.md
> "Appendix A application page"); surgery-specific procedure details (1b) as
> four columns on `protocol_procedures` with a surgical-detail block and
> submit gating (see AGENTS.md "Surgery-specific procedure details"); 3 Rs
> enforcement + structure (1c) as `protocol_rrr_entries` + `GET /:id/validation`
> + server-enforced submit gating (see AGENTS.md "Structured 3 Rs
> justifications + submission enforcement"). The `protocol_experiment_procedures`
> join table was cut — experiments carry their own procedure questions instead.

The current page already has purpose/harm-benefit/scientific summaries,
the 15-item procedures checklist, drug table, animal-use table, and 3 Rs.
The "too basic" gap is mostly **structure and required-ness**, from the RAP
cheat-sheet and Cornell guide.

1a. **Procedures → Experiments & Procedures with step detail** (RAP pp. 5–8).
    Add a per-protocol "Experiments" concept: each experiment has
    - a descriptive name + detailed description (RAP: "detailed description
      of the experiment"),
    - whether multiple surgical events are performed on one animal (RAP
      Q2/Q3),
    - humane endpoints description, with a required justification when
      chronic conditions / persistent clinical signs exist (RAP Q4, pain
      category E),
    - monitoring plan (expected adverse effects, how/when monitored, when
      to contact veterinary staff, termination/euthanasia criteria — RAP
      Q10),
    - husbandry exceptions to standard practices (single housing for social
      animals, non-standard caging, medicated water/special diet,
      withholding enrichment, acclimation waiver, do-not-disturb, extended
      weaning — RAP Q8).
    Model as a new `protocol_experiments` table (1:N per protocol) with a
    `protocol_experiment_procedures` join table, or add the questions
    directly to the existing procedures checklist as richer rows — decide in
    implementation.

1b. **Surgery-specific procedure details** (RAP pp. 7–8). For surgery
    procedures add: detailed surgical description, aseptic preparation of
    animal/surgeon/instruments, anesthetics & analgesics with analgesia
    level (none/mild/moderate/profound), and post-op care & monitoring
    (how often, what care). Likely extra columns on the procedure rows or a
    `protocol_procedure_details` table.

1c. **3 Rs enforcement + structure** (strengthens existing `protocol_alternatives`):
    - Make the literature search fields **required** server-side when a
      protocol is submitted: ≥2 databases, non-empty years range, search
      date, keywords, summary. Add a `submitted` state validation endpoint
      (or extend submit) that returns per-section completeness — mirrors the
      Cornell "green checkmark per section before Submit" rule and the
      Cayuse validation behavior in AGENTS.md §1.2.
    - Split RRR into per-item entries instead of one blob: e.g. allow
      multiple R/Replacement/Refinement/Reduction justification rows
      (method + explanation), rather than three free-textareas.
    - Enforce `av_consult_date` server-side for Category D/E on submit
      (currently only an amber client banner).

### 2. Protocol homepage tabs & version comparison (RAP pp. 2–4)

- Give the detail page a tabbed layout: **Overview / Experiments /
  Documents / History**, matching the RAP protocol homepage.
- **Compare versions**: a `Compare` button + version dropdown that shows a
  diff of the current vs. a selected previous version (aligns with the
  amendment live-diff view planned in ROADMAP item 2 — build the primitive
  here and reuse it there).
- Documents tab shows attached docs (chemical safety advisories, SDS, etc.)
  — groundwork for ROADMAP item 7 (real file attachments).

### 3. Desktop / workspace view (Cornell "Understanding the Desktop")

Left-menu buckets by status — **Draft, Approved, Submitted, Annual Reviews
Due, 3rd Year Reviews Due, Draft Amendments, Protocol Transfers** — with
the Cornell `From → To → Action` semantics table shown on submitted items
(PI→IACUC Office "Initial Submission", IACUC Office→Member "Member(s)
Review", Member→IACUC Office, IACUC Office→PI "PI Revision(s)",
PI→IACUC Office "Revision Submission", IACUC Office→Meeting "Placed on
Meeting Agenda", Meeting→IACUC Office). Our status model in `types.ts`
(`Draft/Submitted/Veterinary Review/IACUC Review/Approved/Active`) is close;
the From→To→Action grid is a useful, low-cost fidelity win on the dashboard.

### 4. Review workflow depth (UTMB flowchart + FAQ)

- Represent the four review methods **FCR / DMR / Administrative Review /
  VVC** as a `review_method` field, plus an `RMTSA` (requires modification
  to secure approval) outcome state with a point-by-point response loop
  (UTMB FAQ; mirrors the "PI Revision(s)" loop from Cornell and the
  amendment-requires-reason rule from AGENTS.md §1.1).
- Add **triennial review** awareness: a due-date computation and a
  "3rd Year Review due" bucket (already partly in ROADMAP item 3).

### 5. Search/filter improvement (RAP p. 11, AGENTS.md §1.6)

- Replace the single substring search with the Cayuse-style filter dropdown
  (field + operator + value, stackable via "Add Filter", `%` wildcard
  support). This is ROADMAP item 8 — the RAP cheat-sheet gives the exact
  interaction (column-header sort, partial `%glu` wildcard match).

---

## Scope notes / decisions to confirm

- **MSU PDF is unreachable** from a script (bot protection). If the Cornell
  + RAP + UTMB material is enough (it is for most of the above), skip MSU;
  otherwise fetch it manually in a browser and drop the text in the repo.
- **Images can't be OCR'd by this agent** — the Cornell PNGs and UTMB
  flowchart were consumed via their source pages / search snippets instead.
  The plan above doesn't depend on anything only visible in the images.
- **Experiments modeling** (item 1a) is the one real architecture decision:
  new tables + joins vs. extending existing rows. Prefer new `1:N` tables
  for experiments so each experiment carries its own endpoints/monitoring/
  husbandry answers, matching how the RAP describes them as slide-in panels
  per experiment.

## Testing requirement (per AGENTS.md conventions)

Every item ships with tests, added in the same PR, not after:

- **Server** (`server/test/*.test.js`, node:test + supertest): new
  endpoints/tables get happy-path + edge cases (404s, FK violations,
  missing-required-field 400s, submit-validation completeness, DMR/FCR
  logic).
- **Client** (`client/src/pages/__tests__/*.test.tsx`, vitest + RTL):
  each new section renders from fixtures, saves call the right api wrapper,
  error paths surface.
- **E2E** (`e2e/tests/`, Playwright, against the shared seeded `e2e.db`):
  keep the existing invariants (0142 latest-submitted & vote-free, 0064
  Macaque, no casual committee-eligible personnel). Seed new fixtures for
  experiments/surgery-details/3Rs-completeness. Reuse the `detail.spec.js`
  read-only pattern for Appendix A and the `css.spec.js` note that Vite
  dev injects CSS as `<style>` tags.
- **Gates**: `npm run typecheck`, `npm test` (server + client suites),
  `npm run test:e2e`, then build before any PR.

---

## Full-featured IACUC administration endpoints (user-provided spec, documented for review)

Status: **documented only — nothing here is implemented yet.** This section
records a spec the user supplied for a full-featured IACUC administration
platform, organized into six domains. It extends (and overlaps with) items
1–5 above; where an endpoint already exists or partially exists, that's
flagged so we don't rebuild it. Per the user, add these to the plan for
review before any implementation.

Cross-cutting notes that apply to all six domains:

- **Schema**: most domains need new tables. Follow the existing conventions —
  `node:sqlite` with named params only for referenced keys, `PRAGMA
  foreign_keys = ON` (already set in `db.js`), `ON DELETE CASCADE` for
  protocol-owned child rows, and the `PRAGMA table_info` migration guard for
  any column added to an *existing* table. New tables just go in the
  `CREATE TABLE IF NOT EXISTS` block.
- **No auth/roles yet** (AGENTS.md §1.5, Roadmap item 4): review assignments,
  personnel compliance, and incident/CAPA fields imply "who can do what,"
  which this app can't enforce yet. Design the schema and endpoints so they
  still work single-persona, and add an `assigned_to`/`reported_by`
  `personnel_id` column up front so RBAC can be layered on later without a
  migration.
- **E2E invariants to preserve** (AGENTS.md §2): `IACUC-2026-0142` must stay
  latest-submitted + vote-free; `IACUC-2025-0064` must stay a Macaque. New
  review/comment endpoints must not write votes for 0142. Any new seeds that
  reference the committee voter list must not add committee-eligible
  personnel casually.
- **PII guardrails** (AGENTS.md §3): training/clearance endpoints touch
  `personnel.name`/`personnel.email` — PII. Fine in-app, but minimize what
  any future AI feature receives and never log free-text notes upstream.
  Animal data is not PHI; no human-subjects fields exist, so no BAA gate.

### A. Review & Approval Workflow

Endpoints: `POST /:id/reviews` (submit a review/vote/committee recommendation:
Approved / Modifications Required / Tabled), `GET /:id/reviews` (history,
assignments, comments), `POST /:id/comments` (inline/section-specific
feedback), `PATCH /:id/assign` (designated/primary reviewer).

- **Already exists (partial)**: `committee.js` implements FCR voting on
  protocols in review — one vote per `(protocol, personnel)` in
  `protocol_votes`, live tallies with comments. That's the "review" core.
- **Gap**: no DMR (designated-member review) vs. FCR distinction, no
  `review_method` field, no "Approved/Modifications Required/Tabled" outcome
  vocabulary beyond the current vote enum, no reviewer *assignment*, and no
  inline/section-specific comments. This is plan item 4's review-method depth
  (FCR/DMR/Admin/VVC, RMTSA). Recommended: extend `protocol_votes` /
  `committee.js` rather than a parallel `reviews` table, and introduce a
  `review_method` column on `protocols` (migration guard). Assignments likely
  need a `protocol_review_assignments` (or `protocol_reviewers`) 1:N table.

### B. Amendments & Annual Renewals

Endpoints: `POST /:id/amendments`, `GET /:id/amendments`, `POST /:id/renewals`.

- **Domain rules** (AGENTS.md §1.1): amendments are *versioned documents* —
  one in-flight per protocol, requires a "Reason for Change," live diff views
  (Live Changes / Previous Version / Changes), approved amendments produce a
  new protocol **version** (0001, 0002, ...) with its own approval/expiration
  dates. Continuing Review ≠ De Novo Review (lightweight annual check-in vs.
  full 3-year resubmission referencing the prior protocol number). Transfer
  Ownership is its own approval workflow.
- **Already exists**: none. Not implemented per AGENTS.md §1.1.
- **Recommended**: `amendments` 1:N table (`protocol_id`, `reason`,
  `status`, `created_at`) + an `amendment_changes`/version snapshot mechanism,
  and a `protocol_versions` table for the versioned lineage (Version, Approved
  date, Expiration date, Version date, Source: New/Amendment/De Novo). Renewals
  can reuse the same submission-gating machinery as 1c (`validateCompleteness`)
  but as a *new* review event, not a status flip. Largest domain — split into
  its own PR(s).

### C. Personnel, CITI Training & OHSP Compliance

Endpoints: `GET /api/personnel/:id/training`, `POST /api/personnel/:id/ohsp-clearance`,
`GET /api/protocols/:id/personnel` (verify all listed personnel meet active
compliance).

- **Already exists**: `admin.js` personnel CRUD (name, email, role). The
  detail page lists personnel per protocol via `related_items`/`personnel`
  joins ("Personnel (3)"). No compliance data.
- **Gap**: `citi_training` records (course, completed date, expiration,
  status) and `ohsp_clearance` status per person. `GET /:id/personnel` is a
  computed check (all personnel active & cleared) — read-only over the
  training/clearance tables, so it can be built after the data tables exist.
- **Recommended**: `personnel_training` 1:N table + an `ohsp` row (or columns
  on `personnel` via migration guard). Wire the "active compliance" check into
  the detail page's personnel panel as an amber/green status per person.

### D. Animal Census & Usage Tracking (the "Register" ledger)

> **Status: DONE.** `animal_usage_transactions` table + `GET/POST
> /:id/animal-usage` (`server/src/routes/animal-usage.js`) + a "Animal usage
> register" card on the application page with per-species tallies, an
> over-allowance flag, and a "Log usage" modal. Seeded transactions include an
> over-allowance fixture (`IACUC-2026-0021`, Rabbit 30 ordered + 40 used of
> 60). See AGENTS.md "Animal usage register".

Endpoints: `GET /:id/animal-usage` (tallies by species, USDA pain category
B/C/D/E, procedure), `POST /:id/animal-usage` (log ordering/usage against the
approved allowance).

- **Already exists (partial)**: `protocol_animal_use` is the *planned*
  count table (species/strain, sex, age, max_count) — the approved allowance.
- **Gap**: this is AGENTS.md §1.4's **Register** — a ledger of *actual*
  ordering/usage transactions (species, pain level, transaction date) against
  the approved protocol. Explicitly marked **not implemented**. The two must
  stay distinct: allowance is read from `protocol_animal_use`; the ledger is
  an append-only transactions table. Overshoot detection (sum(ledger) >
  allowance per species) is the "prevent over-use" value and a natural server
  rule to test.
- **Recommended**: `animal_usage_transactions` 1:N table + a tally query; the
  GET endpoint is read-only aggregation, POST is a logged transaction. Ties
  into plan item 4 / AGENTS.md §1.4.

### E. Post-Approval Monitoring (PAM) & Incident Reporting

Endpoints: `POST /api/incidents` (adverse event/deviation), `GET /:id/pam-audits`
(PAM history + site-visit reports), `PATCH /api/incidents/:id` (log CAPA,
close out).

- **Already exists**: none. Not implemented anywhere in the current schema.
- **Recommended**: `incidents` 1:N table (`protocol_id`, type, description,
  severity, status, corrective_action/CAPA, closed_at, reported_by
  `personnel_id`), and `pam_audits` 1:N (`protocol_id`, audit date, site
  visits, findings, report). Status lifecycle (Open → CAPA → Closed) is
  straightforward server logic; tie `PATCH` CAPA into the incident status
  transition so closing requires a CAPA recorded.
- Note: this is where compliance/inspections data starts to look like audit
  trail material — see AGENTS.md §3.3 (audit logging not yet implemented).

### F. Facility & Semi-Annual Inspections

Endpoints: `GET /api/facilities`, `POST /api/inspections`, `GET /api/inspections/:id/deficiencies`.

- **Already exists**: none. Not implemented.
- **Recommended**: `facilities` table (name, type: housing room / lab /
  surgical suite, species housed), `inspections` 1:N (`facility_id`, date,
  report, result), `inspection_deficiencies` 1:N (`inspection_id`, severity
  minor/major, description, remediation deadline, remediated_at). The
  deficiencies endpoint is a filtered read; remediation deadlines feed the
  "due/remediation overdue" dashboards. Semi-annual cadence is a computation,
  not stored state.

### Suggested ordering

Independent of items 1–5 above; smallest-to-largest surface area:

1. **D — Animal Census & Usage** (leverages existing `protocol_animal_use`,
   self-contained ledger + tally, clear test story for overshoot).
2. **A — Review workflow depth** (extends existing `committee.js`; plan item 4).
3. **C — Personnel compliance** (two data tables + read-only verification).
4. **F — Facilities & inspections** (three standalone tables, no protocol deps).
5. **E — PAM & incidents** (two tables + status/CAPA lifecycle).
6. **B — Amendments & renewals** (largest; versioned documents + diffs;
   depends on items 2/tabs for the version-comparison UI).

