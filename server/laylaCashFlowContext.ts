import type {
  UnifiedGroupCashFlow,
  UnifiedGroupCashFlowRow,
} from "../client/src/lib/unifiedGroupCashFlow";

const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 12;
const EPSILON = 0.000001;

type ProjectLookupInput = {
  project_name: string;
  from_month?: string;
  months?: number;
  include_breakdown?: boolean;
};

type GroupLookupInput = {
  from_month?: string;
  months?: number;
};

const compactMoney = (value: number) => Math.round((Number(value) || 0) * 1000) / 1000;

function clampMonths(value?: number) {
  const numeric = Math.round(Number(value) || DEFAULT_MONTHS);
  return Math.min(Math.max(numeric, 1), MAX_MONTHS);
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ـ\s\-—_()]/g, "");
}

function findProject(report: UnifiedGroupCashFlow, search: string) {
  const needle = normalizeArabic(search);
  const exact = report.projects.filter((project) => normalizeArabic(project.name) === needle);
  if (exact.length === 1) return { project: exact[0], ambiguous: false };

  const matches = report.projects.filter((project) => {
    const name = normalizeArabic(project.name);
    return name.includes(needle) || needle.includes(name);
  });
  return { project: matches.length === 1 ? matches[0] : null, ambiguous: matches.length > 1, matches };
}

function monthSlice(monthDates: string[], fromMonth?: string, requestedMonths?: number) {
  const start = fromMonth ? monthDates.findIndex((month) => month === fromMonth) : 0;
  const startIndex = start >= 0 ? start : 0;
  const count = clampMonths(requestedMonths);
  return { startIndex, endIndex: Math.min(startIndex + count, monthDates.length) };
}

function projectRow(report: UnifiedGroupCashFlow, projectId: number): UnifiedGroupCashFlowRow | undefined {
  return report.rows.find((row) => row.projectId === projectId);
}

/**
 * A read-only data contract for Layla. All values are copied from the final
 * project Investor Cash Flow rows or their already-calendar-aligned group copy.
 */
export function getLaylaCashFlowOverview(report: UnifiedGroupCashFlow) {
  return {
    source: "التدفقات النقدية الموحدة للمجموعة",
    data_rule: "القيم منقولة من الصفوف الشهرية النهائية فقط؛ لا توجد أي توقعات أو تسويات جديدة داخل المحادثة.",
    project_count: report.projects.length,
    period: {
      first_month: report.monthDates[0] || null,
      last_month: report.monthDates.at(-1) || null,
    },
    projects: report.projects.map((project) => ({
      project_id: project.projectId,
      name: project.name,
      financing_scenario: project.financingScenario,
      source_label: project.sourceLabel,
      paid_before_schedule: compactMoney(project.paidBeforeSchedule),
      summary: project.cashFlowSummary ? {
        required_capital: compactMoney(project.cashFlowSummary.requiredCapital),
        paid_capital: compactMoney(project.cashFlowSummary.paidCapital),
        remaining_capital: compactMoney(project.cashFlowSummary.remainingCapital),
        total_investor_payments: compactMoney(project.cashFlowSummary.totalInvestorPayments),
        total_investor_receipts: compactMoney(project.cashFlowSummary.totalInvestorReceipts),
        final_net: compactMoney(project.cashFlowSummary.finalNet),
      } : null,
      scope_note: project.scopeNote || null,
    })),
  };
}

export function getLaylaProjectCashFlow(report: UnifiedGroupCashFlow, input: ProjectLookupInput) {
  const found = findProject(report, input.project_name);
  if (!found.project) {
    return {
      found: false,
      reason: found.ambiguous ? "اسم المشروع غير محدد بما يكفي" : "لم أجد مشروعًا مطابقًا في مصدر التدفقات المعتمد",
      available_projects: (found.matches || report.projects).map((project) => project.name),
    };
  }

  const project = found.project;
  if (!projectRow(report, project.projectId)) {
    return { found: false, reason: "لم يصل الصف النهائي لهذا المشروع إلى التقرير الموحد" };
  }

  const { startIndex, endIndex } = monthSlice(
    report.monthDates,
    input.from_month || project.monthDates[0],
    input.months,
  );
  const monthlyCumulative = project.monthlyCumulative || [];
  const movementMonths = report.monthDates.slice(startIndex, endIndex).map((monthDate, index) => {
    const groupIndex = startIndex + index;
    const projectIndex = project.monthDates.findIndex((date) => date === monthDate);
    const trace = projectIndex >= 0 ? project.monthlyTrace?.[projectIndex] : undefined;
    return {
      month: monthDate,
      paid: compactMoney(projectIndex >= 0 ? project.monthlyDebit[projectIndex] || 0 : 0),
      received: compactMoney(projectIndex >= 0 ? project.monthlyCredit[projectIndex] || 0 : 0),
      net: compactMoney(projectIndex >= 0 ? project.monthlyNet[projectIndex] || 0 : 0),
      cumulative: compactMoney(projectIndex >= 0 ? monthlyCumulative[projectIndex] ?? 0 : 0),
      ...(input.include_breakdown ? {
        paid_items: (trace?.expenses || []).map((item) => ({ name: item.name, value: compactMoney(item.value) })),
        received_items: (trace?.receipts || []).map((item) => ({ name: item.name, value: compactMoney(item.value) })),
      } : {}),
    };
  });

  return {
    found: true,
    source: project.sourceLabel,
    project: project.name,
    financing_scenario: project.financingScenario,
    paid_before_schedule: compactMoney(project.paidBeforeSchedule),
    summary: project.cashFlowSummary ? {
      required_capital: compactMoney(project.cashFlowSummary.requiredCapital),
      paid_capital: compactMoney(project.cashFlowSummary.paidCapital),
      remaining_capital: compactMoney(project.cashFlowSummary.remainingCapital),
      total_investor_payments: compactMoney(project.cashFlowSummary.totalInvestorPayments),
      total_investor_receipts: compactMoney(project.cashFlowSummary.totalInvestorReceipts),
      final_net: compactMoney(project.cashFlowSummary.finalNet),
    } : null,
    scope_note: project.scopeNote || null,
    period: { first_month: report.monthDates[startIndex] || null, last_month: report.monthDates[endIndex - 1] || null },
    months: movementMonths,
  };
}

