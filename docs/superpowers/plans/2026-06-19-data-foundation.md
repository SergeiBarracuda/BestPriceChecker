# BestPriceChecker — Plán 1: Sběr dat (Data Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postavit běžící denní ingesci, která z akcniceny.cz stáhne aktuální akce pro Lidl, Kaufland, Globus, Tesco a Albert, znormalizuje je, odfiltruje vyloučené kategorie, ověří platnost a uloží do Supabase — spouštěno GitHub Actions cronem.

**Architecture:** Čistý TypeScript pipeline `fetch → parse (Cheerio) → normalize → filter → upsert`. Zdroj jsou textové stránky `/akce/<produkt>/` na akcniceny.cz (server-rendered HTML; letáky-obrázky se ignorují). Každý běh se loguje do tabulky `scrape_runs`.

**Tech Stack:** Node 20+ (vestavěný `fetch`), TypeScript, Vitest (testy), Cheerio (HTML parsing), @supabase/supabase-js (DB), dotenv (env), GitHub Actions (cron).

## Global Constraints

- Node.js >= 20 (využívá vestavěný `fetch`; bez `node-fetch`).
- Jazyk: TypeScript, ESM (`"type": "module"`).
- Testy: Vitest. Žádný test nesmí volat živou síť — parser se testuje proti uloženým HTML fixtures v `fixtures/`.
- HTTP požadavky vždy s hlavičkou User-Agent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36`.
- Sledované obchody (kanonické názvy): `Lidl`, `Kaufland`, `Globus`, `Tesco`, `Albert`. Cokoliv jiného se zahazuje.
- Ceny jsou v Kč, desetinná čárka (`12,90`). V kódu se ukládají jako `number` (12.9).
- Žádné tajné klíče v repu. `.env` je v `.gitignore`; commituje se jen `.env.example`.
- Vyloučené kategorie (zahodit): oblečení, dámské potřeby / dámská drogerie / dámský sortiment, alkohol, cigarety, paušály a internet, syrové maso ke zpracování, zahrada / bazény / grilování.

---

## File Structure

```
package.json
tsconfig.json
vitest.config.ts
.gitignore
.env.example
src/
  types.ts                  # RawOffer, NormalizedOffer, StoreMatch
  config/stores.ts          # kanonické obchody + pořadí blízkosti + match raw názvu
  config/categories.ts      # pravidla vyloučených kategorií
  normalize/price.ts        # "12,90 Kč" / rozsahy -> čísla
  normalize/validity.ts     # text platnosti -> {validFrom, validTo} ISO
  normalize/offer.ts        # RawOffer -> NormalizedOffer
  filter/categoryFilter.ts  # zahození vyloučených kategorií
  scrape/fetchPage.ts       # HTTP GET (UA, timeout, 1 retry) -> HTML string
  scrape/akcniceny.ts       # parse /akce/ stránky -> RawOffer[]
  db/schema.sql             # tabulky stores, offers, scrape_runs
  db/client.ts              # tovární funkce supabase klienta
  db/offersRepo.ts          # upsertOffers(), recordRun()
  pipeline/run.ts           # orchestrace celého běhu (entrypoint)
tests/
  price.test.ts
  validity.test.ts
  stores.test.ts
  categoryFilter.test.ts
  offer.test.ts
  akcniceny.test.ts
fixtures/
  akcniceny-akce-sample.html   # zachycený reálný vzorek (Task 7)
.github/workflows/
  daily-scrape.yml
```

---

### Task 1: Inicializace projektu a nástrojů

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`

**Interfaces:**
- Consumes: nic
- Produces: funkční `npm test` (Vitest) a `npm run scrape` (tsx entrypoint). Žádný runtime kód.

- [ ] **Step 1: Vytvoř `package.json`**

```json
{
  "name": "bestpricechecker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "scrape": "tsx src/pipeline/run.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "cheerio": "^1.0.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Vytvoř `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals", "node"],
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Vytvoř `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 4: Vytvoř `.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 5: Vytvoř `.env.example`**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 6: Nainstaluj a ověř**

Run: `npm install && npm test`
Expected: npm install proběhne; `vitest run` skončí hláškou "No test files found" (zatím žádné testy) s exit code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore .env.example package-lock.json
git commit -m "chore: scaffold TypeScript project with vitest"
```

---

### Task 2: Sdílené typy

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Consumes: nic
- Produces:
  - `RawOffer` — surový výstup parseru.
  - `NormalizedOffer` — položka připravená k uložení.
  - `StoreMatch` — výsledek rozpoznání obchodu `{ store: CanonicalStore; isClub: boolean }`.
  - `CanonicalStore = "Lidl" | "Kaufland" | "Globus" | "Tesco" | "Albert"`.

- [ ] **Step 1: Vytvoř `src/types.ts`**

```ts
export type CanonicalStore = "Lidl" | "Kaufland" | "Globus" | "Tesco" | "Albert";

