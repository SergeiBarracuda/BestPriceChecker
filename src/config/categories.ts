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
