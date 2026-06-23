import { describe, it, expect, test } from "vitest";

// Replicate the exact calculation logic from ConsultantEvaluationPage and CommitteeDecisionPage

// Fee Deviation Zone definitions (same as in both pages)
const FEE_ZONES = {
  EXTREME_LOW: { label: "خطر رسوم منخفضة", penalty: 0, flag: "Low Fee Risk" },
  NORMAL: { label: "نطاق طبيعي", penalty: 0, flag: null },
  MODERATE_HIGH: { label: "انحراف معتدل", penalty: 7, flag: null },
  EXTREME_HIGH: { label: "خطر تكلفة عالية", penalty: 15, flag: "High Cost Risk" },
} as const;

type FeeZoneKey = keyof typeof FEE_ZONES;

function calculateFeeZone(fee: number, avgFee: number): { zone: FeeZoneKey; deviation: number } {
  if (avgFee === 0) return { zone: "NORMAL", deviation: 0 };
  const deviation = ((fee - avgFee) / avgFee) * 100;
  if (deviation <= -30) return { zone: "EXTREME_LOW", deviation };
  if (deviation >= 30) return { zone: "EXTREME_HIGH", deviation };
  if (deviation >= 15) return { zone: "MODERATE_HIGH", deviation };
  return { zone: "NORMAL", deviation };
}

function calculateFinancialScore(fee: number, lowestFee: number): number {
  if (fee <= 0 || lowestFee <= 0) return 0;
  return (lowestFee / fee) * 100;
}

// Updated default weights: 80% technical, 20% financial
function calculateValueScore(
  technicalScore: number,
  financialScore: number,
  penalty: number,
  tWeight: number = 80,
  fWeight: number = 20
): { adjustedFinancialScore: number; valueScore: number } {
  const adjustedFinancialScore = Math.max(0, financialScore - penalty);
  const valueScore = (technicalScore * tWeight / 100) + (adjustedFinancialScore * fWeight / 100);
  return { adjustedFinancialScore, valueScore };
}

// New: Weighted technical score calculation using percentages
// Each criterion has a weight (%) and the evaluator selects a converted percentage (%)
// Result for each criterion = converted_percentage × weight / 100
// Total = sum of all criteria results
function calculateWeightedTechnicalScore(
  criteriaWeights: number[],
  selectedPercentages: number[]
): number {
  if (criteriaWeights.length !== selectedPercentages.length) return 0;
  return criteriaWeights.reduce((total, weight, idx) => {
    return total + (selectedPercentages[idx] * weight / 100);
  }, 0);
}

// The 9 criteria weights from the evaluation document
const CRITERIA_WEIGHTS = [14.6, 14.6, 13.6, 10.7, 9.7, 9.7, 9.7, 9.2, 8.2];

describe("Fee Zone Calculation", () => {
  it("should return NORMAL zone for fees within ±15% of average", () => {
    const result = calculateFeeZone(10000, 10000);
    expect(result.zone).toBe("NORMAL");
    expect(result.deviation).toBe(0);
  });

  it("should return NORMAL zone for fee 10% above average", () => {
    const result = calculateFeeZone(11000, 10000);
    expect(result.zone).toBe("NORMAL");
    expect(result.deviation).toBe(10);
  });

  it("should return MODERATE_HIGH for fee 20% above average", () => {
    const result = calculateFeeZone(12000, 10000);
    expect(result.zone).toBe("MODERATE_HIGH");
    expect(result.deviation).toBe(20);
  });

  it("should return EXTREME_HIGH for fee 35% above average", () => {
    const result = calculateFeeZone(13500, 10000);
    expect(result.zone).toBe("EXTREME_HIGH");
    expect(result.deviation).toBe(35);
  });

  it("should return EXTREME_LOW for fee 35% below average", () => {
    const result = calculateFeeZone(6500, 10000);
    expect(result.zone).toBe("EXTREME_LOW");
    expect(result.deviation).toBe(-35);
  });

  it("should return NORMAL zone when average is 0", () => {
    const result = calculateFeeZone(10000, 0);
    expect(result.zone).toBe("NORMAL");
    expect(result.deviation).toBe(0);
  });

  it("should correctly handle boundary at exactly 15%", () => {
    const result = calculateFeeZone(11500, 10000);
    expect(result.zone).toBe("MODERATE_HIGH");
    expect(result.deviation).toBe(15);
  });

  it("should correctly handle boundary at exactly 30%", () => {
    const result = calculateFeeZone(13000, 10000);
    expect(result.zone).toBe("EXTREME_HIGH");
    expect(result.deviation).toBe(30);
  });

  it("should correctly handle boundary at exactly -30%", () => {
    const result = calculateFeeZone(7000, 10000);
    expect(result.zone).toBe("EXTREME_LOW");
    expect(result.deviation).toBe(-30);
  });
});

