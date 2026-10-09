import { describe, expect, it } from "vitest";
import { MAJAN_ORIGINAL_BASELINE } from "../shared/majanBaselineSnapshot";
import type {
  MajanInputs,
  MajanModelResult,
} from "../shared/majanFinanceTypes";
import {
  buildMajanCashFlowCsv,
  buildMajanReportHtml,
  buildMajanWorkbook,
  escapeMajanCsv,
} from "../client/src/lib/majanReportExport";

const inputs: MajanInputs = {
  schemaVersion: 1,
  projectId: 1,
  plot: "6457956",
  caseName: "Board discussion",
  asOf: "2026-10-09",
  horizonMonth: "2031-12",
  development: {
    buaSqft: 1_000_000,
    constructionRate: 450,
    designFee: {
      mode: "percentage",
      amount: null,
      percentage: 2.5,
      minimum: null,
    },
    supervisionFee: {
      mode: "percentage",
      amount: null,
      percentage: 2.5,
      minimum: null,
    },
    source: {
      source: "Application Snapshot",
      asOf: "2026-10-09",
      status: "recorded",
      rationale: "Original path retained",
    },
  },
  leasing: [
    {
      id: "g-retail",
      floor: "G",
      nameEn: "Retail",
      nameAr: "تجزئة",
      areaSqft: 10_000,
      treatment: "leased",
      annualRentPsf: 223,
      rentRule: "base",
      annualSalesPsf: null,
      turnoverPct: null,
      openingMonth: "2029-12",
      initialOccupancyPct: 40,
      stabilisedOccupancyPct: 90,
      rampMonths: 24,
      rentFreeMonths: 3,
      escalationPct: 2,
      collectionPct: 98,
      collectionLagMonths: 1,
      source: {
        source: "Colliers Draft V.02",
        asOf: "2026-09-14",
        status: "assumption",
        rationale: "Illustrative group assumption",
      },
    },
  ],
  opex: [
    {
      id: "utilities",
      nameEn: "Utilities",
      nameAr: "المرافق",
      mode: "per_gla",
      value: 10,
      escalationPct: 2,
      recoverablePct: 80,
      recoveryCollectionPct: 95,
      source: {
        source: "Operating planning allowance",
        asOf: "2026-10-09",
        status: "assumption",
        rationale: "Editable allowance",
      },
    },
  ],
  operations: {
    openingMonth: "2029-12",
    maintenanceCapexAnnual: 1_500_000,
    capexEscalationPct: 2,
    reserveAnnual: 500_000,
    reserveReleaseAnnual: 0,
    cashTaxAnnual: 0,
    taxRationale: "Pre-tax planning only",
    otherIncomeAnnual: 0,
    vatMode: "excluded_net_model",
    source: {
      source: "Operating planning allowance",
      asOf: "2026-10-09",
      status: "assumption",
      rationale: "Editable allowance",
    },
  },
  finance: {
    enabled: false,
    status: "terms_pending",
    structure: "istisna_forward_ijara",
    lender: "",
    commitment: null,
    financeSharePct: null,
    profitRatePct: null,
    drawStartMonth: "2027-04",
    drawEndMonth: "2029-09",
    repaymentStartMonth: "2029-12",
    repaymentMonths: null,
    repaymentMode: "level_payment",
    constructionProfit: "capitalise",
    arrangementFeePct: 1,
    dsraMonths: 6,
    targetDscr: 1.3,
    balloonPct: 0,
    eligibleCategories: ["construction"],
    source: {
      source: "Owner editable scenario",
      asOf: "2026-10-09",
      status: "assumption",
      rationale: "No finance selected",
    },
  },
  notes: "=Never execute a spreadsheet formula",
};

