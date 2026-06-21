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

  it("odmítne nesmyslné datum (měsíc/den mimo rozsah)", () => {
    expect(parseValidity("40. 13. 2026")).toEqual({ validFrom: null, validTo: null });
  });

  it("odmítne neexistující kalendářní datum (30. únor)", () => {
    expect(parseValidity("30. 2. 2026")).toEqual({ validFrom: null, validTo: null });
  });

  it("doplní aktuální rok, když v textu žádný není", () => {
    const year = new Date().getFullYear();
    expect(parseValidity("Platí od 16. 6. do 22. 6.")).toEqual({
      validFrom: `${year}-06-16`,
      validTo: `${year}-06-22`,
    });
  });
});
