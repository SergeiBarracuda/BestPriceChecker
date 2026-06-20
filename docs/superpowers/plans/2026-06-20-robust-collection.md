# BestPriceChecker — Plán 2: Robustní sběr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Naplnit databázi reálnými aktuálními top akcemi všech 5 obchodů ze dvou zdrojů — najdislevu.cz (šířka) a akcniceny.cz `/akce/` (porovnání napříč obchody) — a nahradit dosavadní seed URL skutečným vyhledáváním.

**Architecture:** Rozšíření pipeline z Plánu 1. Dva nové parsery (najdislevu leták, akcniceny discovery) produkují `RawOffer[]`, které procházejí stávajícím `normalizeOffer → isExcluded → upsertOffers`. Orchestrace iteruje „obchody × zdroje" se zdvořilou prodlevou mezi requesty a loguje běh per zdroj.

**Tech Stack:** Stejný jako Plán 1 — Node 20+ (vestavěný fetch), TypeScript ESM, Vitest, Cheerio, @supabase/supabase-js.

## Global Constraints

- Node.js >= 20; TypeScript ESM (`"type":"module"`); `.js` import specifikátory.
- Testy Vitest, **žádný test nesahá na živou síť** — parsery proti uloženým fixtures v `fixtures/`.
- HTTP požadavky s User-Agent `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36` (z Plánu 1, `src/scrape/fetchPage.ts`).
- Mezi requesty na stejný host prodleva ~1 s (robots.txt akcniceny.cz `Crawl-delay: 1`).
- Sledované obchody: `Lidl, Kaufland, Globus, Tesco, Albert`; cokoliv jiného se zahazuje (`matchStore`).
- Zdroje: `najdislevu.cz` a `akcniceny.cz`. Strukturovaně jen ~8–10 top akcí/obchod/zdroj (zbytek letáku jsou obrázky; OCR mimo rozsah).
- Deduplikace: řádky per zdroj (sloupec `source`); idempotence přes existující unikátní index. Žádná ingesce-time dedup napříč zdroji.
- Ceny v Kč, desetinná čárka; ukládají se jako `number`.

## Stávající kód z Plánu 1 (znovupoužití, beze změny pokud neuvedeno)

- `src/types.ts` — `RawOffer`, `NormalizedOffer`, `CanonicalStore`.
- `src/normalize/offer.ts` — `normalizeOffer(raw: RawOffer): NormalizedOffer | null`.
- `src/normalize/price.ts` — `parsePrice`.
- `src/normalize/validity.ts` — `parseValidity` (Task 1 ji vylepší o validaci data).
- `src/filter/categoryFilter.ts` + `src/config/categories.ts` — `isExcluded` (Task 1 opraví overmatch).
- `src/config/stores.ts` — `matchStore`, `STORE_PROXIMITY`.
- `src/scrape/akcniceny.ts` — `parseAkcePage(html, sourceUrl): RawOffer[]` (beze změny).
- `src/scrape/fetchPage.ts` — `fetchPage(url): Promise<string>`.
- `src/db/offersRepo.ts` — `upsertOffers`, `recordRun`.

---

## File Structure

```
src/
  config/sources.ts          # NOVÉ: per-obchod URL obou zdrojů
  scrape/najdislevu.ts       # NOVÉ: parser /letaky/<obchod> -> RawOffer[]
  scrape/akcnicenyDiscovery.ts # NOVÉ: /letaky/<obchod>/ -> [/akce/ URL]
  pipeline/collect.ts        # NOVÉ: normalizeAndFilter (čistá, testovatelná)
  pipeline/run.ts            # PŘEPSAT: orchestrace obchody × zdroje + throttle
  config/categories.ts       # ÚPRAVA (Task 1): overmatch fix
  filter/categoryFilter.ts   # ÚPRAVA (Task 1): shoda na hranici slova
  normalize/validity.ts      # ÚPRAVA (Task 1): validace data
tests/
  categoryFilter.test.ts     # rozšířit (Task 1)
  validity.test.ts           # rozšířit (Task 1)
  najdislevu.test.ts         # NOVÉ
  akcnicenyDiscovery.test.ts # NOVÉ
  collect.test.ts            # NOVÉ
fixtures/
  najdislevu-letak-lidl.html   # zachyceno reconem (Task 3 ověří/dozachytí)
  akcniceny-letaky-lidl.html   # zachyceno reconem (Task 4 ověří/dozachytí)
```