describe("Financial Score Calculation", () => {
  it("should return 100 for the lowest fee consultant", () => {
    const score = calculateFinancialScore(10000, 10000);
    expect(score).toBe(100);
  });

  it("should return proportional score for higher fees", () => {
    const score = calculateFinancialScore(20000, 10000);
    expect(score).toBe(50);
  });

  it("should return 0 when fee is 0", () => {
    const score = calculateFinancialScore(0, 10000);
    expect(score).toBe(0);
  });

  it("should return 0 when lowest fee is 0", () => {
    const score = calculateFinancialScore(10000, 0);
    expect(score).toBe(0);
  });

  it("should calculate correctly for real-world fees", () => {
    const datumScore = calculateFinancialScore(10700000, 10700000);
    expect(datumScore).toBe(100);

    const artecScore = calculateFinancialScore(12639332, 10700000);
    expect(artecScore).toBeCloseTo(84.66, 1);
  });
});

describe("Value Score Calculation (80/20 default weights)", () => {
  it("should calculate correctly with default weights (80/20)", () => {
    const result = calculateValueScore(85, 100, 0);
    // Value = (85 × 0.80) + (100 × 0.20) = 68 + 20 = 88
    expect(result.valueScore).toBe(88);
    expect(result.adjustedFinancialScore).toBe(100);
  });

  it("should apply penalty correctly to financial score", () => {
    const result = calculateValueScore(85, 100, 7);
    // Adjusted Financial = 100 - 7 = 93
    // Value = (85 × 0.80) + (93 × 0.20) = 68 + 18.6 = 86.6
    expect(result.adjustedFinancialScore).toBe(93);
    expect(result.valueScore).toBeCloseTo(86.6, 1);
  });

  it("should apply extreme penalty correctly", () => {
    const result = calculateValueScore(85, 100, 15);
    // Adjusted Financial = 100 - 15 = 85
    // Value = (85 × 0.80) + (85 × 0.20) = 68 + 17 = 85
    expect(result.adjustedFinancialScore).toBe(85);
    expect(result.valueScore).toBe(85);
  });

  it("should not let adjusted financial go below 0", () => {
    const result = calculateValueScore(80, 5, 15);
    // Adjusted Financial = max(0, 5 - 15) = 0
    // Value = (80 × 0.80) + (0 × 0.20) = 64
    expect(result.adjustedFinancialScore).toBe(0);
    expect(result.valueScore).toBe(64);
  });

  it("should work with custom weights (50/50)", () => {
    const result = calculateValueScore(80, 100, 0, 50, 50);
    // Value = (80 × 0.50) + (100 × 0.50) = 40 + 50 = 90
    expect(result.valueScore).toBe(90);
  });

  it("should work with custom weights (70/30)", () => {
    const result = calculateValueScore(80, 100, 0, 70, 30);
    // Value = (80 × 0.70) + (100 × 0.30) = 56 + 30 = 86
    expect(result.valueScore).toBe(86);
  });

  it("should handle zero technical score", () => {
    const result = calculateValueScore(0, 100, 0);
    // Value = (0 × 0.80) + (100 × 0.20) = 0 + 20 = 20
    expect(result.valueScore).toBe(20);
  });

  it("should handle zero financial score", () => {
    const result = calculateValueScore(80, 0, 0);
    // Value = (80 × 0.80) + (0 × 0.20) = 64 + 0 = 64
    expect(result.valueScore).toBe(64);
  });

  it("should handle both scores at zero", () => {
    const result = calculateValueScore(0, 0, 0);
    expect(result.valueScore).toBe(0);
  });
});

describe("Penalty Values", () => {
  it("NORMAL zone should have 0 penalty", () => {
    expect(FEE_ZONES.NORMAL.penalty).toBe(0);
  });

  it("MODERATE_HIGH zone should have 7 point penalty", () => {
    expect(FEE_ZONES.MODERATE_HIGH.penalty).toBe(7);
  });

  it("EXTREME_HIGH zone should have 15 point penalty", () => {
    expect(FEE_ZONES.EXTREME_HIGH.penalty).toBe(15);
  });

  it("EXTREME_LOW zone should have 0 penalty (but flag)", () => {
    expect(FEE_ZONES.EXTREME_LOW.penalty).toBe(0);
    expect(FEE_ZONES.EXTREME_LOW.flag).toBe("Low Fee Risk");
  });
});

