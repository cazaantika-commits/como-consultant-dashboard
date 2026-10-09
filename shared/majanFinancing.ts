import type {
  DevelopmentResult,
  FinanceMonth,
  FinanceResult,
  LeasingResult,
  MajanInputs,
  ModelIssue,
} from "./majanFinanceTypes";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type FacilityTerms = {
  commitment: number;
  financeShare: number;
  monthlyProfitRate: number;
  repaymentMonths: number;
  balloonFraction: number;
};

type BasePeriod = {
  period: string;
  baseUse: number;
  eligibleUse: number;
  cfads: number | null;
};

function issue(
  code: string,
  severity: ModelIssue["severity"],
  field: string,
  messageEn: string,
  messageAr: string,
): ModelIssue {
  return { code, severity, field, messageEn, messageAr };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

function monthSerial(value: string): number {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function addMonths(value: string, count: number): string {
  const serial = monthSerial(value) + count;
  const year = Math.floor(serial / 12);
  const month = (serial % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function zeroOrNull(value: number | null): number | null {
  return value === null ? null : Math.abs(value) < 1e-9 ? 0 : value;
}

function sum(values: Array<number | null>): number | null {
  if (values.some(value => value === null || !isFiniteNumber(value))) return null;
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function isEligibleCategory(category: string, eligibleCategories: string[]): boolean {
  const normalized = category.trim().toLocaleLowerCase();
  return eligibleCategories.some(eligible => normalized === eligible.trim().toLocaleLowerCase());
}

function basePeriods(
  inputs: MajanInputs,
  development: DevelopmentResult,
  leasing: LeasingResult,
  issues: ModelIssue[],
): BasePeriod[] {
  const periods = Array.from(
    new Set([
      ...development.periods.filter(isValidMonth),
      ...leasing.months.map(month => month.period).filter(isValidMonth),
    ]),
  ).sort();

  if (periods.length === 0) {
    issues.push(
      issue(
        "FINANCE_NO_PERIODS",
        "error",
        "periods",
        "No valid monthly periods were supplied by the base schedules.",
        "لم تُوفَّر فترات شهرية صالحة من الجداول الأساسية.",
      ),
    );
    return [];
  }

  const developmentUseByPeriod = new Map<string, number>();
  development.periods.forEach((period, index) => {
    if (!isValidMonth(period)) return;
    const amount = development.uses[index];
    if (!isFiniteNumber(amount) || amount < 0) {
      issues.push(
        issue(
          "FINANCE_INVALID_BASE_USE",
          "error",
          `development.uses.${index}`,
          `Base development use for ${period} is not a finite non-negative amount.`,
          `استخدام التطوير الأساسي للفترة ${period} ليس مبلغاً موجباً أو صفراً صالحاً.`,
        ),
      );
      return;
    }
    developmentUseByPeriod.set(period, amount);
  });

  // An explicit empty selection means no use is eligible; default inputs provide
  // construction/design/supervision explicitly when that is the intended case.
  const eligibleCategories = inputs.finance.eligibleCategories;
  const eligibleUseByPeriod = new Map<string, number>();
  development.rows.forEach(row => {
    if (!isEligibleCategory(row.category, eligibleCategories)) return;
    row.monthly.forEach((amount, index) => {
      const period = development.periods[index];
      if (!isValidMonth(period)) return;
      if (!isFiniteNumber(amount) || amount < 0) {
        issues.push(
          issue(
            "FINANCE_INVALID_ELIGIBLE_USE",
            "error",
            `development.rows.${row.id}.monthly.${index}`,
            `Eligible development use for ${period} is not a finite non-negative amount.`,
            `استخدام التطوير المؤهل للفترة ${period} ليس مبلغاً محدوداً موجباً أو صفراً.`,
          ),
        );
        return;
      }
      eligibleUseByPeriod.set(period, (eligibleUseByPeriod.get(period) ?? 0) + amount);
    });
  });

  const cfadsByPeriod = new Map<string, number | null>();
  leasing.months.forEach(month => {
    if (!isValidMonth(month.period)) return;
    cfadsByPeriod.set(month.period, isFiniteNumber(month.cfads) ? month.cfads : null);
  });

  return periods.map(period => ({
    period,
    baseUse: developmentUseByPeriod.get(period) ?? 0,
    eligibleUse: eligibleUseByPeriod.get(period) ?? 0,
    cfads: cfadsByPeriod.has(period) ? (cfadsByPeriod.get(period) ?? null) : null,
  }));
}

function validateFacilityTerms(inputs: MajanInputs, periods: BasePeriod[]): { terms: FacilityTerms | null; issues: ModelIssue[] } {
  const finance = inputs.finance;
  const issues: ModelIssue[] = [];
  if (finance.status !== "indicative") {
    issues.push(
      issue(
        "FINANCE_STATUS_NOT_CALCULABLE",
        "error",
        "finance.status",
        "Facility economics require a complete Indicative status; terms_pending does not infer facility terms.",
        "تتطلب اقتصاديات المنشأة حالة إرشادية مكتملة؛ ولا تستنتج حالة الشروط المعلقة شروط المنشأة.",
      ),
    );
  }
  const required = [
    ["commitment", finance.commitment],
    ["financeSharePct", finance.financeSharePct],
    ["profitRatePct", finance.profitRatePct],
    ["repaymentMonths", finance.repaymentMonths],
  ] as const;

  required.forEach(([field, value]) => {
    if (value === null) {
      issues.push(
        issue(
          "FINANCE_TERM_MISSING",
          "error",
          `finance.${field}`,
          `${field} is required for an Indicative finance calculation.`,
          `${field} مطلوب لاحتساب تمويل إرشادي.`,
        ),
      );
    } else if (!isFiniteNumber(value) || value < 0) {
      issues.push(
        issue(
          "FINANCE_TERM_INVALID",
          "error",
          `finance.${field}`,
          `${field} must be a finite non-negative number.`,
          `يجب أن يكون ${field} رقماً موجباً أو صفراً ومحدوداً.`,
        ),
      );
    }
  });

  const percentageTerms = [
    ["financeSharePct", finance.financeSharePct],
    ["arrangementFeePct", finance.arrangementFeePct],
    ["balloonPct", finance.balloonPct],
  ] as const;
  percentageTerms.forEach(([field, value]) => {
    if (!isFiniteNumber(value) || value < 0 || value > 100) {
      issues.push(
        issue(
          "FINANCE_PERCENT_OUT_OF_RANGE",
          "error",
          `finance.${field}`,
          `${field} must be between 0% and 100%.`,
          `يجب أن تكون ${field} بين 0٪ و100٪.`,
        ),
      );
    }
  });

  const nonNegativeTerms = [
    ["arrangementFeePct", finance.arrangementFeePct],
    ["dsraMonths", finance.dsraMonths],
  ] as const;
  nonNegativeTerms.forEach(([field, value]) => {
    if (!isFiniteNumber(value) || value < 0) {
      issues.push(
        issue(
          "FINANCE_TERM_INVALID",
          "error",
          `finance.${field}`,
          `${field} must be a finite non-negative value.`,
          `يجب أن تكون ${field} قيمة محدودة موجبة أو صفراً.`,
        ),
      );
    }
  });

  if (finance.targetDscr !== null && (!isFiniteNumber(finance.targetDscr) || finance.targetDscr < 0)) {
    issues.push(
      issue(
        "FINANCE_TARGET_DSCR_INVALID",
        "error",
        "finance.targetDscr",
        "Target DSCR must be a finite non-negative analytical input when supplied.",
        "يجب أن يكون هدف تغطية خدمة الدين، عند إدخاله، قيمة تحليلية محدودة موجبة أو صفراً.",
      ),
    );
  }

  if (!isFiniteNumber(finance.profitRatePct) || finance.profitRatePct < 0) {
    // Already captured above; this branch keeps the type narrowing below explicit.
  } else if (finance.profitRatePct > 100) {
    issues.push(
      issue(
        "FINANCE_PROFIT_RATE_REVIEW",
        "warning",
        "finance.profitRatePct",
        "The annual profit rate exceeds 100%; review the indicative assumption.",
        "يتجاوز معدل الربح السنوي 100٪؛ يرجى مراجعة الافتراض الإرشادي.",
      ),
    );
  }

  if (!Number.isInteger(finance.repaymentMonths) || (finance.repaymentMonths ?? 0) < 1 || (finance.repaymentMonths ?? 0) > 360) {
    issues.push(
      issue(
        "FINANCE_REPAYMENT_MONTHS_INVALID",
        "error",
        "finance.repaymentMonths",
        "Repayment months must be an integer from 1 to 360.",
        "يجب أن تكون أشهر السداد عدداً صحيحاً من 1 إلى 360.",
      ),
    );
  }

  if (!Number.isInteger(finance.dsraMonths) || finance.dsraMonths < 0 || finance.dsraMonths > 360) {
    issues.push(
      issue(
        "FINANCE_DSRA_MONTHS_INVALID",
        "error",
        "finance.dsraMonths",
        "DSRA months must be an integer from 0 to 360.",
        "يجب أن تكون أشهر حساب احتياطي خدمة الدين عدداً صحيحاً من 0 إلى 360.",
      ),
    );
  }

  const dateFields = [
    ["drawStartMonth", finance.drawStartMonth],
    ["drawEndMonth", finance.drawEndMonth],
    ["repaymentStartMonth", finance.repaymentStartMonth],
  ] as const;
  dateFields.forEach(([field, value]) => {
    if (!isValidMonth(value)) {
      issues.push(
        issue(
          "FINANCE_DATE_INVALID",
          "error",
          `finance.${field}`,
          `${field} must use YYYY-MM.`,
          `يجب أن يستخدم ${field} صيغة YYYY-MM.`,
        ),
      );
    }
  });

  if (dateFields.every(([, value]) => isValidMonth(value))) {
    if (finance.drawStartMonth > finance.drawEndMonth) {
      issues.push(
        issue(
          "FINANCE_DRAW_RANGE_INVALID",
          "error",
          "finance.drawEndMonth",
          "Draw end must not precede draw start.",
          "لا يجوز أن يسبق انتهاء السحب بداية السحب.",
        ),
      );
    }
    if (finance.drawEndMonth >= finance.repaymentStartMonth) {
      issues.push(
        issue(
          "FINANCE_DRAW_AFTER_REPAYMENT_UNSUPPORTED",
          "error",
          "finance.repaymentStartMonth",
          "Draws on or after repayment start are not supported by this fixed repayment schedule.",
          "السحوبات في أو بعد بدء السداد غير مدعومة في جدول السداد الثابت هذا.",
        ),
      );
    }
  }

  if (!issues.some(item => item.severity === "error")) {
    const lastPeriod = periods.at(-1)?.period;
    const maturityMonth = addMonths(finance.repaymentStartMonth, (finance.repaymentMonths ?? 1) - 1);
    if (lastPeriod && maturityMonth > lastPeriod && (finance.commitment ?? 0) > 0 && (finance.financeSharePct ?? 0) > 0) {
      issues.push(
        issue(
          "FINANCE_HORIZON_BEFORE_MATURITY",
          "warning",
          "horizonMonth",
          `The report horizon ends before the calculated maturity (${maturityMonth}); any closing balance is not fully repaid in this view.`,
          `ينتهي أفق التقرير قبل تاريخ الاستحقاق المحسوب (${maturityMonth})؛ وأي رصيد ختامي لا يظهر مسدداً بالكامل في هذا العرض.`,
        ),
      );
    }
  }

  if (issues.some(item => item.severity === "error")) return { terms: null, issues };

  return {
    terms: {
      commitment: finance.commitment ?? 0,
      financeShare: (finance.financeSharePct ?? 0) / 100,
      monthlyProfitRate: (finance.profitRatePct ?? 0) / 1200,
      repaymentMonths: finance.repaymentMonths ?? 1,
      balloonFraction: finance.balloonPct / 100,
    },
    issues,
  };
}

function unleveredNet(cfads: number | null, baseUse: number): number | null {
  return cfads === null ? null : cfads - baseUse;
}

function zeroFacilityMonth(period: BasePeriod, ownerOpening: number | null, taggedPaid: number): FinanceMonth {
  const unlevered = unleveredNet(period.cfads, period.baseUse);
  const ownerContribution = unlevered === null ? null : Math.max(-unlevered, 0);
  const ownerDistribution = unlevered === null ? null : Math.max(unlevered, 0);
  const cumulativeOwnerContribution = ownerOpening === null || ownerContribution === null
    ? null
    : ownerOpening + ownerContribution;

  return {
    period: period.period,
    openingBalance: 0,
    draw: 0,
    profitCapitalised: 0,
    profitPaid: 0,
    capitalPaid: 0,
    totalPayment: 0,
    closingBalance: 0,
    fee: 0,
    dsraDeposit: 0,
    dsraRelease: 0,
    dsraBalance: 0,
    dscr: null,
    ownerContribution,
    ownerDistribution,
    cumulativeOwnerContribution: cumulativeOwnerContribution ?? (ownerOpening === 0 ? taggedPaid : null),
    unleveredNet: unlevered,
    fundedNet: unlevered,
    fundingGap: ownerContribution,
  };
}

function incompleteFacilityMonth(period: BasePeriod): FinanceMonth {
  return {
    period: period.period,
    openingBalance: null,
    draw: null,
    profitCapitalised: null,
    profitPaid: null,
    capitalPaid: null,
    totalPayment: null,
    closingBalance: null,
    fee: null,
    dsraDeposit: null,
    dsraRelease: null,
    dsraBalance: null,
    dscr: null,
    ownerContribution: null,
    ownerDistribution: null,
    cumulativeOwnerContribution: null,
    unleveredNet: unleveredNet(period.cfads, period.baseUse),
    fundedNet: null,
    fundingGap: null,
  };
}

function levelPayment(openingBalance: number, balloonBalance: number, rate: number, months: number): number {
  if (openingBalance <= 0 || months <= 0) return 0;
  if (rate === 0) return (openingBalance - balloonBalance) / months;
  const discount = Math.pow(1 + rate, -months);
  return (openingBalance - balloonBalance * discount) * rate / (1 - discount);
}

/**
 * Calculates an analytical, structure-neutral Islamic-finance overlay. It is not a
 * term sheet, facility approval, Shari'ah opinion, payment record, or legal exposure.
 */
export function calculateMajanFinance(
  inputs: MajanInputs,
  development: DevelopmentResult,
  leasing: LeasingResult,
): FinanceResult {
  const issues: ModelIssue[] = [];
  const periods = basePeriods(inputs, development, leasing, issues);
  const taggedPaid = isFiniteNumber(development.taggedPaid) && development.taggedPaid >= 0
    ? development.taggedPaid
    : 0;

  if (taggedPaid > 0) {
    issues.push(
      issue(
        "OWNER_TAGGED_PAID_NOT_VERIFIED_EQUITY",
        "warning",
        "development.taggedPaid",
        "The system-tagged paid amount is carried as a pre-period recorded owner-funding assumption; it is not independent payment or equity evidence.",
        "يُحمل المبلغ الموسوم في النظام كمدفوع كافتراض تمويل مالك مسجل قبل الفترة؛ ولا يُعد دليلاً مستقلاً على السداد أو حقوق الملكية.",
      ),
    );
  }

  if (!inputs.finance.enabled) {
    issues.push(
      issue(
        inputs.finance.status === "terms_pending"
          ? "FINANCE_TERMS_PENDING_NO_OVERLAY"
          : "FINANCE_NONE_NO_OVERLAY",
        "info",
        "finance.status",
        inputs.finance.status === "terms_pending"
          ? "Facility terms are pending. No facility cash flows have been assumed and the unlevered view remains unchanged."
          : "No finance overlay is selected. Facility cash flows are zero and the unlevered view remains unchanged.",
        inputs.finance.status === "terms_pending"
          ? "شروط التمويل قيد الانتظار. لم يُفترض أي تدفق نقدي للمنشأة ويظل العرض غير الممول دون تغيير."
          : "لم تُحدد طبقة تمويل. تدفقات المنشأة النقدية تساوي صفراً ويظل العرض غير الممول دون تغيير.",
      ),
    );
    let cumulative: number | null = taggedPaid;
    const months = periods.map(period => {
      const month = zeroFacilityMonth(period, cumulative, taggedPaid);
      cumulative = month.cumulativeOwnerContribution;
      return month;
    });
    const peakOwnerFunding = months.every(month => month.cumulativeOwnerContribution !== null)
      ? Math.max(taggedPaid, ...months.map(month => month.cumulativeOwnerContribution ?? 0))
      : null;
    return {
      months,
      issues,
      totalDraw: 0,
      totalProfit: 0,
      totalFees: 0,
      closingBalance: 0,
      peakOwnerFunding,
      minDscr: null,
      financeComplete: true,
      maturityMonth: null,
    };
  }

  issues.push(
    issue(
      "FINANCE_INDICATIVE_NOT_APPROVED",
      "info",
      "finance.status",
      "This is an analytical Indicative facility overlay. It is not bank-approved terms, a covenant, a legal contract, or a Shari'ah opinion.",
      "هذه طبقة تمويل إرشادية تحليلية. وليست شروطاً معتمدة من بنك أو تعهداً أو عقداً قانونياً أو رأياً شرعياً.",
    ),
  );
  issues.push(
    issue(
      "FINANCE_LEGAL_EXPOSURE_NOT_DETERMINED",
      "warning",
      "finance.structure",
      "The economic finance balance does not determine legal or contractual exposure for the selected Islamic structure.",
      "الرصيد الاقتصادي للتمويل لا يحدد التعرض القانوني أو التعاقدي للهيكل الإسلامي المختار.",
    ),
  );

  const validation = validateFacilityTerms(inputs, periods);
  issues.push(...validation.issues);
  if (!validation.terms || issues.some(item => item.severity === "error")) {
    return {
      months: periods.map(incompleteFacilityMonth),
      issues,
      totalDraw: null,
      totalProfit: null,
      totalFees: null,
      closingBalance: null,
      peakOwnerFunding: null,
      minDscr: null,
      financeComplete: false,
      maturityMonth: null,
    };
  }

  const terms = validation.terms;
  const finance = inputs.finance;
  const maturityMonth = addMonths(finance.repaymentStartMonth, terms.repaymentMonths - 1);
  let balance = 0;
  let grossDrawn = 0;
  let firstDrawOccurred = false;
  let repaymentOpeningBalance: number | null = null;
  let fixedLevelPayment = 0;

  const months: FinanceMonth[] = periods.map(period => {
    const openingBalance = balance;
    const isDrawPeriod = period.period >= finance.drawStartMonth && period.period <= finance.drawEndMonth;
    const isBeforeRepayment = period.period < finance.repaymentStartMonth;
    const isRepaymentPeriod = period.period >= finance.repaymentStartMonth && period.period <= maturityMonth;
    const isMaturity = period.period === maturityMonth;

    let draw = 0;
    if (isDrawPeriod && grossDrawn < terms.commitment) {
      draw = Math.min(period.eligibleUse * terms.financeShare, terms.commitment - grossDrawn);
      grossDrawn += draw;
    }

    const profitBase = isDrawPeriod ? openingBalance + draw / 2 : openingBalance;
    const accruedProfit = Math.max(profitBase * terms.monthlyProfitRate, 0);
    let profitCapitalised = 0;
    let profitPaid = 0;
    if (isBeforeRepayment) {
      if (finance.constructionProfit === "capitalise") profitCapitalised = accruedProfit;
      else profitPaid = accruedProfit;
    } else if (isRepaymentPeriod) {
      profitPaid = accruedProfit;
    }

    let balanceBeforePrincipal = openingBalance + draw + profitCapitalised;
    let capitalPaid = 0;
    if (isRepaymentPeriod) {
      if (repaymentOpeningBalance === null) {
        repaymentOpeningBalance = balanceBeforePrincipal;
        const balloonBalance = repaymentOpeningBalance * terms.balloonFraction;
        fixedLevelPayment = levelPayment(
          repaymentOpeningBalance,
          balloonBalance,
          terms.monthlyProfitRate,
          terms.repaymentMonths,
        );
      }

      if (isMaturity) {
        // A final explicit settlement avoids a hidden residual, including a balloon.
        capitalPaid = balanceBeforePrincipal;
      } else if (finance.repaymentMode === "equal_principal") {
        capitalPaid = Math.max(
          0,
          (repaymentOpeningBalance * (1 - terms.balloonFraction)) / terms.repaymentMonths,
        );
      } else if (finance.repaymentMode === "level_payment") {
        capitalPaid = Math.max(0, fixedLevelPayment - profitPaid);
      }
      capitalPaid = Math.min(capitalPaid, balanceBeforePrincipal);
    }

    balance = zeroOrNull(balanceBeforePrincipal - capitalPaid) ?? 0;
    const fee = draw > 0 && !firstDrawOccurred
      ? terms.commitment * (finance.arrangementFeePct / 100)
      : 0;
    if (draw > 0) firstDrawOccurred = true;

    return {
      period: period.period,
      openingBalance: zeroOrNull(openingBalance),
      draw: zeroOrNull(draw),
      profitCapitalised: zeroOrNull(profitCapitalised),
      profitPaid: zeroOrNull(profitPaid),
      capitalPaid: zeroOrNull(capitalPaid),
      totalPayment: zeroOrNull(profitPaid + capitalPaid),
      closingBalance: zeroOrNull(balance),
      fee: zeroOrNull(fee),
      dsraDeposit: 0,
      dsraRelease: 0,
      dsraBalance: 0,
      dscr: null,
      ownerContribution: null,
      ownerDistribution: null,
      cumulativeOwnerContribution: null,
      unleveredNet: null,
      fundedNet: null,
      fundingGap: null,
    };
  });

  const lastDrawIndex = months.reduce<number>((last, month, index) => (month.draw ?? 0) > 0 ? index : last, -1);
  const repaymentIndex = months.findIndex(month => month.period === finance.repaymentStartMonth);
  const maturityIndex = months.findIndex(month => month.period === maturityMonth);
  const dsraBuildIndex = lastDrawIndex >= 0 && repaymentIndex >= 0
    ? Math.min(lastDrawIndex, repaymentIndex)
    : lastDrawIndex >= 0
      ? lastDrawIndex
      : -1;

  if (finance.dsraMonths > 0 && dsraBuildIndex >= 0 && maturityIndex > dsraBuildIndex) {
    const upcomingService = months
      .slice(dsraBuildIndex)
      .filter(month => (month.totalPayment ?? 0) > 0)
      .slice(0, finance.dsraMonths);
    const deposit = upcomingService.reduce((total, month) => total + (month.totalPayment ?? 0), 0);
    months[dsraBuildIndex]!.dsraDeposit = zeroOrNull(deposit);
  }

  let dsraBalance = 0;
  months.forEach((month, index) => {
    const deposit = month.dsraDeposit ?? 0;
    const release = index === maturityIndex ? dsraBalance + deposit : 0;
    dsraBalance = zeroOrNull(dsraBalance + deposit - release) ?? 0;
    month.dsraRelease = zeroOrNull(release);
    month.dsraBalance = zeroOrNull(dsraBalance);
  });

  let cumulativeOwnerContribution: number | null = taggedPaid;
  months.forEach((month, index) => {
    const period = periods[index]!;
    const unlevered = unleveredNet(period.cfads, period.baseUse);
    const debtService = month.totalPayment ?? 0;
    month.unleveredNet = unlevered;
    month.dscr = period.cfads === null || debtService <= 0
      ? null
      : zeroOrNull(period.cfads / debtService);

    if (period.cfads === null) {
      month.fundedNet = null;
      month.ownerContribution = null;
      month.ownerDistribution = null;
      month.fundingGap = null;
      cumulativeOwnerContribution = null;
      month.cumulativeOwnerContribution = null;
      return;
    }

    const fundedNet = period.cfads
      - period.baseUse
      - debtService
      - (month.fee ?? 0)
      - (month.dsraDeposit ?? 0)
      + (month.dsraRelease ?? 0)
      + (month.draw ?? 0);
    const ownerContribution = Math.max(-fundedNet, 0);
    const ownerDistribution = Math.max(fundedNet, 0);
    cumulativeOwnerContribution = cumulativeOwnerContribution === null
      ? null
      : cumulativeOwnerContribution + ownerContribution;

    month.fundedNet = zeroOrNull(fundedNet);
    month.ownerContribution = zeroOrNull(ownerContribution);
    month.ownerDistribution = zeroOrNull(ownerDistribution);
    month.fundingGap = zeroOrNull(ownerContribution);
    month.cumulativeOwnerContribution = zeroOrNull(cumulativeOwnerContribution);
  });

  const finalBalance = months.at(-1)?.closingBalance ?? 0;
  if ((finalBalance ?? 0) > 1e-6) {
    issues.push(
      issue(
        "FINANCE_OUTSTANDING_AT_HORIZON",
        "warning",
        "horizonMonth",
        `Economic finance balance of ${finalBalance!.toFixed(2)} remains at the report horizon; this view must not be labelled fully repaid.`,
        `يبقى رصيد تمويل اقتصادي قدره ${finalBalance!.toFixed(2)} عند أفق التقرير؛ ولا يجوز وصف هذا العرض بأنه مسدد بالكامل.`,
      ),
    );
  }
  if (months.some(month => (month.closingBalance ?? 0) > terms.commitment + 1e-6)) {
    issues.push(
      issue(
        "FINANCE_CAPITALISED_EXPOSURE_ABOVE_COMMITMENT",
        "warning",
        "finance.commitment",
        "Capitalised profit has increased economic finance exposure above funded gross commitment; draw principal remains capped, but legal exposure is not determined.",
        "زاد الربح المرسمل التعرض الاقتصادي للتمويل فوق الالتزام الإجمالي الممول؛ يظل أصل السحب مقيداً بالسقف، لكن التعرض القانوني غير محدد.",
      ),
    );
  }

  const totalDraw = sum(months.map(month => month.draw));
  const totalProfit = sum(months.map(month => (month.profitCapitalised ?? 0) + (month.profitPaid ?? 0)));
  const totalFees = sum(months.map(month => month.fee));
  const peakOwnerFunding = months.every(month => month.cumulativeOwnerContribution !== null)
    ? Math.max(taggedPaid, ...months.map(month => month.cumulativeOwnerContribution ?? 0))
    : null;
  const calculatedDscr = months
    .map(month => month.dscr)
    .filter((value): value is number => isFiniteNumber(value));
  const minDscr = calculatedDscr.length > 0 ? Math.min(...calculatedDscr) : null;
  if (finance.targetDscr !== null && minDscr !== null && minDscr + 1e-9 < finance.targetDscr) {
    issues.push(
      issue(
        "INDICATIVE_DSCR_BELOW_TARGET",
        "warning",
        "finance.targetDscr",
        `Indicative monthly minimum DSCR of ${minDscr.toFixed(3)}x is below the entered analytical target of ${finance.targetDscr.toFixed(3)}x. This is not an official covenant and may reflect lease-up timing.`,
        `الحد الأدنى الشهري الإرشادي لتغطية خدمة الدين البالغ ${minDscr.toFixed(3)} مرة أقل من الهدف التحليلي المدخل البالغ ${finance.targetDscr.toFixed(3)} مرة. ليس ذلك تعهداً رسمياً وقد يعكس توقيت التأجير التدريجي.`,
      ),
    );
  }
  const financeComplete = (finalBalance ?? 0) <= 1e-6 && (maturityIndex >= 0 || totalDraw === 0);

  return {
    months,
    issues,
    totalDraw,
    totalProfit,
    totalFees,
    closingBalance: finalBalance,
    peakOwnerFunding,
    minDscr,
    financeComplete,
    maturityMonth,
  };
}
