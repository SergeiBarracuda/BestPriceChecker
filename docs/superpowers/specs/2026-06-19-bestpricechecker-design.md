# BestPriceChecker — návrh systému

- **Datum:** 2026-06-19
- **Stav:** schváleno (brainstorming), připraveno k tvorbě implementačního plánu

## 1. Cíl

Denně běžící systém, který stáhne aktuální akce, slevy, výprodeje a klubové
akce pro obchody **Lidl, Kaufland, Globus, Tesco a Albert**, ověří jejich
platnost, uloží je strukturovaně a umožní uživateli přes **webový chat**
porovnávat, kombinovat a ptát se na souvislosti.

Příklady cílových dotazů:
- „Prací prášek je sice levnější v Tescu, ale když ho koupím s aviváží a vůní
  na prádlo, vyjde výrazně líp Lidl."
- „Tady je to dál, ale zato tam mají lepší ceny — vyplatí se to?"

## 2. Sledované obchody a kritérium vzdálenosti

Obchody seřazené podle blízkosti (pořadí zadané jednou, `1 = nejblíž`):

| Pořadí | Obchod |
|--------|--------|
| (zadá uživatel) | Lidl, Kaufland, Globus, Tesco, Albert |

Vzdálenost se používá jen jako **pořadí blízkosti**, žádné km ani mapová API.
Model ji bere jako jemné kritérium: když je rozdíl jen pár korun, doporučí
bližší obchod a explicitně to zdůvodní (cílem je „nejezdit 3 km kvůli 3 Kč").

## 3. Zdroje dat

1. **Primární:** `akcniceny.cz` a `najdislevu.cz` — agregátory letáků pokrývající
   všech 5 řetězců.
2. **Záloha:** oficiální web daného řetězce, pokud se u některého obchodu data
   v agregátorech nenajdou.

Žádný z řetězců nemá použitelné veřejné API, proto agregátory + fallback.

## 4. Rozsah produktů (filtr kategorií)

Systém nasaje **vše** a odfiltruje vyloučené kategorie.

**Vyloučené:**
- oblečení
- dámské potřeby, dámská drogerie, dámský sortiment obecně
- alkohol
- cigarety
- paušály, internet
- syrové maso ke zpracování
- zahrada, bazény, grilování

**Výslovně ponechané (i když nepotravinové):**
- nářadí, baterie, elektronika, vysavače, spotřebiče obecně

## 5. Architektura (tok dat)

```
GitHub Actions (1x denně, cron)
        |  spustí scraper
        v
Scraper (TypeScript) -- akcniceny.cz + najdislevu.cz
        |             '- fallback: oficiální web řetězce
        |  normalizace + filtr kategorií + ověření platnosti
        v
Supabase (Postgres) -- tabulky: stores, offers, scrape_runs
        ^
        |  dotazy
Next.js app (Vercel) -- Přehled akcí  +  Chat
        |                        |
        |                        v
        |             Retrieval (najdi relevantní akce)
        |                        v
        |             Model (Gemini default <-> Claude API)
        v
   Uživatel (web i mobil)
```

## 6. Technologický stack

Vše v jednom jazyce (TypeScript), v jednom repu, provoz prakticky zdarma.

- **Web app:** Next.js, nasazení na **Vercel** (free tier). Dostupné i z mobilu.
- **Databáze:** **Supabase** (Postgres, free tier).
- **Plánovač:** **GitHub Actions** cron (free) — denní spuštění scraperu, není
  potřeba vlastní běžící server.
- **Model chatu:** přepínatelný za jednou abstrakcí. **Default Gemini** (free
  tier Google AI Studio), volitelně **Claude API** jako placený upgrade bez
  přepisování kódu.
- **Rezerva:** ~100 Kč/měsíc na Google Cloud zůstává nevyužité jako rezerva.

> Poznámka k modelu: Claude Pro / Google One AI předplatné **nezpřístupňují
> programové API** — to vyžaduje samostatný API klíč s platbou za použití.
> Gemini má použitelný free API tier; případnou vyšší kvótu z Google One
> ověříme při zakládání klíče.

## 7. Komponenty

### 7.1 Scraper
TS skript spouštěný GitHub Actions cronem. Pro každý řetězec zkusí oba
agregátory, při neúspěchu oficiální web. Primárně **Cheerio** na statické HTML;
pokud je stránka renderovaná JS, použije se **Playwright** (rozhodne se při
stavbě podle reálné podoby stránek).

### 7.2 Normalizace + filtr kategorií
Sjednotí formát položek a vyhodí vyloučené kategorie (viz sekce 4). Kategorizace
proběhne podle kategorií z agregátoru + pravidel pro vyloučení.

### 7.3 Databáze (Supabase)
Uchovává akce a historii běhů kvůli kontrole čerstvosti a diagnostice.

### 7.4 Web app (Next.js)
- **Přehled:** filtrovatelný seznam akcí napříč obchody.
- **Chat:** konverzační dotazy nad daty.

### 7.5 Chat
Retrieval relevantních akcí k dotazu → předání modelu s kontextem (pořadí
obchodů podle blízkosti, vědomí o vyloučených kategoriích). Porovnání a
kombinování nechává na modelu nad relevantními akcemi (ne na rigidním párování
produktů), což je pružnější.

## 8. Datový model (zjednodušeně)

**`stores`**
- `id`
- `nazev`
- `poradi_blizkosti` (1 = nejblíž)

**`offers`**
- `id`
- `store_id`
- `nazev_produktu`
- `znacka`
- `kategorie`
- `cena`
- `bezna_cena`
- `sleva_procent`
- `jednotkova_cena`
- `klubova_akce` (ano/ne)
- `plati_od`
- `plati_do`
- `zdroj`
- `kdy_stazeno`

**`scrape_runs`**
- `id`
- `kdy`
- `zdroj`
- `stav` (úspěch/chyba)
- `pocet_polozek`

## 9. Čerstvost dat

Každá akce má platnost od–do. Přehled i chat **prošlé akce skryjí nebo označí**.
Pokud denní stažení u některého obchodu selže, zobrazí se varování (např. „data
z Tesca jsou stará 2 dny").

## 10. Ošetření chyb

Selže-li zdroj → fallback na oficiální web → když selže i ten, ponechá poslední
známá data a označí je jako stará. Selhání jednoho obchodu nesmí shodit celou
appku ani zbylé obchody.

## 11. Postup stavby (fáze)

1. **MVP dat:** scraper jednoho obchodu z jednoho agregátoru → Supabase →
   ověření, že data sedí.
2. **Rozšíření:** všech 5 obchodů + oba zdroje + fallback + filtr kategorií.
3. **Web přehled:** Next.js + Vercel, čtení ze Supabase.
4. **Chat:** retrieval + Gemini.
5. **Doladění:** klubové akce, čerstvost, přepínání modelu.

## 12. Testování

- Scraper: testy parsování nad uloženými ukázkami HTML (fixtures) jednotlivých
  zdrojů — odolnost vůči regresím.
- Normalizace/filtr: testy, že vyloučené kategorie skutečně vypadnou a ponechané
  zůstanou.
- Čerstvost: testy logiky platnosti a označení starých dat.
- Web/chat: ověření retrievalu (správné akce k dotazu) a end-to-end odpovědi.

## 13. Hlavní rizika

- **Scraping je křehký** — změna webu agregátoru vyžaduje opravu scraperu. Proto
  fallback a logování běhů (`scrape_runs`).
- **Párování stejných produktů** napříč obchody je obtížné — řešeno přenecháním
  porovnání modelu nad relevantními akcemi místo rigidního párování.
- **Podmínky použití webů** — pro osobní použití zpravidla v pořádku, ale je
  dobré si to uvědomit.
