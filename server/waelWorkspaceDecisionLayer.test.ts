import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Wael decision-first workspace", () => {
  const workspaceSource = readSource("client/src/pages/V2WaelSales.tsx");
  const navigationSource = readSource("client/src/pages/BateekhaPage.tsx");

  it("keeps decision controls and live scenario outcomes ahead of detailed grids", () => {
    expect(workspaceSource).toContain("مركز قرار وائل");
    expect(workspaceSource).toContain("applySalesPace");
    expect(workspaceSource).toContain("adjustAllPrices");
    expect(workspaceSource).toContain("applyPaymentPreset");
    expect(workspaceSource).toContain("أول تحصيل فعلي");
    expect(workspaceSource).toContain("الشهر الحرج");
    expect(workspaceSource).toContain("تفاصيل التحكم الدقيق");
    expect(workspaceSource).toContain("إظهار التفاصيل");
  });

  it("preserves a single approved scenario save and one visible Sales and Marketing entry", () => {
    expect(workspaceSource).toContain("اعتماد سيناريو وائل");
    expect(workspaceSource).toContain("saveWorkspace.mutateAsync");
    expect(navigationSource).toContain("المبيعات والتسويق — مساحة وائل");
    expect(navigationSource).not.toContain('id: "marketing"');
  });
});
