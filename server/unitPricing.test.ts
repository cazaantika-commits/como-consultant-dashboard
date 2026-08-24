import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "/home/ubuntu/como-consultant-dashboard";
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");

describe("unit pricing extensions", () => {
  it("adds the three requested residential unit types as independent project fields", () => {
    const schema = read("drizzle/schema.ts");
    const router = read("server/routers/projects.ts");
    [
      "studioCount", "studioArea", "studioPrice",
      "residential2brMaidCount", "residential2brMaidArea", "residential2brMaidPrice",
      "residential3brMaidCount", "residential3brMaidArea", "residential3brMaidPrice",
    ].forEach((field) => {
      expect(schema).toContain(field);
      expect(router).toContain(field);
    });
  });

  it("keeps new unit types in the shared revenue and escrow calculation inputs", () => {
    const engine = read("client/src/lib/investorCashFlowEngine.ts");
    const escrow = read("client/src/pages/EscrowCashFlowSchedulePage2.tsx");
    ["استوديو", "غرفتين وصالة مع غرفة خادمة", "ثلاث غرف وصالة مع غرفة خادمة"].forEach((label) => {
      expect(engine).toContain(label);
      expect(escrow).toContain(label);
    });
    expect(engine).toContain("residential2brMaidPrice");
    expect(engine).toContain("residential3brMaidPrice");
  });

  it("supports replacement typing and shows both individual-unit and type totals", () => {
    const sales = read("client/src/pages/V2WaelSales.tsx");
    expect(sales).toContain('inputMode="numeric"');
    expect(sales).toContain("event.currentTarget.select()");
    expect(sales).toContain("سعر الوحدة الواحدة");
    expect(sales).toContain("إجمالي النوع");
    expect(sales).toContain("اكتب الرقم مباشرة");
  });

  it("keeps unit distribution and workspace pricing aligned with the new fields", () => {
    const distribution = read("client/src/pages/PricingPage.tsx");
    const workspace = read("server/routers/waelSalesPlan.ts");
    expect(distribution).toContain("twobed_maid");
    expect(distribution).toContain("threebed_maid");
    expect(workspace).toContain("studioPrice");
    expect(workspace).toContain("residential2brMaidPrice");
    expect(workspace).toContain("residential3brMaidPrice");
  });
});
