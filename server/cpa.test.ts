/**
 * CPA Module Tests
 * Verifies: DB data integrity, scope items count, matrix completeness, supervision baseline
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mysql from "mysql2/promise";

let conn: mysql.Connection;

beforeAll(async () => {
  conn = await mysql.createConnection(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await conn.end();
});

describe("CPA Building Categories", () => {
  it("should have exactly 5 building categories", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_building_categories WHERE is_active = 1") as any;
    expect(rows[0].cnt).toBe(5);
  });

  it("should have correct category codes", async () => {
    const [rows] = await conn.execute("SELECT code FROM cpa_building_categories ORDER BY sort_order") as any;
    const codes = rows.map((r: any) => r.code);
    expect(codes).toEqual(["VILLA", "SMALL", "MEDIUM", "LARGE", "MEGA"]);
  });
});

describe("CPA Scope Sections", () => {
  it("should have exactly 5 scope sections", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_scope_sections") as any;
    expect(rows[0].cnt).toBe(5);
  });
});

describe("CPA Scope Items", () => {
  it("should have exactly 47 scope items", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_scope_items WHERE is_active = 1") as any;
    expect(rows[0].cnt).toBe(47);
  });

  it("should have all items with section assignments", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_scope_items WHERE section_id IS NULL") as any;
    expect(rows[0].cnt).toBe(0);
  });

  it("should have correct item numbers 1-47", async () => {
    const [rows] = await conn.execute("SELECT MIN(item_number) as min_n, MAX(item_number) as max_n FROM cpa_scope_items") as any;
    expect(rows[0].min_n).toBe(1);
    expect(rows[0].max_n).toBe(47);
  });

  it("should have 28 CORE items (1-28)", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_scope_items WHERE default_type = 'CORE'") as any;
    expect(rows[0].cnt).toBe(28);
  });

  it("should have 15 GREEN items (29-43)", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_scope_items WHERE default_type = 'GREEN'") as any;
    expect(rows[0].cnt).toBe(15);
  });

  it("should have 4 RED items (44-47)", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_scope_items WHERE default_type = 'RED'") as any;
    expect(rows[0].cnt).toBe(4);
  });

  it("should have key scope item codes", async () => {
    const [rows] = await conn.execute(
      "SELECT code FROM cpa_scope_items WHERE code IN ('CONCEPT_DESIGN','ARCH_DESIGN','FLS','BIM','FIDIC_CONTRACT','GREEN_BUILDING','LANDSCAPE')"
    ) as any;
    expect(rows.length).toBe(7);
  });
});

describe("CPA Scope Category Matrix", () => {
  it("should have exactly 235 matrix cells (47 items × 5 categories)", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_scope_category_matrix") as any;
    expect(rows[0].cnt).toBe(235);
  });

  it("should have all CORE items as INCLUDED for all categories", async () => {
    const [rows] = await conn.execute(`
      SELECT COUNT(*) as cnt FROM cpa_scope_category_matrix scm
      JOIN cpa_scope_items si ON si.id = scm.scope_item_id
      WHERE si.default_type = 'CORE' AND scm.status != 'INCLUDED'
    `) as any;
    expect(rows[0].cnt).toBe(0);
  });

  it("should have MEGA category with all GREEN items as GREEN status", async () => {
    const [cats] = await conn.execute("SELECT id FROM cpa_building_categories WHERE code = 'MEGA'") as any;
    const megaId = cats[0].id;
    const [rows] = await conn.execute(`
      SELECT COUNT(*) as cnt FROM cpa_scope_category_matrix scm
      JOIN cpa_scope_items si ON si.id = scm.scope_item_id
      WHERE si.default_type = 'GREEN' AND scm.building_category_id = ${megaId} AND scm.status != 'GREEN'
    `) as any;
    expect(rows[0].cnt).toBe(0);
  });

  it("VILLA should have NOT_REQUIRED for most GREEN items", async () => {
    const [cats] = await conn.execute("SELECT id FROM cpa_building_categories WHERE code = 'VILLA'") as any;
    const villaId = cats[0].id;
    const [rows] = await conn.execute(`
      SELECT COUNT(*) as cnt FROM cpa_scope_category_matrix scm
      JOIN cpa_scope_items si ON si.id = scm.scope_item_id
      WHERE si.default_type = 'GREEN' AND scm.building_category_id = ${villaId} AND scm.status = 'NOT_REQUIRED'
    `) as any;
    // Most GREEN items are NOT_REQUIRED for VILLA (at least 8)
    expect(rows[0].cnt).toBeGreaterThanOrEqual(8);
  });
});

describe("CPA Scope Reference Costs", () => {
  it("should have reference costs for GREEN items", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_scope_reference_costs") as any;
    expect(rows[0].cnt).toBeGreaterThan(0);
  });

  it("should have GREEN_BUILDING cost for MEGA category", async () => {
    const [rows] = await conn.execute(`
      SELECT src.cost_aed FROM cpa_scope_reference_costs src
      JOIN cpa_scope_items si ON si.id = src.scope_item_id
      JOIN cpa_building_categories bc ON bc.id = src.building_category_id
      WHERE si.code = 'GREEN_BUILDING' AND bc.code = 'MEGA'
    `) as any;
    expect(rows.length).toBe(1);
    expect(Number(rows[0].cost_aed)).toBe(75900);
  });
});

describe("CPA Supervision Roles", () => {
  it("should have exactly 11 supervision roles", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_supervision_roles WHERE is_active = 1") as any;
    expect(rows[0].cnt).toBe(11);
  });

  it("should have correct role codes", async () => {
    const [rows] = await conn.execute("SELECT code FROM cpa_supervision_roles ORDER BY sort_order") as any;
    const codes = rows.map((r: any) => r.code);
    expect(codes).toContain("RE");
    expect(codes).toContain("DEPUTY_RE");
    expect(codes).toContain("HO_STRUCTURAL");
    expect(codes).toContain("HO_ELECTRICAL");
  });

  it("RE should have monthly rate of 45000", async () => {
    const [rows] = await conn.execute("SELECT monthly_rate_aed FROM cpa_supervision_roles WHERE code = 'RE'") as any;
    expect(Number(rows[0].monthly_rate_aed)).toBe(45000);
  });
});

describe("CPA Supervision Baseline", () => {
  it("should have exactly 55 baseline entries (11 roles × 5 categories)", async () => {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM cpa_supervision_baseline") as any;
    expect(rows[0].cnt).toBe(55);
  });

  it("RE should be 100% for all categories", async () => {
    const [rows] = await conn.execute(`
      SELECT sb.required_allocation_pct FROM cpa_supervision_baseline sb
      JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
      WHERE sr.code = 'RE'
    `) as any;
    expect(rows.length).toBe(5);
    rows.forEach((r: any) => expect(Number(r.required_allocation_pct)).toBe(100));
  });

  it("DEPUTY_RE should be 0% for VILLA and SMALL, 100% for LARGE and MEGA", async () => {
    const [rows] = await conn.execute(`
      SELECT bc.code, sb.required_allocation_pct FROM cpa_supervision_baseline sb
      JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
      JOIN cpa_building_categories bc ON bc.id = sb.building_category_id
      WHERE sr.code = 'DEPUTY_RE'
      ORDER BY bc.sort_order
    `) as any;
    const map: Record<string, number> = {};
    rows.forEach((r: any) => { map[r.code] = Number(r.required_allocation_pct); });
    expect(map["VILLA"]).toBe(0);
    expect(map["SMALL"]).toBe(0);
    expect(map["LARGE"]).toBe(100);
    expect(map["MEGA"]).toBe(100);
  });
});