export interface RawOffer {
  productName: string;
  rawStore: string;        // název obchodu tak, jak je na stránce ("Tesco", "Tesco Clubcard")
  priceText: string;       // syrový text ceny ("12,90 Kč", "16,90 - 19,90 Kč")
  validityText: string | null; // syrový text platnosti, pokud je
  category: string | null; // kategorie ze zdroje, pokud je
  source: string;          // "akcniceny.cz"
  sourceUrl: string;
}

export interface NormalizedOffer {
  productName: string;
  store: CanonicalStore;
  isClub: boolean;
  price: number | null;     // dolní mez u rozsahu
  priceMax: number | null;  // horní mez u rozsahu, jinak null
  category: string | null;
  validFrom: string | null; // ISO "YYYY-MM-DD"
  validTo: string | null;   // ISO "YYYY-MM-DD"
  source: string;
  sourceUrl: string;
}

export interface StoreMatch {
  store: CanonicalStore;
  isClub: boolean;
}
```

- [ ] **Step 2: Ověř kompilaci**

Run: `npx tsc --noEmit`
Expected: PASS bez chyb.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared offer types"
```

---

### Task 3: Parsování cen

**Files:**
- Create: `src/normalize/price.ts`
- Test: `tests/price.test.ts`

**Interfaces:**
- Consumes: nic
- Produces: `parsePrice(text: string): { price: number | null; priceMax: number | null }`
  - `"12,90 Kč"` → `{ price: 12.9, priceMax: null }`
  - `"16,90 - 19,90 Kč"` → `{ price: 16.9, priceMax: 19.9 }`
  - nečitelné → `{ price: null, priceMax: null }`

- [ ] **Step 1: Napiš padající test `tests/price.test.ts`**

```ts
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
    expect(parsePrice("  9,90 Kč ")).toEqual({ price: 9.9, priceMax: null });
  });

  it("vrací null pro nečitelný text", () => {
    expect(parsePrice("akce")).toEqual({ price: null, priceMax: null });
  });
});
```

- [ ] **Step 2: Spusť test — musí padat**

Run: `npx vitest run tests/price.test.ts`
Expected: FAIL — `Cannot find module '../src/normalize/price.js'`.

- [ ] **Step 3: Implementuj `src/normalize/price.ts`**

```ts
export function parsePrice(text: string): { price: number | null; priceMax: number | null } {
  const normalized = text.replace(/ /g, " ");
  const numbers = Array.from(
    normalized.matchAll(/(\d+(?:[.,]\d+)?)/g),
    (m) => parseFloat(m[1].replace(",", "."))
  ).filter((n) => !Number.isNaN(n));

  if (numbers.length === 0) return { price: null, priceMax: null };
  if (numbers.length === 1) return { price: numbers[0], priceMax: null };
  return { price: numbers[0], priceMax: numbers[1] };
}
```

- [ ] **Step 4: Spusť test — musí projít**

Run: `npx vitest run tests/price.test.ts`
Expected: PASS, 5 testů.

- [ ] **Step 5: Commit**

```bash
git add src/normalize/price.ts tests/price.test.ts
git commit -m "feat: parse Czech price strings and ranges"
```

---

### Task 4: Parsování platnosti

**Files:**
- Create: `src/normalize/validity.ts`
- Test: `tests/validity.test.ts`

**Interfaces:**
- Consumes: nic
- Produces: `parseValidity(text: string | null, today?: Date): { validFrom: string | null; validTo: string | null }`
  - `"Platí od 16. 6. do 22. 6. 2026"` → `{ validFrom: "2026-06-16", validTo: "2026-06-22" }`
  - `"Platí do 22. 6. 2026"` → `{ validFrom: null, validTo: "2026-06-22" }`
  - `null` / nerozpoznáno → `{ validFrom: null, validTo: null }`
  - Pokud rok u prvního data chybí, doplní se rok z druhého data (běžné u rozsahů jako "16. 6. - 22. 6. 2026").

