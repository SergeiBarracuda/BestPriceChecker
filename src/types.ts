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
