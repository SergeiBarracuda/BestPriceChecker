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
