/**
 * Cash Flow Engine — Dynamic Expense Distribution
 * 
 * This engine classifies each expense by its behavior:
 * - FIXED_ABSOLUTE: One-time payment, never changes (e.g., land cost)
 * - FIXED_RELATIVE: One-time at a relative position in a phase (e.g., RERA at month 4 of pre-con)
 * - DISTRIBUTED: Total divided equally across phase duration (e.g., contractor payments)
 * - PERIODIC: Fixed amount repeating every N months (e.g., RERA reports every 3 months)
 * - SALES_LINKED: Follows revenue timing (e.g., sales agent commission)
 * - CUSTOM: User-defined distribution (e.g., contingency)
 * 
 * When phase duration changes, each expense recalculates automatically based on its type.
 */

// ===== TYPES =====

export type ExpenseBehavior = 
  | "FIXED_ABSOLUTE"    // لا تتأثر أبداً
  | "FIXED_RELATIVE"    // دفعة في وقت نسبي من المرحلة
  | "DISTRIBUTED"       // إجمالي ÷ مدة المرحلة
  | "PERIODIC"          // مبلغ ثابت كل N أشهر
  | "SALES_LINKED"      // مرتبط بالمبيعات
  | "CUSTOM";           // توزيع يدوي/افتراضي

export type PhaseType = "land" | "preCon" | "construction" | "handover";

export interface PhaseConfig {
  type: PhaseType;
  label: string;
  duration: number; // months
  startMonth: number; // calculated from previous phases
}

export interface ExpenseItem {
  id: string;
  name: string;
  total: number;
  behavior: ExpenseBehavior;
  phase: PhaseType; // which phase this expense belongs to
  // For FIXED_RELATIVE: position in phase (1-based, or negative from end)
  relativeMonth?: number; // e.g., 1 = first month, -1 = last month, -2 = second to last
  // For DISTRIBUTED: which phases to distribute across
  distributeAcross?: PhaseType[];
  // For DISTRIBUTED with split: e.g., developer fee 2% preCon + 3% construction
  splitRatio?: { phase: PhaseType; ratio: number }[];
  // For PERIODIC: interval in months and per-occurrence amount
  periodicInterval?: number;
  periodicAmount?: number;
  // For FIXED_RELATIVE with multiple payments
  multiPayments?: { phase: PhaseType; relativeMonth: number; amount: number }[];
  // For SALES_LINKED: percentage of sales
  salesPercentage?: number;
  // Table: "investor" or "escrow"
  table: "investor" | "escrow";
  // Manual override: user can override any month's value
  overrides?: { [month: number]: number };
  // Shift: user can shift the entire expense by N months
  shiftMonths?: number;
}

export interface PhaseDurations {
  preCon: number;      // default 6
  construction: number; // default 16 (was 18 in Excel including handover prep)
  handover: number;     // default 2
}

export const DEFAULT_DURATIONS: PhaseDurations = {
  preCon: 6,
  construction: 16,
  handover: 2,
};

// ===== PHASE CALCULATION =====

export function calculatePhases(durations: PhaseDurations): PhaseConfig[] {
  const phases: PhaseConfig[] = [
    { type: "land", label: "شراء الأرض", duration: 0, startMonth: 0 },
    { type: "preCon", label: "ما قبل البناء", duration: durations.preCon, startMonth: 1 },
    { type: "construction", label: "البناء", duration: durations.construction, startMonth: 1 + durations.preCon },
    { type: "handover", label: "التسليم", duration: durations.handover, startMonth: 1 + durations.preCon + durations.construction },
  ];
  return phases;
}

export function getTotalMonths(durations: PhaseDurations): number {
  return durations.preCon + durations.construction + durations.handover;
}

export function getPhaseMonthRange(phases: PhaseConfig[], phaseType: PhaseType): { start: number; end: number } {
  const phase = phases.find(p => p.type === phaseType);
  if (!phase || phase.duration === 0) return { start: 0, end: 0 };
  return { start: phase.startMonth, end: phase.startMonth + phase.duration - 1 };
}

