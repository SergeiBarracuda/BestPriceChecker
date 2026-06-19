import type { RawOffer, NormalizedOffer } from "../types.js";
import { parsePrice } from "./price.js";
import { parseValidity } from "./validity.js";
import { matchStore } from "../config/stores.js";

export function normalizeOffer(raw: RawOffer): NormalizedOffer | null {
  const matched = matchStore(raw.rawStore);
  if (!matched) return null;

  const { price, priceMax } = parsePrice(raw.priceText);
  const { validFrom, validTo } = parseValidity(raw.validityText);

  return {
    productName: raw.productName.trim(),
    store: matched.store,
    isClub: matched.isClub,
    price,
    priceMax,
    category: raw.category,
    validFrom,
    validTo,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
  };
}