describe("Weighted Technical Score (Percentage-Based System)", () => {
  it("should calculate correctly with all criteria at 90%", () => {
    const percentages = [90, 90, 90, 90, 90, 90, 90, 90, 90];
    const score = calculateWeightedTechnicalScore(CRITERIA_WEIGHTS, percentages);
    // 90% × (14.6+14.6+13.6+10.7+9.7+9.7+9.7+9.2+8.2)/100 = 90% × 100/100 = 90
    expect(score).toBeCloseTo(90, 0);
  });

  it("should calculate correctly with all criteria at 95%", () => {
    const percentages = [95, 95, 95, 95, 95, 95, 95, 95, 95];
    const score = calculateWeightedTechnicalScore(CRITERIA_WEIGHTS, percentages);
    expect(score).toBeCloseTo(95, 0);
  });

  it("should calculate correctly with mixed percentages (user example)", () => {
    // Example from user: DATUM evaluation
    const percentages = [90, 91, 92, 85, 89, 86, 85, 90, 90];
    const score = calculateWeightedTechnicalScore(CRITERIA_WEIGHTS, percentages);
    // Manual: 90×14.6/100 + 91×14.6/100 + 92×13.6/100 + 85×10.7/100 + 89×9.7/100 + 86×9.7/100 + 85×9.7/100 + 90×9.2/100 + 90×8.2/100
    // = 13.14 + 13.286 + 12.512 + 9.095 + 8.633 + 8.342 + 8.245 + 8.28 + 7.38
    // = 88.913
    expect(score).toBeCloseTo(88.91, 0);
  });

  it("should handle all criteria at minimum (worst case)", () => {
    // Worst possible scores from the document
    const percentages = [50, 15, 35, 30, 30, 35, 30, 55, 60];
    const score = calculateWeightedTechnicalScore(CRITERIA_WEIGHTS, percentages);
    // Should be a low score
    expect(score).toBeLessThan(40);
    expect(score).toBeGreaterThan(0);
  });

  it("should handle all criteria at maximum (best case)", () => {
    const percentages = [95, 95, 95, 95, 95, 95, 95, 95, 95];
    const score = calculateWeightedTechnicalScore(CRITERIA_WEIGHTS, percentages);
    expect(score).toBeCloseTo(95, 0);
  });

  it("should return 0 for mismatched array lengths", () => {
    const score = calculateWeightedTechnicalScore([14.6, 14.6], [90]);
    expect(score).toBe(0);
  });

  it("criteria weights should sum to 100%", () => {
    const totalWeight = CRITERIA_WEIGHTS.reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBeCloseTo(100, 0);
  });

  it("should correctly weight higher-weight criteria more", () => {
    // If only the first criterion (14.6%) is high and rest are low
    const highFirst = [95, 50, 50, 50, 50, 50, 50, 50, 50];
    const highLast = [50, 50, 50, 50, 50, 50, 50, 50, 95];
    
    const scoreHighFirst = calculateWeightedTechnicalScore(CRITERIA_WEIGHTS, highFirst);
    const scoreHighLast = calculateWeightedTechnicalScore(CRITERIA_WEIGHTS, highLast);
    
    // First criterion (14.6%) has more weight than last (8.2%)
    // So having 95% on first should give higher total than 95% on last
    expect(scoreHighFirst).toBeGreaterThan(scoreHighLast);
  });
});

describe("End-to-End Value Ranking Scenario (80/20 weights)", () => {
  it("should correctly rank consultants with real data", () => {
    const consultants = [
      { name: "DATUM", technicalScore: 88.9, fee: 10700000 },
      { name: "ARTEC", technicalScore: 82.5, fee: 12639332 },
      { name: "LACASA", technicalScore: 78.3, fee: 14931980 },
      { name: "XYZ", technicalScore: 75.0, fee: 16492280 },
      { name: "Al Diwan", technicalScore: 70.0, fee: 0 },
    ];

    const feesWithValues = consultants.filter(c => c.fee > 0);
    const lowestFee = Math.min(...feesWithValues.map(c => c.fee));
    const avgFee = feesWithValues.reduce((sum, c) => sum + c.fee, 0) / feesWithValues.length;

    expect(lowestFee).toBe(10700000);

    const results = consultants.map(c => {
      const financialScore = calculateFinancialScore(c.fee, lowestFee);
      const feeZoneInfo = calculateFeeZone(c.fee, avgFee);
      const penalty = FEE_ZONES[feeZoneInfo.zone].penalty;
      const { adjustedFinancialScore, valueScore } = calculateValueScore(
        c.technicalScore, financialScore, penalty
      );

      return {
        name: c.name,
        technicalScore: c.technicalScore,
        financialScore: Math.round(financialScore * 10) / 10,
        penalty,
        adjustedFinancialScore: Math.round(adjustedFinancialScore * 10) / 10,
        valueScore: Math.round(valueScore * 10) / 10,
        zone: feeZoneInfo.zone,
      };
    });

    // DATUM: lowest fee → financial=100, no penalty
    expect(results[0].financialScore).toBe(100);
    expect(results[0].penalty).toBe(0);
    expect(results[0].adjustedFinancialScore).toBe(100);
    // Value = (88.9 × 0.80) + (100 × 0.20) = 71.12 + 20 = 91.12
    expect(results[0].valueScore).toBeCloseTo(91.1, 0);

    // ARTEC: financial = 10700000/12639332 × 100 ≈ 84.7
    expect(results[1].financialScore).toBeCloseTo(84.7, 0);
    expect(results[1].penalty).toBe(0); // within normal range

    // XYZ: fee is high, should have penalty
    expect(results[3].zone).toBe("MODERATE_HIGH");
    expect(results[3].penalty).toBe(7);

    // Al Diwan: no fee → financial=0
    expect(results[4].financialScore).toBe(0);
    expect(results[4].adjustedFinancialScore).toBe(0);
    // Value = (70 × 0.80) + (0 × 0.20) = 56
    expect(results[4].valueScore).toBe(56);

    // Sort by value score descending
    const sorted = [...results].sort((a, b) => b.valueScore - a.valueScore);
    expect(sorted[0].name).toBe("DATUM"); // Highest value
  });
});

