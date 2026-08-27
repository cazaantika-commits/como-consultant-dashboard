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

function amount(value: number) {
  return new Intl.NumberFormat("ar-AE", { maximumFractionDigits: 0 }).format(Math.abs(value));
}

function monthLabel(monthDate: string) {
  const [year, month] = monthDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function greeting(member: OpeningMember) {
  const laylaIntroduction = "أنا ليلى، مساعدتك في مركز القيادة.";
  if (member.memberId === "sheikh_issa") return `حياك الله يا شيخ عيسى. ${laylaIntroduction} هذا ملخص القرار السريع.`;
  if (member.memberId === "wael") return `أهلاً وائل. ${laylaIntroduction} هذا ملخص المتابعة التشغيلي السريع.`;
  return `أهلاً ${member.nameAr}. ${laylaIntroduction} هذا ملخص مركز القيادة السريع.`;
}

/**
 * Presentation-only speech text. All figures and counts are copied from the
 * read-only Command Center snapshot and the completed Unified Group report.
 */
export function buildLaylaOpeningBriefing(
  member: OpeningMember,
  operations: LaylaOpeningOperations,
  report?: UnifiedGroupCashFlow | null,
): string {
  const parts: string[] = [greeting(member)];

  if (operations.urgentTasks > 0) {
    parts.push(`هناك ${operations.urgentTasks} مهام عاجلة ضمن ${operations.openTasks} مهام مفتوحة.`);
  } else if (operations.openTasks > 0) {
    parts.push(`هناك ${operations.openTasks} مهام مفتوحة للمتابعة.`);
  }
  if (operations.pendingPayments > 0) parts.push(`وتوجد ${operations.pendingPayments} طلبات صرف معلقة ضمن نطاق صلاحيتك.`);
  if (operations.pendingRequests > 0) parts.push(`كما توجد ${operations.pendingRequests} طلبات تحتاج متابعة.`);
  if (operations.decisions > 0) parts.push(`وهناك ${operations.decisions} قرارات ظاهرة للمراجعة.`);
  if (operations.evaluations > 0) parts.push(`ولدينا ${operations.evaluations} جلسات تقييم قائمة.`);
  if (operations.followUpProjects.length > 0) parts.push(`المشاريع ذات المتابعة: ${operations.followUpProjects.slice(0, 2).join(" و")}.`);

  if (report) {
    const liquidity = buildUnifiedGroupLiquidity(report, { horizon: 3 });
    if (liquidity.summary.required > 0) {
      const peak = liquidity.peakKind === "required" ? liquidity.peakMonth : undefined;
      parts.push(`خلال الأشهر الثلاثة القادمة، التمويل المطلوب ${amount(liquidity.summary.required)} درهم.${peak ? ` وأعلى ضغط في ${monthLabel(peak.monthDate)} بقيمة ${amount(peak.required)} درهم.` : ""}`);
    } else if (liquidity.summary.returned > 0) {
      parts.push(`خلال الأشهر الثلاثة القادمة، صافي المبالغ المستلمة ${amount(liquidity.summary.returned)} درهم.`);
    }
  }

  if (parts.length === 1) parts.push("لا توجد عناصر عاجلة ظاهرة حاليًا في السجلات المعتمدة.");
  return parts.join(" ");
}
