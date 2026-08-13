import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Financial Studies unit price ownership", () => {
  it("keeps Unit Distribution limited to counts and areas", () => {
    const source = readProjectFile("client/src/pages/PricingPage.tsx");

    expect(source).not.toContain("PRICE_MAP");
    expect(source).not.toContain("updatePrice");
    expect(source).not.toContain("سعر/قدم²");
    expect(source).not.toContain("residential1brPrice");
    expect(source).not.toContain("villaPrice");
  });

  it("keeps the Sales Pricing page as the sole unit-price writer", () => {
    const source = readProjectFile("client/src/pages/V2WaelSales.tsx");

    expect(source).toContain("payload[u.dbPrice] = d.price");
    expect(source).toContain("حفظ التسعير");
    expect(source).toContain("سعر/قدم (AED)");
  });
});
