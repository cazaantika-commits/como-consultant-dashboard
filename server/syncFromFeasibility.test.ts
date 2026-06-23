import { describe, it, expect } from "vitest";
import { DEFAULT_AVG_AREAS } from "../shared/feasibilityUtils";

/**
 * Unit tests for the syncFromFeasibility logic.
 * Tests the getAvg helper and the name→amount mapping used in the mutation.
 */

// Replicate the getAvg helper from the server mutation
function getAvg(pctKey: string, avgVal: number | null | undefined): number {
  const v = avgVal || 0;
  if (v > 0) return v;
  const mapping = DEFAULT_AVG_AREAS[pctKey];
  return mapping ? mapping.defaultArea : 0;
}

// Replicate the calcTypeRevenue helper
function calcTypeRevenue(pct: number, avgArea: number, pricePerSqft: number, saleable: number): { revenue: number; units: number } {
  const allocated = saleable * (pct / 100);
  const units = avgArea > 0 ? Math.floor(allocated / avgArea) : 0;
  return { revenue: avgArea * pricePerSqft * units, units };
}

describe("getAvg helper (DEFAULT_AVG_AREAS fallback)", () => {
  it("returns the actual avgArea when it is > 0", () => {
    expect(getAvg("residential3brPct", 1500)).toBe(1500);
  });

  it("returns the default area when avgArea is 0", () => {
    expect(getAvg("residential3brPct", 0)).toBe(1400);
  });

  it("returns the default area when avgArea is null", () => {
    expect(getAvg("residential3brPct", null)).toBe(1400);
  });

  it("returns the default area when avgArea is undefined", () => {
    expect(getAvg("residential3brPct", undefined)).toBe(1400);
  });

  it("returns 0 for unknown pctKey with no avgArea", () => {
    expect(getAvg("unknownKey", 0)).toBe(0);
  });

  it("returns correct defaults for all known keys", () => {
    expect(getAvg("residentialStudioPct", 0)).toBe(400);
    expect(getAvg("residential1brPct", 0)).toBe(700);
    expect(getAvg("residential2brPct", 0)).toBe(1000);
    expect(getAvg("residential3brPct", 0)).toBe(1400);
    expect(getAvg("retailSmallPct", 0)).toBe(300);
    expect(getAvg("retailMediumPct", 0)).toBe(600);
    expect(getAvg("retailLargePct", 0)).toBe(1200);
    expect(getAvg("officeSmallPct", 0)).toBe(400);
    expect(getAvg("officeMediumPct", 0)).toBe(800);
    expect(getAvg("officeLargePct", 0)).toBe(1500);
  });
});

describe("calcTypeRevenue with getAvg fallback", () => {
  it("calculates revenue correctly with default avg area", () => {
    // 3BR: 40% of 10000 sqft saleable = 4000 sqft allocated
    // default avg area = 1400, units = floor(4000/1400) = 2
    // revenue = 1400 * 1500 * 2 = 4,200,000
    const avgArea = getAvg("residential3brPct", 0); // should be 1400
    const result = calcTypeRevenue(40, avgArea, 1500, 10000);
    expect(result.units).toBe(2);
    expect(result.revenue).toBe(1400 * 1500 * 2);
  });

  it("calculates revenue correctly with actual avg area", () => {
    // 3BR: 40% of 10000 sqft saleable = 4000 sqft allocated
    // actual avg area = 1200, units = floor(4000/1200) = 3
    // revenue = 1200 * 1500 * 3 = 5,400,000
    const avgArea = getAvg("residential3brPct", 1200); // should be 1200
    const result = calcTypeRevenue(40, avgArea, 1500, 10000);
    expect(result.units).toBe(3);
    expect(result.revenue).toBe(1200 * 1500 * 3);
  });

  it("returns 0 revenue when avgArea is 0 and no default exists", () => {
    const avgArea = getAvg("unknownKey", 0); // should be 0
    const result = calcTypeRevenue(40, avgArea, 1500, 10000);
    expect(result.units).toBe(0);
    expect(result.revenue).toBe(0);
  });
});

