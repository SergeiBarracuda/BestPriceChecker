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
