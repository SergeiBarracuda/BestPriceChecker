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

  it("zvládne cenu nad 1000 s mezerou jako oddělovačem tisíců", () => {
    expect(parsePrice("1 299 Kč")).toEqual({ price: 1299, priceMax: null });
  });

  it("zvládne cenu nad 1000 s tečkou jako oddělovačem tisíců", () => {
    expect(parsePrice("1.299 Kč")).toEqual({ price: 1299, priceMax: null });
  });

  it("netvoří rozsah ze dvou čísel bez explicitního oddělovače (např. cena + sleva)", () => {
    expect(parsePrice("11,90 Kč -29 %")).toEqual({ price: 11.9, priceMax: null });
  });

  it("zvládne úzké a nezlomitelné mezery jako oddělovač tisíců (U+202F, U+00A0)", () => {
    const narrow = "1" + String.fromCharCode(0x202f) + "299 Kč";
    const nbsp = "1" + String.fromCharCode(0x00a0) + "299 Kč";
    expect(parsePrice(narrow)).toEqual({ price: 1299, priceMax: null });
    expect(parsePrice(nbsp)).toEqual({ price: 1299, priceMax: null });
  });
});