describe("Full Evaluation Flow: Percentages → Weighted Score → Value Score", () => {
  it("should calculate end-to-end from evaluator selections to final value score", () => {
    // Simulating 3 evaluators for DATUM
    const evaluator1 = [90, 91, 92, 85, 89, 86, 85, 90, 90]; // ~88.9%
    const evaluator2 = [93, 95, 87, 91, 82, 80, 91, 82, 82]; // ~88.2%
    const evaluator3 = [85, 84, 82, 85, 95, 92, 85, 95, 95]; // ~87.8%

    // Average each criterion across evaluators
    const avgPercentages = CRITERIA_WEIGHTS.map((_, idx) => {
      return (evaluator1[idx] + evaluator2[idx] + evaluator3[idx]) / 3;
    });

    // Calculate weighted technical score
    const technicalScore = calculateWeightedTechnicalScore(CRITERIA_WEIGHTS, avgPercentages);
    expect(technicalScore).toBeGreaterThan(80);
    expect(technicalScore).toBeLessThan(95);

    // Now calculate value score with financial data
    const fee = 10700000;
    const lowestFee = 10700000;
    const avgFee = 13000000;

    const financialScore = calculateFinancialScore(fee, lowestFee);
    expect(financialScore).toBe(100);

    const feeZone = calculateFeeZone(fee, avgFee);
    expect(feeZone.zone).toBe("NORMAL");

    const { valueScore } = calculateValueScore(technicalScore, financialScore, 0);
    // With 80/20 weights: (technicalScore × 0.80) + (100 × 0.20)
    expect(valueScore).toBeGreaterThan(85);
    expect(valueScore).toBeLessThan(100);
  });
});


// ============ CHART DATA PREPARATION TESTS ============

describe("Chart Data Preparation", () => {
  // Simulates the data transformation used for the Grouped Bar Chart
  function prepareBarChartData(consultants: Array<{ name: string; technicalScore: number; adjustedFinancialScore: number; valueScore: number }>) {
    return consultants.map(r => ({
      name: r.name.length > 18 ? r.name.substring(0, 18) + '…' : r.name,
      fullName: r.name,
      technical: Math.round(r.technicalScore * 10) / 10,
      financial: r.adjustedFinancialScore,
      value: r.valueScore,
    }));
  }

  // Simulates the data transformation used for the Radar Chart
  function prepareRadarChartData(
    criteria: Array<{ name: string; weight: number }>,
    consultants: Array<{ name: string; scores: number[] }>
  ) {
    return criteria.map((criterion, idx) => {
      const entry: Record<string, any> = {
        criterion: criterion.name.length > 12 ? criterion.name.substring(0, 12) + '…' : criterion.name,
        fullName: criterion.name,
        weight: criterion.weight,
      };
      consultants.forEach(c => {
        entry[c.name] = c.scores[idx] || 0;
      });
      return entry;
    });
  }

  // Simulates the data transformation used for the Scatter Chart
  function prepareScatterChartData(consultants: Array<{ name: string; totalFee: number; technicalScore: number; valueScore: number; zone: string; zoneLabel: string }>) {
    return consultants.map(r => ({
      name: r.name,
      fee: r.totalFee,
      technical: Math.round(r.technicalScore * 10) / 10,
      value: r.valueScore,
      zone: r.zone,
      zoneLabel: r.zoneLabel,
    }));
  }

  describe("Bar Chart Data", () => {
    it("should truncate long consultant names to 18 characters", () => {
      const data = prepareBarChartData([
        { name: "شركة الاستشارات الهندسية المتقدمة", technicalScore: 85, adjustedFinancialScore: 90, valueScore: 86 },
      ]);
      expect(data[0].name.length).toBeLessThanOrEqual(19); // 18 + '…'
      expect(data[0].fullName).toBe("شركة الاستشارات الهندسية المتقدمة");
    });

    it("should keep short names unchanged", () => {
      const data = prepareBarChartData([
        { name: "DATUM", technicalScore: 85, adjustedFinancialScore: 90, valueScore: 86 },
      ]);
      expect(data[0].name).toBe("DATUM");
    });

    it("should round technical scores to 1 decimal", () => {
      const data = prepareBarChartData([
        { name: "Test", technicalScore: 85.456, adjustedFinancialScore: 90, valueScore: 86 },
      ]);
      expect(data[0].technical).toBe(85.5);
    });

    it("should include all three score types for each consultant", () => {
      const data = prepareBarChartData([
        { name: "A", technicalScore: 88, adjustedFinancialScore: 92, valueScore: 88.8 },
        { name: "B", technicalScore: 75, adjustedFinancialScore: 100, valueScore: 80 },
      ]);
      expect(data).toHaveLength(2);
      data.forEach(d => {
        expect(d).toHaveProperty("technical");
        expect(d).toHaveProperty("financial");
        expect(d).toHaveProperty("value");
      });
    });
  });

  describe("Radar Chart Data", () => {
    const criteria = [
      { name: "الهوية المعمارية وجودة التصميم", weight: 14.6 },
      { name: "القدرات التقنية", weight: 14.6 },
      { name: "كفاءة التخطيط", weight: 13.6 },
    ];

    it("should create one entry per criterion", () => {
      const data = prepareRadarChartData(criteria, [
        { name: "DATUM", scores: [90, 85, 92] },
      ]);
      expect(data).toHaveLength(3);
    });

    it("should include each consultant as a separate key", () => {
      const data = prepareRadarChartData(criteria, [
        { name: "DATUM", scores: [90, 85, 92] },
        { name: "Khatib", scores: [88, 91, 80] },
      ]);
      expect(data[0]["DATUM"]).toBe(90);
      expect(data[0]["Khatib"]).toBe(88);
      expect(data[1]["DATUM"]).toBe(85);
      expect(data[1]["Khatib"]).toBe(91);
    });

    it("should truncate long criterion names to 12 characters", () => {
      const data = prepareRadarChartData(criteria, [
        { name: "Test", scores: [90, 85, 92] },
      ]);
      expect(data[0].criterion.length).toBeLessThanOrEqual(13); // 12 + '…'
      expect(data[0].fullName).toBe("الهوية المعمارية وجودة التصميم");
    });

    it("should include weight for each criterion", () => {
      const data = prepareRadarChartData(criteria, [
        { name: "Test", scores: [90, 85, 92] },
      ]);
      expect(data[0].weight).toBe(14.6);
      expect(data[2].weight).toBe(13.6);
    });

    it("should default to 0 for missing scores", () => {
      const data = prepareRadarChartData(criteria, [
        { name: "Test", scores: [90] }, // only 1 score for 3 criteria
      ]);
      expect(data[0]["Test"]).toBe(90);
      expect(data[1]["Test"]).toBe(0);
      expect(data[2]["Test"]).toBe(0);
    });
  });

  describe("Scatter Chart Data", () => {
    it("should map all required fields", () => {
      const data = prepareScatterChartData([
        { name: "DATUM", totalFee: 5000000, technicalScore: 88.5, valueScore: 86.2, zone: "normal", zoneLabel: "طبيعي" },
      ]);
      expect(data[0]).toEqual({
        name: "DATUM",
        fee: 5000000,
        technical: 88.5,
        value: 86.2,
        zone: "normal",
        zoneLabel: "طبيعي",
      });
    });

    it("should round technical score to 1 decimal", () => {
      const data = prepareScatterChartData([
        { name: "Test", totalFee: 3000000, technicalScore: 92.456, valueScore: 90, zone: "normal", zoneLabel: "طبيعي" },
      ]);
      expect(data[0].technical).toBe(92.5);
    });

    it("should preserve zone information for color coding", () => {
      const data = prepareScatterChartData([
        { name: "A", totalFee: 5000000, technicalScore: 85, valueScore: 80, zone: "normal", zoneLabel: "طبيعي" },
        { name: "B", totalFee: 8000000, technicalScore: 90, valueScore: 75, zone: "extreme_high", zoneLabel: "انحراف مرتفع جداً" },
        { name: "C", totalFee: 2000000, technicalScore: 70, valueScore: 72, zone: "extreme_low", zoneLabel: "انحراف منخفض جداً" },
      ]);
      expect(data[0].zone).toBe("normal");
      expect(data[1].zone).toBe("extreme_high");
      expect(data[2].zone).toBe("extreme_low");
    });
  });
});


