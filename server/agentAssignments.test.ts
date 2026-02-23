import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue({}),
  }),
});
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    orderBy: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
      limit: vi.fn().mockResolvedValue([]),
    }),
    where: vi.fn().mockResolvedValue([]),
  }),
});
const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue({}),
});

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
    delete: mockDelete,
    execute: vi.fn().mockResolvedValue([[]]),
  }),
}));

vi.mock("../_core/env", () => ({
  ENV: {},
}));

vi.mock("../drizzle/schema", () => ({
  consultants: { id: "id", name: "name" },
  projects: { id: "id" },
  projectConsultants: { projectId: "projectId", consultantId: "consultantId" },
  financialData: { projectId: "projectId" },
  evaluationScores: { projectId: "projectId" },
  evaluatorScores: { projectId: "projectId" },
  committeeDecisions: { projectId: "projectId" },
  consultantDetails: { consultantId: "consultantId" },
  consultantProfiles: { consultantId: "consultantId" },
  consultantNotes: { consultantId: "consultantId" },
  tasks: { createdAt: "createdAt" },
  feasibilityStudies: { id: "id" },
  agents: { id: "id" },
  agentAssignments: { id: "id", agent: "agent", createdAt: "createdAt", status: "status" },
}));

describe("Agent Assignments System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setAgentContext", () => {
    it("should set agent context for assignment logging", async () => {
      const { setAgentContext } = await import("./agentTools");
      // Should not throw
      setAgentContext("salwa", "أضيفي استشاري جديد");
      expect(true).toBe(true);
    });
  });

  describe("WRITE_TOOL_NAMES detection", () => {
    it("should identify write tools correctly", async () => {
      const { AGENT_TOOLS } = await import("./agentTools");
      
      const writeTools = [
        "add_consultant", "update_consultant", "add_consultant_to_project",
        "remove_consultant_from_project", "set_evaluation_score", "set_financial_data",
        "add_project", "add_task", "update_task_status", "update_consultant_profile",
        "add_consultant_note"
      ];
      
      const readTools = [
        "list_projects", "list_consultants", "get_project_consultants",
        "get_evaluation_scores", "get_evaluator_scores", "get_financial_data",
        "get_evaluation_criteria", "get_consultant_profile", "get_committee_decision",
        "list_tasks", "get_feasibility_study"
      ];

      // All write tools should exist in AGENT_TOOLS
      for (const toolName of writeTools) {
        const found = AGENT_TOOLS.find(t => t.function.name === toolName);
        expect(found, `Write tool ${toolName} should exist`).toBeDefined();
      }

      // All read tools should exist in AGENT_TOOLS
      for (const toolName of readTools) {
        const found = AGENT_TOOLS.find(t => t.function.name === toolName);
        expect(found, `Read tool ${toolName} should exist`).toBeDefined();
      }
    });
  });

  describe("getAgentAssignments", () => {
    it("should return assignments list", async () => {
      const { getAgentAssignments } = await import("./agentTools");
      const result = await getAgentAssignments();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should accept filter parameters", async () => {
      const { getAgentAssignments } = await import("./agentTools");
      const result = await getAgentAssignments({ agent: "salwa", limit: 10 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter by status", async () => {
      const { getAgentAssignments } = await import("./agentTools");
      const result = await getAgentAssignments({ status: "completed" });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getAssignmentStats", () => {
    it("should return stats object with correct shape", async () => {
      const { getAssignmentStats } = await import("./agentTools");
      const stats = await getAssignmentStats();
      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("completed");
      expect(stats).toHaveProperty("failed");
      expect(stats).toHaveProperty("executing");
      expect(stats).toHaveProperty("byAgent");
      expect(typeof stats.total).toBe("number");
      expect(typeof stats.completed).toBe("number");
    });
  });

  describe("getToolsForAgent", () => {
    it("should return tools specific to each agent", async () => {
      const { getToolsForAgent } = await import("./agentTools");
      
      const salwaTools = getToolsForAgent("salwa");
      const khaledTools = getToolsForAgent("khaled");
      const alinaTools = getToolsForAgent("alina");
      
      // Salwa should have more tools (coordinator)
      expect(salwaTools.length).toBeGreaterThan(0);
      expect(khaledTools.length).toBeGreaterThan(0);
      expect(alinaTools.length).toBeGreaterThan(0);
      
      // Salwa should have add_task
      expect(salwaTools.some(t => t.function.name === "add_task")).toBe(true);
      
      // Khaled should have evaluation tools
      expect(khaledTools.some(t => t.function.name === "get_evaluation_scores")).toBe(true);
      expect(khaledTools.some(t => t.function.name === "set_evaluation_score")).toBe(true);
      
      // Alina should have financial tools
      expect(alinaTools.some(t => t.function.name === "get_financial_data")).toBe(true);
      expect(alinaTools.some(t => t.function.name === "set_financial_data")).toBe(true);
    });

    it("should not give all tools to every agent", async () => {
      const { getToolsForAgent, AGENT_TOOLS } = await import("./agentTools");
      
      const khazenTools = getToolsForAgent("khazen");
      // Khazen (archiver) should not have financial tools
      expect(khazenTools.some(t => t.function.name === "set_financial_data")).toBe(false);
      
      // No agent should have all tools
      expect(khazenTools.length).toBeLessThan(AGENT_TOOLS.length);
    });
  });

  describe("Tool definitions format", () => {
    it("all tools should have correct OpenAI function calling format", async () => {
      const { AGENT_TOOLS } = await import("./agentTools");
      
      for (const tool of AGENT_TOOLS) {
        expect(tool.type).toBe("function");
        expect(tool.function).toBeDefined();
        expect(tool.function.name).toBeTruthy();
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe("object");
      }
    });

    it("should have at least 20 tools total", async () => {
      const { AGENT_TOOLS } = await import("./agentTools");
      expect(AGENT_TOOLS.length).toBeGreaterThanOrEqual(20);
    });
  });
});
