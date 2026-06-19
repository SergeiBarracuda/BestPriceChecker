export function parsePrice(text: string): { price: number | null; priceMax: number | null } {
  const normalized = text.replace(/ /g, " ");
  const numbers = Array.from(
    normalized.matchAll(/(\d+(?:[.,]\d+)?)/g),
    (m) => parseFloat(m[1].replace(",", "."))
  ).filter((n) => !Number.isNaN(n));

  if (numbers.length === 0) return { price: null, priceMax: null };
  if (numbers.length === 1) return { price: numbers[0], priceMax: null };
  return { price: numbers[0], priceMax: numbers[1] };
}
