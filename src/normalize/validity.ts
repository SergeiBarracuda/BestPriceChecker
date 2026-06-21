interface PartialDate {
  day: number;
  month: number;
  year: number | null;
}

function toIso(d: PartialDate, fallbackYear: number): string | null {
  const year = d.year ?? fallbackYear;
  // Validace přes Date: neexistující kalendářní data (30. únor, 31. duben)
  // JS posune do dalšího měsíce — pak se hodnoty neshodují a vrátíme null.
  const date = new Date(year, d.month - 1, d.day);
  if (date.getFullYear() !== year || date.getMonth() !== d.month - 1 || date.getDate() !== d.day) {
    return null;
  }
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseValidity(
  text: string | null
): { validFrom: string | null; validTo: string | null } {
  if (!text) return { validFrom: null, validTo: null };

  // Najdi všechny výskyty "D. M." s volitelným rokem "D. M. YYYY"
  const matches = Array.from(
    text.matchAll(/(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/g)
  ).map((m): PartialDate => ({
    day: parseInt(m[1], 10),
    month: parseInt(m[2], 10),
    year: m[3] ? parseInt(m[3], 10) : null,
  }));

  if (matches.length === 0) return { validFrom: null, validTo: null };

  // Letáky často uvádějí jen "16. 6. - 22. 6." bez roku — doplň aktuální rok.
  const lastYear = matches[matches.length - 1].year ?? new Date().getFullYear();
  const hasOd = /\bod\b/i.test(text);

  if (matches.length >= 2) {
    return {
      validFrom: toIso(matches[0], lastYear),
      validTo: toIso(matches[1], lastYear),
    };
  }
  // jediné datum: "do" => validTo, "od" => validFrom
  const single = toIso(matches[0], lastYear);
  return hasOd
    ? { validFrom: single, validTo: null }
    : { validFrom: null, validTo: single };
}
