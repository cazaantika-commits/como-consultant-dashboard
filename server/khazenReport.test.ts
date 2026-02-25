import { describe, it, expect } from "vitest";

// Replicate the report-building logic from FactSheetPage.tsx for unit testing
const FACT_SHEET_KEYS = [
  "titleDeedNumber", "ddaNumber", "masterDevRef",
  "plotAreaSqm", "plotAreaSqft", "gfaSqm", "gfaSqft",
  "permittedUse", "ownershipType", "subdivisionRestrictions",
  "masterDevName", "masterDevAddress",
  "sellerName", "sellerAddress",
  "buyerName", "buyerNationality", "buyerPassport", "buyerAddress", "buyerPhone", "buyerEmail",
  "electricityAllocation", "waterAllocation", "sewageAllocation",
  "tripAM", "tripLT", "tripPM",
  "effectiveDate", "constructionPeriod", "constructionStartDate", "completionDate", "constructionConditions",
  "saleRestrictions", "resaleConditions", "communityCharges",
  "registrationAuthority", "adminFee", "clearanceFee", "compensationAmount",
  "governingLaw", "disputeResolution",
];

const FIELD_LABELS: Record<string, string> = {
  titleDeedNumber: "رقم سند الملكية", ddaNumber: "رقم DDA", masterDevRef: "الرقم المرجعي للمطور",
  plotNumber: "رقم القطعة", areaCode: "كود المنطقة",
  plotAreaSqm: "مساحة الأرض (م²)", plotAreaSqft: "مساحة الأرض (قدم²)",
  gfaSqm: "GFA (م²)", gfaSqft: "GFA (قدم²)", bua: "BUA",
  permittedUse: "الاستخدام المسموح", ownershipType: "نوع الملكية", subdivisionRestrictions: "قيود التقسيم",
  masterDevName: "اسم المطور الرئيسي", masterDevAddress: "عنوان المطور الرئيسي",
  sellerName: "اسم البائع", sellerAddress: "عنوان البائع",
  buyerName: "اسم المشتري", buyerNationality: "جنسية المشتري", buyerPassport: "جواز المشتري",
  buyerAddress: "عنوان المشتري", buyerPhone: "هاتف المشتري", buyerEmail: "إيميل المشتري",
  electricityAllocation: "تخصيص الكهرباء", waterAllocation: "تخصيص المياه", sewageAllocation: "تخصيص الصرف",
  tripAM: "رحلات صباحية", tripLT: "رحلات ظهيرة", tripPM: "رحلات مسائية",
  effectiveDate: "تاريخ السريان", constructionPeriod: "فترة البناء",
  constructionStartDate: "تاريخ بدء البناء", completionDate: "تاريخ الانتهاء",
  constructionConditions: "شروط البناء",
  saleRestrictions: "قيود البيع", resaleConditions: "شروط إعادة البيع", communityCharges: "رسوم المجتمع",
  registrationAuthority: "جهة التسجيل", adminFee: "الرسوم الإدارية",
  clearanceFee: "رسوم المخالصة", compensationAmount: "مبلغ التعويض",
  governingLaw: "القانون الحاكم", disputeResolution: "آلية حل النزاعات",
};

/**
 * Build the Khazen auto-fill report by comparing before/after snapshots.
 * This mirrors the logic in FactSheetPage.tsx handleKhazenAutoFill.
 */
function buildKhazenReport(
  beforeData: Record<string, any>,
  afterData: Record<string, any>
) {
  const beforeSnapshot: Record<string, boolean> = {};
  for (const key of FACT_SHEET_KEYS) {
    beforeSnapshot[key] = !!(beforeData[key] && String(beforeData[key]).trim() !== "");
  }
  const beforeCount = Object.values(beforeSnapshot).filter(Boolean).length;

  const filledFields: string[] = [];
  const emptyFields: string[] = [];
  const newlyFilled: string[] = [];

  for (const key of FACT_SHEET_KEYS) {
    const val = afterData[key];
    const isFilled = !!(val && String(val).trim() !== "");
    if (isFilled) {
      filledFields.push(key);
      if (!beforeSnapshot[key]) {
        newlyFilled.push(key);
      }
    } else {
      emptyFields.push(key);
    }
  }

  const afterCount = filledFields.length;

  return {
    filledFields,
    emptyFields,
    newlyFilled,
    beforeCount,
    afterCount,
  };
}

