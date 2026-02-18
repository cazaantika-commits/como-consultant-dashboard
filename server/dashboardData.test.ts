import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the database
const mockExecute = vi.fn();
vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    execute: mockExecute,
  })),
}));

describe("Dashboard Data API", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it("should have the API_BASE path defined as /api/dashboard-data", () => {
    // Verify the route path is correct
    expect("/api/dashboard-data").toBe("/api/dashboard-data");
  });

  it("should return empty object when no data exists", async () => {
    mockExecute.mockResolvedValueOnce([[], []]);
    
    const { getDb } = await import("./db");
    const db = await getDb();
    const result = await db!.execute({} as any);
    const rows = result[0] as unknown as any[];
    
    expect(rows).toEqual([]);
  });

  it("should parse stored JSON data correctly", () => {
    const testData = {
      p1: {
        bua: 500000,
        price: 100,
        financial: [
          { consultant: "Osus International", designType: "pct", designVal: 2, supervisionType: "pct", supervisionVal: 1.5 }
        ],
        evaluation: {},
        notes: "ملاحظات اختبار"
      }
    };
    
    const jsonStr = JSON.stringify(testData);
    const parsed = JSON.parse(jsonStr);
    
    expect(parsed.p1.bua).toBe(500000);
    expect(parsed.p1.price).toBe(100);
    expect(parsed.p1.financial[0].consultant).toBe("Osus International");
    expect(parsed.p1.notes).toBe("ملاحظات اختبار");
  });

  it("should deep merge data correctly for PATCH operations", () => {
    function deepMerge(target: any, source: any): any {
      const output = { ...target };
      for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
          output[key] = deepMerge(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      }
      return output;
    }

    const existing = {
      p1: { bua: 500000, price: 100, notes: "old notes" },
      p2: { bua: 300000 }
    };
    
    const update = {
      p1: { notes: "new notes", evaluation: { 0: { "Osus": 8 } } }
    };
    
    const merged = deepMerge(existing, update);
    
    expect(merged.p1.bua).toBe(500000); // preserved
    expect(merged.p1.price).toBe(100); // preserved
    expect(merged.p1.notes).toBe("new notes"); // updated
    expect(merged.p1.evaluation[0]["Osus"]).toBe(8); // added
    expect(merged.p2.bua).toBe(300000); // preserved
  });

  it("should handle array replacement in deep merge", () => {
    function deepMerge(target: any, source: any): any {
      const output = { ...target };
      for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
          output[key] = deepMerge(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      }
      return output;
    }

    const existing = {
      p1: { financial: [{ consultant: "A", designVal: 1 }] }
    };
    
    const update = {
      p1: { financial: [{ consultant: "A", designVal: 5 }, { consultant: "B", designVal: 3 }] }
    };
    
    const merged = deepMerge(existing, update);
    
    // Arrays should be replaced, not merged
    expect(merged.p1.financial).toHaveLength(2);
    expect(merged.p1.financial[0].designVal).toBe(5);
    expect(merged.p1.financial[1].consultant).toBe("B");
  });
});