// ===== EXPENSE DISTRIBUTION =====

export function distributeExpense(
  item: ExpenseItem,
  phases: PhaseConfig[],
  durations: PhaseDurations,
  revenueData?: { [month: number]: number }
): { [month: number]: number } {
  const result: { [month: number]: number } = {};
  const totalMonths = getTotalMonths(durations);
  const shift = item.shiftMonths || 0;

  switch (item.behavior) {
    case "FIXED_ABSOLUTE": {
      // Land items: no monthly distribution, shown in land column
      // Nothing to distribute
      break;
    }

    case "FIXED_RELATIVE": {
      if (item.multiPayments) {
        // Multiple payments at different relative positions
        for (const payment of item.multiPayments) {
          const range = getPhaseMonthRange(phases, payment.phase);
          if (range.start === 0 && range.end === 0) continue;
          let month: number;
          if (payment.relativeMonth < 0) {
            month = range.end + payment.relativeMonth + 1;
          } else {
            month = range.start + payment.relativeMonth - 1;
          }
          month += shift;
          if (month >= 1 && month <= totalMonths) {
            result[month] = (result[month] || 0) + payment.amount;
          }
        }
      } else {
        const range = getPhaseMonthRange(phases, item.phase);
        if (range.start === 0 && range.end === 0) break;
        let month: number;
        if ((item.relativeMonth || 1) < 0) {
          month = range.end + (item.relativeMonth || -1) + 1;
        } else {
          month = range.start + (item.relativeMonth || 1) - 1;
        }
        month += shift;
        if (month >= 1 && month <= totalMonths) {
          result[month] = item.total;
        }
      }
      break;
    }

    case "DISTRIBUTED": {
      if (item.splitRatio) {
        // Split across multiple phases with ratios
        for (const split of item.splitRatio) {
          const range = getPhaseMonthRange(phases, split.phase);
          if (range.start === 0 && range.end === 0) continue;
          const phaseConfig = phases.find(p => p.type === split.phase);
          if (!phaseConfig || phaseConfig.duration === 0) continue;
          const splitTotal = item.total * split.ratio;
          const monthly = splitTotal / phaseConfig.duration;
          for (let m = range.start; m <= range.end; m++) {
            const shifted = m + shift;
            if (shifted >= 1 && shifted <= totalMonths) {
              result[shifted] = (result[shifted] || 0) + monthly;
            }
          }
        }
      } else if (item.distributeAcross) {
        // Distribute across specified phases
        let totalDuration = 0;
        for (const pt of item.distributeAcross) {
          const phaseConfig = phases.find(p => p.type === pt);
          if (phaseConfig) totalDuration += phaseConfig.duration;
        }
        if (totalDuration === 0) break;
        const monthly = item.total / totalDuration;
        for (const pt of item.distributeAcross) {
          const range = getPhaseMonthRange(phases, pt);
          for (let m = range.start; m <= range.end; m++) {
            const shifted = m + shift;
            if (shifted >= 1 && shifted <= totalMonths) {
              result[shifted] = (result[shifted] || 0) + monthly;
            }
          }
        }
      } else {
        // Distribute across own phase
        const range = getPhaseMonthRange(phases, item.phase);
        const phaseConfig = phases.find(p => p.type === item.phase);
        if (!phaseConfig || phaseConfig.duration === 0) break;
        const monthly = item.total / phaseConfig.duration;
        for (let m = range.start; m <= range.end; m++) {
          const shifted = m + shift;
          if (shifted >= 1 && shifted <= totalMonths) {
            result[shifted] = (result[shifted] || 0) + monthly;
          }
        }
      }
      break;
    }

    case "PERIODIC": {
      const range = getPhaseMonthRange(phases, item.phase);
      if (range.start === 0 && range.end === 0) break;
      const interval = item.periodicInterval || 3;
      const amount = item.periodicAmount || 0;
      // First occurrence at interval months into the phase
      for (let m = range.start + interval - 1; m <= range.end; m += interval) {
        const shifted = m + shift;
        if (shifted >= 1 && shifted <= totalMonths) {
          result[shifted] = (result[shifted] || 0) + amount;
        }
      }
      // Also at end of handover if applicable
      const handoverRange = getPhaseMonthRange(phases, "handover");
      if (handoverRange.end > 0) {
        const shifted = handoverRange.end + shift;
        if (shifted >= 1 && shifted <= totalMonths && !result[shifted]) {
          result[shifted] = (result[shifted] || 0) + amount;
        }
      }
      break;
    }

    case "SALES_LINKED": {
      // Follows revenue timing proportionally
      if (!revenueData) break;
      const totalRev = Object.values(revenueData).reduce((s, v) => s + v, 0);
      if (totalRev === 0) break;
      for (const [mStr, rev] of Object.entries(revenueData)) {
        const m = parseInt(mStr) + shift;
        if (m >= 1 && m <= totalMonths && rev > 0) {
          result[m] = (result[m] || 0) + item.total * (rev / totalRev);
        }
      }
      break;
    }

    case "CUSTOM": {
      // Use overrides directly, or default distribution
      // Custom items start with a default and user can edit
      break;
    }
  }

  // Apply overrides (user manual edits)
  if (item.overrides) {
    for (const [mStr, val] of Object.entries(item.overrides)) {
      const m = parseInt(mStr);
      if (m >= 1 && m <= totalMonths) {
        result[m] = val;
      }
    }
  }

  return result;
}

