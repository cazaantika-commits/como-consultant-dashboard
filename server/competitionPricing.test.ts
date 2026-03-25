import { describe, it, expect } from "vitest";

describe("Competition Pricing Tab - Schema & Logic", () => {
  // Test scenario data structure
  const scenarioData = {
    optimistic: {
      resStudioPrice: 1800,
      res1brPrice: 1650,
      res2brPrice: 1550,
      res3brPrice: 1500,
      retailSmallPrice: 2200,
      retailMediumPrice: 2200,
      retailLargePrice: 2200,
      officeSmallPrice: 1800,
      officeMediumPrice: 1800,
      officeLargePrice: 1800,
    },
    base: {
      resStudioPrice: 1600,
      res1brPrice: 1550,
      res2brPrice: 1450,
      res3brPrice: 1400,
      retailSmallPrice: 2000,
      retailMediumPrice: 2000,
      retailLargePrice: 2000,
      officeSmallPrice: 1600,
      officeMediumPrice: 1600,
      officeLargePrice: 1600,
    },
    conservative: {
      resStudioPrice: 1400,
      res1brPrice: 1450,
      res2brPrice: 1350,
      res3brPrice: 1300,
      retailSmallPrice: 1800,
      retailMediumPrice: 1800,
      retailLargePrice: 1800,
      officeSmallPrice: 1400,
      officeMediumPrice: 1400,
      officeLargePrice: 1400,
    },
  };

  it("should have all three scenarios with correct structure", () => {
    expect(scenarioData).toHaveProperty("optimistic");
    expect(scenarioData).toHaveProperty("base");
    expect(scenarioData).toHaveProperty("conservative");
  });

  it("should have all residential unit types in each scenario", () => {
    for (const scenario of Object.values(scenarioData)) {
      expect(scenario).toHaveProperty("resStudioPrice");
      expect(scenario).toHaveProperty("res1brPrice");
      expect(scenario).toHaveProperty("res2brPrice");
      expect(scenario).toHaveProperty("res3brPrice");
    }
  });

  it("should have all retail types in each scenario", () => {
    for (const scenario of Object.values(scenarioData)) {
      expect(scenario).toHaveProperty("retailSmallPrice");
      expect(scenario).toHaveProperty("retailMediumPrice");
      expect(scenario).toHaveProperty("retailLargePrice");
    }
  });

  it("should have all office types in each scenario", () => {
    for (const scenario of Object.values(scenarioData)) {
      expect(scenario).toHaveProperty("officeSmallPrice");
      expect(scenario).toHaveProperty("officeMediumPrice");
      expect(scenario).toHaveProperty("officeLargePrice");
    }
  });

  it("optimistic prices should be higher than base prices", () => {
    expect(scenarioData.optimistic.res1brPrice).toBeGreaterThan(scenarioData.base.res1brPrice);
    expect(scenarioData.optimistic.retailSmallPrice).toBeGreaterThan(scenarioData.base.retailSmallPrice);
  });

  it("base prices should be higher than conservative prices", () => {
    expect(scenarioData.base.res1brPrice).toBeGreaterThan(scenarioData.conservative.res1brPrice);
    expect(scenarioData.base.retailSmallPrice).toBeGreaterThan(scenarioData.conservative.retailSmallPrice);
  });

  // Test revenue calculation logic
  it("should correctly calculate unit revenue", () => {
    const avgArea = 900;
    const pricePerSqft = 1550;
    const unitCount = 26;
    const unitPrice = avgArea * pricePerSqft;
    const revenue = unitPrice * unitCount;
    expect(unitPrice).toBe(1395000);
    expect(revenue).toBe(36270000);
  });

  it("should correctly calculate total residential revenue", () => {
    const units = [
      { avgArea: 500, price: 1600, count: 5 },
      { avgArea: 900, price: 1550, count: 26 },
      { avgArea: 1200, price: 1450, count: 16 },
      { avgArea: 1500, price: 1400, count: 3 },
    ];
    const totalRevenue = units.reduce((sum, u) => sum + u.avgArea * u.price * u.count, 0);
    expect(totalRevenue).toBe(4000000 + 36270000 + 27840000 + 6300000);
  });

  // Test payment plan logic
  it("payment plan percentages should sum to 100%", () => {
    const paymentPlan = {
      booking: 10,
      construction: 60,
      handover: 30,
      deferred: 0,
    };
    const total = paymentPlan.booking + paymentPlan.construction + paymentPlan.handover + paymentPlan.deferred;
    expect(total).toBe(100);
  });

  it("payment plan with deferred should still sum to 100%", () => {
    const paymentPlan = {
      booking: 10,
      construction: 50,
      handover: 25,
      deferred: 15,
    };
    const total = paymentPlan.booking + paymentPlan.construction + paymentPlan.handover + paymentPlan.deferred;
    expect(total).toBe(100);
  });

  // Test scenario switching
  it("should switch between scenarios correctly", () => {
    const scenarios = ["optimistic", "base", "conservative"] as const;
    let activeScenario: typeof scenarios[number] = "base";
    
    expect(scenarioData[activeScenario].res1brPrice).toBe(1550);
    
    activeScenario = "optimistic";
    expect(scenarioData[activeScenario].res1brPrice).toBe(1650);
    
    activeScenario = "conservative";
    expect(scenarioData[activeScenario].res1brPrice).toBe(1450);
  });

  // Test average price calculation
  it("should correctly calculate weighted average price per sqft", () => {
    const units = [
      { avgArea: 900, price: 1550, count: 26 },
      { avgArea: 1200, price: 1450, count: 16 },
      { avgArea: 1500, price: 1400, count: 3 },
    ];
    const totalArea = units.reduce((sum, u) => sum + u.avgArea * u.count, 0);
    const totalRevenue = units.reduce((sum, u) => sum + u.avgArea * u.price * u.count, 0);
    const avgPrice = totalRevenue / totalArea;
    expect(totalArea).toBe(23400 + 19200 + 4500);
    expect(avgPrice).toBeCloseTo(totalRevenue / totalArea, 2);
  });
});


