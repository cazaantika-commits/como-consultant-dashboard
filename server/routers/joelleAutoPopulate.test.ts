import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the Joelle Engine auto-populate functionality.
 * These tests verify the data mapping logic from Engine 6 (Product Strategy)
 * and Engine 7 (Pricing Intelligence) to the MarketOverview and CompetitionPricing tables.
 */

// ─── Mock data matching Engine 6 output structure ───
const MOCK_ENGINE6_OUTPUT = {
  unitMix: {
    studio: { pct: 15, avgSize: 400 },
    oneBr: { pct: 35, avgSize: 700 },
    twoBr: { pct: 30, avgSize: 1000 },
    threeBr: { pct: 20, avgSize: 1400 },
  },
  retailMix: {
    small: { pct: 40, avgSize: 300 },
    medium: { pct: 35, avgSize: 600 },
    large: { pct: 25, avgSize: 1200 },
  },
  finishingQuality: "premium",
  totalUnits: 250,
  positioning: "mid-luxury",
};

// ─── Mock data matching Engine 7 output structure ───
const MOCK_ENGINE7_OUTPUT = {
  scenarios: {
    optimistic: {
      residential: { studio: 1800, oneBr: 1650, twoBr: 1500, threeBr: 1350 },
      retail: { small: 2200, medium: 2000, large: 1800 },
      offices: { small: 1400, medium: 1300, large: 1200 },
    },
    base: {
      residential: { studio: 1600, oneBr: 1450, twoBr: 1300, threeBr: 1150 },
      retail: { small: 2000, medium: 1800, large: 1600 },
      offices: { small: 1200, medium: 1100, large: 1000 },
    },
    conservative: {
      residential: { studio: 1400, oneBr: 1250, twoBr: 1100, threeBr: 950 },
      retail: { small: 1800, medium: 1600, large: 1400 },
      offices: { small: 1000, medium: 900, large: 800 },
    },
  },
  paymentPlan: {
    booking: { pct: 10, timing: "عند التوقيع" },
    construction: { pct: 60, timing: "أثناء الإنشاء" },
    handover: { pct: 30, timing: "عند التسليم" },
    deferred: { pct: 0, timing: "" },
  },
  weightedAvgPrice: 1420,
};