- [ ] **Step 1: Napiš padající test `tests/validity.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseValidity } from "../src/normalize/validity.js";

describe("parseValidity", () => {
  it("parsuje rozsah od-do se dvěma daty", () => {
    expect(parseValidity("Platí od 16. 6. do 22. 6. 2026")).toEqual({
      validFrom: "2026-06-16",
      validTo: "2026-06-22",
    });
  });

  it("doplní chybějící rok prvního data z druhého", () => {
    expect(parseValidity("16. 6. - 22. 6. 2026")).toEqual({
      validFrom: "2026-06-16",
      validTo: "2026-06-22",
    });
  });

  it("parsuje jen koncové datum", () => {
    expect(parseValidity("Platí do 22. 6. 2026")).toEqual({
      validFrom: null,
      validTo: "2026-06-22",
    });
  });

  it("vrací nully pro null vstup", () => {
    expect(parseValidity(null)).toEqual({ validFrom: null, validTo: null });
  });

  it("vrací nully pro nerozpoznaný text", () => {
    expect(parseValidity("tento týden")).toEqual({ validFrom: null, validTo: null });
  });
});
```

- [ ] **Step 2: Spusť test — musí padat**

Run: `npx vitest run tests/validity.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Implementuj `src/normalize/validity.ts`**

```ts
interface PartialDate {
  day: number;
  month: number;
  year: number | null;
}

