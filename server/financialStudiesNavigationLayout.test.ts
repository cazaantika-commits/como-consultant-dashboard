import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Financial Studies two-tier tile navigation", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "client/src/pages/BateekhaPage.tsx"),
    "utf8",
  );

  it("opens to a reference-style independent card guide instead of a preselected report", () => {
    expect(source).toContain("useState<TabId | null>(null)");
    expect(source).toContain("اختر القسم المطلوب للبدء");
    expect(source).toContain("العودة إلى دليل الدراسات");
  });

  it("renders the five spacious descriptive cards from the supplied reference style", () => {
    expect(source).toContain('max-w-5xl');
    expect(source).toContain('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3');
    expect(source).toContain('rounded-2xl border bg-card p-6 text-right');
    expect(source).toContain('opacity-5 transition-opacity group-hover:opacity-10');
    expect(source).toContain('h-[3px] rounded-t-2xl');
    expect(source).toContain("بطاقة المشروع");
    expect(source).toContain("الإعداد والتخطيط");
    expect(source).toContain("التخطيط المالي");
    expect(source).toContain("دراسة جدوى المستثمر");
    expect(source).toContain("محفظة رأس المال الديناميكية");
    expect(source).toContain("فتح القسم");
  });

  it("opens each group into a dedicated child-page guide", () => {
    expect(source).toContain("!activeTab && openGroup ? (");
    expect(source).toContain("العودة إلى جميع الأقسام");
    expect(source).toContain('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3');
    expect(source).toContain("فتح الصفحة");
    expect(source).toContain("setOpenGroupId(groupId)");
  });

  it("does not revert to compact tile strips and retains type-aware navigation", () => {
    expect(source).not.toContain("sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm");
    expect(source).not.toContain('grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5');
    expect(source).toContain("isFinancialStudiesTabVisible");
    expect(source).toContain("getFallbackFinancialStudiesTab");
    expect(source).toContain('sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm');
  });
});
