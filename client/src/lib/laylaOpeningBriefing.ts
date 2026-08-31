import { buildUnifiedGroupLiquidity, type UnifiedGroupCashFlow } from "@/lib/unifiedGroupCashFlow";

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
const MAX_BRIEFING_POINTS = 2;

function amount(value: number) {
  return new Intl.NumberFormat("ar-AE", { maximumFractionDigits: 0 }).format(Math.abs(value));
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

/**
 * Short presentation-only speech text. Every fact is copied from the read-only
 * Command Center snapshot or the approved Unified Group cash-flow report.
 */
export function buildLaylaOpeningBriefing(
  member: OpeningMember,
  operations: LaylaOpeningOperations,
  report?: UnifiedGroupCashFlow | null,
): string {
  const priorities: string[] = [];

  if (operations.urgentTasks > 0) {
    priorities.push(`لديك ${operations.urgentTasks} مهام عاجلة من أصل ${operations.openTasks} مهام مفتوحة.`);
  }
  if (operations.pendingPayments > 0) {
    priorities.push(`وهناك ${operations.pendingPayments} طلبات صرف معلقة ضمن صلاحيتك.`);
  }
  if (operations.pendingRequests > 0) {
    priorities.push(`وهناك ${operations.pendingRequests} طلبات تحتاج متابعة.`);
  }

  if (report) {
    const liquidity = buildUnifiedGroupLiquidity(report, { horizon: 3 });
    if (liquidity.summary.required > 0) {
      const peak = liquidity.peakKind === "required" ? liquidity.peakMonth : undefined;
      priorities.push(`التمويل المطلوب خلال الأشهر الثلاثة القادمة ${amount(liquidity.summary.required)} درهم${peak ? `، وأعلى ضغط في ${monthLabel(peak.monthDate)}` : ""}.`);
    } else if (liquidity.summary.returned > 0) {
      priorities.push(`صافي المبالغ المستلمة خلال الأشهر الثلاثة القادمة ${amount(liquidity.summary.returned)} درهم.`);
    }
  }

  if (priorities.length === 0 && operations.decisions > 0) {
    priorities.push(`يوجد ${operations.decisions} قرارات ظاهرة للمراجعة.`);
  }
  if (priorities.length === 0 && operations.evaluations > 0) {
    priorities.push(`يوجد ${operations.evaluations} جلسات تقييم قائمة.`);
  }
  if (priorities.length === 0) priorities.push("لا توجد عناصر عاجلة ظاهرة حاليًا.");

  return [greeting(member), ...priorities.slice(0, MAX_BRIEFING_POINTS)].join(" ");
}