function toIso(d: PartialDate, fallbackYear: number | null): string | null {
  const year = d.year ?? fallbackYear;
  if (year === null) return null;
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseValidity(
  text: string | null
): { validFrom: string | null; validTo: string | null } {
  if (!text) return { validFrom: null, validTo: null };

  // Najdi všechny výskyty "D. M." s volitelným rokem "D. M. YYYY"
  const matches = Array.from(
    text.matchAll(/(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/g)
  ).map((m): PartialDate => ({
    day: parseInt(m[1], 10),
    month: parseInt(m[2], 10),
    year: m[3] ? parseInt(m[3], 10) : null,
  }));

  if (matches.length === 0) return { validFrom: null, validTo: null };

  const lastYear = matches[matches.length - 1].year;
  const hasOd = /\bod\b/i.test(text);

  if (matches.length >= 2) {
    return {
      validFrom: toIso(matches[0], lastYear),
      validTo: toIso(matches[1], lastYear),
    };
  }
  // jediné datum: "do" => validTo, "od" => validFrom
  const single = toIso(matches[0], lastYear);
  return hasOd
    ? { validFrom: single, validTo: null }
    : { validFrom: null, validTo: single };
}
```

- [ ] **Step 4: Spusť test — musí projít**

Run: `npx vitest run tests/validity.test.ts`
Expected: PASS, 5 testů.

- [ ] **Step 5: Commit**

```bash
git add src/normalize/validity.ts tests/validity.test.ts
git commit -m "feat: parse Czech validity date ranges"
```

---

### Task 5: Rozpoznání obchodu a pořadí blízkosti

**Files:**
- Create: `src/config/stores.ts`
- Test: `tests/stores.test.ts`

**Interfaces:**
- Consumes: `CanonicalStore`, `StoreMatch` z `src/types.ts`
- Produces:
  - `matchStore(rawName: string): StoreMatch | null` — `"Tesco Clubcard"` → `{ store:"Tesco", isClub:true }`; `"Lidl"` → `{ store:"Lidl", isClub:false }`; `"Billa"` → `null`.
  - `STORE_PROXIMITY: Record<CanonicalStore, number>` — pořadí blízkosti (1 = nejblíž). Výchozí hodnoty si uživatel později upraví.

- [ ] **Step 1: Napiš padající test `tests/stores.test.ts`**

```ts
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
```

- [ ] **Step 2: Spusť test — musí padat**

Run: `npx vitest run tests/stores.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Implementuj `src/config/stores.ts`**

```ts
import type { CanonicalStore, StoreMatch } from "../types.js";

const STORES: CanonicalStore[] = ["Lidl", "Kaufland", "Globus", "Tesco", "Albert"];

// Pořadí blízkosti (1 = nejblíž). UŽIVATEL si tyto hodnoty upraví podle reality.
export const STORE_PROXIMITY: Record<CanonicalStore, number> = {
  Lidl: 1,
  Kaufland: 2,
  Globus: 3,
  Tesco: 4,
  Albert: 5,
};

const CLUB_PATTERNS = /clubcard|kaufland card|lidl plus|m[ůu]j albert/i;

export function matchStore(rawName: string): StoreMatch | null {
  const text = rawName.trim();
  const store = STORES.find((s) => new RegExp(`\\b${s}\\b`, "i").test(text));
  if (!store) return null;
  return { store, isClub: CLUB_PATTERNS.test(text) };
}
```

- [ ] **Step 4: Spusť test — musí projít**

Run: `npx vitest run tests/stores.test.ts`
Expected: PASS, 5 testů.

- [ ] **Step 5: Commit**

```bash
git add src/config/stores.ts tests/stores.test.ts
git commit -m "feat: match tracked stores and club offers"
```

---

### Task 6: Filtr vyloučených kategorií

**Files:**
- Create: `src/config/categories.ts`, `src/filter/categoryFilter.ts`
- Test: `tests/categoryFilter.test.ts`

**Interfaces:**
- Consumes: `NormalizedOffer` z `src/types.ts`
- Produces: `isExcluded(offer: Pick<NormalizedOffer, "productName" | "category">): boolean`
  - `true` = položka spadá do vyloučené kategorie a má se zahodit.
  - Rozhoduje se podle `category` i podle klíčových slov v `productName`.

- [ ] **Step 1: Napiš padající test `tests/categoryFilter.test.ts`**

```ts
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
```

- [ ] **Step 2: Spusť test — musí padat**

Run: `npx vitest run tests/categoryFilter.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Implementuj `src/config/categories.ts`**

```ts
// Klíčová slova, jejichž výskyt (v názvu nebo kategorii) položku VYLUČUJE.
// Pozn.: drogerie obecně NENÍ vyloučená — jen "dámská" drogerie/sortiment.
export const EXCLUDE_KEYWORDS: string[] = [
  // oblečení a dámský sortiment
  "oblečen", "tričko", "kalhoty", "bunda", "dámsk", "dámská drogerie",
  // alkohol
  "alkohol", "vodka", "whisky", "rum", "víno", "pivo", "likér", "gin", "tequila",
  // cigarety
  "cigaret", "tabák", "tabak",
  // paušály a internet
  "paušál", "pausal", "tarif", "internet", "mobilní data",
  // syrové maso ke zpracování
  "syrové maso", "maso ke zpracování", "k tepelné úpravě",
  // zahrada / bazény / grilování
  "zahrad", "bazén", "bazen", "gril", "grilov",
];

// Kategorie (přesnější shoda), které VYLUČUJÍ celou položku.
export const EXCLUDE_CATEGORIES: string[] = [
  "oblečení", "móda", "alkohol", "tabák", "zahrada a grilování", "zahrada",
];
```

- [ ] **Step 4: Implementuj `src/filter/categoryFilter.ts`**

```ts
import { EXCLUDE_KEYWORDS, EXCLUDE_CATEGORIES } from "../config/categories.js";

function normalize(s: string): string {
  return s.toLowerCase();
}

export function isExcluded(offer: { productName: string; category: string | null }): boolean {
  const haystack = normalize(`${offer.productName} ${offer.category ?? ""}`);
  if (EXCLUDE_KEYWORDS.some((kw) => haystack.includes(normalize(kw)))) return true;
  if (offer.category && EXCLUDE_CATEGORIES.some((c) => normalize(offer.category!).includes(normalize(c)))) {
    return true;
  }
  return false;
}
```

- [ ] **Step 5: Spusť test — musí projít**

Run: `npx vitest run tests/categoryFilter.test.ts`
Expected: PASS, 7 testů.

- [ ] **Step 6: Commit**

```bash
git add src/config/categories.ts src/filter/categoryFilter.ts tests/categoryFilter.test.ts
git commit -m "feat: filter out excluded categories"
```

---

### Task 7: Zachycení reálné fixture a parser akcniceny.cz

**Files:**
- Create: `fixtures/akcniceny-akce-sample.html`, `src/scrape/akcniceny.ts`
- Test: `tests/akcniceny.test.ts`

**Interfaces:**
- Consumes: `RawOffer` z `src/types.ts`, Cheerio
- Produces: `parseAkcePage(html: string, sourceUrl: string): RawOffer[]`
  - Z jedné `/akce/<produkt>/` stránky vrátí seznam nabídek (jeden řádek = jeden obchod s cenou).

- [ ] **Step 1: Zachyť reálnou fixture**

Run:
```bash
mkdir -p fixtures
curl -sSL -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" \
  "https://www.akcniceny.cz/akce/gambrinus-10-original-svetle-vycepni-pivo-0-5l/" \
  -o fixtures/akcniceny-akce-sample.html
```
Expected: soubor `fixtures/akcniceny-akce-sample.html` o velikosti ~150 kB.

- [ ] **Step 2: Prozkoumej strukturu fixture a najdi reálné selektory**

Run:
```bash
node -e "import('cheerio').then(async ({load})=>{const fs=await import('node:fs');const \$=load(fs.readFileSync('fixtures/akcniceny-akce-sample.html','utf8'));const el=\$('.shop').first();console.log('shop count:',\$('.shop').length);console.log('first .shop html:\n', el.html()?.slice(0,600));});"
```
Expected: vypíše počet `.shop` bloků a HTML prvního z nich. **Podle skutečné struktury uprav selektory v kroku 4** (názvy tříd pro cenu a platnost — pozorované: text obsahuje `… cena 12,90 Kč`, blok platnosti `.platnost-over-txt`). Pokud se `.shop` neukáže jako řádek s cenou, najdi opakující se kontejner, který obsahuje název obchodu i cenu, a použij ten.

- [ ] **Step 3: Napiš test `tests/akcniceny.test.ts` proti zachycené fixture**

```ts
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
});
```

- [ ] **Step 4: Implementuj `src/scrape/akcniceny.ts`**

> Selektory níže odpovídají pozorované struktuře (opakující se blok `.shop` s názvem obchodu a textem ceny `… cena <částka> Kč`, blok platnosti `.platnost-over-txt`). V kroku 2 ověřené reálné názvy tříd sem doplň/uprav, dokud test neprojde.

```ts
import { load } from "cheerio";
import type { RawOffer } from "../types.js";

