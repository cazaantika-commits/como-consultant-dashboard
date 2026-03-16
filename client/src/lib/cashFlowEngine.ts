/**
 * Cash Flow Engine — Dynamic Expense Distribution (4-Phase Structure)
 * 
 * Phase 1: "land"         — المبالغ المدفوعة (الأرض)
 * Phase 2: "design"       — التصاميم والموافقات
 * Phase 3: "offplan"      — تسجيل أوف بلان (always 2 months)
 * Phase 4: "construction" — الإنشاء
 * Phase 5: "handover"     — التسليم
 * 
 * Key rules:
 *  - offplan duration = always 2 months
 *  - offplan cannot start before month 3 of design phase
 *  - Developer fee: 30% design, 10% offplan, 60% construction
 *  - Marketing: 25% offplan, 75% construction (75% first 4mo, 25% next 6mo)
 *  - Contractor advance: month 1 of construction
 */

// ===== TYPES =====

export type ExpenseBehavior = 
  | "FIXED_ABSOLUTE"
  | "FIXED_RELATIVE"
  | "DISTRIBUTED"
  | "PERIODIC"
  | "SALES_LINKED"
  | "CUSTOM";

export type PhaseType = "land" | "design" | "offplan" | "construction" | "handover";

// Legacy type for backward compatibility
export type LegacyPhaseType = "land" | "preCon" | "construction" | "handover";

export interface PhaseConfig {
  type: PhaseType;
  label: string;
  duration: number;
  startMonth: number;
}

export interface ExpenseItem {
  id: string;
  name: string;
  total: number;
  behavior: ExpenseBehavior;
  phase: PhaseType;
  relativeMonth?: number;
  distributeAcross?: PhaseType[];
  splitRatio?: { phase: PhaseType; ratio: number }[];
  periodicInterval?: number;
  periodicAmount?: number;
  multiPayments?: { phase: PhaseType; relativeMonth: number; amount: number }[];
  customDistribution?: { phase: PhaseType; months: number; ratio: number }[];
  salesPercentage?: number;
  table: "investor" | "escrow";
  overrides?: { [month: number]: number };
  shiftMonths?: number;
}

export interface PhaseDurations {
  design: number;       // was preCon
  offplan: number;      // always 2
  construction: number;
  handover: number;
}

// Legacy interface for backward compatibility
export interface LegacyPhaseDurations {
  preCon: number;
  construction: number;
  handover: number;
}

export const DEFAULT_DURATIONS: PhaseDurations = {
  design: 6,
  offplan: 2,
  construction: 16,
  handover: 2,
};

export function legacyToNewDurations(legacy: LegacyPhaseDurations): PhaseDurations {
  return {
    design: legacy.preCon,
    offplan: 2,
    construction: legacy.construction,
    handover: legacy.handover,
  };
}

// ===== PHASE CALCULATION =====

export function calculatePhases(durations: PhaseDurations, offplanDelay = 0): PhaseConfig[] {
  const designStart = 1;
  const designEnd = designStart + durations.design - 1;
  const offplanEarliestStart = designStart + 2; // after 2 months of design
  const offplanStart = offplanEarliestStart + offplanDelay;
  const constructionStart = designEnd + 1;
  const constructionEnd = constructionStart + durations.construction - 1;
  const handoverStart = constructionEnd + 1;

  return [
    { type: "land", label: "شراء الأرض", duration: 0, startMonth: 0 },
    { type: "design", label: "التصاميم والموافقات", duration: durations.design, startMonth: designStart },
    { type: "offplan", label: "تسجيل أوف بلان", duration: durations.offplan, startMonth: offplanStart },
    { type: "construction", label: "الإنشاء", duration: durations.construction, startMonth: constructionStart },
    { type: "handover", label: "التسليم", duration: durations.handover, startMonth: handoverStart },
  ];
}