// ============ CHART FILTER LOGIC TESTS ============

describe("Chart Filter Logic", () => {
  // Simulate the filter state and logic from ConsultantEvaluationPage
  type FilterState = Record<number, boolean>;

  function isVisible(id: number, state: FilterState): boolean {
    return state[id] !== false; // default is visible (undefined = true)
  }

  function filterRankings<T extends { id: number }>(rankings: T[], state: FilterState): T[] {
    return rankings.filter(r => isVisible(r.id, state));
  }

  const mockRankings = [
    { id: 1, name: "DATUM", technicalScore: 88.5 },
    { id: 2, name: "SSH", technicalScore: 82.3 },
    { id: 3, name: "Lacasa", technicalScore: 79.1 },
    { id: 4, name: "Dewan", technicalScore: 85.7 },
    { id: 5, name: "AE7", technicalScore: 90.2 },
  ];

  test("all consultants visible by default (empty state)", () => {
    const state: FilterState = {};
    const visible = filterRankings(mockRankings, state);
    expect(visible).toHaveLength(5);
    expect(visible.map(r => r.id)).toEqual([1, 2, 3, 4, 5]);
  });

  test("hiding a single consultant", () => {
    const state: FilterState = { 2: false };
    const visible = filterRankings(mockRankings, state);
    expect(visible).toHaveLength(4);
    expect(visible.map(r => r.name)).not.toContain("SSH");
  });

  test("hiding multiple consultants", () => {
    const state: FilterState = { 1: false, 3: false, 5: false };
    const visible = filterRankings(mockRankings, state);
    expect(visible).toHaveLength(2);
    expect(visible.map(r => r.name)).toEqual(["SSH", "Dewan"]);
  });

  test("hiding all consultants", () => {
    const state: FilterState = { 1: false, 2: false, 3: false, 4: false, 5: false };
    const visible = filterRankings(mockRankings, state);
    expect(visible).toHaveLength(0);
  });

  test("show all button resets all to visible", () => {
    // Simulate: start with some hidden
    let state: FilterState = { 1: false, 3: false };
    expect(filterRankings(mockRankings, state)).toHaveLength(3);

    // Simulate "show all" click
    const newState: FilterState = {};
    mockRankings.forEach(r => { newState[r.id] = true; });
    state = newState;

    const visible = filterRankings(mockRankings, state);
    expect(visible).toHaveLength(5);
  });

  test("hide all button hides all", () => {
    let state: FilterState = {};
    expect(filterRankings(mockRankings, state)).toHaveLength(5);

    // Simulate "hide all" click
    const newState: FilterState = {};
    mockRankings.forEach(r => { newState[r.id] = false; });
    state = newState;

    expect(filterRankings(mockRankings, state)).toHaveLength(0);
  });

  test("toggling a consultant on/off preserves other states", () => {
    let state: FilterState = { 1: true, 2: false, 3: true, 4: false, 5: true };

    // Toggle consultant 2 to visible
    state = { ...state, 2: true };
    expect(isVisible(2, state)).toBe(true);
    expect(isVisible(4, state)).toBe(false); // unchanged

    // Toggle consultant 3 to hidden
    state = { ...state, 3: false };
    expect(isVisible(3, state)).toBe(false);
    expect(isVisible(1, state)).toBe(true); // unchanged
  });

  test("filter preserves original order of rankings", () => {
    const state: FilterState = { 2: false, 4: false };
    const visible = filterRankings(mockRankings, state);
    expect(visible.map(r => r.id)).toEqual([1, 3, 5]); // order preserved
  });

  test("visible count calculation", () => {
    const state: FilterState = { 1: false, 3: false };
    const visible = filterRankings(mockRankings, state);
    const visibleCount = visible.length;
    const totalCount = mockRankings.length;
    expect(visibleCount).toBe(3);
    expect(totalCount).toBe(5);
    expect(`${visibleCount}/${totalCount}`).toBe("3/5");
  });

  test("allVisible and noneVisible flags", () => {
    // All visible
    const stateAll: FilterState = {};
    const allVisible = mockRankings.every(r => isVisible(r.id, stateAll));
    expect(allVisible).toBe(true);

    // None visible
    const stateNone: FilterState = { 1: false, 2: false, 3: false, 4: false, 5: false };
    const noneVisible = filterRankings(mockRankings, stateNone).length === 0;
    expect(noneVisible).toBe(true);

    // Partial
    const statePartial: FilterState = { 1: false };
    const partialAllVisible = mockRankings.every(r => isVisible(r.id, statePartial));
    const partialNoneVisible = filterRankings(mockRankings, statePartial).length === 0;
    expect(partialAllVisible).toBe(false);
    expect(partialNoneVisible).toBe(false);
  });
});