export function parseAkcePage(html: string, sourceUrl: string): RawOffer[] {
  const $ = load(html);
  const offers: RawOffer[] = [];

  // Název produktu je obvykle v hlavním nadpisu stránky.
  const productName = $("h1").first().text().trim();
  const validityText = $(".platnost-over-txt").first().text().trim() || null;

  $(".shop").each((_, el) => {
    const block = $(el);
    const text = block.text().replace(/\s+/g, " ").trim();

    // Název obchodu: odkaz nebo nadpis uvnitř bloku, fallback na první slovo.
    const rawStore =
      block.find("a[href*='/letaky/'], .shop-name, h3, h2").first().text().trim() ||
      text.split(" ")[0];

    // Cena: úsek textu obsahující "Kč".
    const priceMatch = text.match(/[\d\s.,]+(?:-\s*[\d.,]+)?\s*Kč/);
    if (!rawStore || !priceMatch) return;

    offers.push({
      productName,
      rawStore,
      priceText: priceMatch[0].trim(),
      validityText,
      category: null,
      source: "akcniceny.cz",
      sourceUrl,
    });
  });

  return offers;
}
```

- [ ] **Step 5: Spusť test — laď selektory, dokud neprojde**

Run: `npx vitest run tests/akcniceny.test.ts`
Expected: PASS, 3 testy. Pokud padá, vrať se ke kroku 2, najdi správné selektory v reálné fixture a uprav krok 4.

- [ ] **Step 6: Commit**

```bash
git add fixtures/akcniceny-akce-sample.html src/scrape/akcniceny.ts tests/akcniceny.test.ts
git commit -m "feat: parse akcniceny.cz akce pages into raw offers"
```

---

### Task 8: Normalizace nabídky (RawOffer -> NormalizedOffer)

**Files:**
- Create: `src/normalize/offer.ts`
- Test: `tests/offer.test.ts`

**Interfaces:**
- Consumes: `parsePrice`, `parseValidity`, `matchStore`, `RawOffer`, `NormalizedOffer`
- Produces: `normalizeOffer(raw: RawOffer): NormalizedOffer | null`
  - Vrátí `null`, pokud obchod není sledovaný (`matchStore` → null) — položka se zahodí výš v pipeline.

- [ ] **Step 1: Napiš padající test `tests/offer.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { normalizeOffer } from "../src/normalize/offer.js";
import type { RawOffer } from "../src/types.js";

const base: RawOffer = {
  productName: "Gambrinus 10 pivo 0,5l",
  rawStore: "Tesco Clubcard",
  priceText: "12,90 Kč",
  validityText: "Platí do 22. 6. 2026",
  category: "Nápoje",
  source: "akcniceny.cz",
  sourceUrl: "https://www.akcniceny.cz/akce/test/",
};

