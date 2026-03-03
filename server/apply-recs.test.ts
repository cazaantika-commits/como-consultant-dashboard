import { describe, it, expect } from "vitest";

// Test the recommendation-to-fields mapping logic (same as applyRecsToLocalFields in MarketOverviewTab)
function applyRecsToFields(recs: any, prev: Record<string, any> = {}) {
  const updated = { ...prev };
  if (recs.residential) {
    updated.residentialStudioPct = recs.residential.studio?.recommended ? (recs.residential.studio.pct || 0) : 0;
    updated.residentialStudioAvgArea = recs.residential.studio?.recommended ? (recs.residential.studio.avgArea || 0) : 0;
    updated.residential1brPct = recs.residential.oneBr?.recommended ? (recs.residential.oneBr.pct || 0) : 0;
    updated.residential1brAvgArea = recs.residential.oneBr?.recommended ? (recs.residential.oneBr.avgArea || 0) : 0;
    updated.residential2brPct = recs.residential.twoBr?.recommended ? (recs.residential.twoBr.pct || 0) : 0;
    updated.residential2brAvgArea = recs.residential.twoBr?.recommended ? (recs.residential.twoBr.avgArea || 0) : 0;
    updated.residential3brPct = recs.residential.threeBr?.recommended ? (recs.residential.threeBr.pct || 0) : 0;
    updated.residential3brAvgArea = recs.residential.threeBr?.recommended ? (recs.residential.threeBr.avgArea || 0) : 0;
  }
  if (recs.retail) {
    updated.retailSmallPct = recs.retail.hasRetail ? (recs.retail.small?.pct || 0) : 0;
    updated.retailSmallAvgArea = recs.retail.hasRetail ? (recs.retail.small?.avgArea || 0) : 0;
    updated.retailMediumPct = recs.retail.hasRetail ? (recs.retail.medium?.pct || 0) : 0;
    updated.retailMediumAvgArea = recs.retail.hasRetail ? (recs.retail.medium?.avgArea || 0) : 0;
    updated.retailLargePct = recs.retail.hasRetail ? (recs.retail.large?.pct || 0) : 0;
    updated.retailLargeAvgArea = recs.retail.hasRetail ? (recs.retail.large?.avgArea || 0) : 0;
  }
  if (recs.offices) {
    updated.officeSmallPct = recs.offices.hasOffices ? (recs.offices.small?.pct || 0) : 0;
    updated.officeSmallAvgArea = recs.offices.hasOffices ? (recs.offices.small?.avgArea || 0) : 0;
    updated.officeMediumPct = recs.offices.hasOffices ? (recs.offices.medium?.pct || 0) : 0;
    updated.officeMediumAvgArea = recs.offices.hasOffices ? (recs.offices.medium?.avgArea || 0) : 0;
    updated.officeLargePct = recs.offices.hasOffices ? (recs.offices.large?.pct || 0) : 0;
    updated.officeLargeAvgArea = recs.offices.hasOffices ? (recs.offices.large?.avgArea || 0) : 0;
  }
  if (recs.finishingQuality) {
    updated.finishingQuality = recs.finishingQuality;
  }
  return updated;
}

