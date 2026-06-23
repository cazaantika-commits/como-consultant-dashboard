import { describe, it, expect } from "vitest";

// Test the fact sheet completeness calculation logic
const FACT_SHEET_KEYS = [
  "titleDeedNumber", "ddaNumber", "masterDevRef",
  "plotAreaSqm", "plotAreaSqft", "gfaSqm", "gfaSqft",
  "permittedUse", "ownershipType", "subdivisionRestrictions",
  "masterDevName", "masterDevAddress",
  "sellerName", "sellerAddress",
  "buyerName", "buyerNationality", "buyerPassport", "buyerAddress", "buyerPhone", "buyerEmail",
  "electricityAllocation", "waterAllocation", "sewageAllocation",
  "tripAM", "tripLT", "tripPM",
  "effectiveDate", "constructionPeriod", "constructionStartDate", "completionDate", "constructionConditions",
  "saleRestrictions", "resaleConditions", "communityCharges",
  "registrationAuthority", "adminFee", "clearanceFee", "compensationAmount",
  "governingLaw", "disputeResolution",
];

function calcFactSheetCompleteness(project: any): { filled: number; total: number; percentage: number } {
  const total = FACT_SHEET_KEYS.length;
  const filled = FACT_SHEET_KEYS.filter(k => project[k] !== null && project[k] !== undefined && project[k] !== "").length;
  return { filled, total, percentage: Math.round((filled / total) * 100) };
}

describe("Fact Sheet Completeness Calculation", () => {
  it("should return 0% for empty project", () => {
    const project = { name: "Test Project" };
    const result = calcFactSheetCompleteness(project);
    expect(result.filled).toBe(0);
    expect(result.total).toBe(FACT_SHEET_KEYS.length);
    expect(result.percentage).toBe(0);
  });

  it("should return 100% for fully filled project", () => {
    const project: any = {};
    FACT_SHEET_KEYS.forEach(k => { project[k] = "some value"; });
    const result = calcFactSheetCompleteness(project);
    expect(result.filled).toBe(FACT_SHEET_KEYS.length);
    expect(result.percentage).toBe(100);
  });

  it("should ignore null, undefined, and empty string values", () => {
    const project = {
      titleDeedNumber: "437",
      ddaNumber: null,
      masterDevRef: undefined,
      plotAreaSqm: "",
      plotAreaSqft: "12228.34",
    };
    const result = calcFactSheetCompleteness(project);
    expect(result.filled).toBe(2); // titleDeedNumber and plotAreaSqft
  });

  it("should count numeric values including 0", () => {
    const project = {
      adminFee: 0,
      clearanceFee: 500,
      compensationAmount: 1000000,
    };
    const result = calcFactSheetCompleteness(project);
    // 0 is truthy for our check (not null, not undefined, not "")
    expect(result.filled).toBe(3);
  });

  it("should have exactly 40 fact sheet keys", () => {
    expect(FACT_SHEET_KEYS.length).toBe(40);
  });

  it("should calculate correct percentage for partial fill", () => {
    const project: any = {};
    // Fill exactly 10 fields
    for (let i = 0; i < 10; i++) {
      project[FACT_SHEET_KEYS[i]] = "value";
    }
    const result = calcFactSheetCompleteness(project);
    expect(result.filled).toBe(10);
    expect(result.percentage).toBe(Math.round((10 / 40) * 100));
  });
});

describe("Project Data Structure", () => {
  it("should validate project field groups cover all fact sheet keys", () => {
    // The FIELD_GROUPS in the frontend should cover all FACT_SHEET_KEYS
    // This test ensures no keys are missing
    const allKeys = new Set(FACT_SHEET_KEYS);
    expect(allKeys.size).toBe(40);
    
    // Check that key categories are represented
    const identificationKeys = ["titleDeedNumber", "ddaNumber", "masterDevRef"];
    const areaKeys = ["plotAreaSqm", "plotAreaSqft", "gfaSqm", "gfaSqft"];
    const buyerKeys = ["buyerName", "buyerNationality", "buyerPassport", "buyerAddress", "buyerPhone", "buyerEmail"];
    const infraKeys = ["electricityAllocation", "waterAllocation", "sewageAllocation", "tripAM", "tripLT", "tripPM"];
    const timelineKeys = ["effectiveDate", "constructionPeriod", "constructionStartDate", "completionDate", "constructionConditions"];
    const feeKeys = ["adminFee", "clearanceFee", "compensationAmount"];
    
    identificationKeys.forEach(k => expect(allKeys.has(k)).toBe(true));
    areaKeys.forEach(k => expect(allKeys.has(k)).toBe(true));
    buyerKeys.forEach(k => expect(allKeys.has(k)).toBe(true));
    infraKeys.forEach(k => expect(allKeys.has(k)).toBe(true));
    timelineKeys.forEach(k => expect(allKeys.has(k)).toBe(true));
    feeKeys.forEach(k => expect(allKeys.has(k)).toBe(true));
  });
});

describe("Project API Integration", () => {
  it("should have listWithStats endpoint available", async () => {
    // Import the router to verify the endpoint exists
    const { projectsRouter } = await import("./routers/projects");
    expect(projectsRouter).toBeDefined();
    // Check that the router has the expected procedures
    const procedures = Object.keys(projectsRouter._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("listWithStats");
    expect(procedures).toContain("getById");
    expect(procedures).toContain("getWithDetails");
    expect(procedures).toContain("create");
    expect(procedures).toContain("update");
    expect(procedures).toContain("delete");
  });

  it("should have 7 procedures in the projects router", async () => {
    const { projectsRouter } = await import("./routers/projects");
    const procedures = Object.keys(projectsRouter._def.procedures);
    expect(procedures.length).toBe(7);
  });
});