// ===== QUARTERLY AGGREGATION =====

export interface QuarterDef {
  label: string;
  months: number[];
  phase: PhaseType | "opening";
  phaseLabel: string;
}

export function buildQuarters(
  phases: PhaseConfig[],
  durations: PhaseDurations,
  projectStart: Date,
  includeOpening?: boolean,
  includeLand?: boolean
): QuarterDef[] {
  const quarters: QuarterDef[] = [];
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  function formatMonth(monthNum: number): string {
    const d = new Date(projectStart);
    d.setMonth(d.getMonth() + monthNum - 1);
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Land column
  if (includeLand) {
    quarters.push({ label: "تم الشراء", months: [], phase: "land", phaseLabel: "شراء الأرض" });
  }

  // Opening balance column (for escrow)
  if (includeOpening) {
    quarters.push({ label: "رصيد افتتاحي", months: [], phase: "opening", phaseLabel: "الرصيد الافتتاحي" });
  }

  const totalMonths = getTotalMonths(durations);

  // Group months individually (monthly view)
  for (const phase of phases) {
    if (phase.type === "land") continue;
    if (includeOpening && phase.type === "preCon") continue; // escrow skips preCon

    const range = getPhaseMonthRange(phases, phase.type);
    if (range.start === 0 && range.end === 0) continue;

    for (let m = range.start; m <= range.end; m++) {
      quarters.push({
        label: formatMonth(m),
        months: [m],
        phase: phase.type,
        phaseLabel: phase.label,
      });
    }
  }

  return quarters;
}

export function aggregateToQuarters(
  monthlyData: { [month: number]: number },
  quarters: QuarterDef[]
): number[] {
  return quarters.map(q => {
    if (q.months.length === 0) return 0;
    return q.months.reduce((sum, m) => sum + (monthlyData[m] || 0), 0);
  });
}

// ===== DEFAULT EXPENSE DEFINITIONS =====

// Construction cost base (FALLBACK defaults when no project data available)
export const CONSTRUCTION_COST = 39427980;
export const SALES_VALUE = 93765000;

/**
 * Dynamic project costs — passed from بطاقة المشروع / دراسة الجدوى.
 * When provided, all expense items use these values instead of hardcoded defaults.
 */
export interface ProjectCosts {
  landPrice: number;
  agentCommissionLand: number;
  landRegistration: number;
  soilTestFee: number;
  topographicSurveyFee: number;
  officialBodiesFees: number;
  designFee: number;
  supervisionFee: number;
  separationFee: number;
  constructionCost: number;
  communityFees: number;
  contingencies: number;
  developerFee: number;
  salesCommission: number;
  marketingCost: number;
  reraUnitRegFee: number;
  reraProjectRegFee: number;
  developerNocFee: number;
  escrowAccountFee: number;
  bankFees: number;
  surveyorFees: number;
  reraAuditReportFee: number;
  reraInspectionReportFee: number;
  totalRevenue: number;
  totalCosts?: number;
}

export function getInvestorExpenses(costs?: ProjectCosts): ExpenseItem[] {
  // Use dynamic costs if provided, otherwise fall back to hardcoded defaults
  const c = costs;
  const constructionCost = c ? c.constructionCost : CONSTRUCTION_COST;
  const salesValue = c ? c.totalRevenue : SALES_VALUE;

  return [
    // === شراء الأرض ===
    {
      id: "land_cost",
      name: "سعر الأرض",
      total: c ? c.landPrice : 18000000,
      behavior: "FIXED_ABSOLUTE",
      phase: "land",
      table: "investor",
    },
    {
      id: "land_broker",
      name: "عمولة وسيط الأرض (1%)",
      total: c ? c.agentCommissionLand : 180000,
      behavior: "FIXED_ABSOLUTE",
      phase: "land",
      table: "investor",
    },
    {
      id: "land_registration",
      name: "رسوم تسجيل الأرض (4%)",
      total: c ? c.landRegistration : 720000,
      behavior: "FIXED_ABSOLUTE",
      phase: "land",
      table: "investor",
    },

    // === ما قبل البناء ===
    {
      id: "soil_test",
      name: "فحص التربة",
      total: c ? c.soilTestFee : 25000,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: 1,
      table: "investor",
    },
    {
      id: "survey",
      name: "المسح الطبوغرافي",
      total: c ? c.topographicSurveyFee : 8000,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: 1,
      table: "investor",
    },
    {
      id: "developer_fee",
      name: "أتعاب المطور (5%)",
      total: c ? c.developerFee : 4688250,
      behavior: "DISTRIBUTED",
      phase: "preCon",
      splitRatio: [
        { phase: "preCon", ratio: 0.4 },       // 2% = 40% of 5%
        { phase: "construction", ratio: 0.5 },  // 2.5% = 50% of 5%
        { phase: "handover", ratio: 0.1 },      // 0.5% = 10% of 5%
      ],
      table: "investor",
    },
    {
      id: "design_fee",
      name: "أتعاب التصميم (2%)",
      total: c ? c.designFee : 788559.6,
      behavior: "DISTRIBUTED",
      phase: "preCon",
      distributeAcross: ["preCon"],
      table: "investor",
    },
    {
      id: "fraz_fee",
      name: "رسوم الفرز (40 د/قدم)",
      total: c ? c.separationFee : 2033044.4,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: 2,
      table: "investor",
    },
    {
      id: "rera_registration",
      name: "تسجيل بيع على الخارطة - ريرا",
      total: c ? c.reraProjectRegFee : 150000,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: 4,
      table: "investor",
    },
    {
      id: "rera_units",
      name: "تسجيل الوحدات - ريرا",
      total: c ? c.reraUnitRegFee : 39100,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: 5,
      table: "investor",
    },
    {
      id: "surveyor_fee",
      name: "رسوم المساح",
      total: c ? c.surveyorFees : 24000,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      multiPayments: [
        { phase: "preCon", relativeMonth: 4, amount: (c ? c.surveyorFees : 24000) / 2 },
        { phase: "handover", relativeMonth: 1, amount: (c ? c.surveyorFees : 24000) / 2 },
      ],
      table: "investor",
    },
    {
      id: "noc_fee",
      name: "رسوم NOC للبيع",
      total: c ? c.developerNocFee : 22000,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      multiPayments: [
        { phase: "preCon", relativeMonth: 5, amount: (c ? c.developerNocFee : 22000) * 0.45 },
        { phase: "handover", relativeMonth: 1, amount: (c ? c.developerNocFee : 22000) * 0.55 },
      ],
      table: "investor",
    },
    {
      id: "escrow_fee",
      name: "رسوم حساب الضمان",
      total: c ? c.escrowAccountFee : 140000,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: 4,
      table: "investor",
    },
    {
      id: "escrow_deposit",
      name: "إيداع حساب الضمان (20%)",
      total: constructionCost * 0.20,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: -2, // second to last month
      table: "investor",
    },
    {
      id: "contractor_advance",
      name: "دفعة مقدمة للمقاول (10%)",
      total: constructionCost * 0.10,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: -1, // last month
      table: "investor",
    },
    {
      id: "community_fee",
      name: "رسوم المجتمع",
      total: c ? c.communityFees : 16000,
      behavior: "FIXED_RELATIVE",
      phase: "preCon",
      relativeMonth: -1, // last month
      table: "investor",
    },

    // === البناء ===
    {
      id: "contingency",
      name: "احتياطي وطوارئ (2%)",
      total: c ? c.contingencies : 788559.6,
      behavior: "CUSTOM",
      phase: "construction",
      table: "investor",
    },
    {
      id: "marketing",
      name: "التسويق والإعلان (2%)",
      total: c ? c.marketingCost : 1875300,
      behavior: "SALES_LINKED",
      phase: "construction",
      table: "investor",
    },
    {
      id: "bank_fees",
      name: "رسوم بنكية",
      total: c ? c.bankFees : 20000,
      behavior: "DISTRIBUTED",
      phase: "construction",
      distributeAcross: ["construction", "handover"],
      table: "investor",
    },
  ];
}

export function getEscrowExpenses(costs?: ProjectCosts): ExpenseItem[] {
  const c = costs;
  const constructionCost = c ? c.constructionCost : CONSTRUCTION_COST;

  return [
    {
      id: "gov_fees",
      name: "رسوم الجهات الحكومية",
      total: c ? c.officialBodiesFees : 1000000,
      behavior: "CUSTOM",
      phase: "construction",
      table: "escrow",
    },
    {
      id: "contractor_payments",
      name: "دفعات المقاول (85%)",
      total: constructionCost * 0.85,
      behavior: "DISTRIBUTED",
      phase: "construction",
      distributeAcross: ["construction"],
      table: "escrow",
    },
    {
      id: "supervision_fee",
      name: "أتعاب الإشراف (2%)",
      total: c ? c.supervisionFee : 788559.6,
      behavior: "DISTRIBUTED",
      phase: "construction",
      distributeAcross: ["construction"],
      table: "escrow",
    },
    {
      id: "sales_agent",
      name: "عمولة وكيل المبيعات (5%)",
      total: c ? c.salesCommission : 4688250,
      behavior: "SALES_LINKED",
      phase: "construction",
      table: "escrow",
    },
    {
      id: "rera_audit",
      name: "تقارير تدقيق ريرا",
      total: c ? c.reraAuditReportFee : 18000,
      behavior: "PERIODIC",
      phase: "construction",
      periodicInterval: 3,
      periodicAmount: c ? Math.round(c.reraAuditReportFee / 6) : 3000,
      table: "escrow",
    },
    {
      id: "rera_inspection",
      name: "تقارير تفتيش ريرا",
      total: c ? c.reraInspectionReportFee : 105000,
      behavior: "PERIODIC",
      phase: "construction",
      periodicInterval: 3,
      periodicAmount: c ? Math.round(c.reraInspectionReportFee / 6) : 15000,
      table: "escrow",
    },
  ];
}

// Default custom distributions (for CUSTOM behavior items)
export function getDefaultCustomDistribution(
  itemId: string,
  phases: PhaseConfig[],
  durations: PhaseDurations,
  costs?: ProjectCosts
): { [month: number]: number } {
  const conRange = getPhaseMonthRange(phases, "construction");

  if (itemId === "contingency") {
    // Contingency: split roughly into 2 payments during construction
    const contingencyTotal = costs ? costs.contingencies : 788559.6;
    const half = contingencyTotal / 2;
    const midMonth = conRange.start + Math.floor((conRange.end - conRange.start) / 2);
    const lateMonth = conRange.end - 1;
    return {
      [midMonth]: half,
      [lateMonth]: half,
    };
  }

  if (itemId === "gov_fees") {
    // Government fees: 80% at month 3 of construction, then rest distributed equally
    // The total of all payments MUST equal govTotal exactly
    const govTotal = costs ? costs.officialBodiesFees : 1000000;
    if (govTotal === 0) return {};
    const result: { [month: number]: number } = {};
    const initialPayment = govTotal * 0.8;
    result[conRange.start + 2] = initialPayment;
    const remaining = govTotal - initialPayment;
    const interval = 4;
    // Collect all remaining payment months first
    const remainingMonths: number[] = [];
    for (let m = conRange.start + 2 + interval; m <= conRange.end; m += interval) {
      remainingMonths.push(m);
    }
    if (remainingMonths.length > 0) {
      // Distribute remaining equally across all months
      const perMonth = remaining / remainingMonths.length;
      remainingMonths.forEach(m => { result[m] = perMonth; });
    } else {
      // No room for remaining payments — add to the initial payment month
      result[conRange.start + 2] = govTotal;
    }
    return result;
  }

  return {};
}

// Default revenue distribution
export function getDefaultRevenue(
  phases: PhaseConfig[],
  durations: PhaseDurations,
  dynamicSalesValue?: number
): { [month: number]: number } {
  const salesTotal = dynamicSalesValue || SALES_VALUE;
  const conRange = getPhaseMonthRange(phases, "construction");
  const handoverRange = getPhaseMonthRange(phases, "handover");
  const revenue: { [month: number]: number } = {};

  // Sales start 3 months into construction
  const salesStart = conRange.start + 2;
  const salesEnd = handoverRange.end;
  const totalSalesMonths = salesEnd - salesStart + 1;

  if (totalSalesMonths <= 0) return revenue;

  // 10% at launch (first 2 months), then 5% monthly, 10% at last 2 months
  const launchMonths = 2;
  const endMonths = 2;
  const midMonths = totalSalesMonths - launchMonths - endMonths;

  let allocated = 0;
  // Launch: 10% each
  for (let i = 0; i < launchMonths && salesStart + i <= salesEnd; i++) {
    revenue[salesStart + i] = salesTotal * 0.10;
    allocated += salesTotal * 0.10;
  }
  // End: 10% each
  for (let i = 0; i < endMonths && salesEnd - i >= salesStart + launchMonths; i++) {
    revenue[salesEnd - i] = salesTotal * 0.10;
    allocated += salesTotal * 0.10;
  }
  // Mid: distribute remaining equally
  const remaining = salesTotal - allocated;
  if (midMonths > 0) {
    const monthly = remaining / midMonths;
    for (let i = 0; i < midMonths; i++) {
      const m = salesStart + launchMonths + i;
      if (!revenue[m]) {
        revenue[m] = monthly;
      }
    }
  }

  return revenue;
}

// ===== FORMAT HELPERS =====

export function fmt(n: number): string {
  if (Math.abs(n) < 1) return "-";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtSigned(n: number): string {
  if (Math.abs(n) < 1) return "-";
  const formatted = Math.round(Math.abs(n)).toLocaleString("en-US");
  if (n < 0) return `(${formatted})`;
  return formatted;
}

// ===== DATE HELPERS =====

export function getMonthDate(monthNum: number, projectStart: Date): Date {
  const d = new Date(projectStart);
  d.setMonth(d.getMonth() + monthNum - 1);
  return d;
}

export function isMonthPaid(monthNum: number, projectStart: Date): boolean {
  const d = getMonthDate(monthNum, projectStart);
  d.setMonth(d.getMonth() + 1);
  return d <= new Date();
}

export function isCurrentMonth(monthNum: number, projectStart: Date): boolean {
  const d = getMonthDate(monthNum, projectStart);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
