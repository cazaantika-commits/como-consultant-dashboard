import { describe, expect, it } from "vitest";
import { buildLaylaOpeningOperations, formatLaylaCommandCenterFallback, formatLaylaCommandCenterOverview, isLaylaCommandCenterOverviewRequest, runLaylaCommandCenterTool, type LaylaCommandCenterSnapshot } from "./laylaCommandCenterContext";
import { readFileSync } from "node:fs";

const snapshot: LaylaCommandCenterSnapshot = {
  generated_at: "2026-08-27T00:00:00.000Z",
  member_id: "abdulrahman",
  projects: [{ id: 1, name: "مجان" }, { id: 2, name: "الجداف" }],
  decisions: [{ project: "مجان", title: "تغيير تصميم", status: "submitted" }],
  approvals: [{ project: "مجان", evaluator: "وائل", approved: false }],
  payment_requests: [{ request_number: "PAY-1", project: "مجان", amount: 5000, status: "pending_wael" }],
  requests: [{ request_number: "REQ-1", subject: "اعتماد عرض", project: "الجداف", status: "pending_sheikh" }],
  tasks: [{ title: "مراجعة المخطط", project: "مجان", status: "progress", priority: "urgent" }],
  meetings: [{ title: "اجتماع المستثمر", status: "preparing" }],
  evaluations: [{ title: "تقييم استشاري", project: "مجان", status: "pending" }],
  project_status: [{ project: "مجان", milestones: [{ title: "التصميم", status: "delayed" }], kpis: [] }],
  updates: [{ type: "reports", title: "تقرير جديد", project: "مجان" }],
};

describe("Layla Command Center read-only context", () => {
  it("returns an accurate overview without exposing mutation capabilities", () => {
    expect(runLaylaCommandCenterTool(snapshot, JSON.stringify({ category: "overview" }))).toMatchObject({
      projects: ["مجان", "الجداف"],
      counts: { decisions: 1, payment_requests: 1, tasks: 1 },
    });
  });

  it("returns the requested source category and filters a matching project", () => {
    expect(runLaylaCommandCenterTool(snapshot, JSON.stringify({ category: "project_status", project_name: "مجان" }))).toMatchObject({
      found: true,
      category: "project_status",
      items: [expect.objectContaining({ project: "مجان" })],
    });
  });

  it("rejects unclear projects and unsupported tool requests", () => {
    expect(runLaylaCommandCenterTool(snapshot, JSON.stringify({ category: "tasks", project_name: "غير موجود" }))).toMatchObject({ found: false });
    expect(runLaylaCommandCenterTool(snapshot, JSON.stringify({ category: "send_message" }))).toMatchObject({ found: false });
  });

  it("formats a source-backed fallback rather than returning a blank assistant response", () => {
    const result = runLaylaCommandCenterTool(snapshot, JSON.stringify({ category: "payment_requests" }));
    expect(formatLaylaCommandCenterFallback(result)).toContain("PAY-1");
    expect(formatLaylaCommandCenterFallback({ found: true, category: "tasks", items: [] })).toContain("لا توجد عناصر ظاهرة");
  });

  it("identifies a multi-topic executive question and returns a source-backed overview", () => {
    expect(isLaylaCommandCenterOverviewRequest("أعطني ملخص القرارات والمهام والاجتماعات وحالة المشاريع")).toBe(true);
    expect(isLaylaCommandCenterOverviewRequest("ما هي طلبات الصرف؟")).toBe(false);
    const summary = formatLaylaCommandCenterOverview(snapshot);
    expect(summary).toContain("طلبات الصرف المعلقة (1): PAY-1");
    expect(summary).toContain("جلسات التقييم (1): تقييم استشاري");
  });

  it("builds the opening briefing payload from the existing snapshot without a write path", () => {
    expect(buildLaylaOpeningOperations(snapshot)).toMatchObject({
      openTasks: 1,
      urgentTasks: 1,
      pendingPayments: 1,
      evaluations: 1,
      followUpProjects: ["مجان"],
    });
  });

  it("forces Layla to answer every Command Center member in Arabic", () => {
    const routerSource = readFileSync("server/routers/commandCenter.ts", "utf8");
    expect(routerSource).toContain("استخدمي اللغة العربية الفصحى فقط مع جميع الأعضاء");
    expect(routerSource).toContain("حتى إذا كان السؤال بلغة أخرى");
  });
});
