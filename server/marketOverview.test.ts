import { describe, it, expect, vi } from "vitest";

// Test the market overview input validation and recommendation parsing
describe("Market Overview", () => {
  it("should validate market overview input fields", () => {
    const input = {
      projectId: 1,
      residentialStudioPct: 15,
      residentialStudioAvgArea: 450,
      residential1brPct: 35,
      residential1brAvgArea: 900,
      residential2brPct: 40,
      residential2brAvgArea: 1200,
      residential3brPct: 10,
      residential3brAvgArea: 1500,
      retailSmallPct: 40,
      retailSmallAvgArea: 300,
      retailMediumPct: 30,
      retailMediumAvgArea: 600,
      retailLargePct: 30,
      retailLargeAvgArea: 1500,
      officeSmallPct: 0,
      officeSmallAvgArea: 0,
      officeMediumPct: 0,
      officeMediumAvgArea: 0,
      officeLargePct: 0,
      officeLargeAvgArea: 0,
      finishingQuality: "ممتاز",
    };

    // Residential total should be 100%
    const resTotalPct = input.residentialStudioPct + input.residential1brPct + input.residential2brPct + input.residential3brPct;
    expect(resTotalPct).toBe(100);

    // Retail total should be 100%
    const retTotalPct = input.retailSmallPct + input.retailMediumPct + input.retailLargePct;
    expect(retTotalPct).toBe(100);

    // Office total should be 0% (no offices)
    const offTotalPct = input.officeSmallPct + input.officeMediumPct + input.officeLargePct;
    expect(offTotalPct).toBe(0);
  });

  it("should compute unit counts correctly from percentages and areas", () => {
    const saleableRes = 48090; // saleable residential area
    const rows = [
      { pct: 50, avgArea: 900 },
      { pct: 40, avgArea: 1200 },
      { pct: 10, avgArea: 1500 },
    ];

    const results = rows.map(r => {
      const allocated = saleableRes * (r.pct / 100);
      const units = r.avgArea > 0 ? Math.floor(allocated / r.avgArea) : 0;
      return { allocated: Math.round(allocated), units };
    });

    expect(results[0].allocated).toBe(24045);
    expect(results[0].units).toBe(26);
    expect(results[1].allocated).toBe(19236);
    expect(results[1].units).toBe(16);
    expect(results[2].allocated).toBe(4809);
    expect(results[2].units).toBe(3);

    const totalUnits = results.reduce((sum, r) => sum + r.units, 0);
    expect(totalUnits).toBe(45);
  });

  it("should parse Joel recommendations JSON correctly", () => {
    const recsJson = JSON.stringify({
      residential: {
        studio: { recommended: false, pct: 0, avgArea: 0 },
        oneBr: { recommended: true, pct: 50, avgArea: 900 },
        twoBr: { recommended: true, pct: 40, avgArea: 1200 },
        threeBr: { recommended: true, pct: 10, avgArea: 1500 },
      },
      retail: {
        hasRetail: true,
        small: { pct: 40, avgArea: 300 },
        medium: { pct: 30, avgArea: 600 },
        large: { pct: 30, avgArea: 1500 },
      },
      offices: {
        hasOffices: false,
        small: { pct: 0, avgArea: 0 },
        medium: { pct: 0, avgArea: 0 },
        large: { pct: 0, avgArea: 0 },
      },
      finishingQuality: "ممتاز",
      summary: "توصية بالتركيز على الوحدات السكنية مع محلات تجارية متنوعة",
    });

    const recs = JSON.parse(recsJson);

    // Verify residential
    expect(recs.residential.studio.recommended).toBe(false);
    expect(recs.residential.oneBr.recommended).toBe(true);
    expect(recs.residential.oneBr.pct).toBe(50);
    expect(recs.residential.oneBr.avgArea).toBe(900);

    // Verify retail
    expect(recs.retail.hasRetail).toBe(true);
    const retailTotal = recs.retail.small.pct + recs.retail.medium.pct + recs.retail.large.pct;
    expect(retailTotal).toBe(100);

    // Verify offices
    expect(recs.offices.hasOffices).toBe(false);

    // Verify finishing quality
    expect(recs.finishingQuality).toBe("ممتاز");
  });

  it("should apply recommendations to data fields correctly", () => {
    const recs = {
      residential: {
        studio: { recommended: true, pct: 15, avgArea: 450 },
        oneBr: { recommended: true, pct: 35, avgArea: 900 },
        twoBr: { recommended: true, pct: 40, avgArea: 1200 },
        threeBr: { recommended: true, pct: 10, avgArea: 1500 },
      },
      retail: {
        hasRetail: true,
        small: { pct: 40, avgArea: 300 },
        medium: { pct: 30, avgArea: 600 },
        large: { pct: 30, avgArea: 1500 },
      },
      offices: {
        hasOffices: false,
        small: { pct: 0, avgArea: 0 },
        medium: { pct: 0, avgArea: 0 },
        large: { pct: 0, avgArea: 0 },
      },
      finishingQuality: "جيد",
    };

    // Simulate applying recommendations
    const data: Record<string, any> = {};

    if (recs.residential) {
      data.residentialStudioPct = (recs.residential.studio?.recommended ? recs.residential.studio.pct : 0)?.toString() ?? '0';
      data.residentialStudioAvgArea = recs.residential.studio?.recommended ? recs.residential.studio.avgArea : 0;
      data.residential1brPct = (recs.residential.oneBr?.recommended ? recs.residential.oneBr.pct : 0)?.toString() ?? '0';
      data.residential1brAvgArea = recs.residential.oneBr?.recommended ? recs.residential.oneBr.avgArea : 0;
      data.residential2brPct = (recs.residential.twoBr?.recommended ? recs.residential.twoBr.pct : 0)?.toString() ?? '0';
      data.residential2brAvgArea = recs.residential.twoBr?.recommended ? recs.residential.twoBr.avgArea : 0;
      data.residential3brPct = (recs.residential.threeBr?.recommended ? recs.residential.threeBr.pct : 0)?.toString() ?? '0';
      data.residential3brAvgArea = recs.residential.threeBr?.recommended ? recs.residential.threeBr.avgArea : 0;
    }

    if (recs.retail) {
      data.retailSmallPct = (recs.retail.hasRetail ? recs.retail.small?.pct : 0)?.toString() ?? '0';
      data.retailSmallAvgArea = recs.retail.hasRetail ? recs.retail.small?.avgArea : 0;
    }

    if (recs.offices) {
      data.officeSmallPct = (recs.offices.hasOffices ? recs.offices.small?.pct : 0)?.toString() ?? '0';
      data.officeSmallAvgArea = recs.offices.hasOffices ? recs.offices.small?.avgArea : 0;
    }

    data.finishingQuality = recs.finishingQuality;

    // Verify applied data
    expect(data.residentialStudioPct).toBe('15');
    expect(data.residentialStudioAvgArea).toBe(450);
    expect(data.residential1brPct).toBe('35');
    expect(data.residential2brPct).toBe('40');
    expect(data.residential3brPct).toBe('10');
    expect(data.retailSmallPct).toBe('40');
    expect(data.retailSmallAvgArea).toBe(300);
    expect(data.officeSmallPct).toBe('0');
    expect(data.officeSmallAvgArea).toBe(0);
    expect(data.finishingQuality).toBe("جيد");
  });

  it("should handle zero areas without division errors", () => {
    const saleableRes = 0;
    const pct = 50;
    const avgArea = 0;
    const allocated = saleableRes * (pct / 100);
    const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
    expect(units).toBe(0);
    expect(allocated).toBe(0);
  });

  it("should clean JSON from markdown code blocks", () => {
    const rawResponse = '```json\n{"finishingQuality": "ممتاز"}\n```';
    const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    expect(parsed.finishingQuality).toBe("ممتاز");
  });

  it("should convert percentage strings to numbers correctly", () => {
    const pctStr = "35.5";
    const pctNum = parseFloat(pctStr);
    expect(pctNum).toBe(35.5);
    expect(parseFloat("0")).toBe(0);
    expect(parseFloat("100")).toBe(100);
  });
});