const result = {
  version: "majan-model-1",
  inputHash: "a".repeat(64),
  generatedAt: "2026-10-09T00:00:00.000Z",
  development: {
    periods: ["2029-12"],
    uses: [100],
    rows: [
      {
        id: "row-1",
        category: "construction",
        nameEn: "Construction",
        nameAr: "إنشاء",
        total: 555_794_315.7425,
        taggedPaid: 0,
        monthly: [100],
      },
    ],
    totalCost: 555_794_315.7425,
    taggedPaid: 65_100_000,
    constructionCost: 450_000_000,
    designFee: 11_250_000,
    supervisionFee: 11_250_000,
    issues: [],
    baselineDelta: 0,
  },
  leasing: {
    months: [
      {
        period: "2029-12",
        potentialRent: 1000,
        billedRent: 1000,
        collectedRent: 980,
        openingAr: 0,
        closingAr: 20,
        badDebt: 0,
        opex: 100,
        serviceChargeBilled: 80,
        serviceChargeCollected: 76,
        cashNoi: 956,
        capex: 125,
        reserveDeposit: 42,
        reserveRelease: 0,
        restrictedCash: 42,
        cashTax: 0,
        otherIncome: 0,
        cfads: 789,
      },
    ],
    issues: [],
    totalGla: 10_000,
    blendedRentPsf: 223,
    floorGla: { G: 10_000 },
  },
  financing: {
    months: [
      {
        period: "2029-12",
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
        ownerContribution: 100,
        ownerDistribution: 0,
        cumulativeOwnerContribution: 65_100_100,
        unleveredNet: 689,
        fundedNet: 689,
        fundingGap: 0,
      },
    ],
    issues: [],
    totalDraw: 0,
    totalProfit: 0,
    totalFees: 0,
    closingBalance: 0,
    peakOwnerFunding: 65_100_100,
    minDscr: null,
    financeComplete: true,
    maturityMonth: null,
  },
  annual: [
    {
      year: "2029",
      developmentUses: 100,
      billedRent: 1000,
      collectedRent: 980,
      opex: 100,
      recoveries: 76,
      cashNoi: 956,
      cfads: 789,
      draw: 0,
      profit: 0,
      capital: 0,
      debtService: 0,
      closingBalance: 0,
      dscr: null,
      ownerContribution: 100,
      ownerDistribution: 0,
    },
  ],
  issues: [
    {
      code: "PRETAX",
      severity: "warning",
      field: "operations.cashTaxAnnual",
      messageEn: "Pre-tax planning input.",
      messageAr: "مدخل تخطيطي قبل الضريبة.",
    },
  ],
  checks: [
    {
      code: "BASE",
      status: "pass",
      messageEn: "Base schedule retained.",
      messageAr: "تم الاحتفاظ بالجدول الأساسي.",
    },
  ],
  sensitivity: [
    {
      nameEn: "Base",
      nameAr: "الأساسي",
      rentChangePct: 0,
      occupancyChangePp: 0,
      annualCfads: 789,
      annualDscr: null,
    },
  ],
} as MajanModelResult;

