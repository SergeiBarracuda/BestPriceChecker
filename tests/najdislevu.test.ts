import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parseNajdislevuLeaflet } from "../src/scrape/najdislevu.js";
import type { RawOffer } from "../src/types.js";

describe("parseNajdislevuLeaflet", () => {
  let offers: RawOffer[];
  beforeAll(() => {
    const html = readFileSync("fixtures/najdislevu-letak-lidl.html", "utf8");
    offers = parseNajdislevuLeaflet(html, "Lidl", "https://www.najdislevu.cz/letaky/lidl");
  });

  it("najde alespoň jednu nabídku", () => {
    expect(offers.length).toBeGreaterThan(0);
  });

  it("každá nabídka má název, cenu s číslem a obchod Lidl", () => {
    for (const o of offers) {
      expect(o.productName.length).toBeGreaterThan(0);
      expect(o.priceText).toMatch(/\d/);
      expect(o.rawStore).toBe("Lidl");
      expect(o.source).toBe("najdislevu.cz");
    }
  });

  it("text karty obsahuje rozsah platnosti pro alespoň jednu nabídku", () => {
    expect(offers.some((o) => /\d{1,2}\.\s*\d{1,2}\./.test(o.validityText ?? ""))).toBe(true);
  });
});