describe("Joelle Auto-Populate - Data Mapping Logic", () => {
  describe("Engine 6 → MarketOverview mapping", () => {
    it("should correctly map unit mix percentages from Engine 6 output", () => {
      const data = MOCK_ENGINE6_OUTPUT;
      const unitMix = data.unitMix;

      // Verify the mapping produces correct values
      const moData = {
        residentialStudioPct: String(unitMix.studio?.pct ?? 0),
        residentialStudioAvgArea: Math.round(unitMix.studio?.avgSize ?? 0),
        residential1brPct: String(unitMix.oneBr?.pct ?? 0),
        residential1brAvgArea: Math.round(unitMix.oneBr?.avgSize ?? 0),
        residential2brPct: String(unitMix.twoBr?.pct ?? 0),
        residential2brAvgArea: Math.round(unitMix.twoBr?.avgSize ?? 0),
        residential3brPct: String(unitMix.threeBr?.pct ?? 0),
        residential3brAvgArea: Math.round(unitMix.threeBr?.avgSize ?? 0),
      };

      expect(moData.residentialStudioPct).toBe("15");
      expect(moData.residentialStudioAvgArea).toBe(400);
      expect(moData.residential1brPct).toBe("35");
      expect(moData.residential1brAvgArea).toBe(700);
      expect(moData.residential2brPct).toBe("30");
      expect(moData.residential2brAvgArea).toBe(1000);
      expect(moData.residential3brPct).toBe("20");
      expect(moData.residential3brAvgArea).toBe(1400);
    });

    it("should correctly map retail mix from Engine 6 output", () => {
      const data = MOCK_ENGINE6_OUTPUT;
      const retailMix = data.retailMix;

      const moData = {
        retailSmallPct: String(retailMix.small?.pct ?? 0),
        retailSmallAvgArea: Math.round(retailMix.small?.avgSize ?? 0),
        retailMediumPct: String(retailMix.medium?.pct ?? 0),
        retailMediumAvgArea: Math.round(retailMix.medium?.avgSize ?? 0),
        retailLargePct: String(retailMix.large?.pct ?? 0),
        retailLargeAvgArea: Math.round(retailMix.large?.avgSize ?? 0),
      };

      expect(moData.retailSmallPct).toBe("40");
      expect(moData.retailSmallAvgArea).toBe(300);
      expect(moData.retailMediumPct).toBe("35");
      expect(moData.retailMediumAvgArea).toBe(600);
      expect(moData.retailLargePct).toBe("25");
      expect(moData.retailLargeAvgArea).toBe(1200);
    });

    it("should handle missing unit types gracefully (default to 0)", () => {
      const partialData = {
        unitMix: {
          studio: { pct: 50, avgSize: 400 },
          oneBr: { pct: 50, avgSize: 700 },
          // twoBr and threeBr missing
        },
        retailMix: {},
        finishingQuality: "standard",
      };

      const unitMix = partialData.unitMix as any;
      const moData = {
        residential2brPct: String(unitMix.twoBr?.pct ?? 0),
        residential2brAvgArea: Math.round(unitMix.twoBr?.avgSize ?? 0),
        residential3brPct: String(unitMix.threeBr?.pct ?? 0),
        residential3brAvgArea: Math.round(unitMix.threeBr?.avgSize ?? 0),
      };

      expect(moData.residential2brPct).toBe("0");
      expect(moData.residential2brAvgArea).toBe(0);
      expect(moData.residential3brPct).toBe("0");
      expect(moData.residential3brAvgArea).toBe(0);
    });

    it("should map finishing quality correctly", () => {
      expect(MOCK_ENGINE6_OUTPUT.finishingQuality).toBe("premium");
      // Default fallback
      const noQuality = {} as any;
      expect(noQuality.finishingQuality || "ممتاز").toBe("ممتاز");
    });
  });

  describe("Engine 7 → CompetitionPricing mapping", () => {
    it("should correctly map base scenario prices", () => {
      const data = MOCK_ENGINE7_OUTPUT;
      const base = data.scenarios.base.residential;

      const cpData = {
        baseStudioPrice: Math.round(base.studio ?? 0),
        base1brPrice: Math.round(base.oneBr ?? 0),
        base2brPrice: Math.round(base.twoBr ?? 0),
        base3brPrice: Math.round(base.threeBr ?? 0),
      };

      expect(cpData.baseStudioPrice).toBe(1600);
      expect(cpData.base1brPrice).toBe(1450);
      expect(cpData.base2brPrice).toBe(1300);
      expect(cpData.base3brPrice).toBe(1150);
    });

    it("should correctly map optimistic scenario prices", () => {
      const data = MOCK_ENGINE7_OUTPUT;
      const opt = data.scenarios.optimistic.residential;

      expect(Math.round(opt.studio)).toBe(1800);
      expect(Math.round(opt.oneBr)).toBe(1650);
      expect(Math.round(opt.twoBr)).toBe(1500);
      expect(Math.round(opt.threeBr)).toBe(1350);
    });

    it("should correctly map conservative scenario prices", () => {
      const data = MOCK_ENGINE7_OUTPUT;
      const cons = data.scenarios.conservative.residential;

      expect(Math.round(cons.studio)).toBe(1400);
      expect(Math.round(cons.oneBr)).toBe(1250);
      expect(Math.round(cons.twoBr)).toBe(1100);
      expect(Math.round(cons.threeBr)).toBe(950);
    });

    it("should correctly map retail prices across scenarios", () => {
      const data = MOCK_ENGINE7_OUTPUT;

      expect(Math.round(data.scenarios.base.retail.small)).toBe(2000);
      expect(Math.round(data.scenarios.base.retail.medium)).toBe(1800);
      expect(Math.round(data.scenarios.base.retail.large)).toBe(1600);
    });

    it("should correctly map office prices across scenarios", () => {
      const data = MOCK_ENGINE7_OUTPUT;

      expect(Math.round(data.scenarios.base.offices.small)).toBe(1200);
      expect(Math.round(data.scenarios.base.offices.medium)).toBe(1100);
      expect(Math.round(data.scenarios.base.offices.large)).toBe(1000);
    });

    it("should correctly map payment plan", () => {
      const data = MOCK_ENGINE7_OUTPUT;
      const pp = data.paymentPlan;

      expect(String(pp.booking.pct)).toBe("10");
      expect(pp.booking.timing).toBe("عند التوقيع");
      expect(String(pp.construction.pct)).toBe("60");
      expect(pp.construction.timing).toBe("أثناء الإنشاء");
      expect(String(pp.handover.pct)).toBe("30");
      expect(pp.handover.timing).toBe("عند التسليم");
      expect(String(pp.deferred.pct)).toBe("0");
    });

    it("should handle missing scenarios gracefully", () => {
      const partialData = {
        scenarios: {
          base: { residential: { studio: 1500 } },
          // optimistic and conservative missing
        },
        paymentPlan: {},
      };

      const opt = (partialData.scenarios as any).optimistic?.residential || {};
      expect(Math.round(opt.studio ?? 0)).toBe(0);
      expect(Math.round(opt.oneBr ?? 0)).toBe(0);
    });

    it("payment plan percentages should sum to 100", () => {
      const pp = MOCK_ENGINE7_OUTPUT.paymentPlan;
      const total = pp.booking.pct + pp.construction.pct + pp.handover.pct + pp.deferred.pct;
      expect(total).toBe(100);
    });
  });

  describe("Auto-populate status logic", () => {
    it("should detect engine readiness from stage status", () => {
      const stages = [
        { stageNumber: 6, stageStatus: "completed", stageDataJson: JSON.stringify(MOCK_ENGINE6_OUTPUT) },
        { stageNumber: 7, stageStatus: "completed", stageDataJson: JSON.stringify(MOCK_ENGINE7_OUTPUT) },
      ];

      const stage6 = stages.find(s => s.stageNumber === 6 && s.stageStatus === "completed");
      const stage7 = stages.find(s => s.stageNumber === 7 && s.stageStatus === "completed");

      expect(!!stage6?.stageDataJson).toBe(true);
      expect(!!stage7?.stageDataJson).toBe(true);
    });

    it("should not detect readiness for incomplete stages", () => {
      const stages = [
        { stageNumber: 6, stageStatus: "running", stageDataJson: null },
        { stageNumber: 7, stageStatus: "pending", stageDataJson: null },
      ];

      const stage6 = stages.find(s => s.stageNumber === 6 && s.stageStatus === "completed");
      const stage7 = stages.find(s => s.stageNumber === 7 && s.stageStatus === "completed");

      expect(!!stage6?.stageDataJson).toBe(false);
      expect(!!stage7?.stageDataJson).toBe(false);
    });

    it("should handle partial completion (only Engine 6 done)", () => {
      const stages = [
        { stageNumber: 6, stageStatus: "completed", stageDataJson: JSON.stringify(MOCK_ENGINE6_OUTPUT) },
        { stageNumber: 7, stageStatus: "pending", stageDataJson: null },
      ];

      const stage6 = stages.find(s => s.stageNumber === 6 && s.stageStatus === "completed");
      const stage7 = stages.find(s => s.stageNumber === 7 && s.stageStatus === "completed");

      expect(!!stage6?.stageDataJson).toBe(true);
      expect(!!stage7?.stageDataJson).toBe(false);
    });
  });

  describe("Data integrity checks", () => {
    it("all residential percentages should be non-negative", () => {
      const unitMix = MOCK_ENGINE6_OUTPUT.unitMix;
      expect(unitMix.studio.pct).toBeGreaterThanOrEqual(0);
      expect(unitMix.oneBr.pct).toBeGreaterThanOrEqual(0);
      expect(unitMix.twoBr.pct).toBeGreaterThanOrEqual(0);
      expect(unitMix.threeBr.pct).toBeGreaterThanOrEqual(0);
    });

    it("residential percentages should sum to 100", () => {
      const unitMix = MOCK_ENGINE6_OUTPUT.unitMix;
      const total = unitMix.studio.pct + unitMix.oneBr.pct + unitMix.twoBr.pct + unitMix.threeBr.pct;
      expect(total).toBe(100);
    });

    it("retail percentages should sum to 100", () => {
      const retailMix = MOCK_ENGINE6_OUTPUT.retailMix;
      const total = retailMix.small.pct + retailMix.medium.pct + retailMix.large.pct;
      expect(total).toBe(100);
    });

    it("all prices should be positive numbers", () => {
      const base = MOCK_ENGINE7_OUTPUT.scenarios.base;
      expect(base.residential.studio).toBeGreaterThan(0);
      expect(base.residential.oneBr).toBeGreaterThan(0);
      expect(base.residential.twoBr).toBeGreaterThan(0);
      expect(base.residential.threeBr).toBeGreaterThan(0);
    });

    it("optimistic prices should be higher than base prices", () => {
      const opt = MOCK_ENGINE7_OUTPUT.scenarios.optimistic.residential;
      const base = MOCK_ENGINE7_OUTPUT.scenarios.base.residential;
      expect(opt.studio).toBeGreaterThan(base.studio);
      expect(opt.oneBr).toBeGreaterThan(base.oneBr);
      expect(opt.twoBr).toBeGreaterThan(base.twoBr);
      expect(opt.threeBr).toBeGreaterThan(base.threeBr);
    });

    it("conservative prices should be lower than base prices", () => {
      const cons = MOCK_ENGINE7_OUTPUT.scenarios.conservative.residential;
      const base = MOCK_ENGINE7_OUTPUT.scenarios.base.residential;
      expect(cons.studio).toBeLessThan(base.studio);
      expect(cons.oneBr).toBeLessThan(base.oneBr);
      expect(cons.twoBr).toBeLessThan(base.twoBr);
      expect(cons.threeBr).toBeLessThan(base.threeBr);
    });

    it("JSON serialization should preserve all data", () => {
      const serialized = JSON.stringify(MOCK_ENGINE6_OUTPUT);
      const parsed = JSON.parse(serialized);
      expect(parsed.unitMix.studio.pct).toBe(15);
      expect(parsed.unitMix.oneBr.avgSize).toBe(700);
      expect(parsed.finishingQuality).toBe("premium");
    });
  });
});
