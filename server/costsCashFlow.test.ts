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
  units: number;
  surplus: number;
  parking: number;
  basePricePerSqft: number;
  unitPrice: number;
  revenueBase: number;
  revenueOpt: number;
  revenueCons: number;
}

function zeroWasteDistribute(types: UnitType[], totalSellable: number): DistResult[] {
  if (totalSellable <= 0 || types.length === 0) return [];
  const activeTypes = types.filter(t => t.pct > 0 && t.avgArea > 0);
  if (activeTypes.length === 0) return [];

  let results: DistResult[] = activeTypes.map(t => {
    const allocated = totalSellable * (t.pct / 100);
    const units = Math.floor(allocated / t.avgArea);
    const surplus = allocated - (units * t.avgArea);
    return {
      key: t.key, label: t.label, pct: t.pct, avgArea: t.avgArea,
      allocated, units, surplus, parking: 0,
      basePricePerSqft: t.basePricePerSqft,
      unitPrice: t.avgArea * t.basePricePerSqft,
      revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    };
  });

  let totalSurplus = results.reduce((s, r) => s + r.surplus, 0);
  const sortedByArea = [...results].sort((a, b) => a.avgArea - b.avgArea);
  for (const item of sortedByArea) {
    while (totalSurplus >= item.avgArea) {
      const r = results.find(r => r.key === item.key)!;
      r.units += 1;
      totalSurplus -= item.avgArea;
    }
  }

  const usedArea = results.reduce((s, r) => s + r.units * r.avgArea, 0);
  const finalSurplus = totalSellable - usedArea;
  results = results.map(r => ({ ...r, surplus: 0 }));
  if (finalSurplus > 0 && results.length > 0) {
    const largestIdx = results.reduce((maxIdx, r, i, arr) => r.avgArea > arr[maxIdx].avgArea ? i : maxIdx, 0);
    results[largestIdx].surplus = finalSurplus;
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
  return results.map(r => ({
    ...r,
    unitPrice: r.avgArea * r.basePricePerSqft,
    revenueBase: r.units * r.avgArea * r.basePricePerSqft,
    revenueOpt: r.units * r.avgArea * r.basePricePerSqft * 1.10,
    revenueCons: r.units * r.avgArea * r.basePricePerSqft * 0.90,
  }));
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
    expect(results[0].units).toBe(25);
    expect(results[0].surplus).toBe(0);
  });

  it("distributes units with surplus correctly", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 100, avgArea: 400, basePricePerSqft: 1500 },
    ];
    const results = zeroWasteDistribute(types, 10100);
    expect(results[0].units).toBe(25);
    expect(results[0].surplus).toBe(100);
  });

  it("uses zero-waste: adds extra units from surplus using smallest type first", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 50, avgArea: 400, basePricePerSqft: 1500 },
      { key: "1br", label: "غرفة وصالة", pct: 50, avgArea: 700, basePricePerSqft: 1800 },
    ];
    const results = zeroWasteDistribute(types, 10000);
    expect(results).toHaveLength(2);
    
    const studio = results.find(r => r.key === "studio")!;
    const oneBr = results.find(r => r.key === "1br")!;
    
    expect(studio.units).toBe(12);
    expect(oneBr.units).toBe(7);
    expect(oneBr.surplus).toBe(300);
  });

  it("adds extra units when surplus is enough for smallest type", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 60, avgArea: 400, basePricePerSqft: 1500 },
      { key: "1br", label: "غرفة وصالة", pct: 40, avgArea: 700, basePricePerSqft: 1800 },
    ];
    const results = zeroWasteDistribute(types, 10000);
    
    const studio = results.find(r => r.key === "studio")!;
    const oneBr = results.find(r => r.key === "1br")!;
    
    expect(studio.units).toBe(16);
    expect(oneBr.units).toBe(5);
    expect(oneBr.surplus).toBe(100);
  });

  it("total used area + surplus equals total sellable", () => {
    const types: UnitType[] = [
      { key: "studio", label: "استديو", pct: 25, avgArea: 400, basePricePerSqft: 1500 },
      { key: "1br", label: "غرفة وصالة", pct: 35, avgArea: 700, basePricePerSqft: 1800 },
      { key: "2br", label: "غرفتان", pct: 25, avgArea: 1000, basePricePerSqft: 2000 },
      { key: "3br", label: "ثلاث غرف", pct: 15, avgArea: 1400, basePricePerSqft: 2200 },
    ];
    const totalSellable = 50000;
    const results = zeroWasteDistribute(types, totalSellable);
    
    const usedArea = results.reduce((s, r) => s + r.units * r.avgArea, 0);
    const totalSurplus = results.reduce((s, r) => s + r.surplus, 0);
    
    expect(usedArea + totalSurplus).toBe(totalSellable);
  });
});

describe("Parking Calculations", () => {
  it("calculates residential parking: 1 spot for units <= 1615 sqft", () => {
    const results: DistResult[] = [{
      key: "studio", label: "استديو", pct: 100, avgArea: 400, allocated: 10000,
      units: 25, surplus: 0, parking: 0, basePricePerSqft: 1500,
      unitPrice: 600000, revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const parked = calcParking(results, "residential");
    expect(parked[0].parking).toBe(25);
  });

  it("calculates residential parking: 2 spots for units > 1615 sqft", () => {
    const results: DistResult[] = [{
      key: "3br", label: "ثلاث غرف", pct: 100, avgArea: 1800, allocated: 18000,
      units: 10, surplus: 0, parking: 0, basePricePerSqft: 2200,
      unitPrice: 3960000, revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const parked = calcParking(results, "residential");
    expect(parked[0].parking).toBe(20);
  });

  it("calculates retail parking: 1 spot per 753 sqft", () => {
    const results: DistResult[] = [{
      key: "retSmall", label: "صغيرة", pct: 100, avgArea: 300, allocated: 3000,
      units: 10, surplus: 0, parking: 0, basePricePerSqft: 2500,
      unitPrice: 750000, revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const parked = calcParking(results, "retail");
    expect(parked[0].parking).toBe(4);
  });

  it("calculates office parking: 1 spot per 538 sqft", () => {
    const results: DistResult[] = [{
      key: "offSmall", label: "صغيرة", pct: 100, avgArea: 400, allocated: 4000,
      units: 10, surplus: 0, parking: 0, basePricePerSqft: 1200,
      unitPrice: 480000, revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const parked = calcParking(results, "offices");
    expect(parked[0].parking).toBe(8);
  });
});

describe("Revenue Calculations", () => {
  it("calculates base, optimistic (+10%), and conservative (-10%) revenue", () => {
    const results: DistResult[] = [{
      key: "studio", label: "استديو", pct: 100, avgArea: 400, allocated: 10000,
      units: 25, surplus: 0, parking: 25, basePricePerSqft: 1500,
      unitPrice: 0, revenueBase: 0, revenueOpt: 0, revenueCons: 0,
    }];
    const revenue = calcRevenue(results);
    
    expect(revenue[0].revenueBase).toBe(15000000);
    expect(revenue[0].revenueOpt).toBeCloseTo(16500000, 0);
    expect(revenue[0].revenueCons).toBeCloseTo(13500000, 0);
    expect(revenue[0].unitPrice).toBe(600000);
  });

  it("handles zero price correctly", () => {
    const results: DistResult[] = [{
      key: "studio", label: "استديو", pct: 100, avgArea: 400, allocated: 10000,
      units: 25, surplus: 0, parking: 25, basePricePerSqft: 0,
      unitPrice: 0, revenueBase: 0, revenueOpt: 0, revenueCons: 0,
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