// ========== Heatmap Color Logic Tests ==========

function getHeatColor(val: number): { bg: string; text: string } {
  if (val === 0) return { bg: '#f1f5f9', text: '#94a3b8' };
  if (val >= 90) return { bg: '#065f46', text: '#ffffff' };
  if (val >= 85) return { bg: '#047857', text: '#ffffff' };
  if (val >= 80) return { bg: '#059669', text: '#ffffff' };
  if (val >= 75) return { bg: '#10b981', text: '#ffffff' };
  if (val >= 70) return { bg: '#34d399', text: '#065f46' };
  if (val >= 65) return { bg: '#6ee7b7', text: '#065f46' };
  if (val >= 60) return { bg: '#fbbf24', text: '#78350f' };
  if (val >= 50) return { bg: '#f59e0b', text: '#78350f' };
  if (val >= 40) return { bg: '#f97316', text: '#ffffff' };
  return { bg: '#ef4444', text: '#ffffff' };
}

describe('Heatmap Color Logic', () => {
  it('should return gray for zero score', () => {
    expect(getHeatColor(0).bg).toBe('#f1f5f9');
  });

  it('should return darkest green for 90%+', () => {
    expect(getHeatColor(95).bg).toBe('#065f46');
    expect(getHeatColor(90).bg).toBe('#065f46');
    expect(getHeatColor(100).bg).toBe('#065f46');
  });

  it('should return dark green for 85-89%', () => {
    expect(getHeatColor(85).bg).toBe('#047857');
    expect(getHeatColor(89).bg).toBe('#047857');
  });

  it('should return medium green for 80-84%', () => {
    expect(getHeatColor(80).bg).toBe('#059669');
    expect(getHeatColor(84).bg).toBe('#059669');
  });

  it('should return green for 75-79%', () => {
    expect(getHeatColor(75).bg).toBe('#10b981');
    expect(getHeatColor(79).bg).toBe('#10b981');
  });

  it('should return light green for 70-74%', () => {
    expect(getHeatColor(70).bg).toBe('#34d399');
    expect(getHeatColor(74).bg).toBe('#34d399');
  });

  it('should return pale green for 65-69%', () => {
    expect(getHeatColor(65).bg).toBe('#6ee7b7');
    expect(getHeatColor(69).bg).toBe('#6ee7b7');
  });

  it('should return yellow for 60-64%', () => {
    expect(getHeatColor(60).bg).toBe('#fbbf24');
    expect(getHeatColor(64).bg).toBe('#fbbf24');
  });

  it('should return amber for 50-59%', () => {
    expect(getHeatColor(50).bg).toBe('#f59e0b');
    expect(getHeatColor(59).bg).toBe('#f59e0b');
  });

  it('should return orange for 40-49%', () => {
    expect(getHeatColor(40).bg).toBe('#f97316');
    expect(getHeatColor(49).bg).toBe('#f97316');
  });

  it('should return red for below 40%', () => {
    expect(getHeatColor(30).bg).toBe('#ef4444');
    expect(getHeatColor(10).bg).toBe('#ef4444');
  });

  it('should have white text on dark backgrounds', () => {
    expect(getHeatColor(95).text).toBe('#ffffff');
    expect(getHeatColor(85).text).toBe('#ffffff');
    expect(getHeatColor(80).text).toBe('#ffffff');
  });

  it('should have dark text on light backgrounds', () => {
    expect(getHeatColor(70).text).toBe('#065f46');
    expect(getHeatColor(65).text).toBe('#065f46');
    expect(getHeatColor(55).text).toBe('#78350f');
  });
});

