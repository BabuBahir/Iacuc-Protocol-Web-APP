import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { getActingAs, onActingAsChange, type ActingAs } from "../identity";

// Office staff can administer the admin page and the committee workflow. This
// mirrors the office role names seeded server-side (IACUC_OFFICE_ROLES in
// server/src/committee.js and admin.js) — the actor picker only knows role
// names, so eligibility is matched by name.
export const OFFICE_ROLES = ["IACUC Coordinator", "IACUC Chair"];

function useActingAs(): ActingAs | null {
  const [actingAs, setActingAs] = useState<ActingAs | null>(() => getActingAs());
  useEffect(() => onActingAsChange(() => setActingAs(getActingAs())), []);
  return actingAs;
}

interface AccessBannerProps {
  // "office" = only IACUC office staff (admin page); "committee" = committee-
  // eligible personnel OR office staff (committee page).
  mode: "office" | "committee";
  // Committee-eligible personnel ids (the voter list) — used to decide
  // eligibility for the committee page, since the acting persona only carries
  // a role name, not an is_committee flag.
  committeePersonnelIds?: number[];
}

export default function AccessBanner({ mode, committeePersonnelIds = [] }: AccessBannerProps) {
  const actingAs = useActingAs();
  const isOffice = actingAs !== null && OFFICE_ROLES.includes(actingAs.roleName);
  const isCommittee = actingAs !== null && committeePersonnelIds.includes(actingAs.personnelId);
  const canAccess = isOffice || (mode === "committee" && isCommittee);

  if (canAccess) return null;

  const who = mode === "office" ? "IACUC office staff only" : "Committee members only";
  const identityLine = actingAs
    ? `You're acting as ${actingAs.name} (${actingAs.roleName}).`
    : "You're not signed in as anyone yet.";
  const hint =
    mode === "office"
      ? "The lookup lists, compliance records, transfer decisions, and audit log are for IACUC office staff (e.g. IACUC Coordinator or IACUC Chair). Pick an office persona from the header menu to see them."
      : "Casting votes, assigning reviewers, and leaving section comments are for committee-eligible personnel or IACUC office staff. Pick a committee persona from the header menu to participate.";

  return (
    <div data-testid="access-banner" className="flex items-start gap-2 rounded bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-[13px]">
      <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-500" />
      <div>
        <span className="font-medium">{who} — </span>
        {identityLine} {hint}
      </div>
    </div>
  );
}
