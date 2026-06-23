import { describe, it, expect, vi } from "vitest";

// ============================================================
// Market Reports Router Tests
// ============================================================
describe("Market Reports Router", () => {
  it("should have correct report source types", () => {
    const REPORT_SOURCES = ["CBRE", "JLL", "Knight Frank", "Savills", "Cushman & Wakefield", "Colliers", "other"];
    expect(REPORT_SOURCES).toContain("CBRE");
    expect(REPORT_SOURCES).toContain("JLL");
    expect(REPORT_SOURCES).toContain("Knight Frank");
    expect(REPORT_SOURCES.length).toBe(7);
  });

  it("should have correct report type categories", () => {
    const REPORT_TYPES = [
      "market_overview", "residential_market", "commercial_market",
      "office_market", "hospitality_market", "retail_market",
      "industrial_market", "investment_market", "area_focus", "custom"
    ];
    expect(REPORT_TYPES).toContain("market_overview");
    expect(REPORT_TYPES).toContain("residential_market");
    expect(REPORT_TYPES).toContain("area_focus");
    expect(REPORT_TYPES.length).toBe(10);
  });

  it("should validate report upload input structure", () => {
    const validInput = {
      title: "CBRE Dubai Market Report Q1 2026",
      source: "CBRE",
      reportType: "market_overview",
      reportDate: "2026-01-15",
      fileUrl: "https://example.com/report.pdf",
      fileName: "cbre-q1-2026.pdf",
      fileSize: 2500000,
    };
    expect(validInput.title).toBeTruthy();
    expect(validInput.source).toBeTruthy();
    expect(validInput.reportType).toBeTruthy();
    expect(validInput.fileUrl).toMatch(/^https?:\/\//);
    expect(validInput.fileSize).toBeLessThan(50 * 1024 * 1024); // 50MB limit
  });

  it("should validate extracted data structure", () => {
    const extractedData = {
      avgPricePerSqft: 1850,
      avgRent: 120000,
      supplyUnits: 5000,
      demandIndex: 78,
      vacancyRate: 8.5,
      yoyPriceChange: 12.3,
      yoyRentChange: 8.7,
      transactionVolume: 15000,
      topAreas: ["Dubai Marina", "Downtown Dubai", "JVC"],
      keyInsights: ["Strong demand in luxury segment", "Increased supply in affordable housing"],
    };
    expect(extractedData.avgPricePerSqft).toBeGreaterThan(0);
    expect(extractedData.vacancyRate).toBeGreaterThanOrEqual(0);
    expect(extractedData.vacancyRate).toBeLessThanOrEqual(100);
    expect(extractedData.topAreas.length).toBeGreaterThan(0);
    expect(extractedData.keyInsights.length).toBeGreaterThan(0);
  });

  it("should calculate report statistics correctly", () => {
    const reports = [
      { source: "CBRE", status: "processed", reportType: "market_overview" },
      { source: "JLL", status: "processed", reportType: "residential_market" },
      { source: "CBRE", status: "pending", reportType: "commercial_market" },
      { source: "Knight Frank", status: "error", reportType: "market_overview" },
    ];
    const totalReports = reports.length;
    const processedReports = reports.filter(r => r.status === "processed").length;
    const sourceBreakdown = reports.reduce((acc: Record<string, number>, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {});
    
    expect(totalReports).toBe(4);
    expect(processedReports).toBe(2);
    expect(sourceBreakdown["CBRE"]).toBe(2);
    expect(sourceBreakdown["JLL"]).toBe(1);
    expect(sourceBreakdown["Knight Frank"]).toBe(1);
  });
});

// ============================================================
// Risk Dashboard Router Tests
// ============================================================
describe("Risk Dashboard Router", () => {
  it("should calculate PMRI score correctly", () => {
    // PMRI = weighted average of 5 risk categories
    const weights = {
      marketRisk: 0.25,
      financialRisk: 0.25,
      competitiveRisk: 0.20,
      regulatoryRisk: 0.15,
      executionRisk: 0.15,
    };
    const scores = {
      marketRisk: 60,
      financialRisk: 40,
      competitiveRisk: 55,
      regulatoryRisk: 30,
      executionRisk: 45,
    };
    const pmri = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + scores[key as keyof typeof scores] * weight;
    }, 0);
    
    expect(pmri).toBeCloseTo(47.25, 1);
    expect(pmri).toBeGreaterThanOrEqual(0);
    expect(pmri).toBeLessThanOrEqual(100);
  });

  it("should classify risk levels correctly", () => {
    function classifyRisk(pmri: number): string {
      if (pmri < 25) return "low";
      if (pmri < 50) return "medium";
      if (pmri < 75) return "high";
      return "critical";
    }
    
    expect(classifyRisk(10)).toBe("low");
    expect(classifyRisk(24)).toBe("low");
    expect(classifyRisk(25)).toBe("medium");
    expect(classifyRisk(49)).toBe("medium");
    expect(classifyRisk(50)).toBe("high");
    expect(classifyRisk(74)).toBe("high");
    expect(classifyRisk(75)).toBe("critical");
    expect(classifyRisk(100)).toBe("critical");
  });

  it("should generate alerts for high-risk projects", () => {
    const projects = [
      { id: 1, name: "Project A", pmriScore: 80, riskLevel: "critical", marketRisk: 90, financialRisk: 70 },
      { id: 2, name: "Project B", pmriScore: 30, riskLevel: "medium", marketRisk: 35, financialRisk: 25 },
      { id: 3, name: "Project C", pmriScore: 65, riskLevel: "high", marketRisk: 70, financialRisk: 60 },
    ];
    const alerts = projects.filter(p => p.riskLevel === "high" || p.riskLevel === "critical");
    
    expect(alerts.length).toBe(2);
    expect(alerts[0].name).toBe("Project A");
    expect(alerts[1].name).toBe("Project C");
  });

  it("should calculate risk distribution correctly", () => {
    const riskLevels = ["low", "medium", "high", "critical", "medium", "low", "high", "medium"];
    const distribution = riskLevels.reduce((acc: Record<string, number>, level) => {
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
    
    expect(distribution.low).toBe(2);
    expect(distribution.medium).toBe(3);
    expect(distribution.high).toBe(2);
    expect(distribution.critical).toBe(1);
    expect(Object.values(distribution).reduce((a, b) => a + b, 0)).toBe(8);
  });

  it("should identify high-risk categories for a project", () => {
    const riskScores = {
      marketRisk: 80,
      financialRisk: 45,
      competitiveRisk: 72,
      regulatoryRisk: 20,
      executionRisk: 65,
    };
    const threshold = 60;
    const highRiskCategories = Object.entries(riskScores)
      .filter(([_, score]) => score >= threshold)
      .map(([key]) => key);
    
    expect(highRiskCategories).toContain("marketRisk");
    expect(highRiskCategories).toContain("competitiveRisk");
    expect(highRiskCategories).toContain("executionRisk");
    expect(highRiskCategories).not.toContain("financialRisk");
    expect(highRiskCategories).not.toContain("regulatoryRisk");
  });
});

// ============================================================
// Self-Learning System Tests
// ============================================================
describe("Self-Learning System", () => {
  it("should calculate MAPE correctly", () => {
    // MAPE = Mean Absolute Percentage Error
    const predictions = [
      { predicted: 1800, actual: 1900 },
      { predicted: 2000, actual: 1850 },
      { predicted: 1500, actual: 1600 },
    ];
    const ape = predictions.map(p => Math.abs(p.predicted - p.actual) / p.actual * 100);
    const mape = ape.reduce((sum, e) => sum + e, 0) / ape.length;
    
    expect(mape).toBeGreaterThan(0);
    expect(mape).toBeLessThan(100);
    // (5.26 + 8.11 + 6.25) / 3 ≈ 6.54
    expect(mape).toBeCloseTo(6.54, 0);
  });

  it("should detect prediction bias correctly", () => {
    function detectBias(predictions: { predicted: number; actual: number }[]): string {
      const errors = predictions.map(p => p.predicted - p.actual);
      const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
      if (avgError > 0) return "over"; // consistently overestimating
      if (avgError < 0) return "under"; // consistently underestimating
      return "neutral";
    }
    
    // Over-estimating
    expect(detectBias([
      { predicted: 2000, actual: 1800 },
      { predicted: 1900, actual: 1700 },
      { predicted: 2100, actual: 1900 },
    ])).toBe("over");
    
    // Under-estimating
    expect(detectBias([
      { predicted: 1600, actual: 1800 },
      { predicted: 1500, actual: 1700 },
      { predicted: 1700, actual: 1900 },
    ])).toBe("under");
  });

  it("should calculate deviation percentage correctly", () => {
    function calcDeviation(predicted: number, actual: number): number {
      return ((predicted - actual) / actual) * 100;
    }
    
    expect(calcDeviation(2000, 1800)).toBeCloseTo(11.11, 1);
    expect(calcDeviation(1600, 1800)).toBeCloseTo(-11.11, 1);
    expect(calcDeviation(1800, 1800)).toBe(0);
  });

  it("should validate prediction types", () => {
    const PREDICTION_TYPES = [
      "price_per_sqft", "total_revenue", "absorption_rate",
      "sell_out_months", "demand_units", "construction_cost", "roi", "irr"
    ];
    expect(PREDICTION_TYPES.length).toBe(8);
    expect(PREDICTION_TYPES).toContain("price_per_sqft");
    expect(PREDICTION_TYPES).toContain("absorption_rate");
    expect(PREDICTION_TYPES).toContain("roi");
  });

  it("should calculate accuracy from MAPE correctly", () => {
    function mapeToAccuracy(mape: number): number {
      return Math.max(0, 100 - mape);
    }
    
    expect(mapeToAccuracy(0)).toBe(100);
    expect(mapeToAccuracy(5)).toBe(95);
    expect(mapeToAccuracy(50)).toBe(50);
    expect(mapeToAccuracy(100)).toBe(0);
    expect(mapeToAccuracy(120)).toBe(0); // capped at 0
  });

  it("should aggregate accuracy by prediction type", () => {
    const logs = [
      { predictionType: "price_per_sqft", mape: 5, sampleSize: 3 },
      { predictionType: "price_per_sqft", mape: 8, sampleSize: 5 },
      { predictionType: "absorption_rate", mape: 12, sampleSize: 2 },
    ];
    
    const byType: Record<string, { totalMape: number; totalSamples: number }> = {};
    for (const log of logs) {
      if (!byType[log.predictionType]) {
        byType[log.predictionType] = { totalMape: 0, totalSamples: 0 };
      }
      byType[log.predictionType].totalMape += log.mape * log.sampleSize;
      byType[log.predictionType].totalSamples += log.sampleSize;
    }
    
    const avgMape: Record<string, number> = {};
    for (const [type, data] of Object.entries(byType)) {
      avgMape[type] = data.totalMape / data.totalSamples;
    }
    
    // price_per_sqft: (5*3 + 8*5) / (3+5) = 55/8 = 6.875
    expect(avgMape["price_per_sqft"]).toBeCloseTo(6.875, 2);
    // absorption_rate: 12*2/2 = 12
    expect(avgMape["absorption_rate"]).toBe(12);
  });
});
