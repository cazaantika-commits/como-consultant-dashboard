import { z } from "zod";

/** CPA storage/UI use percentage points; offer-reader JSON explicitly uses fractions. */
export function feePercentagePoints(value: unknown, unit: "PERCENT" | "FRACTION" = "PERCENT"): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > (unit === "FRACTION" ? 1 : 100)) {
    throw new Error("نسبة الأتعاب خارج الحدود أو وحدتها غير صحيحة");
  }
  return unit === "FRACTION" ? numeric * 100 : numeric;
}

/** Never infer a fraction from magnitude: 0.5 legacy percentage points means 0.5%. */
export function importedFeePercentage(value: unknown, unit: unknown): number | null {
  if (unit !== undefined && unit !== null && unit !== "PERCENT" && unit !== "FRACTION") {
    throw new Error("وحدة نسبة الأتعاب غير معروفة");
  }
  return feePercentagePoints(value, unit === "FRACTION" ? "FRACTION" : "PERCENT");
}

/** Old reviewed readers have an explicit fractional JSON contract. Convert only
 * when the latest reviewed source still matches the stored value. A later manual
 * percentage-point correction must not be overwritten by stale source evidence. */
export function storedDesignPercentage(value: unknown, reviewedExtraction: unknown): number | null {
  const stored = feePercentagePoints(value);
  if (!reviewedExtraction) return stored;
  let source: unknown;
  try { source = typeof reviewedExtraction === "string" ? JSON.parse(reviewedExtraction) : reviewedExtraction; }
  catch { return stored; }
  const parsed = z.object({ design_fee: z.object({ method: z.string(), percentage: z.number().nullable(), percentage_unit: z.enum(["FRACTION", "PERCENT"]).optional() }) }).safeParse(source);
  if (!parsed.success || parsed.data.design_fee.method !== "PERCENTAGE") return stored;
  const fee = parsed.data.design_fee;
  if (fee.percentage === null || fee.percentage_unit === "PERCENT") return stored;
  if (stored !== null && Math.abs(stored - fee.percentage) < 0.0000001) return feePercentagePoints(fee.percentage, "FRACTION");
  return stored;
}

export const EVALUATORS = ["sheikh_issa", "wael", "abdulrahman"] as const;
export const TECHNICAL_CRITERIA = [0, 1, 3, 4, 5, 6, 7, 8, 9] as const;
export type Evaluator = typeof EVALUATORS[number];
type ScoreCell = { consultantId: number; criterionId: number; evaluatorName: string; score: number | null; sessionId?: number | null };

/** Nine actual criteria per linked office per independent evaluator, one version.
 * Duplicate cells cannot fill missing cells, even when COUNT equals the target. */
export function evaluatorMatrixStatus(scores: readonly ScoreCell[], officeIds: readonly number[], evaluator: string) {
  const offices = Array.from(new Set(officeIds));
  const rows = scores.filter(row => row.evaluatorName === evaluator);
  const expected = offices.length * TECHNICAL_CRITERIA.length;
  const cells = new Map<string, ScoreCell[]>();
  for (const row of rows) {
    const key = `${row.consultantId}:${row.criterionId}`;
    cells.set(key, [...(cells.get(key) ?? []), row]);
  }
  let completed = 0;
  for (const office of offices) for (const criterion of TECHNICAL_CRITERIA) {
    const candidates = cells.get(`${office}:${criterion}`) ?? [];
    if (candidates.length === 1 && candidates[0].score !== null && Number.isInteger(candidates[0].score) && candidates[0].score >= 0 && candidates[0].score <= 100) completed++;
  }
  const versions = new Set(rows.map(row => row.sessionId ?? null));
  return { completed, total: expected, isComplete: EVALUATORS.some(name => name === evaluator) && expected > 0 && completed === expected && rows.length === expected && versions.size === 1 };
}

export function threeEvaluatorMatrixReady(scores: readonly ScoreCell[], officeIds: readonly number[], approvals: readonly { evaluatorName: string; isApproved: number }[]) {
  const versions = new Set(scores.map(row => row.sessionId ?? null));
  return versions.size === 1 && EVALUATORS.every(name => {
    const ownApprovals = approvals.filter(row => row.evaluatorName === name);
    return evaluatorMatrixStatus(scores, officeIds, name).isComplete && ownApprovals.length === 1 && ownApprovals[0].isApproved === 1;
  });
}

const snapshotSchema = z.object({ results: z.array(z.record(z.string(), z.unknown())), overrides: z.array(z.record(z.string(), z.unknown())), approvedAt: z.string().optional(), project: z.record(z.string(), z.unknown()).optional(), supervisionBaseline: z.array(z.record(z.string(), z.unknown())).optional(), scopeSourceLabel: z.string().optional() });
export function readApprovedCostSnapshot(raw: unknown) {
  let decoded: unknown;
  try { decoded = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { throw new Error("لقطة التقرير المعتمد غير صالحة؛ لا يجوز استبدالها بحساب حي"); }
  const parsed = snapshotSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("لقطة التقرير المعتمد مفقودة أو غير صالحة؛ يلزم تصحيح المصدر المعتمد");
  const ids = parsed.data.results.map(row => Number(row.project_consultant_id));
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) throw new Error("لقطة التقرير المعتمد تحتوي مكاتب مكررة أو معرفات غير صحيحة");
  return parsed.data;
}

/** Missing evidence is unresolved, even when a reference price exists. Zero is
 * allowed only as an explicit price; null/invalid prices never become zero. */
export function offerGapState(status: string, referencePrice: unknown, overridePrice?: unknown) {
  const needsGap = status !== "INCLUDED";
  const raw = overridePrice === null || overridePrice === undefined ? referencePrice : overridePrice;
  const numeric = raw === null || raw === undefined || raw === "" ? null : Number(raw);
  const gapValue = needsGap && numeric !== null && Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
  const unknownCoverage = !["INCLUDED", "EXCLUDED", "PARTIAL"].includes(status);
  return { needsGap, gapValue, unresolved: needsGap && (unknownCoverage || gapValue === null) };
}

/** Existing nine criteria/weights from the technical evaluation, not a new model. */
export const TECHNICAL_CRITERIA_DEFINITIONS = [
  { id: 0, name: "الهوية المعمارية وجودة التصميم", weight: 14.6 },
  { id: 1, name: "القدرات التقنية والتكامل مع BIM", weight: 14.6 },
  { id: 3, name: "كفاءة التخطيط وتحسين المساحات", weight: 13.6 },
  { id: 4, name: "التحكم في التكاليف والوعي بالميزانية", weight: 10.7 },
  { id: 5, name: "الخبرة في مشاريع مشابهة", weight: 9.7 },
  { id: 6, name: "قوة فريق المشروع", weight: 9.7 },
  { id: 7, name: "إدارة الوقت والانضباط بالبرنامج", weight: 9.7 },
  { id: 8, name: "الاهتمام بالمشروع", weight: 9.2 },
  { id: 9, name: "مرونة التعاقد", weight: 8.2 },
];
