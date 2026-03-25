import { describe, it, expect } from "vitest";

/* ═══════════════════════════════════════════════════════════════ */
/* Part 1: Zero-Waste Distribution, Parking, and Revenue Tests   */
/* ═══════════════════════════════════════════════════════════════ */

const PARKING = {
  residential: { threshold: 1615, below: 1, above: 2 },
  retail: { perSqft: 753 },
  offices: { perSqft: 538 },
};

interface UnitType {
  key: string;
  label: string;
  pct: number;
  avgArea: number;
  basePricePerSqft: number;
}

interface DistResult {
  key: string;
  label: string;
  pct: number;
  avgArea: number;
  allocated: number;
  baseUnits: number;
  bonusUnits: number;
  units: number;
  surplus: number;
  absorbed: number;
  parking: number;
  basePricePerSqft: number;
  unitPrice: number;
  totalArea: number;
  revenueBase: number;
  revenueOpt: number;
  revenueCons: number;
}

function zeroWasteDistribute(types: UnitType[], totalSellable: number): DistResult[] {
  if (totalSellable <= 0 || types.length === 0) return [];
  const activeTypes = types.filter(t => t.pct > 0 && t.avgArea > 0);
  if (activeTypes.length === 0) return [];

  // Step 1: Allocate by percentage
  let results: DistResult[] = activeTypes.map(t => {
    const allocated = totalSellable * (t.pct / 100);
    const baseUnits = Math.floor(allocated / t.avgArea);
    return {
      key: t.key, label: t.label, pct: t.pct, avgArea: t.avgArea,
      allocated, baseUnits, bonusUnits: 0, units: baseUnits, surplus: 0, absorbed: 0, parking: 0,
      basePricePerSqft: t.basePricePerSqft,
      unitPrice: t.avgArea * t.basePricePerSqft,
      totalArea: baseUnits * t.avgArea,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    };
  });

  // Step 2: Collect leftover from all types and redistribute as bonus units (smallest first)
  let totalSurplus = results.reduce((s, r) => s + (r.allocated - r.baseUnits * r.avgArea), 0);
  const sortedByArea = [...results].sort((a, b) => a.avgArea - b.avgArea);
  for (const item of sortedByArea) {
    while (totalSurplus >= item.avgArea) {
      const r = results.find(r => r.key === item.key)!;
      r.bonusUnits += 1;
      r.units = r.baseUnits + r.bonusUnits;
      r.totalArea = r.units * r.avgArea;
      totalSurplus -= item.avgArea;
    }
  }

  // Step 3: Absorb final surplus into 2BR units (غرفتين وصالة) by increasing their area equally
  // If no 2BR, fall back to largest type
  const usedArea = results.reduce((s, r) => s + r.units * r.avgArea, 0);
  const finalSurplus = totalSellable - usedArea;
  results = results.map(r => ({ ...r, surplus: 0, absorbed: 0, totalArea: r.units * r.avgArea }));
  if (finalSurplus > 0 && results.length > 0) {
    // Priority: 2BR (key contains "2br"), fallback to largest type
    let absorberIdx = results.findIndex(r => r.key.includes("2br"));
    if (absorberIdx === -1) {
      absorberIdx = results.reduce((maxIdx, r, i, arr) => r.avgArea > arr[maxIdx].avgArea ? i : maxIdx, 0);
    }
    const absorber = results[absorberIdx];
    if (absorber.units > 0) {
      const extraPerUnit = finalSurplus / absorber.units;
      absorber.absorbed = extraPerUnit;
      absorber.totalArea = absorber.units * (absorber.avgArea + extraPerUnit);
    } else {
      // If absorber has 0 units, just record as surplus on largest
      const largestIdx = results.reduce((maxIdx, r, i, arr) => r.avgArea > arr[maxIdx].avgArea ? i : maxIdx, 0);
      results[largestIdx].surplus = finalSurplus;
    }
  }
  return results;
}

