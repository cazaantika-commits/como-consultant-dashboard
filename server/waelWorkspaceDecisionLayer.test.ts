import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Wael professional decision workspace", () => {
  const workspaceSource = readSource("client/src/pages/V2WaelSales.tsx");
  const navigationSource = readSource("client/src/pages/BateekhaPage.tsx");

  it("uses one professional scenario canvas with live impact beside direct controls", () => {
    expect(workspaceSource).not.toContain("WAEL_STUDIO_ROOMS");
    expect(workspaceSource).toContain("مساحة سيناريو وائل");
    expect(workspaceSource).toContain("شريط التحكم");
    expect(workspaceSource).toContain("لوحة بيع 12 شهرًا");
    expect(workspaceSource).toContain("أثر القرار — مباشر");
    expect(workspaceSource).toContain("impactFocus");
    expect(workspaceSource).toContain("xl:grid-cols-[minmax(0,1fr)_370px]");
    expect(workspaceSource).toContain("h-12 w-full");
    expect(workspaceSource).toContain("applySalesPace");
    expect(workspaceSource).toContain("adjustAllPrices");
    expect(workspaceSource).toContain("applyPaymentPreset");
    expect(workspaceSource).toContain("أول تحصيل فعلي");
    expect(workspaceSource).toContain("أدنى رصيد في الإسكرو");
  });

  it("preserves a single approved scenario save and one visible Sales and Marketing entry", () => {
    expect(workspaceSource).toContain("اعتماد سيناريو وائل");
    expect(workspaceSource).toContain("saveWorkspace.mutateAsync");
    expect(navigationSource).toContain("المبيعات والتسويق — مساحة وائل");
    expect(navigationSource).not.toContain('id: "marketing"');
  });

  it("uses a visible twelve-month direct-input sales board with synchronized, large unit and percentage controls", () => {
    expect(workspaceSource).toContain("const monthsPerPage = 12");
    expect(workspaceSource).toContain("اكتب عدد الوحدات أو النسبة داخل البطاقة نفسها");
    expect(workspaceSource).toContain("const calendarYear = projectStartDate");
    expect(workspaceSource).toContain("tabular-nums tracking-wide text-slate-500");
    expect(workspaceSource).toContain("وحدات ${monthLabel}");
    expect(workspaceSource).toContain("نسبة ${monthLabel}");
    expect(workspaceSource).toContain("updateSalesMonth(salesIndex");
  });

  it("protects the professional canvas from invalid negative legacy month values", () => {
    expect(workspaceSource).toContain("manualUnits.map((value) => Math.max(0, Math.round(Number(value) || 0)))");
    expect(workspaceSource).toContain("const selectedUnits = Math.max(0, Number(manualUnits[salesIndex] ?? units ?? 0) || 0)");
  });

  it("uses direct post-completion sale language instead of off-plan payment or escrow controls for build-for-sale", () => {
    expect(workspaceSource).toContain('isBuildForSale ? "تحصيل البيع"');
    expect(workspaceSource).toContain("دفعة كاملة عند بيع الوحدة");
    expect(workspaceSource).toContain("بيع مباشر بعد الإنجاز");
    expect(workspaceSource).toContain('isBuildForSale ? "استلام مباشر" : "تحصيل"');
  });
});
