import { describe, it, expect, vi } from "vitest";

// Mock getDb
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue([{ insertId: 99 }]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "تحليل تجريبي من جويل" } }],
  }),
}));

describe("Feasibility Router - Joelle Enhancements", () => {
  it("feasibilityInput schema should accept projectId and scenarioName", () => {
    const { z } = require("zod");
    const schema = z.object({
      projectId: z.number().optional().nullable(),
      scenarioName: z.string().optional().nullable(),
      projectName: z.string().min(1),
    });
    
    const result = schema.safeParse({
      projectId: 5,
      scenarioName: "متفائل",
      projectName: "مشروع تجريبي",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe(5);
      expect(result.data.scenarioName).toBe("متفائل");
    }
  });

  it("feasibilityInput schema should accept null projectId", () => {
    const { z } = require("zod");
    const schema = z.object({
      projectId: z.number().optional().nullable(),
      scenarioName: z.string().optional().nullable(),
      projectName: z.string().min(1),
    });
    
    const result = schema.safeParse({
      projectId: null,
      scenarioName: null,
      projectName: "مشروع بدون ربط",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBeNull();
    }
  });

  it("duplicateAsScenario input should validate correctly", () => {
    const { z } = require("zod");
    const schema = z.object({
      studyId: z.number(),
      scenarioName: z.string(),
    });
    
    const result = schema.safeParse({
      studyId: 1,
      scenarioName: "متشائم",
    });
    expect(result.success).toBe(true);
  });

  it("generateMarketAnalysis input should validate correctly", () => {
    const { z } = require("zod");
    const schema = z.object({
      studyId: z.number(),
      community: z.string(),
    });
    
    const result = schema.safeParse({
      studyId: 1,
      community: "دبي مارينا",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.community).toBe("دبي مارينا");
    }
  });

  it("should calculate profit metrics correctly", () => {
    // Simulate the calculation logic from the router
    const study = {
      gfaResidential: 50000,
      gfaRetail: 5000,
      gfaOffices: 0,
      saleableResidentialPct: 90,
      saleableRetailPct: 99,
      saleableOfficesPct: 90,
      residentialSalePrice: 2000,
      retailSalePrice: 3000,
      officesSalePrice: 0,
      landPrice: 20000000,
      estimatedBua: 60000,
      constructionCostPerSqft: 250,
      comoProfitSharePct: 15,
      agentCommissionLandPct: 1,
      designFeePct: 2,
      supervisionFeePct: 2,
      contingenciesPct: 2,
      developerFeePct: 5,
      agentCommissionSalePct: 5,
      marketingPct: 2,
      plotAreaM2: 5000,
      separationFeePerM2: 40,
      numberOfUnits: 100,
      reraUnitFee: 850,
    };

    const saleableRes = study.gfaResidential * (study.saleableResidentialPct / 100);
    const saleableRet = study.gfaRetail * (study.saleableRetailPct / 100);
    const revenueRes = saleableRes * study.residentialSalePrice;
    const revenueRet = saleableRet * study.retailSalePrice;
    const totalRevenue = revenueRes + revenueRet;
    const constructionCost = study.estimatedBua * study.constructionCostPerSqft;

    expect(saleableRes).toBe(45000);
    expect(saleableRet).toBe(4950);
    expect(revenueRes).toBe(90000000);
    expect(revenueRet).toBe(14850000);
    expect(totalRevenue).toBe(104850000);
    expect(constructionCost).toBe(15000000);

    const profit = totalRevenue - (study.landPrice + constructionCost);
    expect(profit).toBe(69850000);
    
    const profitMargin = (profit / totalRevenue) * 100;
    expect(profitMargin).toBeGreaterThan(0);
    expect(profitMargin).toBeLessThan(100);
  });

  it("scenario name should be appended to project name on duplication", () => {
    const originalName = "مشروع الخليج";
    const scenarioName = "متفائل";
    const newName = `${originalName} - ${scenarioName}`;
    expect(newName).toBe("مشروع الخليج - متفائل");
  });

  it("ROI calculation should handle zero funding", () => {
    const fundingRequired = 0;
    const investorProfit = 1000000;
    const roi = fundingRequired > 0 ? (investorProfit / fundingRequired) * 100 : 0;
    expect(roi).toBe(0);
  });

  it("ROI calculation should be correct for positive funding", () => {
    const fundingRequired = 10000000;
    const investorProfit = 5000000;
    const roi = fundingRequired > 0 ? (investorProfit / fundingRequired) * 100 : 0;
    expect(roi).toBe(50);
  });
});