// ========== Quick Compare Filter Logic Tests ==========

describe('Quick Compare Filter Logic', () => {
  const consultants = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
    { id: 4, name: 'D' },
  ];

  function applyQuickCompare(
    selection: number[],
    allConsultants: { id: number; name: string }[]
  ): Record<number, boolean> {
    const state: Record<number, boolean> = {};
    allConsultants.forEach(c => {
      state[c.id] = selection.includes(c.id);
    });
    return state;
  }

  it('should hide all when quick compare starts with empty selection', () => {
    const state = applyQuickCompare([], consultants);
    expect(Object.values(state).every(v => v === false)).toBe(true);
  });

  it('should show only selected consultant when one is picked', () => {
    const state = applyQuickCompare([2], consultants);
    expect(state[1]).toBe(false);
    expect(state[2]).toBe(true);
    expect(state[3]).toBe(false);
    expect(state[4]).toBe(false);
  });

  it('should show exactly two consultants when both are picked', () => {
    const state = applyQuickCompare([1, 3], consultants);
    expect(state[1]).toBe(true);
    expect(state[2]).toBe(false);
    expect(state[3]).toBe(true);
    expect(state[4]).toBe(false);
    const visibleCount = Object.values(state).filter(v => v).length;
    expect(visibleCount).toBe(2);
  });

  it('should not allow more than 2 selections', () => {
    let selection = [1, 3];
    // Attempt to add a third
    const newId = 4;
    if (selection.length < 2) {
      selection = [...selection, newId];
    }
    // Selection should remain at 2
    expect(selection.length).toBe(2);
    expect(selection).toEqual([1, 3]);
  });

  it('should allow deselecting a consultant', () => {
    let selection = [1, 3];
    // Deselect consultant 1
    selection = selection.filter(id => id !== 1);
    const state = applyQuickCompare(selection, consultants);
    expect(state[1]).toBe(false);
    expect(state[3]).toBe(true);
    expect(selection.length).toBe(1);
  });

  it('should restore all visible when exiting quick compare', () => {
    const state: Record<number, boolean> = {};
    consultants.forEach(c => { state[c.id] = true; });
    expect(Object.values(state).every(v => v === true)).toBe(true);
  });
});

// ========== Heatmap Max/Min Indicator Logic Tests ==========

describe('Heatmap Max/Min Indicators', () => {
  it('should identify max score in a criterion', () => {
    const scores = [85, 92, 78, 90];
    const maxScore = Math.max(...scores);
    expect(maxScore).toBe(92);
    expect(scores[1]).toBe(maxScore);
  });

  it('should identify min score in a criterion', () => {
    const scores = [85, 92, 78, 90];
    const minScore = Math.min(...scores.filter(s => s > 0));
    expect(minScore).toBe(78);
    expect(scores[2]).toBe(minScore);
  });

  it('should not mark min when all scores are equal', () => {
    const scores = [85, 85, 85, 85];
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores.filter(s => s > 0));
    // When max === min, isMin should be false
    expect(maxScore).toBe(minScore);
  });

  it('should handle zero scores correctly', () => {
    const scores = [85, 0, 78, 90];
    const nonZero = scores.filter(s => s > 0);
    const minScore = Math.min(...nonZero);
    expect(minScore).toBe(78);
    // Zero should not be considered as min
    expect(nonZero.includes(0)).toBe(false);
  });
});


// ===== Executive Summary Logic Tests =====

