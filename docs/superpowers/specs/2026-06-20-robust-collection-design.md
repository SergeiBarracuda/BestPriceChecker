# BestPriceChecker — Plán 2: Robustní sběr (návrh)

- **Datum:** 2026-06-20
- **Stav:** schváleno (brainstorming), připraveno k tvorbě implementačního plánu
- **Navazuje na:** Plán 1 (Data Foundation) — pipeline `fetch → parse → normalize → filter → upsert` + Supabase schéma.

## Cíl

Naplnit databázi **reálnými aktuálními akcemi** všech 5 sledovaných obchodů
(Lidl, Kaufland, Globus, Tesco, Albert). Nahradit dosavadní seed URL v pipeline
skutečným vyhledáváním ze dvou zdrojů a sjednotit data do existujícího modelu.

## Strategie zdrojů (potvrzeno reconem 2026-06-20)

- **najdislevu.cz `/letaky/<obchod>`** — hlavní zdroj **šířky**: strukturovaný
  výpis celého letáku obchodu (název, cena v `div.product-price`, platnost jako
  rozsah „22. 6. - 28. 6. 2026", sleva %). Jeden request = celý leták obchodu.
- **akcniceny.cz `/akce/<produkt>/`** — zdroj **porovnání cen napříč obchody**.
  Discovery: `/letaky/<obchod>/` vrací ~10 odkazů `/akce/<produkt>/`; každá `/akce/`
  stránka nese ceny daného produktu napříč obchody (klubové ceny vč. „Clubcard").

Oba zdroje jsou server-rendered HTML (Cheerio, žádný headless prohlížeč).
Obrázkové letáky se ignorují (OCR mimo rozsah projektu).

## Rozhodnutí

- **Deduplikace:** ponechat **řádky per zdroj** (sloupec `source` rozlišuje;
  unikátní index `(store_id, product_name, is_club, valid_to, source)` brání
  dvojím záznamům v rámci jednoho zdroje). Stejný produkt z najdislevu i
  akcniceny koexistuje — slučování „stejných" produktů řeší až dotaz/UI
  (Plán 3/4), ne ingesce. Žádná ztráta dat.
- **Oficiální weby obchodů (fallback):** odloženo (YAGNI) — dva agregátory
  pokrývají všech 5 obchodů. Přidá se jen pokud se reálně ukáže chybějící obchod.
- **Zdvořilost:** mezi requesty na stejný host prodleva ~1 s (robots.txt
  akcniceny.cz uvádí `Crawl-delay: 1`). Pevný User-Agent jako v Plánu 1.

## Tok dat

```
pro každý sledovaný obchod:
  ├─ najdislevu.cz /letaky/<obchod>  -> parseNajdislevuLeaflet -> RawOffer[]   (šířka)
  └─ akcniceny.cz /letaky/<obchod>/  -> discoverAkceUrls -> [/akce/<produkt>/]
                                      -> fetch každé -> parseAkcePage          (porovnání)
  -> normalizeOffer -> isExcluded -> sběr
-> upsertOffers (idempotentně) + recordRun per zdroj
(mezi requesty na stejný host ~1 s prodleva)
```

## Komponenty

- `src/config/sources.ts` — per-obchod URL pro oba zdroje (najdislevu leták,
  akcniceny store page).
- `src/scrape/najdislevu.ts` — `parseNajdislevuLeaflet(html, store, sourceUrl): RawOffer[]`.
  Obchod je dán stránkou (`rawStore = store`). Selektory pinnuté proti zachycené
  fixture. Cena `div.product-price`, platnost a název z okolí karty.
- `src/scrape/akcnicenyDiscovery.ts` — `discoverAkceUrls(html, baseUrl): string[]`
  (z `/letaky/<obchod>/` vytáhne absolutní `/akce/` URL). Stávající
  `parseAkcePage` z Plánu 1 se znovu použije beze změny.
- `src/scrape/fetchPage.ts` — přidat `throttle`/prodlevu mezi requesty na host.
- `src/pipeline/run.ts` — přepsat orchestraci na „obchody × zdroje" (místo seedu).
- Fixtures: `fixtures/najdislevu-letak-lidl.html`, `fixtures/akcniceny-letaky-lidl.html`.

## Datový model

Beze změny oproti Plánu 1 (`stores`, `offers`, `scrape_runs`). `source` nabývá
hodnot `najdislevu.cz` i `akcniceny.cz`.

## Ošetření chyb

Selhání jednoho obchodu/zdroje se zaloguje do `scrape_runs` (status `error` +
zpráva) a **nepřeruší** zbytek běhu. Každý zdroj má vlastní `recordRun` s počtem
uložených položek. Síťové chyby používají retry/timeout z Plánu 1 (`fetchPage`).

## Údržba z Plánu 1 (při startu)

Opravit odložené Minor nálezy ze závěrečné review Plánu 1:
- `EXCLUDE_KEYWORDS` overmatch (substring „gin" v „originál", „rum" v „rumsteak",
  „víno" ve „vínotéka") → přejít na shodu na hranicích slov u plnoslovných
  klíčových slov, prefixová ponechat (např. „zahrad", „dámsk").
- `parseValidity` — odmítnout nesmyslná data (měsíc 1–12, den 1–31).

## Testování

- `parseNajdislevuLeaflet` proti uložené fixtuře `/letaky/lidl` — vrátí neprázdné
  nabídky s cenou i platností.
- `discoverAkceUrls` proti uložené fixtuře `/letaky/lidl/` — vrátí absolutní
  `/akce/` URL (>0).
- Regrese pro opravený `EXCLUDE_KEYWORDS` (např. „Coca-Cola Originál" NENÍ
  vyloučena) a `parseValidity` (nesmyslné datum → null).
- Žádný test nesahá na živou síť (fixtures).

## Mimo rozsah

- Oficiální weby obchodů (fallback), OCR obrázkových letáků.
- Web přehled (Plán 3), chat (Plán 4), Vercel Cron pro denní spouštění (Plán 3).