/**
 * Build the Salwa notification message from a report.
 */
function buildNotificationMessage(
  projectName: string,
  report: ReturnType<typeof buildKhazenReport>
) {
  const msg = `خازن أنهى تعبئة بطاقة بيانات المشروع "${projectName}".\n` +
    `📊 النتيجة: ${report.afterCount}/${FACT_SHEET_KEYS.length} حقل مكتمل (${Math.round((report.afterCount / FACT_SHEET_KEYS.length) * 100)}%)\n` +
    `✅ حقول جديدة تم تعبئتها: ${report.newlyFilled.length}\n` +
    (report.emptyFields.length > 0 ? `⚠️ حقول لم يتم تعبئتها (${report.emptyFields.length}): ${report.emptyFields.slice(0, 5).map(k => FIELD_LABELS[k] || k).join("، ")}${report.emptyFields.length > 5 ? " وغيرها..." : ""}\n` : "") +
    (report.emptyFields.length > 0 ? `💡 السبب المحتمل: البيانات غير متوفرة في مستندات Drive أو تحتاج إدخال يدوي` : "");

  return msg;
}

describe("Khazen Auto-Fill Report Builder", () => {
  it("should detect newly filled fields when starting from empty", () => {
    const before: Record<string, any> = {};
    const after: Record<string, any> = {
      plotAreaSqm: "5000",
      plotAreaSqft: "53820",
      permittedUse: "سكني تجاري",
      masterDevName: "نخيل العقارية",
      governingLaw: "قوانين دبي",
    };

    const report = buildKhazenReport(before, after);

    expect(report.beforeCount).toBe(0);
    expect(report.afterCount).toBe(5);
    expect(report.newlyFilled).toHaveLength(5);
    expect(report.newlyFilled).toContain("plotAreaSqm");
    expect(report.newlyFilled).toContain("masterDevName");
    expect(report.emptyFields).toHaveLength(FACT_SHEET_KEYS.length - 5);
  });

  it("should detect newly filled fields when some were already filled", () => {
    const before: Record<string, any> = {
      plotAreaSqm: "5000",
      plotAreaSqft: "53820",
      permittedUse: "سكني تجاري",
    };
    const after: Record<string, any> = {
      plotAreaSqm: "5000",
      plotAreaSqft: "53820",
      permittedUse: "سكني تجاري",
      masterDevName: "نخيل العقارية",
      governingLaw: "قوانين دبي",
      sellerName: "شركة كومو",
      effectiveDate: "2024-01-15",
    };

    const report = buildKhazenReport(before, after);

    expect(report.beforeCount).toBe(3);
    expect(report.afterCount).toBe(7);
    expect(report.newlyFilled).toHaveLength(4);
    expect(report.newlyFilled).toContain("masterDevName");
    expect(report.newlyFilled).toContain("governingLaw");
    expect(report.newlyFilled).toContain("sellerName");
    expect(report.newlyFilled).toContain("effectiveDate");
    // Previously filled fields should NOT be in newlyFilled
    expect(report.newlyFilled).not.toContain("plotAreaSqm");
  });

  it("should handle all fields already filled (no new fields)", () => {
    const data: Record<string, any> = {};
    for (const key of FACT_SHEET_KEYS) {
      data[key] = "some value";
    }

    const report = buildKhazenReport(data, data);

    expect(report.beforeCount).toBe(FACT_SHEET_KEYS.length);
    expect(report.afterCount).toBe(FACT_SHEET_KEYS.length);
    expect(report.newlyFilled).toHaveLength(0);
    expect(report.emptyFields).toHaveLength(0);
  });

  it("should handle completely empty project (no fields filled)", () => {
    const report = buildKhazenReport({}, {});

    expect(report.beforeCount).toBe(0);
    expect(report.afterCount).toBe(0);
    expect(report.newlyFilled).toHaveLength(0);
    expect(report.emptyFields).toHaveLength(FACT_SHEET_KEYS.length);
  });

  it("should treat empty strings and whitespace as unfilled", () => {
    const before: Record<string, any> = {};
    const after: Record<string, any> = {
      plotAreaSqm: "",
      plotAreaSqft: "   ",
      permittedUse: "سكني",
      masterDevName: null,
      governingLaw: undefined,
    };

    const report = buildKhazenReport(before, after);

    expect(report.afterCount).toBe(1); // Only permittedUse
    expect(report.newlyFilled).toEqual(["permittedUse"]);
    expect(report.emptyFields).toContain("plotAreaSqm");
    expect(report.emptyFields).toContain("plotAreaSqft");
    expect(report.emptyFields).toContain("masterDevName");
    expect(report.emptyFields).toContain("governingLaw");
  });

  it("should count total of 40 fact sheet keys", () => {
    expect(FACT_SHEET_KEYS.length).toBe(40);
  });
});

