import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/ConstructionInputsPage.tsx"), "utf8");

describe("Construction Plan execution canvas", () => {
  it("uses direct controls and a compact paged 20-month execution calendar", () => {
    expect(source).toContain("تقويم التنفيذ الشهري");
    expect(source).toContain('aria-label="مدة الإنشاء بالأشهر"');
    expect(source).toContain('aria-label="نسبة الدفعة المقدمة"');
    expect(source).toContain("const CONSTRUCTION_MONTHS_PER_PAGE = 20");
    expect(source).toContain("monthlyProgress.slice(pageStart, pageStart + CONSTRUCTION_MONTHS_PER_PAGE)");
    expect(source).toContain("h-9 w-full");
    expect(source).toContain("الأشهر {pageStart + 1}–{Math.min(pageStart + CONSTRUCTION_MONTHS_PER_PAGE, constructionMonths)}");
    expect(source).not.toContain("repeat(${totalColumns}, minmax(40px, 1fr))");
  });

  it("uses the Consultant Evaluation-style visual composition for cards and controls", () => {
    expect(source).toContain('construction-example-canvas');
    expect(source).toContain('example-icon-tile example-icon-teal');
    expect(source).toContain('example-icon-tile example-icon-blue');
    expect(source).toContain('example-icon-tile example-icon-rose');
    expect(source).toContain('example-icon-tile example-icon-amber');
  });

  it("retains the financial save contract and auditable payment details", () => {
    expect(source).toContain("mergeProjectScheduleJson");
    expect(source).toContain("constructionScheduleJson: mergeProjectScheduleJson(project?.constructionScheduleJson");
    expect(source).not.toContain("constructionScheduleJson: JSON.stringify({ mobilizationPct, monthlyProgress, curveType })");
    expect(source).toContain("تفاصيل دفعات المقاول للتدقيق");
    expect(source).toContain("إطلاق احتجاز قادم");
  });
});
