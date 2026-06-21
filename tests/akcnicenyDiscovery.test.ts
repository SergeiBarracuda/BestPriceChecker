import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { discoverAkceUrls } from "../src/scrape/akcnicenyDiscovery.js";

describe("discoverAkceUrls", () => {
  let urls: string[];
  beforeAll(() => {
    const html = readFileSync("fixtures/akcniceny-letaky-lidl.html", "utf8");
    urls = discoverAkceUrls(html, "https://www.akcniceny.cz/letaky/lidl/");
  });

  it("najde alespoň jednu /akce/ URL", () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  it("všechny URL jsou absolutní a míří na /akce/ na akcniceny.cz", () => {
    for (const u of urls) {
      expect(u).toMatch(/^https:\/\/www\.akcniceny\.cz\/akce\/.+/);
    }
  });

  it("URL jsou deduplikované", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});
