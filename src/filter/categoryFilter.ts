import { EXCLUDE_KEYWORDS, EXCLUDE_CATEGORIES } from "../config/categories.js";

function normalize(s: string): string {
  return s.toLowerCase();
}

export function isExcluded(offer: { productName: string; category: string | null }): boolean {
  const haystack = normalize(`${offer.productName} ${offer.category ?? ""}`);
  if (EXCLUDE_KEYWORDS.some((kw) => haystack.includes(normalize(kw)))) return true;
  if (offer.category && EXCLUDE_CATEGORIES.some((c) => normalize(offer.category!).includes(normalize(c)))) {
    return true;
  }
  return false;
}