export function getLaylaGroupCashFlow(report: UnifiedGroupCashFlow, input: GroupLookupInput) {
  const { startIndex, endIndex } = monthSlice(report.monthDates, input.from_month, input.months);
  return {
    source: "التدفقات النقدية الموحدة للمجموعة",
    paid_before_schedule: compactMoney(report.paidBeforeScheduleTotal),
    period: { first_month: report.monthDates[startIndex] || null, last_month: report.monthDates[endIndex - 1] || null },
    months: report.monthDates.slice(startIndex, endIndex).map((monthDate, index) => {
      const sourceIndex = startIndex + index;
      return {
        month: monthDate,
        net: compactMoney(report.totals[sourceIndex] || 0),
        cumulative: compactMoney(report.cumulativeTotals[sourceIndex] || 0),
        project_drivers: report.rows
          .map((row) => ({ project: row.name, value: compactMoney(row.values[sourceIndex] || 0), source: row.sourceLabel }))
          .filter((movement) => Math.abs(movement.value) > EPSILON),
      };
    }),
  };
}

export const laylaCashFlowTools = [
  {
    type: "function" as const,
    function: {
      name: "get_cash_flow_overview",
      description: "يعرض المشاريع والفترة المتاحة في مصدر التدفقات النقدية المعتمد. استخدمه عند السؤال عن النطاق أو إذا لم يحدد المستخدم مشروعًا أو شهرًا.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_project_cash_flow",
      description: "يعرض ملخص التدفقات النهائي لمشروع واحد، بما فيه رأس المال والمدفوع والمستلم والنتيجة، ثم الحركات الشهرية النهائية وبنودها عند طلب السبب أو الشرح.",
      parameters: {
        type: "object",
        properties: {
          project_name: { type: "string", description: "اسم المشروع كما ذكره المستخدم" },
          from_month: { type: "string", description: "شهر البداية بصيغة YYYY-MM إن حدده المستخدم" },
          months: { type: "integer", minimum: 1, maximum: 12, description: "عدد الأشهر المطلوبة" },
          include_breakdown: { type: "boolean", description: "true عند السؤال عن سبب حركة أو بنود مدفوع/مستلم" },
        },
        required: ["project_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_group_cash_flow",
      description: "يعرض صافي التدفق والتراكمي ومحركات المشاريع للتدفقات النقدية الموحدة للمجموعة خلال فترة محددة.",
      parameters: {
        type: "object",
        properties: {
          from_month: { type: "string", description: "شهر البداية بصيغة YYYY-MM إن حدده المستخدم" },
          months: { type: "integer", minimum: 1, maximum: 12, description: "عدد الأشهر المطلوبة" },
        },
        additionalProperties: false,
      },
    },
  },
];

export function runLaylaCashFlowTool(report: UnifiedGroupCashFlow, name: string, rawArguments: string) {
  let input: Record<string, unknown> = {};
  try {
    input = rawArguments ? JSON.parse(rawArguments) : {};
  } catch {
    return { error: "تعذر فهم مدخلات السؤال؛ يرجى تحديد المشروع أو الشهر بصيغة أوضح." };
  }

  if (name === "get_cash_flow_overview") return getLaylaCashFlowOverview(report);
  if (name === "get_project_cash_flow") return getLaylaProjectCashFlow(report, input as ProjectLookupInput);
  if (name === "get_group_cash_flow") return getLaylaGroupCashFlow(report, input as GroupLookupInput);
  return { error: "هذه الأداة غير مسموح بها في محادثة التدفقات النقدية." };
}