describe('Executive Summary - Data Extraction', () => {
  const consultants = [
    { id: 1, name: 'ARTEC', technicalScore: 86.4, totalFee: 5_200_000, feeDeviation: 8.3, feeZone: 'normal' as const, feeFlag: null },
    { id: 2, name: 'DATUM', technicalScore: 84.7, totalFee: 4_800_000, feeDeviation: -0.1, feeZone: 'normal' as const, feeFlag: null },
    { id: 3, name: 'Realistic', technicalScore: 83.0, totalFee: 6_500_000, feeDeviation: 35.4, feeZone: 'extreme_high' as const, feeFlag: 'مخاطر تكلفة عالية' },
    { id: 4, name: 'Safeer', technicalScore: 82.3, totalFee: 3_200_000, feeDeviation: -33.3, feeZone: 'extreme_low' as const, feeFlag: 'مخاطر سعر منخفض' },
  ];

  it('should identify the top technical consultant', () => {
    const sorted = [...consultants].sort((a, b) => b.technicalScore - a.technicalScore);
    expect(sorted[0].name).toBe('ARTEC');
    expect(sorted[0].technicalScore).toBe(86.4);
  });

  it('should identify the lowest fee consultant', () => {
    const sorted = [...consultants].filter(c => c.totalFee > 0).sort((a, b) => a.totalFee - b.totalFee);
    expect(sorted[0].name).toBe('Safeer');
    expect(sorted[0].totalFee).toBe(3_200_000);
  });

  it('should calculate average technical score', () => {
    const avg = consultants.reduce((s, c) => s + c.technicalScore, 0) / consultants.length;
    expect(avg).toBeCloseTo(84.1, 1);
  });

  it('should calculate technical gap between highest and lowest', () => {
    const sorted = [...consultants].sort((a, b) => b.technicalScore - a.technicalScore);
    const gap = sorted[0].technicalScore - sorted[sorted.length - 1].technicalScore;
    expect(gap).toBeCloseTo(4.1, 1);
  });

  it('should calculate fee gap between highest and lowest', () => {
    const fees = consultants.filter(c => c.totalFee > 0);
    const gap = Math.max(...fees.map(c => c.totalFee)) - Math.min(...fees.map(c => c.totalFee));
    expect(gap).toBe(3_300_000);
  });

  it('should identify penalized consultants (moderate_high or extreme_high)', () => {
    const penalized = consultants.filter(c => c.feeZone === 'moderate_high' || c.feeZone === 'extreme_high');
    expect(penalized.length).toBe(1);
    expect(penalized[0].name).toBe('Realistic');
  });

  it('should identify flagged low consultants (extreme_low)', () => {
    const flaggedLow = consultants.filter(c => c.feeZone === 'extreme_low');
    expect(flaggedLow.length).toBe(1);
    expect(flaggedLow[0].name).toBe('Safeer');
  });
});

describe('Executive Summary - Strength/Weakness Detection', () => {
  const CRITERIA_NAMES = [
    'الهوية المعمارية', 'BIM', 'التخطيط', 'التكاليف', 'الخبرة',
    'الفريق', 'إدارة الوقت', 'الاهتمام', 'مرونة التعاقد'
  ];

  it('should find the strongest criterion for a consultant', () => {
    const scores = [85, 72, 92, 89, 89, 70, 85, 95, 86];
    let maxIdx = 0;
    scores.forEach((s, i) => { if (s > scores[maxIdx]) maxIdx = i; });
    expect(CRITERIA_NAMES[maxIdx]).toBe('الاهتمام');
    expect(scores[maxIdx]).toBe(95);
  });

  it('should find the weakest criterion for a consultant', () => {
    const scores = [85, 72, 92, 89, 89, 70, 85, 95, 86];
    let minIdx = 0;
    scores.forEach((s, i) => { if (s > 0 && (scores[minIdx] === 0 || s < scores[minIdx])) minIdx = i; });
    expect(CRITERIA_NAMES[minIdx]).toBe('الفريق');
    expect(scores[minIdx]).toBe(70);
  });

  it('should handle all-zero scores gracefully', () => {
    const scores = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    let maxIdx = 0;
    scores.forEach((s, i) => { if (s > scores[maxIdx]) maxIdx = i; });
    expect(scores[maxIdx]).toBe(0);
  });

  it('should detect when top technical differs from top value', () => {
    // Scenario: ARTEC is top technical but DATUM has better value score
    const topTechnical = { name: 'ARTEC', technicalScore: 86.4 };
    const topValue = { name: 'DATUM', valueScore: 85.2 };
    const differs = topTechnical.name !== topValue.name;
    expect(differs).toBe(true);
  });

  it('should detect when top technical equals top value', () => {
    const topTechnical = { name: 'ARTEC', technicalScore: 86.4 };
    const topValue = { name: 'ARTEC', valueScore: 87.1 };
    const differs = topTechnical.name !== topValue.name;
    expect(differs).toBe(false);
  });
});

describe('Executive Summary - Value Ranking Table', () => {
  it('should rank consultants by value score descending', () => {
    const valueRankings = [
      { name: 'ARTEC', valueScore: 87.1 },
      { name: 'DATUM', valueScore: 85.2 },
      { name: 'Realistic', valueScore: 78.5 },
      { name: 'Safeer', valueScore: 82.0 },
    ].sort((a, b) => b.valueScore - a.valueScore);

    expect(valueRankings[0].name).toBe('ARTEC');
    expect(valueRankings[1].name).toBe('DATUM');
    expect(valueRankings[2].name).toBe('Safeer');
    expect(valueRankings[3].name).toBe('Realistic');
  });

  it('should calculate gap from first place correctly', () => {
    const sorted = [
      { name: 'ARTEC', valueScore: 87.1 },
      { name: 'DATUM', valueScore: 85.2 },
      { name: 'Safeer', valueScore: 82.0 },
    ];
    const gaps = sorted.map((r, i) => i === 0 ? 0 : sorted[0].valueScore - r.valueScore);
    expect(gaps[0]).toBe(0);
    expect(gaps[1]).toBeCloseTo(1.9, 1);
    expect(gaps[2]).toBeCloseTo(5.1, 1);
  });
});