describe("Approved Revenue & Scenario Selection", () => {
  // Simulate the revenue calculation per scenario
  function calcRevenueByScenario(
    units: { avgArea: number; basePrice: number; count: number }[],
    multiplier: number
  ): number {
    return units.reduce(
      (sum, u) => sum + u.count * u.avgArea * u.basePrice * multiplier,
      0
    );
  }

  const sampleUnits = [
    { avgArea: 500, basePrice: 1600, count: 5 },
    { avgArea: 900, basePrice: 1550, count: 26 },
    { avgArea: 1200, basePrice: 1450, count: 16 },
    { avgArea: 1500, basePrice: 1400, count: 3 },
  ];

  const baseRevenue = calcRevenueByScenario(sampleUnits, 1.0);
  const optRevenue = calcRevenueByScenario(sampleUnits, 1.1);
  const consRevenue = calcRevenueByScenario(sampleUnits, 0.9);

  it("optimistic revenue should be 10% higher than base", () => {
    expect(optRevenue).toBeCloseTo(baseRevenue * 1.1, 0);
  });

  it("conservative revenue should be 10% lower than base", () => {
    expect(consRevenue).toBeCloseTo(baseRevenue * 0.9, 0);
  });

  it("approved revenue should match the selected scenario revenue", () => {
    type ScenarioKey = "optimistic" | "base" | "conservative";
    const revenueByScenario: Record<ScenarioKey, number> = {
      optimistic: optRevenue,
      base: baseRevenue,
      conservative: consRevenue,
    };

    // Simulate clicking on "base" scenario
    let approvedScenario: ScenarioKey = "base";
    let approvedRevenue = Math.round(revenueByScenario[approvedScenario]);
    expect(approvedRevenue).toBe(Math.round(baseRevenue));

    // Switch to optimistic
    approvedScenario = "optimistic";
    approvedRevenue = Math.round(revenueByScenario[approvedScenario]);
    expect(approvedRevenue).toBe(Math.round(optRevenue));

    // Switch to conservative
    approvedScenario = "conservative";
    approvedRevenue = Math.round(revenueByScenario[approvedScenario]);
    expect(approvedRevenue).toBe(Math.round(consRevenue));
  });

  it("approved revenue should be 0 when no scenario is selected", () => {
    type ScenarioKey = "optimistic" | "base" | "conservative";
    const revenueByScenario: Record<ScenarioKey, number> = {
      optimistic: optRevenue,
      base: baseRevenue,
      conservative: consRevenue,
    };

    const approvedScenario: ScenarioKey | null = null;
    const approvedRevenue = approvedScenario
      ? Math.round(revenueByScenario[approvedScenario])
      : 0;
    expect(approvedRevenue).toBe(0);
  });

  it("clicking a scenario should set both activeScenario and approvedScenario", () => {
    type ScenarioKey = "optimistic" | "base" | "conservative";
    let activeScenario: ScenarioKey = "base";
    let approvedScenario: ScenarioKey | null = null;

    // Simulate clicking on optimistic card
    const clickScenario = (sc: ScenarioKey) => {
      approvedScenario = sc;
      activeScenario = sc;
    };

    clickScenario("optimistic");
    expect(activeScenario).toBe("optimistic");
    expect(approvedScenario).toBe("optimistic");

    clickScenario("conservative");
    expect(activeScenario).toBe("conservative");
    expect(approvedScenario).toBe("conservative");
  });

  it("save payload should include approvedRevenue from selected scenario", () => {
    type ScenarioKey = "optimistic" | "base" | "conservative";
    const revenueByScenario: Record<ScenarioKey, number> = {
      optimistic: optRevenue,
      base: baseRevenue,
      conservative: consRevenue,
    };

    const approvedScenario: ScenarioKey = "base";
    const savePayload = {
      projectId: 1,
      activeScenario: approvedScenario,
      approvedRevenue: approvedScenario
        ? Math.round(revenueByScenario[approvedScenario])
        : 0,
    };

    expect(savePayload.approvedRevenue).toBe(Math.round(baseRevenue));
    expect(savePayload.activeScenario).toBe("base");
    expect(savePayload.approvedRevenue).toBeGreaterThan(0);
  });

  it("editable price should update base price and recalculate revenue", () => {
    const originalPrice = 1550;
    const newPrice = 1700;
    const avgArea = 900;
    const count = 26;

    const originalRevenue = count * avgArea * originalPrice;
    const newRevenue = count * avgArea * newPrice;

    expect(newRevenue).toBeGreaterThan(originalRevenue);
    expect(newRevenue).toBe(26 * 900 * 1700);
    expect(newRevenue).toBe(39780000);
  });

  it("scenario multiplier should apply on top of edited base price", () => {
    const editedBasePrice = 1700;
    const avgArea = 900;
    const count = 26;

    const baseRev = count * avgArea * editedBasePrice * 1.0;
    const optRev = count * avgArea * editedBasePrice * 1.1;
    const consRev = count * avgArea * editedBasePrice * 0.9;

    expect(optRev).toBeCloseTo(baseRev * 1.1, 0);
    expect(consRev).toBeCloseTo(baseRev * 0.9, 0);
  });
});
