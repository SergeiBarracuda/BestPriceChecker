import { load } from "cheerio";

export function discoverAkceUrls(html: string, baseUrl: string): string[] {
  const $ = load(html);
  const set = new Set<string>();
  $('a[href^="/akce/"]').each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    try {
      set.add(new URL(href, baseUrl).toString());
    } catch {
      // neplatná adresa — přeskoč, ať nespadne celý discovery
    }
  });
  return [...set];
}