describe("Majan report exports", () => {
  it("builds a complete English financial report without Q&A labels", () => {
    const html = buildMajanReportHtml(
      inputs,
      MAJAN_ORIGINAL_BASELINE,
      result,
      "en"
    );
    expect(html).toContain(
      "Majan Commercial Center — Indicative Financial Discussion Report"
    );
    expect(html).toContain("555,794,316");
    expect(html).toContain("DRAFT / INDICATIVE — NOT BANK-APPROVED TERMS");
    expect(html).toContain("Colliers Draft V.02");
    expect(html).not.toContain("Question:");
    expect(html).not.toContain("Answer:");
    expect(html).toContain("not a financing offer");
    expect(html).toContain("Stabilised DSCR");
    expect(html).toContain("Stabilised debt service");
  });

  it("keeps all input values printable and splits wide tables into readable panels", () => {
    const html = buildMajanReportHtml(inputs, MAJAN_ORIGINAL_BASELINE, result, "en");
    const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)];
    expect(tables.length).toBeGreaterThan(15);
    for (const table of tables) {
      const header = table[1].match(/<thead>([\s\S]*?)<\/thead>/)![1];
      expect([...header.matchAll(/<th>/g)].length).toBeLessThanOrEqual(6);
    }
    expect(html).toContain('<td>development.constructionRate</td><td>Development › constructionRate</td><td>450</td>');
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain("Supporting schedules");
    expect(html.indexOf("Annual summary")).toBeLessThan(html.indexOf("Complete editable input audit</h2>"));
  });

  it("keeps Arabic and English financial values on the same DTO while localising their report language", () => {
    const english = buildMajanReportHtml(
      inputs,
      MAJAN_ORIGINAL_BASELINE,
      result,
      "en"
    );
    const arabic = buildMajanReportHtml(
      inputs,
      MAJAN_ORIGINAL_BASELINE,
      result,
      "ar"
    );
    expect(english).toContain(result.inputHash);
    expect(arabic).toContain(result.inputHash);
    expect(english).toContain("Retail");
    expect(arabic).toContain("تجزئة");
    expect(english).toContain("AED");
    expect(arabic).toContain("مسودة / تقديري");
    expect(arabic).not.toContain("Question:");
  });

  it("exports readable monthly CSV columns and protects untrusted formula text", () => {
    const csv = buildMajanCashFlowCsv(result, "en");
    const [header, row] = csv.split("\r\n");
    expect(header).toBe(
      "Period,Development uses (AED),Billed rent (AED),Collected rent (AED),Cash OPEX (AED),Recoveries collected (AED),CFADS pre-tax indicative (AED),Facility draw (AED),Profit / rental paid (AED),Capital paid (AED),Debt service (AED),Closing economic balance (AED),DSCR (x),Owner contribution (AED)"
    );
    expect(row).toBe("2029-12,100,1000,980,100,76,789,0,0,0,0,0,,100");
    expect(escapeMajanCsv("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeMajanCsv(-123.5)).toBe("-123.5");
    expect(escapeMajanCsv("plain note")).toBe("plain note");
  });

  it("accepts saved metadata and keeps zero-payment DSCR as N/A with one issue row per code and field", () => {
    const duplicateIssueResult: MajanModelResult = {
      ...result,
      issues: [
        ...result.issues,
        { ...result.issues[0] },
      ],
    };
    const html = buildMajanReportHtml(
      inputs,
      MAJAN_ORIGINAL_BASELINE,
      duplicateIssueResult,
      "en",
      { saved: true, revision: 7, savedAt: "2026-10-09T12:00:00.000Z" }
    );
    expect(html).toContain("Saved snapshot");
    expect(html).toContain("r7");
    expect(html).toContain("finance.balloonPct");
    expect(html).toContain("Eligible categories");
    expect(html).toContain(">N/A</td>");
    expect((html.match(/Pre-tax planning input\./g) || [])).toHaveLength(1);
  });

  it("builds an editable audited workbook with the required support tabs and source comments", async () => {
    const workbook: any = await buildMajanWorkbook(
      { ...inputs, finance: { ...inputs.finance, enabled: true } },
      MAJAN_ORIGINAL_BASELINE,
      { ...result, annual: [{ ...result.annual[0], year: "2032", dscr: 1.2, debtService: 100 }], financing: { ...result.financing, minDscr: 1.2 } },
      "en",
      { saved: true, revision: 4, savedAt: "2026-10-09T12:00:00.000Z" }
    );
    expect(workbook.SheetNames).toEqual(expect.arrayContaining([
      "Summary", "Inputs", "Leasing", "OPEX", "MonthlyCashFlow", "Financing",
      "Annual", "SourcesChecks", "Sensitivity", "ArchivedBaseline", "InputAudit", "OperatingBridge",
    ]));
    const audit = workbook.Sheets.InputAudit;
    const auditValues = Object.values(audit).map((cell: any) => cell?.v);
    expect(auditValues).toContain("finance.balloonPct");
    expect(auditValues).toContain("operations.vatMode");
    const commentedInput = Object.values(audit).find((cell: any) => cell?.v === 1) as any;
    expect(commentedInput?.c?.[0]?.t).toContain("input path:");
    expect(audit.E9.s.font.color.rgb).toBe("0000FF");
    expect(workbook.Sheets.Summary.D18.z).not.toContain("x");
    expect(workbook.Sheets.Summary.D19.z).toContain("x");
    expect(workbook.Sheets.Summary.C22.v).toBe("Stabilised DSCR");
    const leasing = workbook.Sheets.Leasing;
    expect(leasing.K9.z).toContain("%");
    expect(leasing.M9.z).toContain("%");
    expect(leasing.N9.z).toContain("%");
    expect(leasing.Q9.z).toContain("%");
    expect(leasing.R9.z).toContain("%");
    expect(leasing.L9.z ?? "").not.toContain("%");
    expect(leasing.P9.z ?? "").not.toContain("%");
    expect(workbook.Sheets.Sensitivity.D9.z).toContain("%");
    expect(workbook.Sheets.Sensitivity.E9.z).not.toContain("%");
  });
});
