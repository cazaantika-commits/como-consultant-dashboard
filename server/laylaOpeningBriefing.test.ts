import { describe, expect, it } from "vitest";
import {
  buildLaylaOpeningBriefing,
  formatLaylaApproximateAmount,
  type LaylaOpeningOperations,
} from "../client/src/lib/laylaOpeningBriefing";
import type { UnifiedGroupCashFlow } from "../client/src/lib/unifiedGroupCashFlow";

const operations: LaylaOpeningOperations = {
  generatedAt: "2026-08-31T00:00:00.000Z",
  openTasks: 2,
  urgentTasks: 1,
  pendingPayments: 0,
  pendingRequests: 0,
  decisions: 0,
  evaluations: 2,
  meetings: 0,
  followUpProjects: [],
};

const report: UnifiedGroupCashFlow = {
  monthDates: ["2026-09", "2026-10", "2026-11", "2026-12"],
  totals: [-2_215_342, -7_137_484, -8_034_923, -8_076_723],
  cumulativeTotals: [-2_215_342, -9_352_826, -17_387_749, -25_464_472],
  debitTotals: [2_215_342, 7_137_484, 8_034_923, 8_076_723],
  creditTotals: [0, 0, 0, 0],
  paidBeforeScheduleTotal: 0,
  rows: [
    {
      projectId: 1,
      name: "مشاريع البيع والاستثمار",
      values: [0, -4_291_608, -4_660_058, -5_797_373],
      sourceKind: "investor_cash_flow",
      sourceLabel: "صف صافي الشهر النهائي من تدفقات المستثمر",
      includesOperatingCashFlows: false,
    },
    {
      projectId: 2,
      name: "المركز التجاري",
      values: [-2_215_342, -2_845_876, -3_374_865, -2_279_350],
      sourceKind: "commercial_development",
      sourceLabel: "صف تدفقات تطوير المركز التجاري قبل التشغيل",
      includesOperatingCashFlows: false,
    },
  ],
  projects: [],
};

describe("Layla opening briefing", () => {
  it("rounds spoken amounts to natural quarter-million expressions", () => {
    expect(formatLaylaApproximateAmount(25_464_473)).toBe("حوالي 25 مليونًا ونصف");
    expect(formatLaylaApproximateAmount(27_853_120)).toBe("حوالي 27 مليونًا وثلاثة أرباع");
    expect(formatLaylaApproximateAmount(7_137_484)).toBe("حوالي 7 ملايين وربع");
    expect(formatLaylaApproximateAmount(2_215_342)).toBe("حوالي مليونين وربع");
    expect(formatLaylaApproximateAmount(530_000)).toBe("حوالي نصف مليون");
  });

  it("speaks the new liquidity heading, all four months, and the two-way split without exact long digits", () => {
    const text = buildLaylaOpeningBriefing(
      { memberId: "abdulrahman", nameAr: "عبدالرحمن", role: "admin" },
      operations,
      report,
    );

    expect(text).toContain("أهلاً عبدالرحمن، أنا ليلى");
    expect(text).toContain("احتياج المجموعة خلال الأشهر الأربعة القادمة");
    expect(text).toContain("حوالي 25 مليونًا ونصف درهم");
    for (const month of ["سبتمبر 2026", "أكتوبر 2026", "نوفمبر 2026", "ديسمبر 2026"]) {
      expect(text).toContain(month);
    }
    expect(text).toContain("للمشاريع");
    expect(text).toContain("لتطوير المركز التجاري");
    expect(text).toContain("بالكامل لتطوير المركز التجاري");
    expect(text).toContain("تشغيليًا، لديك 1 مهام عاجلة");
    expect(text).not.toContain("25,464,473");
    expect(text).not.toContain("٢٥٬٤٦٤٬٤٧٣");
  });
});