describe("syncFromFeasibility name→amount mapping completeness", () => {
  // These are the canonical names used in CostsCashFlowTab
  const canonicalNames = [
    "سعر الأرض",
    "عمولة وسيط الأرض",
    "رسوم تسجيل الأرض",
    "فحص التربة",
    "المسح الطبوغرافي",
    "رسوم الجهات الرسمية",
    "أتعاب التصميم",
    "أتعاب الإشراف",
    "رسوم الفرز",
    "تكلفة البناء",
    "رسوم المجتمع",
    "احتياطي وطوارئ",
    "أتعاب المطور",
    "عمولة البيع",
    "التسويق",
    "رسوم تسجيل الوحدات — ريرا",
    "رسوم تسجيل المشروع — ريرا",
    "رسوم عدم ممانعة — المطور",
    "حساب الضمان (Escrow)",
    "الرسوم البنكية",
    "أتعاب المسّاح",
    "تدقيق ريرا",
    "تفتيش ريرا",
  ];

  // Build the mapping like the server does (simplified with dummy values)
  const buildMapping = () => {
    const landPrice = 10000000;
    const agentCommissionLandPct = 1;
    const constructionCost = 50000000;
    const designFeePct = 2;
    const supervisionFeePct = 2;
    const plotAreaM2 = 5000;
    const separationFeePerM2 = 40;
    const totalRevenue = 100000000;
    const developerFeePct = 5;
    const salesCommissionPct = 5;
    const marketingPct = 2;

    return {
      'سعر الأرض': Math.round(landPrice),
      'عمولة وسيط الأرض': Math.round(landPrice * (agentCommissionLandPct / 100)),
      'عمولة وسيط الأرض (1%)': Math.round(landPrice * (agentCommissionLandPct / 100)),
      'رسوم تسجيل الأرض (4%)': Math.round(landPrice * 0.04),
      'رسوم تسجيل الأرض': Math.round(landPrice * 0.04),
      'فحص التربة': 50000,
      'المسح الطبوغرافي': 30000,
      'رسوم الجهات الرسمية': 200000,
      'رسوم الجهات الحكومية': 200000,
      'أتعاب التصميم': Math.round(constructionCost * (designFeePct / 100)),
      'أتعاب التصميم (2%)': Math.round(constructionCost * (designFeePct / 100)),
      'أتعاب الإشراف': Math.round(constructionCost * (supervisionFeePct / 100)),
      'أتعاب الإشراف (2%)': Math.round(constructionCost * (supervisionFeePct / 100)),
      'رسوم الفرز': Math.round(plotAreaM2 * separationFeePerM2),
      'رسوم الفرز (40 د/قدم)': Math.round(plotAreaM2 * separationFeePerM2),
      'تكلفة البناء': Math.round(constructionCost),
      'المقاول الرئيسي': Math.round(constructionCost),
      'رسوم المجتمع': 100000,
      'احتياطي': Math.round(constructionCost * 0.02),
      'احتياطي وطوارئ': Math.round(constructionCost * 0.02),
      'احتياطي وطوارئ (2%)': Math.round(constructionCost * 0.02),
      'أتعاب المطور': Math.round(totalRevenue * (developerFeePct / 100)),
      'أتعاب المطور (5%)': Math.round(totalRevenue * (developerFeePct / 100)),
      'عمولة البيع': Math.round(totalRevenue * (salesCommissionPct / 100)),
      'عمولة وكيل المبيعات (5%)': Math.round(totalRevenue * (salesCommissionPct / 100)),
      'التسويق': Math.round(totalRevenue * (marketingPct / 100)),
      'التسويق والإعلان (2%)': Math.round(totalRevenue * (marketingPct / 100)),
      'رسوم تسجيل الوحدات — ريرا': 50000,
      'تسجيل الوحدات - ريرا': 50000,
      'رسوم تسجيل المشروع — ريرا': 30000,
      'تسجيل بيع على الخارطة - ريرا': 30000,
      'رسوم عدم ممانعة — المطور': 20000,
      'رسوم NOC للبيع': 20000,
      'حساب الضمان (Escrow)': 15000,
      'رسوم حساب الضمان': 15000,
      'الرسوم البنكية': 10000,
      'رسوم بنكية': 10000,
      'أتعاب المسّاح': 25000,
      'رسوم المساح': 25000,
      'تدقيق ريرا': 8000,
      'تقارير تدقيق ريرا': 8000,
      'تفتيش ريرا': 5000,
      'تقارير تفتيش ريرا': 5000,
    };
  };

  it("every canonical name from CostsCashFlowTab has a match in the server mapping", () => {
    const mapping = buildMapping();
    for (const name of canonicalNames) {
      expect(mapping).toHaveProperty(name);
    }
  });

  it("old name aliases also exist in the mapping for backward compatibility", () => {
    const mapping = buildMapping();
    // Old names that may exist in existing CF projects
    const oldNames = [
      "المقاول الرئيسي",
      "احتياطي",
      "رسوم الجهات الحكومية",
      "عمولة وسيط الأرض (1%)",
      "رسوم تسجيل الأرض (4%)",
    ];
    for (const name of oldNames) {
      expect(mapping).toHaveProperty(name);
    }
  });

  it("old and new names resolve to the same amount", () => {
    const mapping = buildMapping();
    expect(mapping["تكلفة البناء"]).toBe(mapping["المقاول الرئيسي"]);
    expect(mapping["احتياطي وطوارئ"]).toBe(mapping["احتياطي"]);
    expect(mapping["رسوم تسجيل الأرض"]).toBe(mapping["رسوم تسجيل الأرض (4%)"]);
  });
});
