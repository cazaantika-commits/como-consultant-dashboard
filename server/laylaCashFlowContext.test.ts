import { describe, expect, it } from "vitest";
import {
  getLaylaCashFlowOverview,
  getLaylaGroupCashFlow,
  getLaylaProjectCashFlow,
  runLaylaCashFlowTool,
} from "./laylaCashFlowContext";
import type { UnifiedGroupCashFlow } from "../client/src/lib/unifiedGroupCashFlow";

const report: UnifiedGroupCashFlow = {
  monthDates: ["2026-10", "2026-11", "2026-12"],
  totals: [-110, 200, -20],
  cumulativeTotals: [-210, -10, -30],
  paidBeforeScheduleTotal: 100,
  rows: [
    {
      projectId: 1,
      name: "مجان متعدد الاستخدامات",
      values: [-100, 250, -20],
      sourceKind: "investor_cash_flow",
      sourceLabel: "صف صافي الشهر النهائي من تدفقات المستثمر",
      includesOperatingCashFlows: false,
    },
    {
      projectId: 2,
      name: "المركز التجاري",
      values: [-10, -50, 0],
      sourceKind: "commercial_development",
      sourceLabel: "صف تدفقات تطوير المركز التجاري قبل التشغيل",
      scopeNote: "يشمل تكاليف التطوير المعتمدة فقط؛ لا توجد توقعات إيجار أو مصروفات تشغيل في هذا التقرير.",
      includesOperatingCashFlows: false,
    },
  ],
  projects: [
    {
      projectId: 1,
      name: "مجان متعدد الاستخدامات",
      financingScenario: "offplan_escrow",
      startDate: "2026-10",
      monthDates: ["2026-10", "2026-11", "2026-12"],
      monthlyDebit: [100, 0, 20],
      monthlyCredit: [0, 250, 0],
      monthlyNet: [-100, 250, -20],
      monthlyCumulative: [-200, 50, 30],
      paidBeforeSchedule: 100,
      cashFlowSummary: { requiredCapital: 200, paidCapital: 100, remainingCapital: 100, totalInvestorPayments: 220, totalInvestorReceipts: 250, finalNet: 30 },
      monthlyTrace: [
        { expenses: [{ name: "تصاميم", value: 100 }], receipts: [], expenseTotal: 100, receiptTotal: 0, net: -100 },
        { expenses: [], receipts: [{ name: "تحويل الضمان", value: 250 }], expenseTotal: 0, receiptTotal: 250, net: 250 },
        { expenses: [{ name: "ريتينشن", value: 20 }], receipts: [], expenseTotal: 20, receiptTotal: 0, net: -20 },
      ],
      sourceKind: "investor_cash_flow",
      sourceLabel: "صف صافي الشهر النهائي من تدفقات المستثمر",
      includesOperatingCashFlows: false,
    },
    {
      projectId: 2,
      name: "المركز التجاري",
      financingScenario: "build_for_rent",
      startDate: "2026-10",
      monthDates: ["2026-10", "2026-11", "2026-12"],
      monthlyDebit: [10, 50, 0],
      monthlyCredit: [0, 0, 0],
      monthlyNet: [-10, -50, 0],
      monthlyCumulative: [-10, -60, -60],
      paidBeforeSchedule: 0,
      cashFlowSummary: { requiredCapital: 60, paidCapital: 0, remainingCapital: 60, totalInvestorPayments: 60, totalInvestorReceipts: 0, finalNet: -60 },
      monthlyTrace: [
        { expenses: [{ name: "إنشاء", value: 10 }], receipts: [], expenseTotal: 10, receiptTotal: 0, net: -10 },
        { expenses: [{ name: "إنشاء", value: 50 }], receipts: [], expenseTotal: 50, receiptTotal: 0, net: -50 },
        { expenses: [], receipts: [], expenseTotal: 0, receiptTotal: 0, net: 0 },
      ],
      sourceKind: "commercial_development",
      sourceLabel: "صف تدفقات تطوير المركز التجاري قبل التشغيل",
      scopeNote: "يشمل تكاليف التطوير المعتمدة فقط؛ لا توجد توقعات إيجار أو مصروفات تشغيل في هذا التقرير.",
      includesOperatingCashFlows: false,
    },
  ],
};

