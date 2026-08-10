// Sets a self-declared acting persona for a page before the app loads, so
// client/src/api.ts attaches the X-Actor header and the graduated access gate
// (server/src/access.js) accepts governance mutations (admin CRUD, compliance
// training/OHSP, transfers, committee votes/assignments). This is the e2e
// mirror of picking a name in the header's ActorPicker — no auth involved:
// the server trusts whatever name arrives in the header.
//
// We use the seeded "Maya Patel" (IACUC Coordinator): an office persona, so it
// can drive every office-gated endpoint AND it hides the client-side
// AccessBanner, keeping the specs' DOM free of banner text.

const OFFICE_NAME = "Maya Patel";
const OFFICE_ROLE = "IACUC Coordinator";

export async function actAsOffice(request, page) {
  // Hit the e2e API server directly (4100), not the Vite proxy — the `request`
  // fixture's default baseURL is the Vite dev server, whose SPA fallback
  // returns index.html for a bare /api path instead of forwarding it.
  const res = await request.get("http://localhost:4100/api/admin/personnel");
  const personnel = await res.json();
  const maya = personnel.find((p) => p.name === OFFICE_NAME);
  if (!maya) {
    throw new Error(`Seeded persona "${OFFICE_NAME}" not found — did seed.js change?`);
  }
  await page.addInitScript(
    ([personnelId, name, roleName]) => {
      localStorage.setItem("iacuc.actingAs", JSON.stringify({ personnelId, name, roleName }));
    },
    [maya.id, OFFICE_NAME, OFFICE_ROLE],
  );
}
