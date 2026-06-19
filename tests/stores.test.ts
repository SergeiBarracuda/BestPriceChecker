import { describe, it, expect } from "vitest";
import { matchStore, STORE_PROXIMITY } from "../src/config/stores.js";

describe("matchStore", () => {
  it("rozpozná sledovaný obchod", () => {
    expect(matchStore("Lidl")).toEqual({ store: "Lidl", isClub: false });
  });

  it("rozpozná klubovou cenu (Clubcard)", () => {
    expect(matchStore("Tesco Clubcard")).toEqual({ store: "Tesco", isClub: true });
  });

  it("je odolný vůči velikosti písmen a okolnímu textu", () => {
    expect(matchStore("  KAUFLAND  ")).toEqual({ store: "Kaufland", isClub: false });
  });

  it("vrací null pro nesledovaný obchod", () => {
    expect(matchStore("Billa")).toBeNull();
  });
});

describe("STORE_PROXIMITY", () => {
  it("má pořadí pro všech 5 obchodů", () => {
    expect(Object.keys(STORE_PROXIMITY).sort()).toEqual(
      ["Albert", "Globus", "Kaufland", "Lidl", "Tesco"]
    );
  });
});
