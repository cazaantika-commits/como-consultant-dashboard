import { describe, it, expect, vi } from "vitest";

// Test the agent dashboard data structures and filtering logic

describe("Agent Dashboard", () => {
  // Status mapping
  const STATUS_MAP: Record<string, string> = {
    new: "لم تبدأ",
    progress: "قيد التنفيذ",
    hold: "معلقة",
    done: "مكتملة",
    cancelled: "ملغاة",
  };

  const PRIORITY_MAP: Record<string, string> = {
    high: "عالية",
    medium: "متوسطة",
    low: "منخفضة",
  };

  const AGENT_INFO: Record<string, { role: string }> = {
    "قاسم": { role: "وكيل الأرشفة والتنظيم" },
    "سلوى": { role: "وكيلة التقييم والتحليل" },
  };

  // Mock tasks
  const mockAgentTasks = [
    { id: 1, title: "أرشفة ملفات Al Jaddaf", project: "Al Jaddaf", owner: "أحمد", priority: "high", status: "progress", progress: 50, source: "agent", sourceAgent: "قاسم", dueDate: "2026-03-01", createdAt: "2026-02-18T10:00:00Z" },
    { id: 2, title: "تقييم عرض Datum", project: "Al Jaddaf", owner: "سارة", priority: "medium", status: "done", progress: 100, source: "agent", sourceAgent: "سلوى", dueDate: "2026-02-15", createdAt: "2026-02-17T10:00:00Z" },
    { id: 3, title: "تنظيم مجلد Majan", project: "Majan Building", owner: "أحمد", priority: "low", status: "new", progress: 0, source: "agent", sourceAgent: "قاسم", dueDate: "2026-03-10", createdAt: "2026-02-18T12:00:00Z" },
    { id: 4, title: "تحليل عرض Realistic", project: "Nad Al Sheba", owner: "سارة", priority: "high", status: "hold", progress: 30, source: "agent", sourceAgent: "سلوى", dueDate: "2026-02-20", createdAt: "2026-02-16T10:00:00Z" },
    { id: 5, title: "مراجعة عقود المول", project: "Mall", owner: "محمد", priority: "medium", status: "cancelled", progress: 0, source: "agent", sourceAgent: "قاسم", dueDate: null, createdAt: "2026-02-15T10:00:00Z" },
    { id: 6, title: "مهمة يدوية", project: "Al Jaddaf", owner: "أحمد", priority: "high", status: "new", progress: 0, source: "manual", sourceAgent: null, dueDate: null, createdAt: "2026-02-18T14:00:00Z" },
  ];

  describe("Filter: agent tasks only", () => {
    it("should filter only agent-sourced tasks", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      expect(agentTasks.length).toBe(5);
      expect(agentTasks.every((t) => t.source === "agent")).toBe(true);
    });

    it("should exclude manual tasks", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      expect(agentTasks.find((t) => t.source === "manual")).toBeUndefined();
    });
  });

  describe("Filter: by agent name", () => {
    it("should filter tasks by قاسم", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const qasimTasks = agentTasks.filter((t) => t.sourceAgent === "قاسم");
      expect(qasimTasks.length).toBe(3);
      expect(qasimTasks.every((t) => t.sourceAgent === "قاسم")).toBe(true);
    });

    it("should filter tasks by سلوى", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const salwaTasks = agentTasks.filter((t) => t.sourceAgent === "سلوى");
      expect(salwaTasks.length).toBe(2);
      expect(salwaTasks.every((t) => t.sourceAgent === "سلوى")).toBe(true);
    });
  });

  describe("Filter: by status", () => {
    it("should filter tasks by status 'progress'", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const progressTasks = agentTasks.filter((t) => t.status === "progress");
      expect(progressTasks.length).toBe(1);
      expect(progressTasks[0].title).toBe("أرشفة ملفات Al Jaddaf");
    });

    it("should filter tasks by status 'done'", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const doneTasks = agentTasks.filter((t) => t.status === "done");
      expect(doneTasks.length).toBe(1);
    });

    it("should filter tasks by status 'new'", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const newTasks = agentTasks.filter((t) => t.status === "new");
      expect(newTasks.length).toBe(1);
    });
  });

  describe("Filter: by priority", () => {
    it("should filter high priority tasks", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const highPriority = agentTasks.filter((t) => t.priority === "high");
      expect(highPriority.length).toBe(2);
    });

    it("should filter medium priority tasks", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const medPriority = agentTasks.filter((t) => t.priority === "medium");
      expect(medPriority.length).toBe(2);
    });
  });

  describe("Filter: combined filters", () => {
    it("should filter by agent + status", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const result = agentTasks.filter((t) => t.sourceAgent === "قاسم" && t.status === "progress");
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("أرشفة ملفات Al Jaddaf");
    });

    it("should filter by agent + priority", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const result = agentTasks.filter((t) => t.sourceAgent === "سلوى" && t.priority === "high");
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("تحليل عرض Realistic");
    });

    it("should filter by search query", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const q = "datum";
      const result = agentTasks.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.project?.toLowerCase().includes(q)
      );
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("تقييم عرض Datum");
    });
  });

  describe("Stats calculations", () => {
    it("should calculate correct stats for agent tasks", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const total = agentTasks.length;
      const newCount = agentTasks.filter((t) => t.status === "new").length;
      const progressCount = agentTasks.filter((t) => t.status === "progress").length;
      const holdCount = agentTasks.filter((t) => t.status === "hold").length;
      const doneCount = agentTasks.filter((t) => t.status === "done").length;
      const cancelledCount = agentTasks.filter((t) => t.status === "cancelled").length;
      const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      expect(total).toBe(5);
      expect(newCount).toBe(1);
      expect(progressCount).toBe(1);
      expect(holdCount).toBe(1);
      expect(doneCount).toBe(1);
      expect(cancelledCount).toBe(1);
      expect(completionRate).toBe(20);
    });

    it("should calculate overdue tasks correctly", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const today = "2026-02-18";
      const overdueCount = agentTasks.filter(
        (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "cancelled"
      ).length;
      // Task 4 has dueDate 2026-02-20 which is NOT overdue on 2026-02-18
      // Task 2 has dueDate 2026-02-15 but is "done" so not overdue
      expect(overdueCount).toBe(0);
    });

    it("should detect overdue when date has passed", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const today = "2026-03-15"; // future date
      const overdueCount = agentTasks.filter(
        (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "cancelled"
      ).length;
      // Task 1: 2026-03-01 < 2026-03-15 and status=progress → overdue
      // Task 3: 2026-03-10 < 2026-03-15 and status=new → overdue
      // Task 4: 2026-02-20 < 2026-03-15 and status=hold → overdue
      expect(overdueCount).toBe(3);
    });
  });

  describe("Agent stats by agent", () => {
    it("should calculate per-agent stats", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const byAgent: Record<string, { total: number; new: number; progress: number; done: number }> = {};
      for (const t of agentTasks) {
        const name = t.sourceAgent || "غير معروف";
        if (!byAgent[name]) byAgent[name] = { total: 0, new: 0, progress: 0, done: 0 };
        byAgent[name].total++;
        if (t.status === "new") byAgent[name].new++;
        if (t.status === "progress") byAgent[name].progress++;
        if (t.status === "done") byAgent[name].done++;
      }

      expect(byAgent["قاسم"].total).toBe(3);
      expect(byAgent["قاسم"].progress).toBe(1);
      expect(byAgent["قاسم"].new).toBe(1);
      expect(byAgent["سلوى"].total).toBe(2);
      expect(byAgent["سلوى"].done).toBe(1);
    });
  });

  describe("Project distribution", () => {
    it("should calculate project distribution correctly", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const dist: Record<string, number> = {};
      agentTasks.forEach((t) => {
        dist[t.project] = (dist[t.project] || 0) + 1;
      });
      const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);

      expect(sorted[0][0]).toBe("Al Jaddaf");
      expect(sorted[0][1]).toBe(2);
      expect(Object.keys(dist).length).toBe(4); // 4 unique projects
    });
  });

  describe("Status and Priority maps", () => {
    it("should have all required statuses", () => {
      expect(STATUS_MAP["new"]).toBe("لم تبدأ");
      expect(STATUS_MAP["progress"]).toBe("قيد التنفيذ");
      expect(STATUS_MAP["hold"]).toBe("معلقة");
      expect(STATUS_MAP["done"]).toBe("مكتملة");
      expect(STATUS_MAP["cancelled"]).toBe("ملغاة");
    });

    it("should have all required priorities", () => {
      expect(PRIORITY_MAP["high"]).toBe("عالية");
      expect(PRIORITY_MAP["medium"]).toBe("متوسطة");
      expect(PRIORITY_MAP["low"]).toBe("منخفضة");
    });
  });

  describe("Agent info", () => {
    it("should have info for قاسم and سلوى", () => {
      expect(AGENT_INFO["قاسم"]).toBeDefined();
      expect(AGENT_INFO["قاسم"].role).toBe("وكيل الأرشفة والتنظيم");
      expect(AGENT_INFO["سلوى"]).toBeDefined();
      expect(AGENT_INFO["سلوى"].role).toBe("وكيلة التقييم والتحليل");
    });
  });

  describe("Unique agents extraction", () => {
    it("should extract unique agent names", () => {
      const agentTasks = mockAgentTasks.filter((t) => t.source === "agent");
      const agents = new Set(agentTasks.map((t) => t.sourceAgent).filter(Boolean));
      const uniqueAgents = Array.from(agents);
      expect(uniqueAgents.length).toBe(2);
      expect(uniqueAgents).toContain("قاسم");
      expect(uniqueAgents).toContain("سلوى");
    });
  });
});
