import { describe, it, expect } from "vitest";
import { isExcluded } from "../src/filter/categoryFilter.js";

describe("isExcluded", () => {
  it("vyloučí alkohol podle názvu", () => {
    expect(isExcluded({ productName: "Vodka Finlandia 0,7l", category: null })).toBe(true);
  });

  it("vyloučí cigarety", () => {
    expect(isExcluded({ productName: "Marlboro cigarety", category: null })).toBe(true);
  });

  it("vyloučí zahradu/grilování podle kategorie", () => {
    expect(isExcluded({ productName: "Gril kulatý", category: "Zahrada a grilování" })).toBe(true);
  });

  it("vyloučí dámský sortiment", () => {
    expect(isExcluded({ productName: "Dámské tričko", category: "Oblečení" })).toBe(true);
  });

  it("PONECHÁ prací prášek (drogerie obecně není vyloučená)", () => {
    expect(isExcluded({ productName: "Ariel prací prášek 50 praní", category: "Drogerie" })).toBe(false);
  });

  it("PONECHÁ nářadí a elektroniku", () => {
    expect(isExcluded({ productName: "Aku vrtačka Bosch", category: "Nářadí" })).toBe(false);
    expect(isExcluded({ productName: "Vysavač Rowenta", category: "Elektro" })).toBe(false);
  });

  it("PONECHÁ běžnou potravinu", () => {
    expect(isExcluded({ productName: "Gervais sýr 80g", category: "Mléčné výrobky" })).toBe(false);
  });
});
