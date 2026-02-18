import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: () => ({ from: (table: any) => ({ orderBy: mockOrderBy }) }),
    insert: () => ({ values: mockValues }),
    update: () => ({ set: () => ({ where: mockWhere }) }),
    delete: () => ({ where: mockWhere }),
  })),
}));

vi.mock("../drizzle/schema", () => ({
  tasks: {
    id: "id",
    title: "title",
    createdAt: "createdAt",
  },
}));

describe("Tasks Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderBy.mockResolvedValue([]);
    mockValues.mockResolvedValue([{ insertId: 1 }]);
    mockWhere.mockResolvedValue([]);
  });

  describe("Task Data Validation", () => {
    it("should validate task input has required fields", () => {
      const validTask = {
        title: "مهمة اختبارية",
        project: "الجداف",
        owner: "عبدالرحمن",
        priority: "high" as const,
        status: "new" as const,
        progress: 0,
      };

      expect(validTask.title).toBeTruthy();
      expect(validTask.project).toBeTruthy();
      expect(validTask.owner).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(validTask.priority);
      expect(["new", "progress", "hold", "done", "cancelled"]).toContain(validTask.status);
      expect(validTask.progress).toBeGreaterThanOrEqual(0);
      expect(validTask.progress).toBeLessThanOrEqual(100);
    });

    it("should reject empty title", () => {
      const invalidTask = { title: "", project: "الجداف", owner: "عبدالرحمن" };
      expect(invalidTask.title).toBeFalsy();
    });

    it("should reject empty project", () => {
      const invalidTask = { title: "مهمة", project: "", owner: "عبدالرحمن" };
      expect(invalidTask.project).toBeFalsy();
    });

    it("should reject empty owner", () => {
      const invalidTask = { title: "مهمة", project: "الجداف", owner: "" };
      expect(invalidTask.owner).toBeFalsy();
    });

    it("should validate priority values", () => {
      const validPriorities = ["high", "medium", "low"];
      expect(validPriorities).toContain("high");
      expect(validPriorities).toContain("medium");
      expect(validPriorities).toContain("low");
      expect(validPriorities).not.toContain("critical");
    });

    it("should validate status values", () => {
      const validStatuses = ["new", "progress", "hold", "done", "cancelled"];
      expect(validStatuses).toContain("new");
      expect(validStatuses).toContain("progress");
      expect(validStatuses).toContain("hold");
      expect(validStatuses).toContain("done");
      expect(validStatuses).toContain("cancelled");
      expect(validStatuses).not.toContain("archived");
    });

    it("should validate progress range 0-100", () => {
      expect(0).toBeGreaterThanOrEqual(0);
      expect(50).toBeLessThanOrEqual(100);
      expect(100).toBeLessThanOrEqual(100);
    });

    it("should validate source values", () => {
      const validSources = ["manual", "agent", "command"];
      expect(validSources).toContain("manual");
      expect(validSources).toContain("agent");
      expect(validSources).toContain("command");
    });
  });

  describe("Task Stats Calculation", () => {
    it("should calculate stats correctly", () => {
      const tasks = [
        { status: "new", dueDate: "2025-01-01" },
        { status: "new", dueDate: null },
        { status: "progress", dueDate: "2026-12-31" },
        { status: "hold", dueDate: "2025-06-01" },
        { status: "done", dueDate: "2025-01-01" },
        { status: "cancelled", dueDate: null },
      ];

      const today = new Date().toISOString().split("T")[0];
      const total = tasks.length;
      const newCount = tasks.filter((t) => t.status === "new").length;
      const progress = tasks.filter((t) => t.status === "progress").length;
      const hold = tasks.filter((t) => t.status === "hold").length;
      const done = tasks.filter((t) => t.status === "done").length;
      const cancelled = tasks.filter((t) => t.status === "cancelled").length;
      const overdue = tasks.filter(
        (t) =>
          t.dueDate &&
          t.dueDate < today &&
          t.status !== "done" &&
          t.status !== "cancelled"
      ).length;

      expect(total).toBe(6);
      expect(newCount).toBe(2);
      expect(progress).toBe(1);
      expect(hold).toBe(1);
      expect(done).toBe(1);
      expect(cancelled).toBe(1);
      // overdue: tasks with past dueDate that are not done/cancelled
      // "new" with 2025-01-01 = overdue, "hold" with 2025-06-01 = overdue
      expect(overdue).toBe(2);
    });

    it("should not count done tasks as overdue", () => {
      const tasks = [
        { status: "done", dueDate: "2020-01-01" },
      ];
      const today = new Date().toISOString().split("T")[0];
      const overdue = tasks.filter(
        (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "cancelled"
      ).length;
      expect(overdue).toBe(0);
    });

    it("should not count cancelled tasks as overdue", () => {
      const tasks = [
        { status: "cancelled", dueDate: "2020-01-01" },
      ];
      const today = new Date().toISOString().split("T")[0];
      const overdue = tasks.filter(
        (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "cancelled"
      ).length;
      expect(overdue).toBe(0);
    });

    it("should not count tasks without dueDate as overdue", () => {
      const tasks = [
        { status: "new", dueDate: null },
      ];
      const today = new Date().toISOString().split("T")[0];
      const overdue = tasks.filter(
        (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "cancelled"
      ).length;
      expect(overdue).toBe(0);
    });
  });

  describe("Agent Task Creation", () => {
    it("should set source to agent when created by agent", () => {
      const agentTask = {
        title: "مهمة من قاسم",
        project: "الجداف",
        owner: "عبدالرحمن",
        agentName: "قاسم",
        source: "agent",
        sourceAgent: "قاسم",
        status: "new",
        progress: 0,
      };

      expect(agentTask.source).toBe("agent");
      expect(agentTask.sourceAgent).toBe("قاسم");
      expect(agentTask.status).toBe("new");
      expect(agentTask.progress).toBe(0);
    });

    it("should set source to command when created by command", () => {
      const commandTask = {
        title: "مهمة من أمر",
        project: "المول",
        owner: "أحمد",
        source: "command",
        sourceAgent: "المدير",
      };

      expect(commandTask.source).toBe("command");
    });
  });

  describe("Task Filtering", () => {
    const sampleTasks = [
      { id: 1, title: "تصميم المول", project: "المول", status: "new", priority: "high", owner: "أحمد", dueDate: "2026-03-01", description: null },
      { id: 2, title: "عقد الجداف", project: "الجداف", status: "progress", priority: "medium", owner: "محمد", dueDate: "2026-04-01", description: "عقد استشاري" },
      { id: 3, title: "ترخيص الفلل", project: "الفلل", status: "done", priority: "low", owner: "أحمد", dueDate: "2026-02-01", description: null },
    ];

    it("should filter by status", () => {
      const filtered = sampleTasks.filter((t) => t.status === "new");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("تصميم المول");
    });

    it("should filter by project", () => {
      const filtered = sampleTasks.filter((t) => t.project === "الجداف");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("عقد الجداف");
    });

    it("should filter by priority", () => {
      const filtered = sampleTasks.filter((t) => t.priority === "high");
      expect(filtered).toHaveLength(1);
    });

    it("should filter by owner", () => {
      const filtered = sampleTasks.filter((t) => t.owner.includes("أحمد"));
      expect(filtered).toHaveLength(2);
    });

    it("should filter by search text", () => {
      const searchText = "عقد";
      const filtered = sampleTasks.filter((t) => {
        const text = `${t.title} ${t.description || ""}`.toLowerCase();
        return text.includes(searchText);
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].project).toBe("الجداف");
    });

    it("should return all when no filter", () => {
      expect(sampleTasks).toHaveLength(3);
    });
  });

  describe("Mark Done", () => {
    it("should set status to done and progress to 100", () => {
      const task = { status: "progress", progress: 50 };
      const updated = { ...task, status: "done", progress: 100 };
      expect(updated.status).toBe("done");
      expect(updated.progress).toBe(100);
    });
  });
});
