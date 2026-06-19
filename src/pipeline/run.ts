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