export function getTotalMonths(durations: PhaseDurations): number {
  // offplan overlaps with design in normal flow, so total = design + construction + handover
  return durations.design + durations.construction + durations.handover;
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
      break;
    }

    case "FIXED_RELATIVE": {
      if (item.multiPayments) {
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
      for (let m = range.start + interval - 1; m <= range.end; m += interval) {
        const shifted = m + shift;
        if (shifted >= 1 && shifted <= totalMonths) {
          result[shifted] = (result[shifted] || 0) + amount;
        }
      }
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
      // Custom distribution for marketing with weighted month blocks
      if (item.customDistribution) {
        for (const block of item.customDistribution) {
          const range = getPhaseMonthRange(phases, block.phase);
          if (range.start === 0 && range.end === 0) continue;
          const blockTotal = item.total * block.ratio;

          if (block.phase === "offplan") {
            const phaseConfig = phases.find(p => p.type === block.phase);
            if (!phaseConfig || phaseConfig.duration === 0) continue;
            const monthly = blockTotal / phaseConfig.duration;
            for (let m = range.start; m <= range.end; m++) {
              const shifted = m + shift;
              if (shifted >= 1 && shifted <= totalMonths) {
                result[shifted] = (result[shifted] || 0) + monthly;
              }
            }
          } else {
            // Construction: first N months or next N months
            const isFirstBlock = block.ratio === 0.75 * 0.75; // 56.25%
            const blockStart = isFirstBlock ? range.start : range.start + 4;
            const blockEnd = isFirstBlock
              ? Math.min(range.start + block.months - 1, range.end)
              : Math.min(blockStart + block.months - 1, range.end);

            const actualMonths = blockEnd - blockStart + 1;
            if (actualMonths <= 0) continue;
            const monthly = blockTotal / actualMonths;
            for (let m = blockStart; m <= blockEnd; m++) {
              const shifted = m + shift;
              if (shifted >= 1 && shifted <= totalMonths) {
                result[shifted] = (result[shifted] || 0) + monthly;
              }
            }
          }
        }
      }
      // Apply overrides for legacy custom items (contingency, gov_fees)
      if (item.overrides) {
        for (const [mStr, val] of Object.entries(item.overrides)) {
          const m = parseInt(mStr);
          if (m >= 1 && m <= totalMonths) {
            result[m] = val;
          }
        }
      }
      break;
    }
  }

  // Apply overrides (user manual edits) for non-CUSTOM behaviors
  if (item.behavior !== "CUSTOM" && item.overrides) {
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

  // Opening balance
  if (includeOpening) {
    quarters.push({ label: "رصيد افتتاحي", months: [], phase: "opening", phaseLabel: "الرصيد الافتتاحي" });
  }

  const totalMonths = getTotalMonths(durations);

  // Build a month -> phase mapping, handling overlaps
  // offplan months take priority over design months when they overlap
  const offplanRange = getPhaseMonthRange(phases, "offplan");
  const designRange = getPhaseMonthRange(phases, "design");
  
  // Collect all phases except land in order
  const orderedPhases = phases.filter(p => p.type !== "land");
  if (includeOpening) {
    // escrow skips design phase entirely
    orderedPhases.splice(orderedPhases.findIndex(p => p.type === "design"), 1);
  }
  
  // Track which months have been assigned
  const assignedMonths = new Set<number>();
  
  // First pass: assign offplan months (they take priority in overlaps)
  if (offplanRange.start > 0) {
    for (let m = offplanRange.start; m <= offplanRange.end; m++) {
      assignedMonths.add(m);
    }
  }
  
  // Build quarters in chronological order
  // Design months (excluding offplan overlap)
  if (!includeOpening && designRange.start > 0) {
    const designPhase = phases.find(p => p.type === "design")!;
    for (let m = designRange.start; m <= designRange.end; m++) {
      if (!assignedMonths.has(m)) {
        quarters.push({
          label: formatMonth(m),
          months: [m],
          phase: "design",
          phaseLabel: designPhase.label,
        });
      } else if (m === offplanRange.start) {
        // Insert offplan months here (chronological position)
        const offplanPhase = phases.find(p => p.type === "offplan")!;
        for (let om = offplanRange.start; om <= offplanRange.end; om++) {
          quarters.push({
            label: formatMonth(om),
            months: [om],
            phase: "offplan",
            phaseLabel: offplanPhase.label,
          });
        }
      }
    }
    // If offplan starts after design ends, add offplan months separately
    if (offplanRange.start > designRange.end) {
      const offplanPhase = phases.find(p => p.type === "offplan")!;
      for (let m = offplanRange.start; m <= offplanRange.end; m++) {
        quarters.push({
          label: formatMonth(m),
          months: [m],
          phase: "offplan",
          phaseLabel: offplanPhase.label,
        });
      }
    }
  }
  
  // Construction and handover months
  for (const phase of orderedPhases) {
    if (phase.type === "design" || phase.type === "offplan") continue;
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

export const CONSTRUCTION_COST = 39427980;
export const SALES_VALUE = 93765000;

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
  const c = costs;
  const constructionCost = c ? c.constructionCost : CONSTRUCTION_COST;

  return [
    // ═══ المرحلة 1: الأرض (المبالغ المدفوعة) ═══
    {
      id: "land_cost", name: "سعر الأرض",
      total: c ? c.landPrice : 18000000,
      behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor",
    },
    {
      id: "land_broker", name: "عمولة وسيط الأرض (1%)",
      total: c ? c.agentCommissionLand : 180000,
      behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor",
    },
    {
      id: "land_registration", name: "رسوم تسجيل الأرض (4%)",
      total: c ? c.landRegistration : 720000,
      behavior: "FIXED_ABSOLUTE", phase: "land", table: "investor",
    },

    // ═══ المرحلة 2: التصاميم والموافقات ═══
    {
      id: "soil_test", name: "فحص التربة",
      total: c ? c.soilTestFee : 25000,
      behavior: "FIXED_RELATIVE", phase: "design", relativeMonth: 1, table: "investor",
    },
    {
      id: "survey", name: "المسح الطبوغرافي",
      total: c ? c.topographicSurveyFee : 8000,
      behavior: "FIXED_RELATIVE", phase: "design", relativeMonth: 1, table: "investor",
    },
    // أتعاب المطور: 30% تصاميم، 10% أوف بلان، 60% إنشاء
    {
      id: "developer_fee", name: "أتعاب المطور (5%)",
      total: c ? c.developerFee : 4688250,
      behavior: "DISTRIBUTED", phase: "design",
      splitRatio: [
        { phase: "design", ratio: 0.3 },
        { phase: "offplan", ratio: 0.1 },
        { phase: "construction", ratio: 0.6 },
      ],
      table: "investor",
    },
    {
      id: "design_fee", name: "أتعاب التصميم (2%)",
      total: c ? c.designFee : 788559.6,
      behavior: "DISTRIBUTED", phase: "design", distributeAcross: ["design"], table: "investor",
    },

    // ═══ المرحلة 3: تسجيل أوف بلان ═══
    {
      id: "fraz_fee", name: "رسوم الفرز (40 د/قدم²)",
      total: c ? c.separationFee : 2033044.4,
      behavior: "FIXED_RELATIVE", phase: "offplan", relativeMonth: 1, table: "investor",
    },
    {
      id: "rera_registration", name: "تسجيل بيع على الخارطة - ريرا",
      total: c ? c.reraProjectRegFee : 150000,
      behavior: "FIXED_RELATIVE", phase: "offplan", relativeMonth: 1, table: "investor",
    },
    {
      id: "rera_units", name: "تسجيل الوحدات - ريرا",
      total: c ? c.reraUnitRegFee : 39100,
      behavior: "FIXED_RELATIVE", phase: "offplan", relativeMonth: 1, table: "investor",
    },
    {
      id: "surveyor_fee", name: "رسوم المساح",
      total: c ? c.surveyorFees : 24000,
      behavior: "FIXED_RELATIVE", phase: "offplan",
      multiPayments: [
        { phase: "offplan", relativeMonth: 1, amount: (c ? c.surveyorFees : 24000) / 2 },
        { phase: "handover", relativeMonth: 1, amount: (c ? c.surveyorFees : 24000) / 2 },
      ],
      table: "investor",
    },
    {
      id: "noc_fee", name: "رسوم NOC للبيع",
      total: c ? c.developerNocFee : 22000,
      behavior: "FIXED_RELATIVE", phase: "offplan",
      multiPayments: [
        { phase: "offplan", relativeMonth: 1, amount: (c ? c.developerNocFee : 22000) * 0.45 },
        { phase: "handover", relativeMonth: 1, amount: (c ? c.developerNocFee : 22000) * 0.55 },
      ],
      table: "investor",
    },
    {
      id: "escrow_fee", name: "رسوم حساب الضمان",
      total: c ? c.escrowAccountFee : 140000,
      behavior: "FIXED_RELATIVE", phase: "offplan", relativeMonth: 1, table: "investor",
    },
    {
      id: "community_fee", name: "رسوم المجتمع",
      total: c ? c.communityFees : 16000,
      behavior: "FIXED_RELATIVE", phase: "offplan", relativeMonth: 2, table: "investor",
    },
    {
      id: "bank_fees", name: "رسوم بنكية",
      total: c ? c.bankFees : 20000,
      behavior: "DISTRIBUTED", phase: "construction",
      distributeAcross: ["construction", "handover"], table: "investor",
    },
    // إيداع حساب الضمان (20% من تكلفة الإنشاء)
    {
      id: "escrow_deposit", name: "إيداع حساب الضمان (20%)",
      total: constructionCost * 0.20,
      behavior: "FIXED_RELATIVE", phase: "offplan", relativeMonth: 2, table: "investor",
    },

    // ═══ المرحلة 4: الإنشاء ═══
    // دفعة مقدمة للمقاول — الشهر الأول من الإنشاء
    {
      id: "contractor_advance", name: "دفعة مقدمة للمقاول (10%)",
      total: constructionCost * 0.10,
      behavior: "FIXED_RELATIVE", phase: "construction", relativeMonth: 1, table: "investor",
    },
    {
      id: "contingency", name: "احتياطي وطوارئ (2%)",
      total: c ? c.contingencies : 788559.6,
      behavior: "DISTRIBUTED", phase: "construction", distributeAcross: ["construction"], table: "investor",
    },
    // التسويق والإعلان: 25% أوف بلان، 75% إنشاء (75% أول 4 شهور، 25% الـ 6 التالية)
    {
      id: "marketing", name: "التسويق والإعلان (2%)",
      total: c ? c.marketingCost : 1875300,
      behavior: "CUSTOM", phase: "offplan",
      customDistribution: [
        { phase: "offplan", months: 2, ratio: 0.25 },
        { phase: "construction", months: 4, ratio: 0.75 * 0.75 },
        { phase: "construction", months: 6, ratio: 0.75 * 0.25 },
      ],
      table: "investor",
    },
  ];
}

export function getEscrowExpenses(costs?: ProjectCosts): ExpenseItem[] {
  const c = costs;
  const constructionCost = c ? c.constructionCost : CONSTRUCTION_COST;

  return [
    {
      id: "gov_fees", name: "رسوم الجهات الحكومية",
      total: c ? c.officialBodiesFees : 1000000,
      behavior: "CUSTOM", phase: "construction", table: "escrow",
    },
    {
      id: "contractor_payments", name: "دفعات المقاول (85%)",
      total: constructionCost * 0.85,
      behavior: "DISTRIBUTED", phase: "construction",
      distributeAcross: ["construction"], table: "escrow",
    },
    {
      id: "supervision_fee", name: "أتعاب الإشراف (2%)",
      total: c ? c.supervisionFee : 788559.6,
      behavior: "DISTRIBUTED", phase: "construction",
      distributeAcross: ["construction"], table: "escrow",
    },
    {
      id: "sales_agent", name: "عمولة وكيل المبيعات (5%)",
      total: c ? c.salesCommission : 4688250,
      behavior: "SALES_LINKED", phase: "construction", table: "escrow",
    },
    {
      id: "rera_audit", name: "تقارير تدقيق ريرا",
      total: c ? c.reraAuditReportFee : 18000,
      behavior: "PERIODIC", phase: "construction",
      periodicInterval: 3,
      periodicAmount: c ? Math.round(c.reraAuditReportFee / 6) : 3000,
      table: "escrow",
    },
    {
      id: "rera_inspection", name: "تقارير تفتيش ريرا",
      total: c ? c.reraInspectionReportFee : 105000,
      behavior: "PERIODIC", phase: "construction",
      periodicInterval: 3,
      periodicAmount: c ? Math.round(c.reraInspectionReportFee / 6) : 15000,
      table: "escrow",
    },
  ];
}

// Default custom distributions (for CUSTOM behavior items without customDistribution)
export function getDefaultCustomDistribution(
  itemId: string,
  phases: PhaseConfig[],
  durations: PhaseDurations,
  costs?: ProjectCosts
): { [month: number]: number } {
  const conRange = getPhaseMonthRange(phases, "construction");

  if (itemId === "contingency") {
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
    const govTotal = costs ? costs.officialBodiesFees : 1000000;
    if (govTotal === 0) return {};
    const result: { [month: number]: number } = {};
    const initialPayment = govTotal * 0.8;
    result[conRange.start + 2] = initialPayment;
    const remaining = govTotal - initialPayment;
    const interval = Math.max(1, Math.floor((conRange.end - conRange.start - 2) / 3));
    const remainingMonths: number[] = [];
    for (let m = conRange.start + 2 + interval; m <= conRange.end; m += interval) {
      remainingMonths.push(m);
    }
    if (remainingMonths.length > 0) {
      const perMonth = remaining / remainingMonths.length;
      remainingMonths.forEach(m => { result[m] = perMonth; });
    } else {
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

  const salesStart = conRange.start + 2;
  const salesEnd = handoverRange.end;
  const totalSalesMonths = salesEnd - salesStart + 1;

  if (totalSalesMonths <= 0) return revenue;

  const launchMonths = 2;
  const endMonths = 2;
  const midMonths = totalSalesMonths - launchMonths - endMonths;

  let allocated = 0;
  for (let i = 0; i < launchMonths && salesStart + i <= salesEnd; i++) {
    revenue[salesStart + i] = salesTotal * 0.10;
    allocated += salesTotal * 0.10;
  }
  for (let i = 0; i < endMonths && salesEnd - i >= salesStart + launchMonths; i++) {
    revenue[salesEnd - i] = salesTotal * 0.10;
    allocated += salesTotal * 0.10;
  }
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
