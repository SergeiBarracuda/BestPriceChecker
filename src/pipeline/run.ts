import "dotenv/config";
import { fetchPage } from "../scrape/fetchPage.js";
import { parseNajdislevuLeaflet } from "../scrape/najdislevu.js";
import { discoverAkceUrls } from "../scrape/akcnicenyDiscovery.js";
import { parseAkcePage } from "../scrape/akcniceny.js";
import { normalizeAndFilter } from "./collect.js";
import { upsertOffers, recordRun } from "../db/offersRepo.js";
import { STORE_SOURCES } from "../config/sources.js";
import type { CanonicalStore, RawOffer } from "../types.js";

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