describe("Khazen Notification Message Builder", () => {
  it("should build correct notification with partial fill", () => {
    const report = {
      filledFields: ["plotAreaSqm", "plotAreaSqft", "permittedUse", "masterDevName", "governingLaw"],
      emptyFields: FACT_SHEET_KEYS.filter(k => !["plotAreaSqm", "plotAreaSqft", "permittedUse", "masterDevName", "governingLaw"].includes(k)),
      newlyFilled: ["plotAreaSqm", "plotAreaSqft", "permittedUse", "masterDevName", "governingLaw"],
      beforeCount: 0,
      afterCount: 5,
    };

    const msg = buildNotificationMessage("ند الشبا - قطعة 1", report);

    expect(msg).toContain("ند الشبا - قطعة 1");
    expect(msg).toContain(`5/${FACT_SHEET_KEYS.length}`);
    expect(msg).toContain("حقول جديدة تم تعبئتها: 5");
    expect(msg).toContain("حقول لم يتم تعبئتها");
    expect(msg).toContain("السبب المحتمل");
  });

  it("should build notification without empty fields warning when all filled", () => {
    const allFilled = FACT_SHEET_KEYS.map(k => k);
    const report = {
      filledFields: allFilled,
      emptyFields: [],
      newlyFilled: allFilled,
      beforeCount: 0,
      afterCount: FACT_SHEET_KEYS.length,
    };

    const msg = buildNotificationMessage("الجداف", report);

    expect(msg).toContain("الجداف");
    expect(msg).toContain(`${FACT_SHEET_KEYS.length}/${FACT_SHEET_KEYS.length}`);
    expect(msg).toContain("100%");
    expect(msg).not.toContain("حقول لم يتم تعبئتها");
    expect(msg).not.toContain("السبب المحتمل");
  });

  it("should truncate empty fields list to 5 items with 'وغيرها'", () => {
    const report = {
      filledFields: ["plotAreaSqm"],
      emptyFields: FACT_SHEET_KEYS.filter(k => k !== "plotAreaSqm"),
      newlyFilled: ["plotAreaSqm"],
      beforeCount: 0,
      afterCount: 1,
    };

    const msg = buildNotificationMessage("البرشاء", report);

    expect(msg).toContain("وغيرها...");
    // Should only show 5 field labels, not all 39
    const emptyFieldsLine = msg.split("\n").find(l => l.includes("حقول لم يتم تعبئتها"));
    expect(emptyFieldsLine).toBeDefined();
  });

  it("should show percentage correctly", () => {
    const report = {
      filledFields: Array(12).fill("x"),
      emptyFields: Array(28).fill("y"),
      newlyFilled: Array(12).fill("z"),
      beforeCount: 0,
      afterCount: 12,
    };

    const msg = buildNotificationMessage("تست", report);

    expect(msg).toContain("12/40");
    expect(msg).toContain("30%");
  });
});

describe("Field Labels Coverage", () => {
  it("should have Arabic labels for all fact sheet keys", () => {
    for (const key of FACT_SHEET_KEYS) {
      expect(FIELD_LABELS[key]).toBeDefined();
      expect(FIELD_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("should have unique labels for each key", () => {
    const labels = FACT_SHEET_KEYS.map(k => FIELD_LABELS[k]);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});
