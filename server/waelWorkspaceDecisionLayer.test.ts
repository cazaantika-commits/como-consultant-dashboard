import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Wael professional decision workspace", () => {
  const workspaceSource = readSource("client/src/pages/V2WaelSales.tsx");
  const navigationSource = readSource("client/src/pages/BateekhaPage.tsx");

  it("uses focused decision rooms and live scenario outcomes instead of a collapsed grid collection", () => {
    expect(workspaceSource).toContain("WAEL_STUDIO_ROOMS");
    expect(workspaceSource).toContain("لوحة السيناريو");
    expect(workspaceSource).toContain("المنتج والسعر");
    expect(workspaceSource).toContain("خطة البيع");
    expect(workspaceSource).toContain("تحصيل المشتري");
    expect(workspaceSource).toContain("حملة التسويق");
    expect(workspaceSource).toContain("أثر القرار");
    expect(workspaceSource).toContain("activeStudioRoom");
    expect(workspaceSource).toContain("applySalesPace");
    expect(workspaceSource).toContain("adjustAllPrices");
    expect(workspaceSource).toContain("applyPaymentPreset");
    expect(workspaceSource).toContain("أول تحصيل فعلي");
    expect(workspaceSource).toContain("الشهر الحرج");
    expect(workspaceSource).not.toContain("تفاصيل التحكم الدقيق");
  });

  it("preserves a single approved scenario save and one visible Sales and Marketing entry", () => {
    expect(workspaceSource).toContain("اعتماد سيناريو وائل");
    expect(workspaceSource).toContain("saveWorkspace.mutateAsync");
    expect(navigationSource).toContain("المبيعات والتسويق — مساحة وائل");
    expect(navigationSource).not.toContain('id: "marketing"');
  });

  it("uses a visible twelve-month direct-input sales board with synchronized units and percentage controls", () => {
    expect(workspaceSource).toContain("const monthsPerPage = 12");
    expect(workspaceSource).toContain("لوحة البيع التفاعلية");
    expect(workspaceSource).toContain("12 شهرًا واضحًا");
    expect(workspaceSource).toContain("وحدات ${monthIndex");
    expect(workspaceSource).toContain("نسبة ${monthIndex");
    expect(workspaceSource).toContain("updateSalesMonth(salesIndex");
  });
});
