import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Financial Studies two-tier tile navigation", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "client/src/pages/BateekhaPage.tsx"),
    "utf8",
  );

  it("opens to an independent tile guide instead of a preselected report", () => {
    expect(source).toContain("useState<TabId | null>(null)");
    expect(source).toContain("اختر مجال العمل");
    expect(source).toContain("العودة إلى دليل الدراسات");
  });

  it("renders larger group tiles that reveal smaller independent page tiles", () => {
    expect(source).toContain('isGrouped ? "col-span-2" : "col-span-1"');
    expect(source).toContain('isGrouped ? "min-h-[156px] gap-2" : "min-h-[118px] gap-1.5"');
    expect(source).toContain('isGrouped && isOpen');
    expect(source).toContain('grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5');
    expect(source).toContain('min-h-[96px] flex-col items-center justify-center');
  });

  it("does not revert to the old sticky horizontal strip and retains type-aware navigation", () => {
    expect(source).not.toContain("sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm");
    expect(source).toContain("isFinancialStudiesTabVisible");
    expect(source).toContain("getFallbackFinancialStudiesTab");
  });
});