---

### Task 1: Údržbové opravy z review Plánu 1

**Files:**
- Modify: `src/filter/categoryFilter.ts`, `src/config/categories.ts`, `src/normalize/validity.ts`
- Test: `tests/categoryFilter.test.ts`, `tests/validity.test.ts`

**Interfaces:**
- Consumes: nic nového
- Produces: beze změny signatur (`isExcluded`, `parseValidity`) — jen přesnější chování.

- [ ] **Step 1: Přidej padající testy do `tests/categoryFilter.test.ts`**

Vlož do `describe("isExcluded", ...)`:
```ts
  it("PONECHÁ produkt, kde je klíčové slovo jen vnořeným podřetězcem (originál vs gin)", () => {
    expect(isExcluded({ productName: "Coca-Cola Originál 2l", category: null })).toBe(false);
  });

  it("stále vyloučí slovo na hranici (pivo)", () => {
    expect(isExcluded({ productName: "Pivo Gambrinus 0,5l", category: null })).toBe(true);
  });

  it("stále respektuje prefixová klíčová slova (zahradní, dámské)", () => {
    expect(isExcluded({ productName: "Zahradní gril", category: null })).toBe(true);
    expect(isExcluded({ productName: "Dámské tričko", category: null })).toBe(true);
  });
```

- [ ] **Step 2: Přidej padající test do `tests/validity.test.ts`**

Vlož do `describe("parseValidity", ...)`:
```ts
  it("odmítne nesmyslné datum (měsíc/den mimo rozsah)", () => {
    expect(parseValidity("40. 13. 2026")).toEqual({ validFrom: null, validTo: null });
  });
```

- [ ] **Step 3: Spusť testy — musí padat**

Run: `npx vitest run tests/categoryFilter.test.ts tests/validity.test.ts`
Expected: FAIL — `Coca-Cola Originál` je dnes vyloučena (substring „gin" v „originál"); nesmyslné datum dnes projde.

- [ ] **Step 4: Oprav `src/filter/categoryFilter.ts` na shodu od hranice slova**

```ts
import { EXCLUDE_KEYWORDS, EXCLUDE_CATEGORIES } from "../config/categories.js";

function normalize(s: string): string {
  return s.toLowerCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Klíčové slovo se shoduje, jen když začíná na hranici slova (\b<kw>).
// Tím "gin" nezasáhne uvnitř "originál", ale prefixy jako "zahrad" stále
// chytí "zahradní".
function matchesKeyword(haystack: string, kw: string): boolean {
  return new RegExp("\\b" + escapeRegex(normalize(kw)), "i").test(haystack);
}

export function isExcluded(offer: { productName: string; category: string | null }): boolean {
  const haystack = normalize(`${offer.productName} ${offer.category ?? ""}`);
  if (EXCLUDE_KEYWORDS.some((kw) => matchesKeyword(haystack, kw))) return true;
  if (offer.category && EXCLUDE_CATEGORIES.some((c) => normalize(offer.category!).includes(normalize(c)))) {
    return true;
  }
  return false;
}
```

- [ ] **Step 5: Oprav `src/normalize/validity.ts` — validuj datum v `toIso`**

Nahraď tělo funkce `toIso`:
```ts
function toIso(d: PartialDate, fallbackYear: number | null): string | null {
  const year = d.year ?? fallbackYear;
  if (year === null) return null;
  if (d.month < 1 || d.month > 12 || d.day < 1 || d.day > 31) return null;
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
```

- [ ] **Step 6: Spusť testy — musí projít**

Run: `npx vitest run tests/categoryFilter.test.ts tests/validity.test.ts`
Expected: PASS (categoryFilter 10 testů, validity 6 testů).

- [ ] **Step 7: Commit**

