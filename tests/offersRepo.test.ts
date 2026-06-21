import { describe, it, expect } from "vitest";
import { dedupeForUpsert } from "../src/db/offersRepo.js";
import type { NormalizedOffer } from "../src/types.js";

function offer(over: Partial<NormalizedOffer>): NormalizedOffer {
  return {
    productName: "Pivo 0,5l",
    store: "Tesco",
    isClub: true,
    price: 12.9,
    priceMax: null,
    category: null,
    validFrom: null,
    validTo: "2026-06-22",
    source: "akcniceny.cz",
    sourceUrl: "https://www.akcniceny.cz/akce/test/",
    ...over,
  };
}

describe("dedupeForUpsert", () => {
  it("sloučí řádky se stejným konfliktním klíčem (poslední vyhrává)", () => {
    const out = dedupeForUpsert([offer({ price: 16.9 }), offer({ price: 12.9 })]);
    expect(out.length).toBe(1);
    expect(out[0].price).toBe(12.9);
  });

  it("ponechá řádky lišící se klíčem (jiný is_club)", () => {
    const out = dedupeForUpsert([offer({ isClub: true }), offer({ isClub: false })]);
    expect(out.length).toBe(2);
  });

  it("ponechá řádky lišící se obchodem", () => {
    const out = dedupeForUpsert([offer({ store: "Tesco" }), offer({ store: "Lidl" })]);
    expect(out.length).toBe(2);
  });
});