function calcParking(results: DistResult[], category: "residential" | "retail" | "offices"): DistResult[] {
  return results.map(r => {
    let parking = 0;
    if (category === "residential") {
      parking = r.units * (r.avgArea <= PARKING.residential.threshold ? PARKING.residential.below : PARKING.residential.above);
    } else if (category === "retail") {
      parking = Math.ceil((r.units * r.avgArea) / PARKING.retail.perSqft);
    } else {
      parking = Math.ceil((r.units * r.avgArea) / PARKING.offices.perSqft);
    }
    return { ...r, parking };
  });
}

function calcRevenue(results: DistResult[]): DistResult[] {
  return results.map(r => {
    const effectiveArea = r.avgArea + (r.absorbed || 0);
    return {
      ...r,
      unitPrice: effectiveArea * r.basePricePerSqft,
      revenueBase: r.units * effectiveArea * r.basePricePerSqft,
      revenueOpt: r.units * effectiveArea * r.basePricePerSqft * 1.10,
      revenueCons: r.units * effectiveArea * r.basePricePerSqft * 0.90,
    };
  });
}

describe("Zero-Waste Distribution Algorithm", () => {
  it("returns empty array for zero sellable area", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 30, avgArea: 400, basePricePerSqft: 1500 },
    ];
    expect(zeroWasteDistribute(types, 0)).toEqual([]);
  });

  it("returns empty array for no active types", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 0, avgArea: 400, basePricePerSqft: 1500 },
    ];
    expect(zeroWasteDistribute(types, 10000)).toEqual([]);
  });

  it("distributes units correctly for a single type", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 100, avgArea: 400, basePricePerSqft: 1500 },
    ];
    const results = zeroWasteDistribute(types, 10000);
    expect(results).toHaveLength(1);
    expect(results[0].baseUnits).toBe(25);
    expect(results[0].bonusUnits).toBe(0);
    expect(results[0].units).toBe(25);
    // No surplus — exact fit, absorbed should be 0
    expect(results[0].absorbed).toBe(0);
    expect(results[0].surplus).toBe(0);
  });

  it("absorbs surplus into largest type when single type has remainder", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 100, avgArea: 400, basePricePerSqft: 1500 },
    ];
    const results = zeroWasteDistribute(types, 10100);
    expect(results[0].baseUnits).toBe(25);
    expect(results[0].units).toBe(25);
    // 100 sqft surplus absorbed into 25 studios = 4 sqft/unit
    expect(results[0].absorbed).toBeCloseTo(4, 5);
    expect(results[0].totalArea).toBeCloseTo(10100, 5);
    expect(results[0].surplus).toBe(0);
  });

  it("absorbs surplus into 2BR when available (priority rule)", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 25, avgArea: 400, basePricePerSqft: 1500 },
      { key: "1br", label: "غرفة وصالة", pct: 35, avgArea: 700, basePricePerSqft: 1800 },
      { key: "2br", label: "غرفتان", pct: 25, avgArea: 1000, basePricePerSqft: 2000 },
      { key: "3br", label: "ثلاث غرف", pct: 15, avgArea: 1400, basePricePerSqft: 2200 },
    ];
    const totalSellable = 50000;
    const results = zeroWasteDistribute(types, totalSellable);
    
    const twoBr = results.find(r => r.key === "2br")!;
    const threeBr = results.find(r => r.key === "3br")!;
    
    // 2BR should have absorbed > 0 (it's the priority absorber)
    // 3BR should NOT have absorbed (it's not 2BR)
    expect(twoBr.absorbed).toBeGreaterThan(0);
    expect(threeBr.absorbed).toBe(0);
    expect(threeBr.surplus).toBe(0);
  });

  it("total area equals total sellable (true zero-waste with absorption)", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 25, avgArea: 400, basePricePerSqft: 1500 },
      { key: "1br", label: "غرفة وصالة", pct: 35, avgArea: 700, basePricePerSqft: 1800 },
      { key: "2br", label: "غرفتان", pct: 25, avgArea: 1000, basePricePerSqft: 2000 },
      { key: "3br", label: "ثلاث غرف", pct: 15, avgArea: 1400, basePricePerSqft: 2200 },
    ];
    const totalSellable = 50000;
    const results = zeroWasteDistribute(types, totalSellable);
    
    const totalArea = results.reduce((s, r) => s + r.totalArea, 0);
    // With absorption, total area should equal total sellable (true zero waste)
    expect(totalArea).toBeCloseTo(totalSellable, 5);
  });

  it("falls back to largest type when no 2BR exists", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 50, avgArea: 400, basePricePerSqft: 1500 },
      { key: "1br", label: "غرفة وصالة", pct: 50, avgArea: 700, basePricePerSqft: 1800 },
    ];
    const results = zeroWasteDistribute(types, 10000);
    
    const studio = results.find(r => r.key === "studio")!;
    const oneBr = results.find(r => r.key === "1br")!;
    
    // studio: 5000/400 = 12 base, 1br: 5000/700 = 7 base
    // surplus: 200 + 100 = 300, no bonus (300 < 400)
    // No 2BR → falls back to largest (1br), absorbed into 7 units
    expect(studio.baseUnits).toBe(12);
    expect(oneBr.baseUnits).toBe(7);
    expect(oneBr.absorbed).toBeCloseTo(300 / 7, 5);
    expect(studio.absorbed).toBe(0);
    expect(oneBr.surplus).toBe(0);
  });

  it("adds bonus units when surplus is enough for smallest type", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 60, avgArea: 400, basePricePerSqft: 1500 },
      { key: "1br", label: "غرفة وصالة", pct: 40, avgArea: 700, basePricePerSqft: 1800 },
    ];
    const results = zeroWasteDistribute(types, 10000);
    
    const studio = results.find(r => r.key === "studio")!;
    const oneBr = results.find(r => r.key === "1br")!;
    
    // studio: 6000/400 = 15 base, 1br: 4000/700 = 5 base
    // surplus: 0 + 500 = 500, 500 >= 400 → +1 bonus studio, remaining 100
    // No 2BR → absorbed into largest (1br, 5 units): 100/5 = 20 sqft/unit
    expect(studio.baseUnits).toBe(15);
    expect(studio.bonusUnits).toBe(1);
    expect(studio.units).toBe(16);
    expect(oneBr.baseUnits).toBe(5);
    expect(oneBr.absorbed).toBeCloseTo(100 / 5, 5);
    expect(oneBr.surplus).toBe(0);
  });

  it("tracks bonus units separately from base units", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 25, avgArea: 400, basePricePerSqft: 1500 },
      { key: "1br", label: "غرفة وصالة", pct: 35, avgArea: 700, basePricePerSqft: 1800 },
      { key: "2br", label: "غرفتان", pct: 25, avgArea: 1000, basePricePerSqft: 2000 },
      { key: "3br", label: "ثلاث غرف", pct: 15, avgArea: 1400, basePricePerSqft: 2200 },
    ];
    const totalSellable = 50000;
    const results = zeroWasteDistribute(types, totalSellable);
    
    for (const r of results) {
      expect(r.units).toBe(r.baseUnits + r.bonusUnits);
    }
    
    const totalBonus = results.reduce((s, r) => s + r.bonusUnits, 0);
    expect(totalBonus).toBeGreaterThanOrEqual(0);
  });
});

