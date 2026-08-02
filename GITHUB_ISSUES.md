# GitHub Issues — ready to create

Two ways to use this file:

## Option A — GitHub web UI (no tooling needed)
Go to your repo → Issues → New issue. Copy each Title/Body pair below.

## Option B — GitHub CLI (`gh`), one command per issue
If you have `gh` installed and authenticated (`gh auth login`), run this
from inside the repo folder:

```bash
gh issue create --title "TITLE HERE" --body "BODY HERE" --label enhancement
```

Or save each body to a temp file and use `--body-file` for the multi-line
ones below. Example for issue 1:

```bash
gh issue create --title "Wire up the Appendix A frontend" --body-file - --label enhancement <<'EOF'
Backend already exists in `server/src/routes/protocol-form.js`...
EOF
```

---

### Issue 1
**Title:** Wire up the Appendix A frontend

**Body:**
Backend already exists (`server/src/routes/protocol-form.js`): procedures
checklist, drug/dosing table, animal-use table, 3Rs/alternatives. None of
it has UI yet.

Add sections to `client/src/pages/DetailPage.jsx` to display and edit this
content.

See `AGENTS.md` §1.3 for the full field list and the Category D/E →
AV-consultation-required rule (already computed server-side, don't
duplicate that logic client-side).

**Labels:** enhancement, frontend

---

### Issue 2
**Title:** Amendment workflow with versioning

**Body:**
Real IACUC systems version protocols on amendment, they don't just edit
in place. Needed:
- Reason-required start ("Reason for Change", required free text)
- Only one amendment in flight per protocol at a time
- A three-way diff view per changed field: Live Changes (proposed,
  highlighted) / Previous Version / Changes (delta from last revision)
- A Protocol Versions Preview screen: every approved version listed with
  its own approval/expiration dates, version date, and source (New /
  Amendment / De Novo Document)

See `AGENTS.md` §1.1 for the full behavior spec distilled from Loyola's
4-step amendment manual.

**Labels:** enhancement, backend, frontend

---

### Issue 3
**Title:** Continuing Review & De Novo Review as distinct recurring events

**Body:**
These are two different things, not the same feature at different
intervals:
- **Continuing Review** — lightweight annual check-in on the *existing*
  protocol record.
- **De Novo Review** — full 3-year resubmission; effectively a new
  protocol that references the prior protocol number and summarizes
  3 years of findings.

Needs its own schema (recurring review events tied to a protocol), queue/
dashboard tiles, and workflow. See `AGENTS.md` §1.1.

**Labels:** enhancement, backend

---

### Issue 4
**Title:** Authentication + role-based access control

**Body:**
Currently anyone can vote as anyone (FCR voting just takes a
`personnel_id` in the request body) and edit any protocol. No login, no
session, no server-side enforcement of identity.

This is the biggest trust gap before this app could be used for anything
beyond a demo. Needs: real login, sessions/tokens, and enforcement that a
user can only cast votes / make edits as themselves.

**Labels:** enhancement, security, backend

---

### Issue 5
**Title:** Dynamic/conditional Table of Contents

**Body:**
Real Cayuse protocols aren't a fixed form — an initial "Options" page of
yes/no questions (funded? human tissues? off-campus work? housed outside
central facility >12hrs?) conditionally adds whole sections to the
protocol. A green checkmark appears per section once its required fields
are filled; all sections must be checked before submission.

This is a real architecture change — sections need to become data-driven
rather than hardcoded routes/components.

Note: per Wright State's Hazard Safety FAQ, a section's internal/hardcoded
name doesn't always match its repurposed content (their "Nanoparticles"
section is reused for all non-biological hazardous agents) — worth keeping
in mind if we mirror this pattern closely.

See `AGENTS.md` §1.2.

**Labels:** enhancement, architecture, backend, frontend

---

### Issue 6
**Title:** Register / animal usage ledger

**Body:**
Distinct from the *planned* animal-use table (Issue 1): a ledger of
*actual* animal ordering/usage transactions against an approved protocol
— species, pain level, transaction date. Closer to inventory/procurement
tracking than protocol content.

See `AGENTS.md` §1.4.

**Labels:** enhancement, backend

---

### Issue 7
**Title:** File attachments

**Body:**
Attachments related list currently stores filename strings only. Add real
file upload/storage for protocol narratives, SOPs, training certificates,
etc.

**Labels:** enhancement, backend, frontend

---

### Issue 8
**Title:** Search filter-builder + saved filters + CSV export

**Body:**
Current search is a single substring match on the protocol list page.
Real systems use a stackable filter builder (field + operator + value,
add multiple), with Save Filters / Recall Filters and CSV export — across
both Protocol Search and Register Search (once Issue 6 exists).

See `AGENTS.md` §1.6.

**Labels:** enhancement, backend, frontend

---

### Issue 9
**Title:** AAALAC-style compliance reports

**Body:**
Canned reports: restraint by species, euthanasia methods by species,
surgery locations/types, multiple major recovery surgical procedures,
analgesic/anesthetic drugs, use locations by species.

Mostly SQL aggregation once procedures/drugs/animal-use data (Issue 1) is
actually populated through the UI rather than just seeded.

**Labels:** enhancement, backend

---

### Issue 10
**Title:** Transfer Ownership workflow

**Body:**
Reassign a protocol to another PI through an approval queue — requires a
reason, sits pending until approved (not an instant reassignment), and
should support bulk-transferring multiple protocols from one PI to
another at once. Needs an audit trail.

See `AGENTS.md` §1.1.

**Labels:** enhancement, backend, frontend