describe("applyRecsToFields", () => {
  it("should apply residential recommendations correctly", () => {
    const recs = {
      residential: {
        studio: { recommended: true, pct: 20, avgArea: 450 },
        oneBr: { recommended: true, pct: 40, avgArea: 750 },
        twoBr: { recommended: true, pct: 30, avgArea: 1100 },
        threeBr: { recommended: true, pct: 10, avgArea: 1600 },
      },
    };
    const result = applyRecsToFields(recs);
    expect(result.residentialStudioPct).toBe(20);
    expect(result.residentialStudioAvgArea).toBe(450);
    expect(result.residential1brPct).toBe(40);
    expect(result.residential1brAvgArea).toBe(750);
    expect(result.residential2brPct).toBe(30);
    expect(result.residential2brAvgArea).toBe(1100);
    expect(result.residential3brPct).toBe(10);
    expect(result.residential3brAvgArea).toBe(1600);
  });

  it("should set non-recommended residential types to 0", () => {
    const recs = {
      residential: {
        studio: { recommended: false, pct: 20, avgArea: 450 },
        oneBr: { recommended: true, pct: 50, avgArea: 750 },
        twoBr: { recommended: true, pct: 50, avgArea: 1100 },
        threeBr: { recommended: false, pct: 0, avgArea: 0 },
      },
    };
    const result = applyRecsToFields(recs);
    expect(result.residentialStudioPct).toBe(0);
    expect(result.residentialStudioAvgArea).toBe(0);
    expect(result.residential1brPct).toBe(50);
    expect(result.residential3brPct).toBe(0);
  });

  it("should apply retail recommendations when hasRetail is true", () => {
    const recs = {
      retail: {
        hasRetail: true,
        small: { pct: 50, avgArea: 800 },
        medium: { pct: 30, avgArea: 1500 },
        large: { pct: 20, avgArea: 3000 },
      },
    };
    const result = applyRecsToFields(recs);
    expect(result.retailSmallPct).toBe(50);
    expect(result.retailSmallAvgArea).toBe(800);
    expect(result.retailMediumPct).toBe(30);
    expect(result.retailLargePct).toBe(20);
  });

  it("should set retail to 0 when hasRetail is false", () => {
    const recs = {
      retail: {
        hasRetail: false,
        small: { pct: 50, avgArea: 800 },
        medium: { pct: 30, avgArea: 1500 },
        large: { pct: 20, avgArea: 3000 },
      },
    };
    const result = applyRecsToFields(recs);
    expect(result.retailSmallPct).toBe(0);
    expect(result.retailSmallAvgArea).toBe(0);
    expect(result.retailMediumPct).toBe(0);
    expect(result.retailLargePct).toBe(0);
  });

  it("should apply office recommendations when hasOffices is true", () => {
    const recs = {
      offices: {
        hasOffices: true,
        small: { pct: 40, avgArea: 500 },
        medium: { pct: 35, avgArea: 1000 },
        large: { pct: 25, avgArea: 2000 },
      },
    };
    const result = applyRecsToFields(recs);
    expect(result.officeSmallPct).toBe(40);
    expect(result.officeMediumPct).toBe(35);
    expect(result.officeLargePct).toBe(25);
  });

  it("should apply finishing quality", () => {
    const recs = { finishingQuality: "ممتاز" };
    const result = applyRecsToFields(recs);
    expect(result.finishingQuality).toBe("ممتاز");
  });

  it("should apply all recommendations together", () => {
    const recs = {
      residential: {
        studio: { recommended: true, pct: 20, avgArea: 450 },
        oneBr: { recommended: true, pct: 40, avgArea: 750 },
        twoBr: { recommended: true, pct: 30, avgArea: 1100 },
        threeBr: { recommended: true, pct: 10, avgArea: 1600 },
      },
      retail: {
        hasRetail: true,
        small: { pct: 50, avgArea: 800 },
        medium: { pct: 30, avgArea: 1500 },
        large: { pct: 20, avgArea: 3000 },
      },
      offices: {
        hasOffices: false,
        small: { pct: 0, avgArea: 0 },
        medium: { pct: 0, avgArea: 0 },
        large: { pct: 0, avgArea: 0 },
      },
      finishingQuality: "جيد جداً",
    };
    const result = applyRecsToFields(recs);
    // Residential applied
    expect(result.residentialStudioPct).toBe(20);
    expect(result.residential1brPct).toBe(40);
    // Retail applied
    expect(result.retailSmallPct).toBe(50);
    // Offices zeroed
    expect(result.officeSmallPct).toBe(0);
    // Quality applied
    expect(result.finishingQuality).toBe("جيد جداً");
  });

  it("should preserve existing fields not covered by recommendations", () => {
    const prev = { someOtherField: "hello", residentialStudioPct: 99 };
    const recs = {
      residential: {
        studio: { recommended: true, pct: 20, avgArea: 450 },
        oneBr: { recommended: true, pct: 40, avgArea: 750 },
        twoBr: { recommended: true, pct: 30, avgArea: 1100 },
        threeBr: { recommended: true, pct: 10, avgArea: 1600 },
      },
    };
    const result = applyRecsToFields(recs, prev);
    expect(result.someOtherField).toBe("hello");
    expect(result.residentialStudioPct).toBe(20); // overwritten
  });
});
