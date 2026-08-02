# Session Briefing — IACUC Protocol Review App

Paste this into your Claude Project's custom instructions, or upload
alongside `AGENTS.md` / `ROADMAP.md` in the project's file knowledge base.
This is the short version — "what happened and where things stand."
`AGENTS.md` in the repo has the full domain research and technical detail;
this file just orients a new session fast.

## What this project is

A Salesforce-Lightning-styled IACUC (animal research protocol) review app.
Started as a single-file UI mockup, evolved into a real two-tier app:
Express + `node:sqlite` backend, Vite + React frontend, npm workspaces.

GitHub repo (created by the user, not yet pushed as of this writing):
`https://github.com/BabuBahir/iacuc-protocol-review-case-study`

## Current state (4 commits, all tests passing)

- **Core app**: protocol list/detail pages, dashboard metrics, admin
  section (species/roles/personnel), committee section (Full Committee
  Review voting with live tallies).
- **Backend for Appendix A content exists but has no frontend UI yet**:
  procedures checklist, drug/dosing table, animal-use table, 3Rs/
  alternatives. This is Roadmap item 1 — the most obvious next step.
- **Testing**: 76 backend tests (99.46% line coverage) + 23 frontend
  tests (65.63% line coverage, with `App.jsx`/`CommitteePage.jsx`/
  `DetailPage.jsx` at 0% — an explicit, documented gap, not an oversight).
  `npm test` from repo root runs both suites.
- **Docs that matter**: `AGENTS.md` (domain knowledge from real Cayuse/
  Loyola/NMSU IACUC documentation + repo conventions + HIPAA/AI-safety
  guardrails), `ROADMAP.md` (12 prioritized next steps), `GITHUB_ISSUES.md`
  (the same 12 items pre-formatted for `gh issue create`).

## Decisions worth knowing before touching this repo

- **`node:sqlite`, not `better-sqlite3`.** Native-addon builds were
  breaking on newer Node/Windows; switched to Node's built-in SQLite
  module. It's stricter about named parameters than `better-sqlite3` was
  — see AGENTS.md's Database section before writing new queries.
- **npm workspaces, not pnpm.** pnpm's build-script approval gate caused
  repeated Windows friction; reverted.
- **react-router-dom has 2 known moderate CVEs**, deliberately not
  upgraded yet (v7 is breaking). Assessed as low real-world risk for this
  app's actual usage pattern — full reasoning in AGENTS.md. Roadmap
  item 12.
- Two real bugs were found and fixed *by writing tests*, not by
  inspection — worth remembering when someone says "it looks fine":
  1. AV-consultation-required flag matched on a bad regex that
     accidentally matched the letter "E" in the word "Category" itself.
  2. Three `AdminPage` panels had a `useEffect(load, [])` bug where an
     async function's Promise was being treated as a cleanup function.

## What to do in a fresh session on this project

1. Read `AGENTS.md` first — it's written specifically to prevent
   re-deriving domain rules or re-hitting solved bugs.
2. Check `ROADMAP.md` for the next unchecked item.
3. Run `npm test` before making changes, to confirm the baseline is
   green, and again before considering any change done.
4. If it's a code-review interview/case-study context (repo name
   suggests so): the interesting things to point to are the domain
   research grounding (Appendix A field mapping, Cayuse workflow
   patterns), the test-driven bug catches above, and the honest
   documentation of what's *not* done rather than overselling coverage.
