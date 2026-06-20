import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parseAkcePage } from "../src/scrape/akcniceny.js";
import type { RawOffer } from "../src/types.js";

describe("parseAkcePage", () => {
  let offers: RawOffer[];

  beforeAll(() => {
    const html = readFileSync("fixtures/akcniceny-akce-sample.html", "utf8");
    offers = parseAkcePage(html, "https://www.akcniceny.cz/akce/test/");
  });

  it("najde alespoň jednu nabídku", () => {
    expect(offers.length).toBeGreaterThan(0);
  });

  it("každá nabídka má název produktu, obchod a text ceny", () => {
    for (const o of offers) {
      expect(o.productName.length).toBeGreaterThan(0);
      expect(o.rawStore.length).toBeGreaterThan(0);
      expect(o.priceText).toMatch(/\d/);
      expect(o.source).toBe("akcniceny.cz");
      expect(o.sourceUrl).toBe("https://www.akcniceny.cz/akce/test/");
    }
  });

  it("zachytí alespoň jednu cenu obsahující 'Kč'", () => {
    expect(offers.some((o) => /Kč/.test(o.priceText))).toBe(true);
  });

  it("rozpozná klubovou nabídku Tesco (alt 'Tesco Clubcard cena')", () => {
    expect(offers.some((o) => /Tesco/.test(o.rawStore))).toBe(true);
  });
});
