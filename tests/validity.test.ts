import { describe, it, expect } from "vitest";
import { parseValidity } from "../src/normalize/validity.js";

describe("parseValidity", () => {
  it("parsuje rozsah od-do se dvěma daty", () => {
    expect(parseValidity("Platí od 16. 6. do 22. 6. 2026")).toEqual({
      validFrom: "2026-06-16",
      validTo: "2026-06-22",
    });
  });

  it("doplní chybějící rok prvního data z druhého", () => {
    expect(parseValidity("16. 6. - 22. 6. 2026")).toEqual({
      validFrom: "2026-06-16",
      validTo: "2026-06-22",
    });
  });

  it("parsuje jen koncové datum", () => {
    expect(parseValidity("Platí do 22. 6. 2026")).toEqual({
      validFrom: null,
      validTo: "2026-06-22",
    });
  });

  it("vrací nully pro null vstup", () => {
    expect(parseValidity(null)).toEqual({ validFrom: null, validTo: null });
  });

  it("vrací nully pro nerozpoznaný text", () => {
    expect(parseValidity("tento týden")).toEqual({ validFrom: null, validTo: null });
  });
});
