import { describe, it, expect } from "vitest";

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