```bash
git add src/filter/categoryFilter.ts src/normalize/validity.ts tests/categoryFilter.test.ts tests/validity.test.ts
git commit -m "fix: word-boundary keyword matching and validity date validation"
```

---

### Task 2: Konfigurace zdrojů per obchod

**Files:**
- Create: `src/config/sources.ts`
- Test: `tests/sources.test.ts`

**Interfaces:**
- Consumes: `CanonicalStore` z `src/types.ts`
- Produces:
  - `interface StoreSources { najdislevuLeaflet: string; akcnicenyStorePage: string }`
  - `STORE_SOURCES: Record<CanonicalStore, StoreSources>`

- [ ] **Step 1: Napiš padající test `tests/sources.test.ts`**

```ts
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
```

- [ ] **Step 2: Spusť test — musí padat**

Run: `npx vitest run tests/sources.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Implementuj `src/config/sources.ts`**

```ts
import type { CanonicalStore } from "../types.js";

export interface StoreSources {
  najdislevuLeaflet: string;
  akcnicenyStorePage: string;
}

export const STORE_SOURCES: Record<CanonicalStore, StoreSources> = {
  Lidl: {
    najdislevuLeaflet: "https://www.najdislevu.cz/letaky/lidl",
    akcnicenyStorePage: "https://www.akcniceny.cz/letaky/lidl/",
  },
  Kaufland: {
    najdislevuLeaflet: "https://www.najdislevu.cz/letaky/kaufland",
    akcnicenyStorePage: "https://www.akcniceny.cz/letaky/kaufland/",
  },
  Globus: {
    najdislevuLeaflet: "https://www.najdislevu.cz/letaky/globus",
    akcnicenyStorePage: "https://www.akcniceny.cz/letaky/globus/",
  },
  Tesco: {
    najdislevuLeaflet: "https://www.najdislevu.cz/letaky/tesco",
    akcnicenyStorePage: "https://www.akcniceny.cz/letaky/tesco/",
  },
  Albert: {
    najdislevuLeaflet: "https://www.najdislevu.cz/letaky/albert",
    akcnicenyStorePage: "https://www.akcniceny.cz/letaky/albert/",
  },
};
```

- [ ] **Step 4: Spusť test — musí projít**

Run: `npx vitest run tests/sources.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/sources.ts tests/sources.test.ts
git commit -m "feat: per-store source URLs for najdislevu and akcniceny"
```

---

### Task 3: Parser najdislevu.cz letáku

**Files:**
- Create: `src/scrape/najdislevu.ts`, `fixtures/najdislevu-letak-lidl.html` (pokud chybí)
- Test: `tests/najdislevu.test.ts`

**Interfaces:**
- Consumes: `RawOffer`, `CanonicalStore`, Cheerio
- Produces: `parseNajdislevuLeaflet(html: string, store: CanonicalStore, sourceUrl: string): RawOffer[]`

- [ ] **Step 1: Zajisti fixturu (pokud chybí)**

Run:
```bash
test -f fixtures/najdislevu-letak-lidl.html || curl -sSL \
  -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" \
  "https://www.najdislevu.cz/letaky/lidl" -o fixtures/najdislevu-letak-lidl.html
```
Expected: soubor existuje (~100 kB).

- [ ] **Step 2: Napiš test `tests/najdislevu.test.ts`**

```ts
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
```

- [ ] **Step 3: Spusť test — musí padat**

Run: `npx vitest run tests/najdislevu.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 4: Implementuj `src/scrape/najdislevu.ts`**

> Selektory ověřené proti reálné fixtuře: opakující se karta `.product-card`,
> název `.product-title`, cena `.product-price`; platnost je rozsah dat v textu
> karty (předáme celý text karty jako `validityText`, `parseValidity` z něj
> rozsah vytáhne).

