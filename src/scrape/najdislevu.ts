import { load } from "cheerio";
import type { RawOffer, CanonicalStore } from "../types.js";

// Struktura /letaky/<obchod> na najdislevu.cz (ověřeno proti reálné fixtuře):
// sekce "Top slevy" = opakující se karty .product-card; název .product-title,
// cena .product-price; platnost je rozsah dat v textu karty (předáme celý text
// karty jako validityText a parseValidity z něj rozsah vytáhne).
export function parseNajdislevuLeaflet(
  html: string,
  store: CanonicalStore,
  sourceUrl: string
): RawOffer[] {
  const $ = load(html);
  const offers: RawOffer[] = [];

  $(".product-card").each((_, el) => {
    const card = $(el);
    const productName = card.find(".product-title").first().text().replace(/\s+/g, " ").trim();
    const priceText = card.find(".product-price").first().text().replace(/\s+/g, " ").trim();
    if (!productName || !/\d/.test(priceText)) return;

    // Platnost hledáme jen v doplňkovém textu karty — odeber název a cenu,
    // ať se čísla z názvu/ceny nezamění za datum.
    const validityText = card
      .clone()
      .find(".product-title, .product-price")
      .remove()
      .end()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    offers.push({
      productName,
      rawStore: store,
      priceText,
      validityText,
      category: null,
      source: "najdislevu.cz",
      sourceUrl,
    });
  });

  return offers;
}
