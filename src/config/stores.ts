import type { CanonicalStore, StoreMatch } from "../types.js";

const STORES: CanonicalStore[] = ["Lidl", "Kaufland", "Globus", "Tesco", "Albert"];

// Pořadí blízkosti (1 = nejblíž). UŽIVATEL si tyto hodnoty upraví podle reality.
export const STORE_PROXIMITY: Record<CanonicalStore, number> = {
  Lidl: 1,
  Kaufland: 2,
  Globus: 3,
  Tesco: 4,
  Albert: 5,
};

const CLUB_PATTERNS = /clubcard|kaufland card|lidl plus|m[ůu]j albert/i;

export function matchStore(rawName: string): StoreMatch | null {
  const text = rawName.trim();
  const store = STORES.find((s) => new RegExp(`\\b${s}\\b`, "i").test(text));
  if (!store) return null;
  return { store, isClub: CLUB_PATTERNS.test(text) };
}
