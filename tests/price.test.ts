import { describe, it, expect } from "vitest";
import { parsePrice } from "../src/normalize/price.js";

describe("parsePrice", () => {
  it("parsuje jednoduchou cenu s čárkou", () => {
    expect(parsePrice("12,90 Kč")).toEqual({ price: 12.9, priceMax: null });
  });

  it("parsuje cenový rozsah", () => {
    expect(parsePrice("16,90 - 19,90 Kč")).toEqual({ price: 16.9, priceMax: 19.9 });
  });

  it("parsuje celé číslo bez desetin", () => {
    expect(parsePrice("109 Kč")).toEqual({ price: 109, priceMax: null });
  });

  it("ignoruje okolní bílé znaky a nbsp", () => {
    expect(parsePrice("  9,90 Kč ")).toEqual({ price: 9.9, priceMax: null });
  });

  it("vrací null pro nečitelný text", () => {
    expect(parsePrice("akce")).toEqual({ price: null, priceMax: null });
  });
});
