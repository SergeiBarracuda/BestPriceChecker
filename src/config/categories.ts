// Pravidla pro vyloučení položky podle názvu/kategorie.
// Pozn.: drogerie obecně NENÍ vyloučená — jen "dámská" drogerie/sortiment.

// Víceslovné fráze — porovnávají se jako podřetězec (nízké riziko falešné shody).
export const EXCLUDE_PHRASES: string[] = [
  "dámská drogerie",
  "syrové maso",
  "maso ke zpracování",
  "k tepelné úpravě",
  "mobilní data",
];

// Prefixová klíčová slova — shoda od hranice slova, povolen libovolný sufix
// (např. "zahrad" chytí "zahradní", "dámsk" chytí "dámské").
export const EXCLUDE_PREFIX_KEYWORDS: string[] = [
  "oblečen", "dámsk", "cigaret", "tabák", "tabak", "paušál", "pausal",
  "zahrad", "bazén", "bazen", "grilov", "alkohol",
];

// Celá slova — shoda jen jako samostatné slovo (aby "gin" nezasáhlo "ginger",
// "rum" nezasáhlo "rumsteak", "víno" nezasáhlo "vínotéka").
export const EXCLUDE_WORD_KEYWORDS: string[] = [
  "tričko", "kalhoty", "bunda",
  "vodka", "whisky", "rum", "víno", "pivo", "likér", "gin", "tequila",
  "tarif", "internet", "gril",
];

// Kategorie (přesnější shoda), které VYLUČUJÍ celou položku.
export const EXCLUDE_CATEGORIES: string[] = [
  "oblečení", "móda", "alkohol", "tabák", "zahrada a grilování", "zahrada",
];