describe("normalizeOffer", () => {
  it("znormalizuje kompletní nabídku včetně klubové ceny", () => {
    expect(normalizeOffer(base)).toEqual({
      productName: "Gambrinus 10 pivo 0,5l",
      store: "Tesco",
      isClub: true,
      price: 12.9,
      priceMax: null,
      category: "Nápoje",
      validFrom: null,
      validTo: "2026-06-22",
      source: "akcniceny.cz",
      sourceUrl: "https://www.akcniceny.cz/akce/test/",
    });
  });

  it("vrátí null pro nesledovaný obchod", () => {
    expect(normalizeOffer({ ...base, rawStore: "Billa" })).toBeNull();
  });
});
```

- [ ] **Step 2: Spusť test — musí padat**

Run: `npx vitest run tests/offer.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Implementuj `src/normalize/offer.ts`**

```ts
import type { RawOffer, NormalizedOffer } from "../types.js";
import { parsePrice } from "./price.js";
import { parseValidity } from "./validity.js";
import { matchStore } from "../config/stores.js";

export function normalizeOffer(raw: RawOffer): NormalizedOffer | null {
  const matched = matchStore(raw.rawStore);
  if (!matched) return null;

  const { price, priceMax } = parsePrice(raw.priceText);
  const { validFrom, validTo } = parseValidity(raw.validityText);

  return {
    productName: raw.productName.trim(),
    store: matched.store,
    isClub: matched.isClub,
    price,
    priceMax,
    category: raw.category,
    validFrom,
    validTo,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
  };
}
```

- [ ] **Step 4: Spusť test — musí projít**

Run: `npx vitest run tests/offer.test.ts`
Expected: PASS, 2 testy.

- [ ] **Step 5: Commit**

```bash
git add src/normalize/offer.ts tests/offer.test.ts
git commit -m "feat: normalize raw offers into store-matched offers"
```

---

### Task 9: Schéma databáze Supabase

**Files:**
- Create: `src/db/schema.sql`

**Interfaces:**
- Consumes: nic
- Produces: SQL pro tabulky `stores`, `offers`, `scrape_runs`. `offers` má unikátní klíč pro idempotentní upsert.

- [ ] **Step 1: Vytvoř `src/db/schema.sql`**

```sql
create table if not exists stores (
  id text primary key,            -- kanonický název: "Lidl", "Tesco", ...
  proximity int not null          -- pořadí blízkosti (1 = nejblíž)
);

create table if not exists offers (
  id bigint generated always as identity primary key,
  store_id text not null references stores(id),
  product_name text not null,
  is_club boolean not null default false,
  price numeric,                  -- dolní mez u rozsahu
  price_max numeric,              -- horní mez u rozsahu, jinak null
  category text,
  valid_from date,
  valid_to date,
  source text not null,
  source_url text not null,
  scraped_at timestamptz not null default now(),
  -- idempotence: stejný produkt/obchod/platnost/zdroj se neduplikuje
  unique (store_id, product_name, is_club, valid_to, source)
);

create index if not exists offers_store_idx on offers (store_id);
create index if not exists offers_valid_to_idx on offers (valid_to);

create table if not exists scrape_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  source text not null,
  status text not null,           -- "success" | "error"
  item_count int not null default 0,
  message text
);
```

- [ ] **Step 2: Aplikuj schéma v Supabase**

V Supabase projektu otevři **SQL Editor**, vlož obsah `src/db/schema.sql` a spusť. Poté vlož řádky obchodů:
```sql
insert into stores (id, proximity) values
  ('Lidl',1),('Kaufland',2),('Globus',3),('Tesco',4),('Albert',5)
on conflict (id) do update set proximity = excluded.proximity;
```
Expected: tabulky vytvořeny, `select * from stores;` vrátí 5 řádků.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.sql
git commit -m "feat: add Supabase schema for stores, offers, scrape_runs"
```

---

### Task 10: Klient a repozitář databáze

**Files:**
- Create: `src/db/client.ts`, `src/db/offersRepo.ts`

**Interfaces:**
- Consumes: `NormalizedOffer`, `@supabase/supabase-js`
- Produces:
  - `getClient(): SupabaseClient` — čte `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY` z env.
  - `upsertOffers(offers: NormalizedOffer[]): Promise<number>` — vrátí počet uložených.
  - `recordRun(run: { source: string; status: "success" | "error"; itemCount: number; message?: string }): Promise<void>`

> Pozn.: DB metody se v tomto plánu netestují jednotkově (vyžadovaly by živé Supabase). Ověří se ručně v Task 11 / Task 12. Logika, kterou lze testovat bez sítě (parsing, normalizace, filtr), pokryta je.

- [ ] **Step 1: Implementuj `src/db/client.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY v prostředí.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: Implementuj `src/db/offersRepo.ts`**

