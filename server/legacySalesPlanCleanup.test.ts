import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("legacy Sales and Marketing Plan cleanup", () => {
  const appSource = readSource("client/src/App.tsx");
  const homeSource = readSource("client/src/pages/Home.tsx");
  const financialStudiesSource = readSource("client/src/pages/BateekhaPage.tsx");

  it("removes the external legacy Sales and Marketing entry and its direct route", () => {
    expect(homeSource).not.toContain('id: "tool-wael-sales"');
    expect(homeSource).not.toContain('path: "/wael-sales-plan"');
    expect(appSource).not.toContain('path="/wael-sales-plan"');
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/WaelSalesPlan.tsx"))).toBe(false);
  });

  it("preserves the current Sales and Marketing pages inside Financial Studies", () => {
    expect(appSource).toContain('path="/bateekha"');
    expect(financialStudiesSource).toContain('id: "sales"');
    expect(financialStudiesSource).toContain('id: "marketing"');
    expect(financialStudiesSource).toContain('V2WaelSales');
  });
});
