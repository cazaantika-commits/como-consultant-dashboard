import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Investor Cash Flow readability layout", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "client/src/pages/V2InvestorCashFlow.tsx"),
    "utf8",
  );
  const escrowSource = fs.readFileSync(
    path.resolve(process.cwd(), "client/src/pages/V2EscrowCashFlow.tsx"),
    "utf8",
  );

  it("renders direct expense rows rather than non-decision subsection headings", () => {
    expect(source).toContain("{debitRows.map((item, i) => {");
    expect(source).not.toContain("{sections.map((section, si) => (");
    expect(source).not.toContain("الرسوم الحكومية والتنظيمية");
  });

  it("uses investor-relevant labels while retaining the shared net calculation", () => {
    expect(source).toContain("المبالغ المطلوبة من المستثمر");
    expect(source).toContain("المبالغ المستلمة للمستثمر");
    expect(source).toContain("calculateInvestorMonthlyNet(data, salesResult)");
  });

  it("keeps readable table text with compact one-unit vertical data-row padding", () => {
    expect(source).toContain('className="investor-cashflow-table w-full text-xs border-collapse min-w-max"');
    expect(source).toContain('px-3 py-1 text-gray-800 font-semibold');
    expect(source).toContain('px-1.5 py-1 text-center tabular-nums');
    expect(source).not.toContain('px-3 py-2 text-gray-800 font-semibold');
    expect(source).not.toContain('px-1.5 py-2 text-center tabular-nums');
  });

  it("keeps dark month headers visible during scrolling and defines clear month boundaries", () => {
    expect(source).toContain('investor-cashflow-table-wrap max-h-[70vh] overflow-auto');
    expect(source).toContain('sticky top-0 z-30 bg-white shadow-md');
    expect(source).toContain('text-[10px] font-black leading-4 text-slate-800');
    expect(source).toContain('border-s border-slate-300');
  });

  it("uses full month and year labels plus a compact phase-month label in both monthly matrices", () => {
    expect(source).toContain("formatCashFlowMonthYear(m.date).month");
    expect(source).toContain("شهر {m.label}");
    expect(escrowSource).toContain("formatCashFlowMonthYear(m.date).month");
    expect(escrowSource).toContain("شهر {m.label}");
  });

  it("keeps both matrices in a fixed-heading scroll frame with a period summary and clear decision rows", () => {
    expect(source).toContain("ملخص الفترة المالية في المصفوفة");
    expect(source).toContain('max-h-[70vh] overflow-auto');
    expect(source).toContain('bg-cyan-100/80 font-bold border-y-2 border-cyan-400');
    expect(escrowSource).toContain("ملخص الفترة المالية في المصفوفة");
    expect(escrowSource).toContain('max-h-[70vh] overflow-auto');
    expect(escrowSource).toContain('bg-violet-100/80 font-bold border-y-2 border-violet-400');
  });

  it("keeps the detail table beneath a decision-first investor position layer", () => {
    expect(source).toContain("موقف المستثمر — مباشر");
    expect(source).toContain("أعلى ضغط تمويلي");
    expect(source).toContain("نبض الضغط والعودة الشهري");
  });

  it("separates peak capital from lifetime investor payments and exposes feasibility reconciliation", () => {
    expect(source).toContain("calculateInvestorCapitalSummary(data)");
    expect(source).toContain("رأس المال المطلوب عند الذروة");
    expect(source).toContain("مدفوع سابقًا");
    expect(source).toContain("المتبقي للتمويل");
    expect(source).toContain("إجمالي مدفوعات المستثمر طوال المشروع");
    expect(source).toContain("إجمالي ما يستلمه المستثمر");
    expect(source).toContain("صافي ربح المستثمر");
    expect(source).toContain("مطابق لدراسة الجدوى — الفرق 0 فلس");
    expect(source).not.toContain("إجمالي المطلوب من المستثمر");
  });

  it("keeps the dense header totals off small screens where the decision cards already show them", () => {
    expect(source).toContain('className="hidden items-center gap-3 text-xs 2xl:flex"');
    expect(source).toContain("flex-wrap items-center justify-between");
  });
});