```ts
import { load } from "cheerio";
import type { RawOffer, CanonicalStore } from "../types.js";

export function parseNajdislevuLeaflet(
  html: string,
  store: CanonicalStore,
  sourceUrl: string
): RawOffer[] {
  const $ = load(html);
  const offers: RawOffer[] = [];

  $(".product-card").each((_, el) => {
    const card = $(el);
    const productName = card.find(".product-title").first().text().replace(/\s+/g, " ").trim();
    const priceText = card.find(".product-price").first().text().replace(/\s+/g, " ").trim();
    if (!productName || !/\d/.test(priceText)) return;

    offers.push({
      productName,
      rawStore: store,
      priceText,
      validityText: card.text().replace(/\s+/g, " ").trim(),
      category: null,
      source: "najdislevu.cz",
      sourceUrl,
    });
  });

  return offers;
}
```

- [ ] **Step 5: Spusť test — musí projít**

Run: `npx vitest run tests/najdislevu.test.ts`
Expected: PASS, 3 testy. Pokud padá, ověř selektory v reálné fixtuře a uprav krok 4.

- [ ] **Step 6: Commit**

```bash
git add src/scrape/najdislevu.ts tests/najdislevu.test.ts fixtures/najdislevu-letak-lidl.html
git commit -m "feat: parse najdislevu.cz leaflet top deals into raw offers"
```

---

### Task 4: Discovery /akce/ URL z akcniceny.cz

**Files:**
- Create: `src/scrape/akcnicenyDiscovery.ts`, `fixtures/akcniceny-letaky-lidl.html` (pokud chybí)
- Test: `tests/akcnicenyDiscovery.test.ts`

**Interfaces:**
- Consumes: Cheerio
- Produces: `discoverAkceUrls(html: string, baseUrl: string): string[]` — absolutní `/akce/` URL, deduplikované.

- [ ] **Step 1: Zajisti fixturu (pokud chybí)**

Run:
```bash
test -f fixtures/akcniceny-letaky-lidl.html || curl -sSL \
  -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" \
  "https://www.akcniceny.cz/letaky/lidl/" -o fixtures/akcniceny-letaky-lidl.html
```
Expected: soubor existuje (~130 kB).

- [ ] **Step 2: Napiš test `tests/akcnicenyDiscovery.test.ts`**

```ts
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
```

- [ ] **Step 3: Spusť test — musí padat**

Run: `npx vitest run tests/akcnicenyDiscovery.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 4: Implementuj `src/scrape/akcnicenyDiscovery.ts`**

```ts
import { load } from "cheerio";

export function discoverAkceUrls(html: string, baseUrl: string): string[] {
  const $ = load(html);
  const set = new Set<string>();
  $('a[href^="/akce/"]').each((_, a) => {
    const href = $(a).attr("href");
    if (href) set.add(new URL(href, baseUrl).toString());
  });
  return [...set];
}
```

- [ ] **Step 5: Spusť test — musí projít**

Run: `npx vitest run tests/akcnicenyDiscovery.test.ts`
Expected: PASS, 3 testy.

- [ ] **Step 6: Commit**

```bash
git add src/scrape/akcnicenyDiscovery.ts tests/akcnicenyDiscovery.test.ts fixtures/akcniceny-letaky-lidl.html
git commit -m "feat: discover akce URLs from akcniceny store pages"
```

---

### Task 5: Normalizace + filtr dávky (čistá funkce)

**Files:**
- Create: `src/pipeline/collect.ts`
- Test: `tests/collect.test.ts`

**Interfaces:**
- Consumes: `RawOffer`, `NormalizedOffer`, `normalizeOffer`, `isExcluded`
- Produces: `normalizeAndFilter(raws: RawOffer[]): { offers: NormalizedOffer[]; skipped: number }`
  - zahodí nesledované obchody (`normalizeOffer` → null) i vyloučené kategorie (`isExcluded`), počítá `skipped`.

- [ ] **Step 1: Napiš padající test `tests/collect.test.ts`**

```ts
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
```

- [ ] **Step 2: Spusť test — musí padat**

Run: `npx vitest run tests/collect.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Implementuj `src/pipeline/collect.ts`**

