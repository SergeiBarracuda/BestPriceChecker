import { EXCLUDE_KEYWORDS, EXCLUDE_CATEGORIES } from "../config/categories.js";

function normalize(s: string): string {
  return s.toLowerCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Klíčové slovo se shoduje, jen když začíná na hranici slova (\b<kw>).
// Tím "gin" nezasáhne uvnitř "originál", ale prefixy jako "zahrad" stále
// chytí "zahradní".
function matchesKeyword(haystack: string, kw: string): boolean {
  return new RegExp("\\b" + escapeRegex(normalize(kw)), "i").test(haystack);
}

export function isExcluded(offer: { productName: string; category: string | null }): boolean {
  const haystack = normalize(`${offer.productName} ${offer.category ?? ""}`);
  if (EXCLUDE_KEYWORDS.some((kw) => matchesKeyword(haystack, kw))) return true;
  if (offer.category && EXCLUDE_CATEGORIES.some((c) => normalize(offer.category!).includes(normalize(c)))) {
    return true;
  }
  return false;
}
