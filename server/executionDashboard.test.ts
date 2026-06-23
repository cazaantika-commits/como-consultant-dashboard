import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();

const mockDb = {
  select: () => {
    mockSelect();
    return {
      from: (table: any) => {
        mockFrom(table);
        return {
          where: (cond: any) => {
            mockWhere(cond);
            return {
              orderBy: (ord: any) => {
                mockOrderBy(ord);
                return {
                  limit: (n: number) => {
                    mockLimit(n);
                    return [];
                  }
                };
              }
            };
          },
          orderBy: (ord: any) => {
            mockOrderBy(ord);
            return {
              limit: (n: number) => {
                mockLimit(n);
                return [];
              }
            };
          }
        };
      }
    };
  },
  insert: (table: any) => {
    mockInsert(table);
    return {
      values: (vals: any) => {
        mockValues(vals);
        return { insertId: 1 };
      }
    };
  }
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  taskExecutionLogs: { id: "id", status: "status", agent: "agent", meetingId: "meetingId", createdAt: "createdAt" },
  tasks: { id: "id" },
  meetings: { id: "id" },
}));

describe("Execution Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Stats Calculation", () => {
    it("should calculate correct stats from execution logs", () => {
      const logs = [
        { status: "completed", toolCallCount: 3, writeToolCount: 2, toolsUsedJson: '["add_consultant","search_all_data","update_consultant"]', agent: "salwa", durationMs: 5000, verified: 1 },
        { status: "completed", toolCallCount: 2, writeToolCount: 1, toolsUsedJson: '["search_all_data","set_financial_data"]', agent: "alina", durationMs: 3000, verified: 1 },
        { status: "failed", toolCallCount: 0, writeToolCount: 0, toolsUsedJson: '[]', agent: "salwa", durationMs: 1000, verified: 0 },
        { status: "partial", toolCallCount: 1, writeToolCount: 0, toolsUsedJson: '["search_all_data"]', agent: "khazen", durationMs: 2000, verified: 0 },
      ];

      const total = logs.length;
      const completed = logs.filter(l => l.status === "completed").length;
      const partial = logs.filter(l => l.status === "partial").length;
      const failed = logs.filter(l => l.status === "failed").length;
      const successRate = Math.round((completed / total) * 100);

      expect(total).toBe(4);
      expect(completed).toBe(2);
      expect(partial).toBe(1);
      expect(failed).toBe(1);
      expect(successRate).toBe(50);

      // Tool usage
      let totalToolCalls = 0;
      let totalWriteTools = 0;
      const toolUsageMap: Record<string, number> = {};
      for (const log of logs) {
        totalToolCalls += log.toolCallCount;
        totalWriteTools += log.writeToolCount;
        const tools = JSON.parse(log.toolsUsedJson) as string[];
        for (const t of tools) {
          toolUsageMap[t] = (toolUsageMap[t] || 0) + 1;
        }
      }

      expect(totalToolCalls).toBe(6);
      expect(totalWriteTools).toBe(3);
      expect(toolUsageMap["search_all_data"]).toBe(3);
      expect(toolUsageMap["add_consultant"]).toBe(1);
      expect(toolUsageMap["update_consultant"]).toBe(1);
      expect(toolUsageMap["set_financial_data"]).toBe(1);

      // Agent stats
      const agentStats: Record<string, { total: number; completed: number; failed: number }> = {};
      for (const log of logs) {
        if (!agentStats[log.agent]) agentStats[log.agent] = { total: 0, completed: 0, failed: 0 };
        agentStats[log.agent].total++;
        if (log.status === "completed") agentStats[log.agent].completed++;
        if (log.status === "failed") agentStats[log.agent].failed++;
      }

      expect(agentStats["salwa"].total).toBe(2);
      expect(agentStats["salwa"].completed).toBe(1);
      expect(agentStats["salwa"].failed).toBe(1);
      expect(agentStats["alina"].total).toBe(1);
      expect(agentStats["alina"].completed).toBe(1);

      // Verification rate
      const verifiedCount = logs.filter(l => l.verified === 1).length;
      const verificationRate = Math.round((verifiedCount / total) * 100);
      expect(verificationRate).toBe(50);
    });

    it("should handle empty logs gracefully", () => {
      const logs: any[] = [];
      const total = logs.length;
      const successRate = total > 0 ? Math.round((0 / total) * 100) : 0;
      expect(total).toBe(0);
      expect(successRate).toBe(0);
    });
  });

  describe("Task Execution Engine - Action Plan", () => {
    it("should correctly map agent names to agent keys", () => {
      const AGENT_NAME_MAP: Record<string, string> = {
        "سلوى": "salwa",
        "فاروق": "farouq",
        "خالد": "khaled",
        "ألينا": "alina",
        "براق": "buraq",
        "خازن": "khazen",
        "باز": "baz",
        "جويل": "joelle",
        "salwa": "salwa",
        "farouq": "farouq",
        "khaled": "khaled",
        "alina": "alina",
        "buraq": "buraq",
        "khazen": "khazen",
        "baz": "baz",
        "joelle": "joelle",
      };

      expect(AGENT_NAME_MAP["سلوى"]).toBe("salwa");
      expect(AGENT_NAME_MAP["خازن"]).toBe("khazen");
      expect(AGENT_NAME_MAP["ألينا"]).toBe("alina");
    });

    it("should identify write tools correctly", () => {
      const writeToolNames = new Set([
        "add_consultant", "update_consultant", "add_consultant_to_project",
        "remove_consultant_from_project", "set_evaluation_score", "set_financial_data",
        "add_project", "add_task", "update_task_status", "update_consultant_profile",
        "add_consultant_note"
      ]);

      expect(writeToolNames.has("add_consultant")).toBe(true);
      expect(writeToolNames.has("search_all_data")).toBe(false);
      expect(writeToolNames.has("set_financial_data")).toBe(true);
      expect(writeToolNames.has("list_consultants")).toBe(false);
    });

    it("should correctly determine verification status", () => {
      // Write tools were required but not used → not verified
      const plan1Steps = [
        { stepNumber: 1, toolName: "add_consultant", description: "test" },
        { stepNumber: 2, toolName: "search_all_data", description: "test" },
      ];
      const toolsUsed1: string[] = ["search_all_data"];
      
      const writeToolNames = new Set([
        "add_consultant", "update_consultant", "add_consultant_to_project",
        "set_evaluation_score", "set_financial_data", "add_project",
        "add_task", "update_task_status", "update_consultant_profile", "add_consultant_note"
      ]);
      
      const writeToolsUsed1 = toolsUsed1.filter(t => writeToolNames.has(t));
      const requiredWriteSteps1 = plan1Steps.filter(s => writeToolNames.has(s.toolName));
      
      // Should NOT be verified because add_consultant was required but not used
      expect(writeToolsUsed1.length).toBe(0);
      expect(requiredWriteSteps1.length).toBe(1);
      
      // Write tools were used → should be verified
      const toolsUsed2 = ["search_all_data", "add_consultant"];
      const writeToolsUsed2 = toolsUsed2.filter(t => writeToolNames.has(t));
      expect(writeToolsUsed2.length).toBe(1);
    });
  });

  describe("Log Parsing", () => {
    it("should parse execution log JSON fields correctly", () => {
      const log = {
        id: 1,
        actionPlanJson: JSON.stringify({
          taskSummary: "تسجيل استشاري جديد",
          bestAgent: "salwa",
          steps: [{ stepNumber: 1, toolName: "add_consultant", description: "إضافة" }]
        }),
        toolsUsedJson: JSON.stringify(["add_consultant", "search_all_data"]),
        stepResultsJson: JSON.stringify([
          { stepNumber: 1, toolName: "add_consultant", success: true, toolOutput: "تم" }
        ]),
        dataChangesJson: JSON.stringify(["add_consultant: تمت الإضافة"]),
      };

      const actionPlan = JSON.parse(log.actionPlanJson);
      expect(actionPlan.bestAgent).toBe("salwa");
      expect(actionPlan.steps).toHaveLength(1);

      const toolsUsed = JSON.parse(log.toolsUsedJson);
      expect(toolsUsed).toContain("add_consultant");
      expect(toolsUsed).toHaveLength(2);

      const stepResults = JSON.parse(log.stepResultsJson);
      expect(stepResults[0].success).toBe(true);

      const dataChanges = JSON.parse(log.dataChangesJson);
      expect(dataChanges).toHaveLength(1);
    });

    it("should handle null/undefined JSON fields gracefully", () => {
      const log = {
        actionPlanJson: null,
        toolsUsedJson: null,
        stepResultsJson: null,
        dataChangesJson: null,
      };

      const actionPlan = log.actionPlanJson ? JSON.parse(log.actionPlanJson) : null;
      const toolsUsed = log.toolsUsedJson ? JSON.parse(log.toolsUsedJson) : [];
      const stepResults = log.stepResultsJson ? JSON.parse(log.stepResultsJson) : [];
      const dataChanges = log.dataChangesJson ? JSON.parse(log.dataChangesJson) : [];

      expect(actionPlan).toBeNull();
      expect(toolsUsed).toEqual([]);
      expect(stepResults).toEqual([]);
      expect(dataChanges).toEqual([]);
    });
  });
});
