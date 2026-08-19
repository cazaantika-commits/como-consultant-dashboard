import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/ConstructionInputsPage.tsx"), "utf8");

describe("Construction Plan execution canvas", () => {
  it("uses direct large construction controls and a paged monthly execution calendar", () => {
    expect(source).toContain("تقويم التنفيذ الشهري");
    expect(source).toContain('aria-label="مدة الإنشاء بالأشهر"');
    expect(source).toContain('aria-label="نسبة الدفعة المقدمة"');
    expect(source).toContain("monthlyProgress.slice(pageStart, pageStart + 12)");
    expect(source).toContain("h-12 w-full");
    expect(source).not.toContain("repeat(${totalColumns}, minmax(40px, 1fr))");
  });

  it("retains the financial save contract and auditable payment details", () => {
    expect(source).toContain("constructionScheduleJson: JSON.stringify({ mobilizationPct, monthlyProgress, curveType })");
    expect(source).toContain("تفاصيل دفعات المقاول للتدقيق");
    expect(source).toContain("إطلاق احتجاز قادم");
  });
});