```ts
import type { RawOffer, NormalizedOffer } from "../types.js";
import { normalizeOffer } from "../normalize/offer.js";
import { isExcluded } from "../filter/categoryFilter.js";

export function normalizeAndFilter(
  raws: RawOffer[]
): { offers: NormalizedOffer[]; skipped: number } {
  const offers: NormalizedOffer[] = [];
  let skipped = 0;
  for (const raw of raws) {
    const normalized = normalizeOffer(raw);
    if (!normalized) { skipped++; continue; }
    if (isExcluded(normalized)) { skipped++; continue; }
    offers.push(normalized);
  }
  return { offers, skipped };
}
```

- [ ] **Step 4: Spusť test — musí projít**

Run: `npx vitest run tests/collect.test.ts`
Expected: PASS, 3 testy.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/collect.ts tests/collect.test.ts
git commit -m "feat: extract normalizeAndFilter batch helper"
```

---

### Task 6: Přepis orchestrace pipeline (obchody × zdroje)

**Files:**
- Modify: `src/pipeline/run.ts` (kompletní přepis)

**Interfaces:**
- Consumes: `fetchPage`, `parseNajdislevuLeaflet`, `discoverAkceUrls`, `parseAkcePage`, `normalizeAndFilter`, `upsertOffers`, `recordRun`, `STORE_SOURCES`
- Produces:
  - `runPipeline(): Promise<{ najdislevu: number; akcniceny: number; skipped: number }>` — počty uložené per zdroj a celkem přeskočené.
  - `src/pipeline/run.ts` spustitelný přes `npm run scrape`.

> Orchestrace není pokrytá jednotkovým testem (vyžadovala by živou síť/Supabase) — logika normalizace/filtru je v `normalizeAndFilter` (Task 5, testováno). Ověření zde: `tsc` + ruční živý běh.

- [ ] **Step 1: Přepiš `src/pipeline/run.ts`**

```ts
import "dotenv/config";
import { fetchPage } from "../scrape/fetchPage.js";
import { parseNajdislevuLeaflet } from "../scrape/najdislevu.js";
import { discoverAkceUrls } from "../scrape/akcnicenyDiscovery.js";
import { parseAkcePage } from "../scrape/akcniceny.js";
import { normalizeAndFilter } from "./collect.js";
import { upsertOffers, recordRun } from "../db/offersRepo.js";
import { STORE_SOURCES } from "../config/sources.js";
import type { CanonicalStore, NormalizedOffer, RawOffer } from "../types.js";

