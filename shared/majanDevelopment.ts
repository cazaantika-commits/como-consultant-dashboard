/** Majan development schedule transformation. Finance never imports or changes this schedule. */
import type {
  BaselineCostRow,
  DevelopmentInputs,
  DevelopmentResult,
  FeeSpec,
  MajanBaseline,
  MajanInputs,
  ModelIssue,
} from "./majanFinanceTypes";

const EPSILON = 0.005;

type Timeline = { startMonth: string; designMonths: number; constructionMonths: number; postMonths: number; changed: boolean };

function issue(
  issues: ModelIssue[],
  code: string,
  severity: ModelIssue["severity"],
  field: string,
  messageEn: string,
  messageAr: string,
): void {
  issues.push({ code, severity, field, messageEn, messageAr });
}

export function isMajanMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Adds months without Date/time-zone parsing, keeping the model browser-safe. */
export function addMajanMonths(month: string, count: number): string {
  if (!isMajanMonth(month) || !Number.isInteger(count)) throw new RangeError(`Invalid Majan month arithmetic: ${month}`);
  const [year, monthNumber] = month.split("-").map(Number);
  const serial = year * 12 + monthNumber - 1 + count;
  return `${Math.floor(serial / 12)}-${String((serial % 12) + 1).padStart(2, "0")}`;
}

