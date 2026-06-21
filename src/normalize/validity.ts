interface PartialDate {
  day: number;
  month: number;
  year: number | null;
}

function toIso(d: PartialDate, fallbackYear: number | null): string | null {
  const year = d.year ?? fallbackYear;
  if (year === null) return null;
  if (d.month < 1 || d.month > 12 || d.day < 1 || d.day > 31) return null;
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

  const lastYear = matches[matches.length - 1].year;
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