const CRAWL_DELAY_MS = 1000;
const STORES: CanonicalStore[] = ["Lidl", "Kaufland", "Globus", "Tesco", "Albert"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function collectNajdislevu(): Promise<{ raws: RawOffer[]; errors: number }> {
  const raws: RawOffer[] = [];
  let errors = 0;
  for (const store of STORES) {
    const url = STORE_SOURCES[store].najdislevuLeaflet;
    try {
      const html = await fetchPage(url);
      raws.push(...parseNajdislevuLeaflet(html, store, url));
    } catch (err) {
      errors++;
      console.error(`najdislevu ${store} selhal: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(CRAWL_DELAY_MS);
  }
  return { raws, errors };
}

async function collectAkcniceny(): Promise<{ raws: RawOffer[]; errors: number }> {
  const raws: RawOffer[] = [];
  let errors = 0;
  for (const store of STORES) {
    const storePage = STORE_SOURCES[store].akcnicenyStorePage;
    try {
      const listHtml = await fetchPage(storePage);
      await sleep(CRAWL_DELAY_MS);
      const akceUrls = discoverAkceUrls(listHtml, storePage);
      for (const akceUrl of akceUrls) {
        try {
          const html = await fetchPage(akceUrl);
          raws.push(...parseAkcePage(html, akceUrl));
        } catch (err) {
          errors++;
          console.error(`akcniceny ${akceUrl} selhal: ${err instanceof Error ? err.message : err}`);
        }
        await sleep(CRAWL_DELAY_MS);
      }
    } catch (err) {
      errors++;
      console.error(`akcniceny ${store} list selhal: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { raws, errors };
}

export async function runPipeline(): Promise<{ najdislevu: number; akcniceny: number; skipped: number }> {
  let skipped = 0;

  const nd = await collectNajdislevu();
  const ndFiltered = normalizeAndFilter(nd.raws);
  skipped += ndFiltered.skipped;
  const ndStored = await upsertOffers(ndFiltered.offers);
  await recordRun({
    source: "najdislevu.cz",
    status: nd.errors > 0 ? "error" : "success",
    itemCount: ndStored,
    message: nd.errors > 0 ? `${nd.errors} chyb při stahování` : undefined,
  });

  const ac = await collectAkcniceny();
  const acFiltered = normalizeAndFilter(ac.raws);
  skipped += acFiltered.skipped;
  const acStored = await upsertOffers(acFiltered.offers);
  await recordRun({
    source: "akcniceny.cz",
    status: ac.errors > 0 ? "error" : "success",
    itemCount: acStored,
    message: ac.errors > 0 ? `${ac.errors} chyb při stahování` : undefined,
  });

  return { najdislevu: ndStored, akcniceny: acStored, skipped };
}

async function main() {
  try {
    const r = await runPipeline();
    console.log(`Hotovo: najdislevu ${r.najdislevu}, akcniceny ${r.akcniceny}, přeskočeno ${r.skipped}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Pipeline selhala:", message);
    process.exitCode = 1;
  }
}

main();
```

- [ ] **Step 2: Ověř kompilaci a celou testovou sadu**

Run: `npx tsc --noEmit && npm test`
Expected: tsc čistý; všechny testy PASS (price, validity, stores, categoryFilter, offer, akcniceny, sources, najdislevu, akcnicenyDiscovery, collect).

- [ ] **Step 3: Ruční živý běh proti Supabase**

Run: (s vyplněným `.env`)
```bash
npm run scrape
```
Expected: výpis `Hotovo: najdislevu N, akcniceny M, přeskočeno K.` s N+M > 0. V Supabase `select source, count(*) from offers group by source;` ukáže řádky pro `najdislevu.cz` i `akcniceny.cz`; `scrape_runs` má dva nové řádky (per zdroj). Běh trvá ~1–2 min kvůli zdvořilé prodlevě.

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/run.ts
git commit -m "feat: orchestrate multi-source scraping over stores"
```

---

## Self-Review

**1. Spec coverage:**
- najdislevu (šířka, top akce) → Task 3. ✓
- akcniceny `/akce/` discovery + porovnání → Task 4 (discovery) + reUSE `parseAkcePage`. ✓
- Per-obchod URL → Task 2. ✓
- Deduplikace per zdroj → drženo přes `source` + existující unikátní index; orchestrace upsertuje per zdroj (Task 6). ✓
- Zdvořilá prodleva ~1 s → Task 6 (`CRAWL_DELAY_MS`, `sleep`). ✓
- Ošetření chyb per obchod/zdroj, log do `scrape_runs` → Task 6 (try/catch + `recordRun` per zdroj). ✓
- Údržba z Plánu 1 (overmatch, validace data) → Task 1. ✓
- Nahrazení seed URL → Task 6 (`runPipeline` bez seedu). ✓
- **Mimo rozsah (vědomě):** oficiální weby (fallback), OCR, web/chat/Vercel Cron (Plán 3/4).

**2. Placeholder scan:** Žádné TBD/„handle errors" bez kódu. Kroky „zajisti fixturu" jsou idempotentní příkazy (fixtury už byly zachyceny reconem). Selektory ověřené proti reálným fixtures.

**3. Type consistency:** `RawOffer`/`NormalizedOffer`/`CanonicalStore` konzistentní. `parseNajdislevuLeaflet(html, store, sourceUrl)`, `discoverAkceUrls(html, baseUrl)`, `normalizeAndFilter(raws)`, `runPipeline()` mají konzistentní signatury napříč Task 3–6. `parseAkcePage(html, sourceUrl)` a `upsertOffers`/`recordRun` beze změny z Plánu 1.

---

## Po Plánu 2 (následně)

- **Plán 3** — web přehled (Next.js + Vercel) + **denní Vercel Cron** spouštějící scrape (rozhodnuto: scheduler na Vercelu, ne GitHub Actions kvůli zámku účtu).
- **Plán 4** — chat (retrieval + přepínatelný model Gemini/Claude).
