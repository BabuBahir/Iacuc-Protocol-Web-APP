// "Who am I" for this browser — deliberately NOT authentication.
//
// Product decision: this app stays anonymous-friendly. No login wall, no
// password, no signup — anyone can open it and start using it immediately.
// This module exists purely to make the audit trail (Roadmap item 11)
// meaningful for a good-faith user who wants their actions attributed to a
// real name instead of "system", without making that a requirement to use
// the app at all.
//
// This provides ZERO security. Anyone can pick any name, including someone
// else's. It is not a substitute for real authentication (Roadmap item 4
// remains open as "add real auth" for whenever the product actually needs
// access control, not just attribution) — it's a courtesy label, the same
// trust level as a sign-in sheet at a front desk, not a locked door.

const STORAGE_KEY = "iacuc.actingAs";

export interface ActingAs {
  personnelId: number;
  name: string;
  roleName: string;
}

export function getActingAs(): ActingAs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === "string" && typeof parsed.personnelId === "number") {
      return parsed as ActingAs;
    }
    return null;
  } catch {
    // Corrupt or inaccessible storage (private browsing, quota, etc.) —
    // fail open to "no one selected" rather than throw and break the app.
    return null;
  }
}

export function setActingAs(person: ActingAs | null): void {
  try {
    if (person) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(person));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Same fail-open reasoning as getActingAs — losing the "acting as" label
    // is a minor annoyance (falls back to "system" in the audit trail), not
    // something worth surfacing as an error to the user.
  }
  // Notify subscribers (e.g. the access banners) so UI that depends on the
  // current persona re-renders without a page navigation.
  listeners.forEach(listener => listener());
}

const listeners = new Set<() => void>();

// Subscribe to persona changes. Returns an unsubscribe function. Used by
// components (AccessBanner) that need to react to the actor picker changing
// while the page is mounted — localStorage alone gives no change notification.
export function onActingAsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The literal header name the backend's resolveActor() already checks
// first, per server/src/audit.js. Keeping this as a named export (not
// inlined in api.ts) so both files can cite it as the shared contract.
export const ACTOR_HEADER_NAME = "X-Actor";
