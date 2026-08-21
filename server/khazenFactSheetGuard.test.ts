import { describe, expect, it } from "vitest";
import { buildKhazenFactSheetUpdate } from "./khazenFactSheetGuard";

describe("Khazen fact-sheet write guard", () => {
  it("keeps financial BUA protected while retaining documented GFA", () => {
    const update = buildKhazenFactSheetUpdate({
      bua: 50_570.04,
      gfaSqft: "50,570.04",
      plotNumber: "3260885",
      adminFee: "0",
    });

    expect(update).toEqual({
      gfaSqft: 50_570.04,
      plotNumber: "3260885",
      adminFee: 0,
    });
    expect(update).not.toHaveProperty("bua");
  });

  it("drops malformed numeric values instead of causing an all-or-nothing database failure", () => {
    const update = buildKhazenFactSheetUpdate({
      gfaSqm: "not documented",
      parkingAvailableSpaces: "12 spaces",
      gfaSqft: "0",
    });

    expect(update).toEqual({ gfaSqft: 0 });
  });
});
