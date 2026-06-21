import type { RawOffer, NormalizedOffer } from "../types.js";
import { normalizeOffer } from "../normalize/offer.js";
import { isExcluded } from "../filter/categoryFilter.js";

export function normalizeAndFilter(
  raws: RawOffer[]
): { offers: NormalizedOffer[]; skipped: number } {
  const offers: NormalizedOffer[] = [];
  let skipped = 0;
  for (const raw of raws) {
    const normalized = normalizeOffer(raw);
    if (!normalized) { skipped++; continue; }
    if (isExcluded(normalized)) { skipped++; continue; }
    offers.push(normalized);
  }
  return { offers, skipped };
}