```ts
import type { NormalizedOffer } from "../types.js";
import { getClient } from "./client.js";

export async function upsertOffers(offers: NormalizedOffer[]): Promise<number> {
  if (offers.length === 0) return 0;
  const rows = offers.map((o) => ({
    store_id: o.store,
    product_name: o.productName,
    is_club: o.isClub,
    price: o.price,
    price_max: o.priceMax,
    category: o.category,
    valid_from: o.validFrom,
    valid_to: o.validTo,
    source: o.source,
    source_url: o.sourceUrl,
    scraped_at: new Date().toISOString(),
  }));

  const { error, count } = await getClient()
    .from("offers")
    .upsert(rows, {
      onConflict: "store_id,product_name,is_club,valid_to,source",
      count: "exact",
    });
  if (error) throw new Error(`upsertOffers selhal: ${error.message}`);
  return count ?? rows.length;
}

export async function recordRun(run: {
  source: string;
  status: "success" | "error";
  itemCount: number;
  message?: string;
}): Promise<void> {
  const { error } = await getClient().from("scrape_runs").insert({
    source: run.source,
    status: run.status,
    item_count: run.itemCount,
    message: run.message ?? null,
  });
  if (error) throw new Error(`recordRun selhal: ${error.message}`);
}
```

- [ ] **Step 3: Ověř kompilaci**

Run: `npx tsc --noEmit`
Expected: PASS bez chyb.

- [ ] **Step 4: Commit**

```bash
git add src/db/client.ts src/db/offersRepo.ts
git commit -m "feat: add Supabase client and offers repository"
```

---

### Task 11: Orchestrace pipeline (entrypoint)

**Files:**
- Create: `src/scrape/fetchPage.ts`, `src/pipeline/run.ts`

**Interfaces:**
- Consumes: `fetchPage`, `parseAkcePage`, `normalizeOffer`, `isExcluded`, `upsertOffers`, `recordRun`
- Produces:
  - `fetchPage(url: string): Promise<string>` — GET s UA, timeout 20 s, 1 retry.
  - `runPipeline(akceUrls: string[]): Promise<{ stored: number; skipped: number }>` — celý běh nad seznamem `/akce/` URL.
  - `src/pipeline/run.ts` je spustitelný přes `npm run scrape`.

> Seznam `/akce/` URL: pro Plán 1 použijeme pevný startovní seznam (níže) jako důkaz funkčnosti end-to-end. Plán 2 přidá automatické zjišťování seznamu z listovacích/kategorijních stránek a fallback na najdislevu.cz + oficiální weby.

- [ ] **Step 1: Implementuj `src/scrape/fetchPage.ts`**

```ts
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

export async function fetchPage(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  throw new Error("unreachable");
}
```

- [ ] **Step 2: Implementuj `src/pipeline/run.ts`**

```ts
import "dotenv/config";
import { fetchPage } from "../scrape/fetchPage.js";
import { parseAkcePage } from "../scrape/akcniceny.js";
import { normalizeOffer } from "../normalize/offer.js";
import { isExcluded } from "../filter/categoryFilter.js";
import { upsertOffers, recordRun } from "../db/offersRepo.js";
import type { NormalizedOffer } from "../types.js";

// Startovní seznam akcí (Plán 2 ho nahradí automatickým zjišťováním).
const SEED_AKCE_URLS: string[] = [
  "https://www.akcniceny.cz/akce/gambrinus-10-original-svetle-vycepni-pivo-0-5l/",
];

export async function runPipeline(
  akceUrls: string[]
): Promise<{ stored: number; skipped: number }> {
  const collected: NormalizedOffer[] = [];
  let skipped = 0;

  for (const url of akceUrls) {
    const html = await fetchPage(url);
    const raws = parseAkcePage(html, url);
    for (const raw of raws) {
      const normalized = normalizeOffer(raw);
      if (!normalized) { skipped++; continue; }            // nesledovaný obchod
      if (isExcluded(normalized)) { skipped++; continue; } // vyloučená kategorie
      collected.push(normalized);
    }
  }

  const stored = await upsertOffers(collected);
  return { stored, skipped };
}

async function main() {
  try {
    const { stored, skipped } = await runPipeline(SEED_AKCE_URLS);
    await recordRun({ source: "akcniceny.cz", status: "success", itemCount: stored });
    console.log(`Hotovo: uloženo ${stored}, přeskočeno ${skipped}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordRun({ source: "akcniceny.cz", status: "error", itemCount: 0, message });
    console.error("Pipeline selhala:", message);
    process.exitCode = 1;
  }
}

