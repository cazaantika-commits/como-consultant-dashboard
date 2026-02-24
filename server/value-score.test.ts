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

function calculateValueScore(
  technicalScore: number,
  financialScore: number,
  penalty: number,
  tWeight: number = 65,
  fWeight: number = 35
): { adjustedFinancialScore: number; valueScore: number } {
  const adjustedFinancialScore = Math.max(0, financialScore - penalty);
  const valueScore = (technicalScore * tWeight / 100) + (adjustedFinancialScore * fWeight / 100);
  return { adjustedFinancialScore, valueScore };
}

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
    // DATUM: 10,700,000 (lowest)
    // ARTEC: 12,639,332
    const datumScore = calculateFinancialScore(10700000, 10700000);
    expect(datumScore).toBe(100);

    const artecScore = calculateFinancialScore(12639332, 10700000);
    expect(artecScore).toBeCloseTo(84.66, 1);
  });
});

describe("Value Score Calculation", () => {
  it("should calculate correctly with default weights (65/35)", () => {
    const result = calculateValueScore(80, 100, 0);
    // Value = (80 × 0.65) + (100 × 0.35) = 52 + 35 = 87
    expect(result.valueScore).toBe(87);
    expect(result.adjustedFinancialScore).toBe(100);
  });

  it("should apply penalty correctly to financial score", () => {
    const result = calculateValueScore(80, 100, 7);
    // Adjusted Financial = 100 - 7 = 93
    // Value = (80 × 0.65) + (93 × 0.35) = 52 + 32.55 = 84.55
    expect(result.adjustedFinancialScore).toBe(93);
    expect(result.valueScore).toBeCloseTo(84.55, 1);
  });

  it("should apply extreme penalty correctly", () => {
    const result = calculateValueScore(80, 100, 15);
    // Adjusted Financial = 100 - 15 = 85
    // Value = (80 × 0.65) + (85 × 0.35) = 52 + 29.75 = 81.75
    expect(result.adjustedFinancialScore).toBe(85);
    expect(result.valueScore).toBeCloseTo(81.75, 1);
  });

  it("should not let adjusted financial go below 0", () => {
    const result = calculateValueScore(80, 5, 15);
    // Adjusted Financial = max(0, 5 - 15) = 0
    // Value = (80 × 0.65) + (0 × 0.35) = 52
    expect(result.adjustedFinancialScore).toBe(0);
    expect(result.valueScore).toBe(52);
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
    // Value = (0 × 0.65) + (100 × 0.35) = 0 + 35 = 35
    expect(result.valueScore).toBe(35);
  });

  it("should handle zero financial score", () => {
    const result = calculateValueScore(80, 0, 0);
    // Value = (80 × 0.65) + (0 × 0.35) = 52 + 0 = 52
    expect(result.valueScore).toBe(52);
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

describe("End-to-End Value Ranking Scenario", () => {
  it("should correctly rank consultants with real data", () => {
    const consultants = [
      { name: "DATUM", technicalScore: 85, fee: 10700000 },
      { name: "ARTEC", technicalScore: 82, fee: 12639332 },
      { name: "LACASA", technicalScore: 78, fee: 14931980 },
      { name: "XYZ", technicalScore: 75, fee: 16492280 },
      { name: "Al Diwan", technicalScore: 70, fee: 0 },
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
    // Value = (85 × 0.65) + (100 × 0.35) = 55.25 + 35 = 90.25
    expect(results[0].valueScore).toBeCloseTo(90.3, 0);

    // ARTEC: financial = 10700000/12639332 × 100 ≈ 84.7
    expect(results[1].financialScore).toBeCloseTo(84.7, 0);
    expect(results[1].penalty).toBe(0); // within normal range

    // XYZ: fee is high, should have penalty
    expect(results[3].zone).toBe("MODERATE_HIGH");
    expect(results[3].penalty).toBe(7);

    // Al Diwan: no fee → financial=0
    expect(results[4].financialScore).toBe(0);
    expect(results[4].adjustedFinancialScore).toBe(0);
    // Value = (70 × 0.65) + (0 × 0.35) = 45.5
    expect(results[4].valueScore).toBe(45.5);

    // Sort by value score descending
    const sorted = [...results].sort((a, b) => b.valueScore - a.valueScore);
    expect(sorted[0].name).toBe("DATUM"); // Highest value
  });
});
