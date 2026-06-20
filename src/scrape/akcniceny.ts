import { load } from "cheerio";
import type { RawOffer } from "../types.js";

// Struktura stránky /akce/<produkt>/ na akcniceny.cz (ověřeno proti reálné fixture):
//  - název produktu je v <h1>,
//  - každá nabídka obchodu má cenu v <p class="fs-20 fw-bold"> (text může
//    obsahovat i slevu, např. "11,90 Kč -29%"),
//  - název obchodu je v alt nejbližšího nadřazeného <img> (např. "Penny Market",
//    "Tesco Clubcard cena"),
//  - platnost je v .platnost-over-txt (společná pro stránku).
export function parseAkcePage(html: string, sourceUrl: string): RawOffer[] {
  const $ = load(html);
  const offers: RawOffer[] = [];

  const productName = $("h1").first().text().replace(/\s+/g, " ").trim();
  const validityText = $(".platnost-over-txt").first().text().replace(/\s+/g, " ").trim() || null;

  $("p.fs-20.fw-bold").each((_, el) => {
    const p = $(el);

    // Cena: úsek od čísla po "Kč" (odřízne případnou slevu "-29%" za cenou).
    const priceMatch = p.text().match(/[\d\s.,]+Kč/);
    if (!priceMatch) return;

    // Název obchodu: alt nejbližšího nadřazeného bloku obsahujícího <img>.
    let container = p;
    for (let depth = 0; depth < 6; depth++) {
      if (container.find("img[alt]").length > 0) break;
      const parent = container.parent();
      if (parent.length === 0) break;
      container = parent;
    }
    const rawStore = (container.find("img[alt]").first().attr("alt") ?? "").trim();
    if (!rawStore) return;

    offers.push({
      productName,
      rawStore,
      priceText: priceMatch[0].replace(/\s+/g, " ").trim(),
      validityText,
      category: null,
      source: "akcniceny.cz",
      sourceUrl,
    });
  });

  return offers;
}
