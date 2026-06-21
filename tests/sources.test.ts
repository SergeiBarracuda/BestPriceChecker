import { describe, it, expect } from "vitest";
import { STORE_SOURCES } from "../src/config/sources.js";

describe("STORE_SOURCES", () => {
  it("má URL obou zdrojů pro všech 5 obchodů", () => {
    const stores = ["Lidl", "Kaufland", "Globus", "Tesco", "Albert"] as const;
    for (const s of stores) {
      expect(STORE_SOURCES[s].najdislevuLeaflet).toMatch(/^https:\/\/www\.najdislevu\.cz\/letaky\//);
      expect(STORE_SOURCES[s].akcnicenyStorePage).toMatch(/^https:\/\/www\.akcniceny\.cz\/letaky\/.+\/$/);
    }
  });
});