main();
```

- [ ] **Step 3: Ověř kompilaci a celou testovou sadu**

Run: `npx tsc --noEmit && npm test`
Expected: kompilace PASS; všechny dosavadní testy (price, validity, stores, categoryFilter, offer, akcniceny) PASS.

- [ ] **Step 4: Ruční end-to-end ověření proti živé Supabase**

Run: (s vyplněným `.env` z `.env.example`)
```bash
npm run scrape
```
Expected: výpis `Hotovo: uloženo N, přeskočeno M.` V Supabase `select * from offers;` vrátí uložené nabídky jen pro sledované obchody a `select * from scrape_runs order by ran_at desc limit 1;` ukáže `status = success`.

- [ ] **Step 5: Commit**

```bash
git add src/scrape/fetchPage.ts src/pipeline/run.ts
git commit -m "feat: end-to-end scrape pipeline with run logging"
```

---

### Task 12: Denní spuštění přes GitHub Actions

**Files:**
- Create: `.github/workflows/daily-scrape.yml`

**Interfaces:**
- Consumes: `npm run scrape`, repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Produces: cron workflow, který jednou denně spustí scrape.

- [ ] **Step 1: Vytvoř `.github/workflows/daily-scrape.yml`**

```yaml
name: daily-scrape
on:
  schedule:
    - cron: "30 5 * * *"   # každý den 05:30 UTC (~07:30 ČR v létě)
  workflow_dispatch: {}      # umožní ruční spuštění z GitHubu

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run scrape
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- [ ] **Step 2: Nastav GitHub secrets**

V repu na GitHubu: **Settings → Secrets and variables → Actions** přidej `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY`.
Expected: oba secrety uvedeny v seznamu.

- [ ] **Step 3: Ověř ruční spuštění**

Na GitHubu **Actions → daily-scrape → Run workflow**.
Expected: běh skončí zeleně; v Supabase přibude řádek v `scrape_runs` se `status = success`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/daily-scrape.yml
git commit -m "ci: add daily scrape workflow"
```

---

## Self-Review

**1. Spec coverage (Plán 1 = sekce sběru dat ze specu):**
- Zdroj akcniceny.cz, server-rendered, textové ceny → Task 7, 11. ✓
- Sledované obchody Lidl/Kaufland/Globus/Tesco/Albert + zahození ostatních → Task 5, 8. ✓
- Klubové akce → Task 5 (`isClub`), Task 9 (sloupec). ✓
- Filtr vyloučených kategorií → Task 6. ✓
- Platnost od–do, čerstvost → Task 4, schéma `valid_from/valid_to`, `scraped_at` (Task 9). ✓
- Pořadí blízkosti → Task 5 `STORE_PROXIMITY`, Task 9 `stores.proximity`. ✓
- Logování běhů `scrape_runs` → Task 9, 10, 11. ✓
- Denní spuštění → Task 12. ✓
- **Mimo Plán 1 (vědomě, → další plány):** najdislevu.cz + fallback na oficiální weby, automatické zjišťování seznamu `/akce/` URL (Plán 2); web přehled (Plán 3); chat + model (Plán 4). Letáky-obrázky (OCR) jsou mimo rozsah projektu (rozhodnuto reconem).

**2. Placeholder scan:** Task 7 záměrně obsahuje krok ladění selektorů proti reálné zachycené fixture — to není placeholder, ale nutný discovery krok daný tím, že přesné názvy tříd se potvrzují až nad staženým HTML. Veškerý ostatní kód je konkrétní.

**3. Type consistency:** `RawOffer`/`NormalizedOffer`/`StoreMatch`/`CanonicalStore` (Task 2) se shodně používají v Task 3–11. `matchStore`, `parsePrice`, `parseValidity`, `isExcluded`, `parseAkcePage`, `normalizeOffer`, `upsertOffers`, `recordRun`, `fetchPage`, `runPipeline` mají konzistentní signatury napříč tasky. ✓

---

## Roadmapa dalších plánů (napíšou se samostatně po dokončení Plánu 1)

- **Plán 2 — Robustní sběr:** automatické zjišťování seznamu akcí z listovacích/kategorijních stránek akcniceny.cz, přidání najdislevu.cz a fallbacku na oficiální weby, deduplikace napříč zdroji.
- **Plán 3 — Web přehled:** Next.js + Vercel, filtrovatelný seznam akcí ze Supabase, indikace čerstvosti dat.
- **Plán 4 — Chat:** retrieval relevantních akcí + přepínatelný model (Gemini default, Claude API volitelně), kontext s pořadím blízkosti a vyloučenými kategoriemi.
