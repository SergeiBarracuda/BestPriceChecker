import { describe, it, expect } from "vitest";
import { normalizeAndFilter } from "../src/pipeline/collect.js";
import type { RawOffer } from "../src/types.js";

function raw(over: Partial<RawOffer>): RawOffer {
  return {
    productName: "Máslo 250g",
    rawStore: "Lidl",
    priceText: "39,90 Kč",
    validityText: "22. 6. - 28. 6. 2026",
    category: null,
    source: "najdislevu.cz",
    sourceUrl: "https://www.najdislevu.cz/letaky/lidl",
    ...over,
  };
}

describe("normalizeAndFilter", () => {
  it("ponechá sledovaný obchod v povolené kategorii", () => {
    const res = normalizeAndFilter([raw({})]);
    expect(res.offers.length).toBe(1);
    expect(res.offers[0].store).toBe("Lidl");
    expect(res.skipped).toBe(0);
  });

  it("zahodí nesledovaný obchod", () => {
    const res = normalizeAndFilter([raw({ rawStore: "Billa" })]);
    expect(res.offers.length).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it("zahodí vyloučenou kategorii (pivo)", () => {
    const res = normalizeAndFilter([raw({ productName: "Pivo Gambrinus 0,5l" })]);
    expect(res.offers.length).toBe(0);
    expect(res.skipped).toBe(1);
  });
});
