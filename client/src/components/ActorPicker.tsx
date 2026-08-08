import { useEffect, useState } from "react";
import { User, ChevronDown } from "lucide-react";
import { api } from "../api";
import { getActingAs, setActingAs, type ActingAs } from "../identity";
import type { Personnel } from "../types";

// Not authentication — see identity.ts for the full reasoning. This is a
// courtesy "who am I" label so the audit trail (Roadmap item 11) can show a
// real name for a good-faith user, while staying entirely optional: closing
// this dropdown without picking anyone leaves the app exactly as anonymous
// as it was before.
export default function ActorPicker() {
  const [open, setOpen] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<ActingAs | null>(() => getActingAs());

  useEffect(() => {
    if (!open || personnel.length > 0) return;
    setLoading(true);
    api
      .listPersonnel()
      .then(setPersonnel)
      .catch(() => setPersonnel([])) // fail quiet — picker just shows empty, app still fully usable
      .finally(() => setLoading(false));
  }, [open, personnel.length]);

  const choose = (person: Personnel | null) => {
    if (!person) {
      setActingAs(null);
      setCurrent(null);
    } else {
      const next: ActingAs = {
        personnelId: person.id,
        name: person.name,
        roleName: person.role_name ?? "",
      };
      setActingAs(next);
      setCurrent(next);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/20 text-[12px] text-gray-100 hover:bg-white/10"
        title="Optional: pick who you're acting as, so your actions are attributed in the audit log. Not a login."
      >
        <User size={13} />
        {current ? current.name : "Acting as: anonymous"}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded shadow-lg border border-gray-200 z-50 text-gray-800">
          <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-100">
            Optional — attributes your actions in the audit log. Anyone can pick any name; this is not a login.
          </div>
          <button
            onClick={() => choose(null)}
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 border-b border-gray-100"
          >
            Stay anonymous
          </button>
          <div className="max-h-64 overflow-y-auto">
            {loading && <div className="px-3 py-2 text-[12px] text-gray-400">Loading…</div>}
            {!loading && personnel.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-gray-400">No personnel found.</div>
            )}
            {personnel.map(p => (
              <button
                key={p.id}
                onClick={() => choose(p)}
                className="w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50"
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-[11px] text-gray-500">{p.role_name}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
