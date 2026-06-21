import {
  EXCLUDE_PHRASES,
  EXCLUDE_PREFIX_KEYWORDS,
  EXCLUDE_WORD_KEYWORDS,
  EXCLUDE_CATEGORIES,
} from "../config/categories.js";

function normalize(s: string): string {
  return s.toLowerCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Hranice slova s podporou Unicode: ASCII \b nefunguje s českou diakritikou
// (č, š, í… jsou pro \b nonword). Použijeme lookbehind/lookahead na "není
// písmeno" (\p{L}) s flagem u.
function matchesPrefix(haystack: string, kw: string): boolean {
  return new RegExp("(?<!\\p{L})" + escapeRegex(normalize(kw)), "iu").test(haystack);
}

function matchesWord(haystack: string, kw: string): boolean {
  return new RegExp("(?<!\\p{L})" + escapeRegex(normalize(kw)) + "(?!\\p{L})", "iu").test(haystack);
}

export function isExcluded(offer: { productName: string; category: string | null }): boolean {
  const haystack = normalize(`${offer.productName} ${offer.category ?? ""}`);
  if (EXCLUDE_PHRASES.some((p) => haystack.includes(normalize(p)))) return true;
  if (EXCLUDE_PREFIX_KEYWORDS.some((kw) => matchesPrefix(haystack, kw))) return true;
  if (EXCLUDE_WORD_KEYWORDS.some((kw) => matchesWord(haystack, kw))) return true;
  if (offer.category && EXCLUDE_CATEGORIES.some((c) => normalize(offer.category!).includes(normalize(c)))) {
    return true;
  }
  return false;
}
