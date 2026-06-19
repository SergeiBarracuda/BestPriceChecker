import { describe, it, expect } from "vitest";
import { normalizeOffer } from "../src/normalize/offer.js";
import type { RawOffer } from "../src/types.js";

const base: RawOffer = {
  productName: "Gambrinus 10 pivo 0,5l",
  rawStore: "Tesco Clubcard",
  priceText: "12,90 Kč",
  validityText: "Platí do 22. 6. 2026",
  category: "Nápoje",
  source: "akcniceny.cz",
  sourceUrl: "https://www.akcniceny.cz/akce/test/",
};

describe("normalizeOffer", () => {
  it("znormalizuje kompletní nabídku včetně klubové ceny", () => {
    expect(normalizeOffer(base)).toEqual({
      productName: "Gambrinus 10 pivo 0,5l",
      store: "Tesco",
      isClub: true,
      price: 12.9,
      priceMax: null,
      category: "Nápoje",
      validFrom: null,
      validTo: "2026-06-22",
      source: "akcniceny.cz",
      sourceUrl: "https://www.akcniceny.cz/akce/test/",
    });
  });

  it("vrátí null pro nesledovaný obchod", () => {
    expect(normalizeOffer({ ...base, rawStore: "Billa" })).toBeNull();
  });
});