describe("Layla cash-flow source context", () => {
  it("lists the final-source scope and identifies the commercial center without rent", () => {
    const overview = getLaylaCashFlowOverview(report);
    expect(overview.project_count).toBe(2);
    expect(overview.projects[1]).toMatchObject({
      name: "المركز التجاري",
      source_label: "صف تدفقات تطوير المركز التجاري قبل التشغيل",
      scope_note: expect.stringContaining("لا توجد توقعات إيجار"),
    });
  });

  it("copies an exact project month range and trace rather than deriving a new cash flow", () => {
    const result = getLaylaProjectCashFlow(report, {
      project_name: "مجان",
      from_month: "2026-11",
      months: 2,
      include_breakdown: true,
    });
    expect(result).toMatchObject({
      found: true,
      project: "مجان متعدد الاستخدامات",
      paid_before_schedule: 100,
      summary: { required_capital: 200, total_investor_payments: 220, total_investor_receipts: 250, final_net: 30 },
    });
    expect((result as any).months).toEqual([
      expect.objectContaining({ month: "2026-11", paid: 0, received: 250, net: 250, cumulative: 50, received_items: [{ name: "تحويل الضمان", value: 250 }] }),
      expect.objectContaining({ month: "2026-12", paid: 20, received: 0, net: -20, cumulative: 30, paid_items: [{ name: "ريتينشن", value: 20 }] }),
    ]);
  });

  it("uses each project's own calendar index when its schedule starts after the group calendar", () => {
    const delayedProject = {
      ...report.projects[0],
      monthDates: ["2026-11", "2026-12"],
      monthlyDebit: [7, 0],
      monthlyCredit: [0, 19],
      monthlyNet: [-7, 19],
      monthlyCumulative: [-107, -88],
      monthlyTrace: [
        { expenses: [{ name: "تصاميم", value: 7 }], receipts: [], expenseTotal: 7, receiptTotal: 0, net: -7 },
        { expenses: [], receipts: [{ name: "تحويل الضمان", value: 19 }], expenseTotal: 0, receiptTotal: 19, net: 19 },
      ],
    };
    const shiftedReport = { ...report, projects: [delayedProject, report.projects[1]] };
    const result = getLaylaProjectCashFlow(shiftedReport, { project_name: "مجان", from_month: "2026-11", months: 2, include_breakdown: true });
    expect((result as any).months).toEqual([
      expect.objectContaining({ month: "2026-11", paid: 7, received: 0, net: -7, cumulative: -107 }),
      expect.objectContaining({ month: "2026-12", paid: 0, received: 19, net: 19, cumulative: -88 }),
    ]);
  });

  it("returns only the copied group totals and their project drivers", () => {
    const result = getLaylaGroupCashFlow(report, { from_month: "2026-10", months: 2 });
    expect(result.paid_before_schedule).toBe(100);
    expect(result.months).toEqual([
      expect.objectContaining({ month: "2026-10", net: -110, cumulative: -210, project_drivers: expect.arrayContaining([expect.objectContaining({ project: "المركز التجاري", value: -10 })]) }),
      expect.objectContaining({ month: "2026-11", net: 200, cumulative: -10 }),
    ]);
  });

  it("does not manufacture values when the project or requested tool is unavailable", () => {
    expect(getLaylaProjectCashFlow(report, { project_name: "مشروع غير موجود" })).toMatchObject({ found: false });
    expect(runLaylaCashFlowTool(report, "not_allowed", "{}")).toEqual({ error: "هذه الأداة غير مسموح بها في محادثة التدفقات النقدية." });
  });
});
