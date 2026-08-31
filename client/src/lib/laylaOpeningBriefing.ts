import { buildUnifiedGroupLiquidity, type UnifiedGroupCashFlow, type UnifiedGroupLiquidityMonth } from "@/lib/unifiedGroupCashFlow";

export type LaylaOpeningOperations = {
  generatedAt: string;
  openTasks: number;
  urgentTasks: number;
  pendingPayments: number;
  pendingRequests: number;
  decisions: number;
  evaluations: number;
  meetings: number;
  followUpProjects: string[];
};

type OpeningMember = { memberId: string; nameAr: string; role: string };

const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const SPOKEN_LIQUIDITY_HORIZON = 4;

function formatArabicInteger(value: number) {
  return new Intl.NumberFormat("ar-AE", { maximumFractionDigits: 0 }).format(value);
}

function millionCount(millions: number) {
  if (millions === 1) return "مليون";
  if (millions === 2) return "مليونين";
  if (millions >= 3 && millions <= 10) return `${formatArabicInteger(millions)} ملايين`;
  return `${formatArabicInteger(millions)} مليونًا`;
}

/**
 * Presentation-only money phrasing for speech. It rounds the spoken amount to
 * the nearest quarter million so Layla never recites long accounting digits.
 * Displayed report values and financial calculations remain exact and unchanged.
 */
export function formatLaylaApproximateAmount(value: number) {
  const absolute = Math.abs(Number(value) || 0);
  if (absolute < 0.5) return "صفر";

  if (absolute < 250_000) {
    const roundedThousands = Math.max(1, Math.round(absolute / 10_000) * 10);
    return `حوالي ${formatArabicInteger(roundedThousands)} ألف`;
  }

  const quarterMillions = Math.max(1, Math.round(absolute / 250_000));
  const millions = Math.floor(quarterMillions / 4);
  const quarterRemainder = quarterMillions % 4;

  if (millions === 0) {
    if (quarterRemainder === 1) return "حوالي ربع مليون";
    if (quarterRemainder === 2) return "حوالي نصف مليون";
    return "حوالي ثلاثة أرباع المليون";
  }

  const base = millionCount(millions);
  if (quarterRemainder === 1) return `حوالي ${base} وربع`;
  if (quarterRemainder === 2) return `حوالي ${base} ونصف`;
  if (quarterRemainder === 3) return `حوالي ${base} وثلاثة أرباع`;
  return `حوالي ${base}`;
}

function monthLabel(monthDate: string) {
  const [year, month] = monthDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function greeting(member: OpeningMember) {
  if (member.memberId === "sheikh_issa") return "حياك الله يا شيخ عيسى، أنا ليلى.";
  if (member.memberId === "wael") return "أهلاً وائل، أنا ليلى.";
  const name = member.nameAr?.trim() || "بك";
  return `أهلاً ${name}، أنا ليلى.`;
}

function describeSignedMovement(value: number) {
  if (Math.abs(value) < 0.5) return "لا حركة";
  const spokenAmount = formatLaylaApproximateAmount(value);
  return value < 0 ? `مطلوب ${spokenAmount}` : `متوقع استلام ${spokenAmount}`;
}

function describeLiquidityMonth(month: UnifiedGroupLiquidityMonth) {
  const saleInvestment = month.saleInvestmentNet;
  const commercial = month.commercialDevelopmentNet;

  if (month.total < -0.5 && saleInvestment <= 0 && commercial <= 0) {
    const total = `${formatLaylaApproximateAmount(month.total)} درهم`;
    if (Math.abs(saleInvestment) < 0.5) {
      return `في ${monthLabel(month.monthDate)}، إجمالي المطلوب ${total}، بالكامل لتطوير المركز التجاري.`;
    }
    if (Math.abs(commercial) < 0.5) {
      return `في ${monthLabel(month.monthDate)}، إجمالي المطلوب ${total}، بالكامل لمشاريع البيع والاستثمار.`;
    }
    return `في ${monthLabel(month.monthDate)}، إجمالي المطلوب ${total}؛ منه ${formatLaylaApproximateAmount(saleInvestment)} للمشاريع، و${formatLaylaApproximateAmount(commercial)} لتطوير المركز التجاري.`;
  }

  return [
    `في ${monthLabel(month.monthDate)}، إجمالي الشهر ${describeSignedMovement(month.total)} درهم.`,
    `مشاريع البيع والاستثمار: ${describeSignedMovement(month.saleInvestmentNet)}.`,
    `تطوير المركز التجاري: ${describeSignedMovement(month.commercialDevelopmentNet)}.`,
  ].join(" ");
}

function firstOperationalPriority(operations: LaylaOpeningOperations) {
  if (operations.urgentTasks > 0) {
    return `تشغيليًا، لديك ${operations.urgentTasks} مهام عاجلة من أصل ${operations.openTasks} مهام مفتوحة.`;
  }
  if (operations.pendingPayments > 0) {
    return `تشغيليًا، هناك ${operations.pendingPayments} طلبات صرف معلقة ضمن صلاحيتك.`;
  }
  if (operations.pendingRequests > 0) {
    return `تشغيليًا، هناك ${operations.pendingRequests} طلبات تحتاج متابعة.`;
  }
  if (operations.decisions > 0) return `تشغيليًا، يوجد ${operations.decisions} قرارات ظاهرة للمراجعة.`;
  if (operations.evaluations > 0) return `تشغيليًا، يوجد ${operations.evaluations} جلسات تقييم قائمة.`;
  return null;
}

/**
 * Short presentation-only speech text. Every fact is copied from the read-only
 * Command Center snapshot or the approved Unified Group cash-flow report.
 */
export function buildLaylaOpeningBriefing(
  member: OpeningMember,
  operations: LaylaOpeningOperations,
  report?: UnifiedGroupCashFlow | null,
): string {
  const briefing = [greeting(member)];

  if (report) {
    const liquidity = buildUnifiedGroupLiquidity(report, { horizon: SPOKEN_LIQUIDITY_HORIZON });
    if (liquidity.summary.required > 0) {
      briefing.push(`احتياج المجموعة خلال الأشهر الأربعة القادمة هو ${formatLaylaApproximateAmount(liquidity.summary.required)} درهم.`);
    } else if (liquidity.summary.returned > 0) {
      briefing.push(`صافي المبالغ المستلمة للمجموعة خلال الأشهر الأربعة القادمة هو ${formatLaylaApproximateAmount(liquidity.summary.returned)} درهم.`);
    }
    briefing.push(...liquidity.months.map(describeLiquidityMonth));
  }

  const operationalPriority = firstOperationalPriority(operations);
  if (operationalPriority) briefing.push(operationalPriority);
  if (briefing.length === 1) briefing.push("لا توجد عناصر عاجلة ظاهرة حاليًا.");

  return briefing.join(" ");
}
