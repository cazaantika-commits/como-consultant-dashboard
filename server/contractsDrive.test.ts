import { describe, it, expect, vi } from "vitest";

describe("Contracts - Save to Drive & File Upload", () => {
  it("should have saveToDrive procedure defined in contracts router", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("contracts.saveToDrive");
  });

  it("should have uploadFile procedure defined in contracts router", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("contracts.uploadFile");
  });

  it("should have analyzeContract procedure defined in contracts router", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("contracts.analyzeContract");
  });

  it("saveToDrive should be a mutation procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedure = (appRouter._def.procedures as any)["contracts.saveToDrive"];
    expect(procedure).toBeDefined();
    // Check it's a procedure with _def
    expect(procedure._def).toBeDefined();
    expect(procedure._def.type).toBe("mutation");
  });

  it("uploadFile should be a mutation procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedure = (appRouter._def.procedures as any)["contracts.uploadFile"];
    expect(procedure).toBeDefined();
    expect(procedure._def).toBeDefined();
    expect(procedure._def.type).toBe("mutation");
  });

  it("analyzeContract should be a mutation procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedure = (appRouter._def.procedures as any)["contracts.analyzeContract"];
    expect(procedure).toBeDefined();
    expect(procedure._def).toBeDefined();
    expect(procedure._def.type).toBe("mutation");
  });

  it("contracts router should have all CRUD operations", async () => {
    const { appRouter } = await import("./routers");
    const procedures = appRouter._def.procedures;
    expect(procedures).toHaveProperty("contracts.list");
    expect(procedures).toHaveProperty("contracts.add");
    expect(procedures).toHaveProperty("contracts.update");
    expect(procedures).toHaveProperty("contracts.delete");
  });

  it("contracts router should have stats and type management", async () => {
    const { appRouter } = await import("./routers");
    const procedures = appRouter._def.procedures;
    expect(procedures).toHaveProperty("contracts.stats");
    expect(procedures).toHaveProperty("contracts.listTypes");
    expect(procedures).toHaveProperty("contracts.addType");
    expect(procedures).toHaveProperty("contracts.updateType");
    expect(procedures).toHaveProperty("contracts.deleteType");
  });
});
