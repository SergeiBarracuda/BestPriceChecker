function toNumber(token: string): number {
  return parseFloat(token.replace(",", "."));
}

export function parsePrice(text: string): { price: number | null; priceMax: number | null } {
  // Sjednoť všechny druhy bílých znaků (vč. nbsp a úzkých mezer U+2009/U+202F)
  // na běžnou mezeru a odstraň oddělovače tisíců, ať se velká čísla
  // ("1 299 Kč", "1.299 Kč") nerozpadnou na dvě hodnoty.
  let s = text.replace(/\s/g, " ");
  s = s.replace(/(\d)\s(\d{3})\b/g, "$1$2"); // mezera jako oddělovač tisíců
  s = s.replace(/(\d)\.(\d{3})\b/g, "$1$2"); // tečka jako oddělovač tisíců

  // Rozsah POUZE při explicitním oddělovači mezi dvěma čísly (-, –, "až").
  const range = s.match(/(\d+(?:,\d+)?)\s*(?:-|–|až)\s*(\d+(?:,\d+)?)/);
  if (range) {
    return { price: toNumber(range[1]), priceMax: toNumber(range[2]) };
  }

  const single = s.match(/\d+(?:,\d+)?/);
  return single
    ? { price: toNumber(single[0]), priceMax: null }
    : { price: null, priceMax: null };
}