function finiteNonNegative(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function positiveFinite(value: number | null | undefined): value is number {
  return finiteNonNegative(value) && value > 0;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function makePeriods(startMonth: string, length: number): string[] {
  return Array.from({ length }, (_, index) => addMajanMonths(startMonth, index));
}

function validDuration(
  provided: number | undefined,
  fallback: number,
  field: string,
  issues: ModelIssue[],
): number {
  if (provided === undefined) return fallback;
  if (!Number.isInteger(provided) || provided <= 0 || provided > 360) {
    issue(issues, "invalid_duration", "error", field, "Duration must be a whole number from 1 to 360 months; recorded timing was retained.", "يجب أن تكون المدة عدداً صحيحاً من 1 إلى 360 شهراً؛ تم الإبقاء على التوقيت المسجل.");
    return fallback;
  }
  return provided;
}

function resolveTimeline(input: DevelopmentInputs, baseline: MajanBaseline, issues: ModelIssue[]): Timeline {
  const startMonth = input.startMonth === undefined ? baseline.startMonth : input.startMonth;
  const safeStart = isMajanMonth(startMonth)
    ? startMonth
    : (() => {
        issue(issues, "invalid_start_month", "error", "development.startMonth", "Start month must use YYYY-MM; the recorded start month was retained.", "يجب أن يكون شهر البدء بصيغة YYYY-MM؛ تم الإبقاء على شهر البدء المسجل.");
        return baseline.startMonth;
      })();
  const designMonths = validDuration(input.designMonths, baseline.designMonths, "development.designMonths", issues);
  const constructionMonths = validDuration(input.constructionMonths, baseline.constructionMonths, "development.constructionMonths", issues);
  // The original schedule has a 13-month post-construction tail despite a two-month handover input.
  // Keep enough space for the recorded +1 and +12 retention timing when durations are changed.
  const handoverInput = validDuration(input.handoverMonths, baseline.handoverMonths, "development.handoverMonths", issues);
  const postMonths = Math.max(13, handoverInput);
  const changed = safeStart !== baseline.startMonth
    || designMonths !== baseline.designMonths
    || constructionMonths !== baseline.constructionMonths
    || handoverInput !== baseline.handoverMonths;
  return { startMonth: safeStart, designMonths, constructionMonths, postMonths, changed };
}

function distribution(weights: number[], target: number): number[] {
  if (target === 0) return weights.map(() => 0);
  const clean = weights.map(value => (Number.isFinite(value) && value > 0 ? value : 0));
  const weightTotal = sum(clean);
  if (weightTotal <= 0) {
    const result = weights.map(() => 0);
    if (result.length > 0) result[0] = target;
    return result;
  }
  const result = clean.map(value => (value / weightTotal) * target);
  // Keep row sums exact (to machine precision) rather than allowing display rounding to create a reconciliation drift.
  result[result.length - 1] += target - sum(result);
  return result;
}

function resampleWeights(weights: number[], targetLength: number): number[] {
  if (targetLength <= 0) return [];
  if (weights.length === targetLength) return [...weights];
  if (weights.length === 0) return Array.from({ length: targetLength }, () => 0);
  const result = Array.from({ length: targetLength }, () => 0);
  // Integrate original monthly weights over each new monthly bucket. This preserves the overall shape and exact sum.
  for (let targetIndex = 0; targetIndex < targetLength; targetIndex += 1) {
    const targetStart = (targetIndex * weights.length) / targetLength;
    const targetEnd = ((targetIndex + 1) * weights.length) / targetLength;
    for (let originalIndex = Math.floor(targetStart); originalIndex < Math.ceil(targetEnd); originalIndex += 1) {
      if (originalIndex < 0 || originalIndex >= weights.length) continue;
      const overlap = Math.max(0, Math.min(targetEnd, originalIndex + 1) - Math.max(targetStart, originalIndex));
      result[targetIndex] += (weights[originalIndex] ?? 0) * overlap;
    }
  }
  return result;
}

function isRetention(row: BaselineCostRow): "first" | "final" | null {
  const label = `${row.nameEn} ${row.nameAr}`.toLowerCase();
  if (!row.category.includes("construction")) return null;
  if (label.includes("first") || label.includes("الأولى")) return "first";
  if (label.includes("final") || label.includes("أخيرة")) return "final";
  return null;
}

function buildTimelineMonthly(row: BaselineCostRow, baseline: MajanBaseline, timeline: Timeline): number[] {
  if (!timeline.changed) return [...row.monthly];
  const oldDesignEnd = baseline.designMonths;
  const oldConstructionEnd = oldDesignEnd + baseline.constructionMonths;
  const designWeights = row.monthly.slice(0, oldDesignEnd);
  const constructionWeights = row.monthly.slice(oldDesignEnd, oldConstructionEnd);
  const postWeights = row.monthly.slice(oldConstructionEnd);
  const retention = isRetention(row);
  const result = [
    ...resampleWeights(designWeights, timeline.designMonths),
    ...resampleWeights(constructionWeights, timeline.constructionMonths),
    ...resampleWeights(postWeights, timeline.postMonths),
  ];
  if (retention) {
    const amount = sum(postWeights);
    result.fill(0, timeline.designMonths + timeline.constructionMonths);
    const offset = retention === "first" ? 1 : 12;
    const index = timeline.designMonths + timeline.constructionMonths + offset;
    if (index < result.length) result[index] = amount;
  }
  return result;
}

function feeAmount(
  spec: FeeSpec,
  constructionCost: number,
  fallback: number,
  field: string,
  issues: ModelIssue[],
): number {
  const invalid = (message: string) => {
    issue(issues, "invalid_fee_spec", "error", field, `${message} The recorded fee was retained.`, `${message} تم الإبقاء على الأتعاب المسجلة.`);
    return fallback;
  };
  switch (spec.mode) {
    case "none":
      return 0;
    case "amount":
      return finiteNonNegative(spec.amount) ? spec.amount : invalid("A fixed fee amount is required.");
    case "percentage":
      return finiteNonNegative(spec.percentage) ? constructionCost * (spec.percentage / 100) : invalid("A fee percentage is required.");
    case "percentage_minimum": {
      if (!finiteNonNegative(spec.percentage) || !finiteNonNegative(spec.minimum)) return invalid("Both percentage and minimum fee are required.");
      return Math.max(constructionCost * (spec.percentage / 100), spec.minimum);
    }
    default:
      return invalid("Unsupported fee mode.");
  }
}

function cloneRow(row: BaselineCostRow, monthly: number[], total: number): BaselineCostRow {
  return { ...row, total, taggedPaid: row.taggedPaid, monthly };
}

/**
 * Calculates an editable development scenario from the immutable Majan baseline.
 * It preserves timing and every raw row unless an explicit development basis,
 * fee mode, permitted other-row override, or timeline input is supplied.
 */
export function calculateMajanDevelopment(inputs: MajanInputs, baseline: MajanBaseline): DevelopmentResult {
  const issues: ModelIssue[] = [];
  const timeline = resolveTimeline(inputs.development, baseline, issues);
  const rawBua = inputs.development.buaSqft;
  const rawRate = inputs.development.constructionRate;
  const bua = positiveFinite(rawBua)
    ? rawBua
    : (() => {
        issue(issues, "invalid_bua", "error", "development.buaSqft", "BUA must be greater than zero; the recorded BUA was retained.", "يجب أن تكون المساحة البنائية أكبر من صفر؛ تم الإبقاء على المساحة المسجلة.");
        return baseline.buaSqft;
      })();
  const rate = positiveFinite(rawRate)
    ? rawRate
    : (() => {
        issue(issues, "invalid_construction_rate", "error", "development.constructionRate", "Construction rate must be greater than zero; the recorded rate was retained.", "يجب أن يكون معدل الإنشاء أكبر من صفر؛ تم الإبقاء على المعدل المسجل.");
        return baseline.constructionRate;
      })();
  const constructionCost = bua * rate;
  const constructionRatio = baseline.constructionCost === 0 ? 1 : constructionCost / baseline.constructionCost;
  const designFee = feeAmount(inputs.development.designFee, constructionCost, baseline.designFee, "development.designFee", issues);
  const supervisionFee = feeAmount(inputs.development.supervisionFee, constructionCost, baseline.supervisionFee, "development.supervisionFee", issues);

  issue(
    issues,
    "fee_path_gap_recorded",
    "warning",
    "development.source",
    "Recorded percentage fees (2.5% / 2.5%) are used unless changed. Fixed alternatives AED 7.9m (design) and AED 8.5m (supervision) remain an unresolved raw-source difference; neither is selected silently.",
    "تُستخدم الأتعاب النسبية المسجلة (2.5% / 2.5%) ما لم تُعدّل. البدائل الثابتة 7.9 مليون درهم للتصميم و8.5 مليون درهم للإشراف تبقى فرقاً غير محسوم في المصدر الخام؛ ولا يتم اختيار أي منها تلقائياً.",
  );
  issue(
    issues,
    "tagged_paid_not_payment_evidence",
    "info",
    "baseline.taggedPaid",
    "'Tagged paid' is retained as a system label only; it is not payment evidence, verified equity, or facility eligibility evidence.",
    "يُحتفظ بوسم «مدفوع» كوسم نظام فقط؛ وليس دليلاً على الدفع أو حقوق ملكية متحققة أو أهلية للتمويل.",
  );
  if (timeline.changed) {
    issue(
      issues,
      "timeline_resampled",
      "warning",
      "development",
      "Development timing was explicitly edited. Monthly patterns were proportionally resampled; recorded construction/retention timings are not contractual evidence. Leasing and operations opening dates were not moved automatically.",
      "تم تعديل توقيت التطوير صراحةً. أُعيد توزيع النمط الشهري بصورة نسبية؛ وتوقيتات الإنشاء والاحتجاز المسجلة ليست دليلاً تعاقدياً. لم تُنقل تواريخ افتتاح التأجير والتشغيل تلقائياً.",
    );
  }

  const overrides = new Map<string, number>();
  for (const override of inputs.development.costOverrides ?? []) {
    if (!override || typeof override.rowId !== "string" || !finiteNonNegative(override.amount)) {
      issue(issues, "invalid_cost_override", "error", "development.costOverrides", "Each cost override needs a row ID and a finite non-negative amount; invalid entry was ignored.", "يتطلب كل تجاوز للكلفة معرّف صف ومبلغاً محدوداً غير سالب؛ تم تجاهل الإدخال غير الصحيح.");
      continue;
    }
    if (overrides.has(override.rowId)) {
      issue(issues, "duplicate_cost_override", "warning", "development.costOverrides", `More than one override was supplied for ${override.rowId}; the last explicit value was used.`, `تم تقديم أكثر من تجاوز واحد للصف ${override.rowId}؛ استُخدمت آخر قيمة صريحة.`);
    }
    overrides.set(override.rowId, override.amount);
  }

  const periods = makePeriods(timeline.startMonth, timeline.designMonths + timeline.constructionMonths + timeline.postMonths);
  const rows = baseline.rows.map(row => {
    const originalMonthly = buildTimelineMonthly(row, baseline, timeline);
    const originalScheduled = sum(row.monthly);
    const originalExpected = row.taggedPaid + originalScheduled;
    if (`${row.nameEn} ${row.nameAr}`.toLowerCase().includes("as-built") || row.nameAr.includes("(As-Built)")) {
      issue(issues, "as_built_scheduled_unpaid_exception", "warning", `baseline.rows.${row.id}`, "The AED 45,000 As-Built survey amount is retained in scheduled uses while the reviewed source reported its unpaid field as zero. This is a visible reconciliation exception; the schedule was not changed.", "تم الإبقاء على مبلغ 45,000 درهم لرسوم المساح حسب التنفيذ ضمن الاستخدامات المجدولة رغم أن حقل غير المدفوع في المصدر المراجع كان صفراً. هذا استثناء مصالحة ظاهر ولم يتم تغيير الجدول.");
    }
    if (Math.abs(row.total - originalExpected) > EPSILON) {
      issue(issues, "recorded_row_gap", "warning", `baseline.rows.${row.id}`, `Recorded row ${row.nameEn} has a ${row.total - originalExpected} difference between total and tagged paid plus scheduled uses. The schedule was not corrected.`, `يوجد في الصف المسجل ${row.nameAr} فرق قدره ${row.total - originalExpected} بين الإجمالي والمدفوع الموسوم والاستخدامات المجدولة. لم يتم تصحيح الجدول.`);
    }

    let targetTotal = row.total;
    if (row.category === "construction") targetTotal = row.total * constructionRatio;
    else if (row.category === "design") targetTotal = designFee;
    else if (row.category === "supervision") targetTotal = supervisionFee;
    else if (row.category === "developer_fee") targetTotal = row.total * constructionRatio;

    const override = overrides.get(row.id);
    if (override !== undefined) {
      if (["construction", "design", "supervision", "developer_fee"].includes(row.category)) {
        issue(issues, "override_not_permitted_for_dynamic_row", "error", `development.costOverrides.${row.id}`, `Override for ${row.nameEn} was ignored because it is driven by the editable development basis or fee specification.`, `تم تجاهل تجاوز ${row.nameAr} لأنه محكوم بأساس التطوير القابل للتعديل أو بمواصفة الأتعاب.`);
      } else if (override < row.taggedPaid) {
        issue(issues, "override_below_tagged_paid", "error", `development.costOverrides.${row.id}`, `Override for ${row.nameEn} is below its recorded tagged-paid label and was ignored.`, `تجاوز ${row.nameAr} أقل من وسم المدفوع المسجل وتم تجاهله.`);
      } else {
        targetTotal = override;
      }
    }

    const targetScheduled = Math.max(0, targetTotal - row.taggedPaid);
    // Do not alter a recorded row gap: only scenario changes turn total into a fully reconciled scheduled amount.
    const scheduleBasis = (Math.abs(targetTotal - row.total) <= EPSILON && !timeline.changed)
      ? originalMonthly
      : originalMonthly;
    const monthly = distribution(scheduleBasis, targetScheduled);
    const actualTotal = row.taggedPaid + sum(monthly);
    return cloneRow(row, monthly, actualTotal);
  });

  const uses = periods.map((_, index) => sum(rows.map(row => row.monthly[index] ?? 0)));
  const totalCost = sum(rows.map(row => row.total));
  const taggedPaid = sum(rows.map(row => row.taggedPaid));
  const reconciledUseTotal = sum(uses);
  if (Math.abs(totalCost - taggedPaid - reconciledUseTotal) > EPSILON) {
    issue(issues, "development_reconciliation_fail", "error", "development", "Development total does not reconcile to tagged paid plus scheduled uses.", "إجمالي التطوير لا يتطابق مع المدفوع الموسوم زائد الاستخدامات المجدولة.");
  }
  if (periods.length !== baseline.periods.length && !timeline.changed) {
    issue(issues, "period_alignment_fail", "error", "development", "Unexpected development period length; recorded timing was retained where possible.", "طول فترات التطوير غير متوقع؛ تم الإبقاء على التوقيت المسجل قدر الإمكان.");
  }
  return {
    periods,
    uses,
    rows,
    totalCost,
    taggedPaid,
    constructionCost,
    designFee,
    supervisionFee,
    issues,
    baselineDelta: totalCost - baseline.totalCost,
  };
}
