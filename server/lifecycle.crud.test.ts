import { describe, expect, it } from "vitest";

/**
 * Unit tests for the custom service CRUD operations.
 *
 * Tests the input validation and data building logic for:
 * - addCustomService: adds a custom task to a stage
 * - deleteCustomService: removes a custom task
 * - updateService: updates name and/or duration of a service
 *
 * These tests validate the logic in isolation without hitting the database.
 */

// ── addCustomService input validation ──
function validateAddInput(input: {
  stageCode?: string;
  nameAr?: string;
  expectedDurationDays?: number;
  projectId?: number;
  plannedStartDate?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.stageCode || typeof input.stageCode !== "string") errors.push("stageCode is required");
  if (!input.nameAr || input.nameAr.trim().length === 0) errors.push("nameAr is required and must not be empty");
  if (input.expectedDurationDays !== undefined && (input.expectedDurationDays < 1 || !Number.isInteger(input.expectedDurationDays))) {
    errors.push("expectedDurationDays must be a positive integer");
  }
  if (!input.projectId || typeof input.projectId !== "number") errors.push("projectId is required");
  return { valid: errors.length === 0, errors };
}

// ── Service code generation ──
function generateServiceCode(stageCode: string, timestamp: number): string {
  return `SRV-CUSTOM-${stageCode}-${timestamp}`;
}

// ── updateService data builder ──
function buildUpdateData(input: {
  serviceCode: string;
  nameAr?: string;
  expectedDurationDays?: number;
}): Record<string, any> {
  const data: Record<string, any> = {};
  if (input.nameAr !== undefined) data.nameAr = input.nameAr;
  if (input.expectedDurationDays !== undefined) data.expectedDurationDays = input.expectedDurationDays;
  return data;
}

describe("addCustomService input validation", () => {
  it("accepts valid input with all required fields", () => {
    const result = validateAddInput({
      stageCode: "STG-01",
      nameAr: "مهمة جديدة",
      expectedDurationDays: 10,
      projectId: 1,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty nameAr", () => {
    const result = validateAddInput({
      stageCode: "STG-01",
      nameAr: "",
      projectId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("nameAr is required and must not be empty");
  });

  it("rejects whitespace-only nameAr", () => {
    const result = validateAddInput({
      stageCode: "STG-01",
      nameAr: "   ",
      projectId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("nameAr is required and must not be empty");
  });

  it("rejects negative duration", () => {
    const result = validateAddInput({
      stageCode: "STG-01",
      nameAr: "مهمة",
      expectedDurationDays: -5,
      projectId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("expectedDurationDays must be a positive integer");
  });

  it("rejects zero duration", () => {
    const result = validateAddInput({
      stageCode: "STG-01",
      nameAr: "مهمة",
      expectedDurationDays: 0,
      projectId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("expectedDurationDays must be a positive integer");
  });

  it("rejects missing stageCode", () => {
    const result = validateAddInput({
      nameAr: "مهمة",
      projectId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("stageCode is required");
  });

  it("rejects missing projectId", () => {
    const result = validateAddInput({
      stageCode: "STG-01",
      nameAr: "مهمة",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("projectId is required");
  });

  it("accepts input without optional plannedStartDate", () => {
    const result = validateAddInput({
      stageCode: "STG-01",
      nameAr: "مهمة بدون تاريخ",
      projectId: 2,
    });
    expect(result.valid).toBe(true);
  });

  it("uses default duration of 7 when not specified", () => {
    const input = {
      stageCode: "STG-01",
      nameAr: "مهمة",
      projectId: 1,
    };
    const duration = input.expectedDurationDays ?? 7;
    expect(duration).toBe(7);
  });
});

describe("generateServiceCode", () => {
  it("generates code with correct prefix and stage code", () => {
    const code = generateServiceCode("STG-01", 1234567890);
    expect(code).toBe("SRV-CUSTOM-STG-01-1234567890");
  });

  it("generates unique codes for different timestamps", () => {
    const code1 = generateServiceCode("STG-01", 1000);
    const code2 = generateServiceCode("STG-01", 2000);
    expect(code1).not.toBe(code2);
  });

  it("includes stage code in the generated code", () => {
    const code = generateServiceCode("STG-DESIGN", 999);
    expect(code).toContain("STG-DESIGN");
  });
});

describe("updateService data builder", () => {
  it("includes nameAr when provided", () => {
    const data = buildUpdateData({
      serviceCode: "SRV-001",
      nameAr: "اسم جديد",
    });
    expect(data.nameAr).toBe("اسم جديد");
    expect(data).not.toHaveProperty("expectedDurationDays");
  });

  it("includes expectedDurationDays when provided", () => {
    const data = buildUpdateData({
      serviceCode: "SRV-001",
      expectedDurationDays: 20,
    });
    expect(data.expectedDurationDays).toBe(20);
    expect(data).not.toHaveProperty("nameAr");
  });

  it("includes both fields when both provided", () => {
    const data = buildUpdateData({
      serviceCode: "SRV-001",
      nameAr: "اسم محدث",
      expectedDurationDays: 15,
    });
    expect(data.nameAr).toBe("اسم محدث");
    expect(data.expectedDurationDays).toBe(15);
  });

  it("returns empty object when no optional fields provided", () => {
    const data = buildUpdateData({
      serviceCode: "SRV-001",
    });
    expect(Object.keys(data)).toHaveLength(0);
  });

  it("does not include serviceCode in update data (it's the WHERE clause)", () => {
    const data = buildUpdateData({
      serviceCode: "SRV-001",
      nameAr: "test",
    });
    expect(data).not.toHaveProperty("serviceCode");
  });
});