describe("Parking Calculations", () => {
  it("calculates residential parking: 1 spot for units <= 1615 sqft", () => {
    const results: DistResult[] = [{
      key: "studio", label: "استديو", pct: 100, avgArea: 400, allocated: 10000,
      baseUnits: 25, bonusUnits: 0, units: 25, surplus: 0, absorbed: 0, parking: 0,
      basePricePerSqft: 1500, unitPrice: 600000, totalArea: 10000,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const parked = calcParking(results, "residential");
    expect(parked[0].parking).toBe(25);
  });

  it("calculates residential parking: 2 spots for units > 1615 sqft", () => {
    const results: DistResult[] = [{
      key: "3br", label: "ثلاث غرف", pct: 100, avgArea: 1800, allocated: 18000,
      baseUnits: 10, bonusUnits: 0, units: 10, surplus: 0, absorbed: 0, parking: 0,
      basePricePerSqft: 2200, unitPrice: 3960000, totalArea: 18000,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const parked = calcParking(results, "residential");
    expect(parked[0].parking).toBe(20);
  });

  it("calculates retail parking: 1 spot per 753 sqft", () => {
    const results: DistResult[] = [{
      key: "retSmall", label: "صغيرة", pct: 100, avgArea: 300, allocated: 3000,
      baseUnits: 10, bonusUnits: 0, units: 10, surplus: 0, absorbed: 0, parking: 0,
      basePricePerSqft: 2500, unitPrice: 750000, totalArea: 3000,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const parked = calcParking(results, "retail");
    expect(parked[0].parking).toBe(4);
  });

  it("calculates office parking: 1 spot per 538 sqft", () => {
    const results: DistResult[] = [{
      key: "offSmall", label: "صغيرة", pct: 100, avgArea: 400, allocated: 4000,
      baseUnits: 10, bonusUnits: 0, units: 10, surplus: 0, absorbed: 0, parking: 0,
      basePricePerSqft: 1200, unitPrice: 480000, totalArea: 4000,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const parked = calcParking(results, "offices");
    expect(parked[0].parking).toBe(8);
  });
});

describe("Revenue Calculations", () => {
  it("calculates base, optimistic (+10%), and conservative (-10%) revenue", () => {
    const results: DistResult[] = [{
      key: "studio", label: "استديو", pct: 100, avgArea: 400, allocated: 10000,
      baseUnits: 25, bonusUnits: 0, units: 25, surplus: 0, absorbed: 0, parking: 25,
      basePricePerSqft: 1500, unitPrice: 0, totalArea: 10000,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const revenue = calcRevenue(results);
    
    expect(revenue[0].revenueBase).toBe(15000000);
    expect(revenue[0].revenueOpt).toBeCloseTo(16500000, 0);
    expect(revenue[0].revenueCons).toBeCloseTo(13500000, 0);
    expect(revenue[0].unitPrice).toBe(600000);
  });

  it("includes absorbed area in revenue calculation", () => {
    const results: DistResult[] = [{
      key: "2br", label: "غرفتان", pct: 100, avgArea: 1000, allocated: 10000,
      baseUnits: 10, bonusUnits: 0, units: 10, surplus: 0, absorbed: 20, parking: 10,
      basePricePerSqft: 2000, unitPrice: 0, totalArea: 10200,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const revenue = calcRevenue(results);
    
    // effectiveArea = 1000 + 20 = 1020
    expect(revenue[0].unitPrice).toBe(1020 * 2000);
    expect(revenue[0].revenueBase).toBe(10 * 1020 * 2000);
  });

  it("handles zero price correctly", () => {
    const results: DistResult[] = [{
      key: "studio", label: "استديو", pct: 100, avgArea: 400, allocated: 10000,
      baseUnits: 25, bonusUnits: 0, units: 25, surplus: 0, absorbed: 0, parking: 25,
      basePricePerSqft: 0, unitPrice: 0, totalArea: 10000,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const revenue = calcRevenue(results);
    expect(revenue[0].revenueBase).toBe(0);
    expect(revenue[0].revenueOpt).toBe(0);
    expect(revenue[0].revenueCons).toBe(0);
  });
});

describe("Sellable Area Efficiency Ratios", () => {
  it("applies correct efficiency ratios", () => {
    const gfaRes = 100000;
    const gfaRet = 50000;
    const gfaOff = 30000;
    
    const sellableRes = gfaRes * 0.95;
    const sellableRet = gfaRet * 0.97;
    const sellableOff = gfaOff * 0.95;
    
    expect(sellableRes).toBe(95000);
    expect(sellableRet).toBe(48500);
    expect(sellableOff).toBe(28500);
  });
});
